// Orchestrierung: sichere Übernahme eines Deltas (S0 → S1) in den Hauptarbeitsbaum.
// Drei Phasen: planen (ändert nichts), sichern (Kopien außerhalb des Repositories + Journal), anwenden (Datei für Datei, bei jedem Fehler vollständig zurück).
// Stirbt der Prozess mitten im Anwenden, setzt `wiederherstellen` anhand des Journals zurück (wiederholbar). Das Dateisystem selbst ist nicht atomar –
// die Zusicherung ist „alles oder nichts, notfalls durch Wiederherstellen“.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { KONFIG, blob, sha256 } from './git.js';
import { aenderungen } from './delta.js';

export class KonfliktFehler extends Error {
  constructor(konflikte) { super(`Übernahme abgelehnt: ${konflikte.map((k) => `${k.pfad} (${k.grund})`).join('; ')}`); this.name = 'KonfliktFehler'; this.konflikte = konflikte; }
}

const istBinaer = (b) => b.includes(0);
const eolStil = (b) => { const t = b.toString('latin1'); const crlf = (t.match(/\r\n/g) ?? []).length, lf = (t.match(/(?<!\r)\n/g) ?? []).length; return crlf && !lf ? 'crlf' : lf && !crlf ? 'lf' : crlf || lf ? 'gemischt' : 'keine'; };
const gleich = (a, b) => a && b && Buffer.compare(a, b) === 0;

/** Plant die Übernahme (ändert nichts) oder wirft KonfliktFehler. Aktionen: {pfad, art: 'schreiben'|'loeschen', inhalt?, erwartet}. */
export function planen(haupt, s0, s1) {
  const aktionen = [], konflikte = [];
  for (const { status, pfad } of aenderungen(haupt, s0, s1)) {
    const abs = path.join(haupt, pfad);
    const basis = blob(haupt, s0, pfad), deren = blob(haupt, s1, pfad);
    const unser = fs.existsSync(abs) && fs.statSync(abs).isFile() ? fs.readFileSync(abs) : null;
    const vorher = aktionen.length;
    if (status === 'D') {
      if (!unser) continue;
      if (gleich(unser, basis)) aktionen.push({ pfad, art: 'loeschen' }); else konflikte.push({ pfad, grund: 'lokal geändert, Delta löscht' });
    } else if (status === 'A') {
      if (!unser) aktionen.push({ pfad, art: 'schreiben', inhalt: deren });
      else if (!gleich(unser, deren)) konflikte.push({ pfad, grund: 'lokal vorhanden und anders, Delta legt neu an' });
    } else if (!unser) konflikte.push({ pfad, grund: 'lokal gelöscht, Delta ändert' });
    else if (gleich(unser, basis)) aktionen.push({ pfad, art: 'schreiben', inhalt: deren });
    else if (gleich(unser, deren)) continue;
    else if (istBinaer(unser) || istBinaer(basis ?? Buffer.alloc(0)) || istBinaer(deren ?? Buffer.alloc(0))) konflikte.push({ pfad, grund: 'binär, beidseitig geändert' });
    else {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-merge-'));
      try {
        for (const [n, b] of [['unser', unser], ['basis', basis], ['deren', deren]]) fs.writeFileSync(path.join(tmp, n), b);
        const r = spawnSync('git', [...KONFIG, 'merge-file', '-p', 'unser', 'basis', 'deren'], { cwd: tmp, maxBuffer: 1 << 30 });
        if (r.status === 0) aktionen.push({ pfad, art: 'schreiben', inhalt: r.stdout }); else konflikte.push({ pfad, grund: r.status > 0 ? `${r.status} Konflikt(e) im Text` : 'Zusammenführen fehlgeschlagen' });
      } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    }
    // Zeilenenden: das Ergebnis darf den Stil der Basis nicht ändern
    const a = aktionen.length > vorher ? aktionen.at(-1) : null;
    if (a?.art === 'schreiben' && basis && !istBinaer(basis) && a.inhalt) {
      const vor = eolStil(basis), nach = eolStil(a.inhalt);
      if (vor !== 'keine' && nach !== 'keine' && vor !== nach) { aktionen.pop(); konflikte.push({ pfad, grund: `Zeilenenden ${vor} → ${nach}` }); }
    }
  }
  if (konflikte.length) throw new KonfliktFehler(konflikte);
  for (const a of aktionen) { const abs = path.join(haupt, a.pfad); a.erwartet = fs.existsSync(abs) ? sha256(fs.readFileSync(abs)) : null; }
  return aktionen;
}

function fehlendeOrdner(haupt, pfad) {
  const l = []; let d = path.dirname(path.join(haupt, pfad));
  while (d.length > haupt.length && !fs.existsSync(d)) { l.push(d); d = path.dirname(d); }
  return l;
}

function zurueck(journal) {
  for (const e of journal.eintraege) {
    const abs = path.join(journal.haupt, e.pfad);
    fs.rmSync(`${abs}.bw-tmp`, { force: true });
    if (e.vorher === 'datei') {
      try { fs.chmodSync(abs, 0o666); } catch { /* gibt es evtl. nicht */ }
      const t = `${abs}.bw-rest`;
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.copyFileSync(path.join(journal.sicherung, 'dateien', String(e.nr)), t);
      fs.renameSync(t, abs);
      if (e.nurLesen) fs.chmodSync(abs, 0o444);
    } else fs.rmSync(abs, { force: true });
  }
  for (const d of journal.neueOrdner) { try { fs.rmdirSync(d); } catch { /* nicht leer oder weg */ } }
}

/**
 * Wendet die Aktionen an. Bei jedem Fehler wird vollständig zurückgesetzt und der Fehler weitergereicht.
 * `vorSchritt(k, pfad)` dient nur der Fehlereinspeisung in Tests.
 */
export function anwenden(haupt, aktionen, sicherung, { vorSchritt = () => {} } = {}) {
  fs.mkdirSync(path.join(sicherung, 'dateien'), { recursive: true });
  const journal = { phase: 'sichern', haupt, sicherung, eintraege: [], neueOrdner: [] };
  const schreibe = () => fs.writeFileSync(path.join(sicherung, 'journal.json'), JSON.stringify(journal));
  schreibe();
  // Hat sich der Hauptbaum seit dem Planen verändert, wird nichts angefasst
  for (const a of aktionen) {
    const abs = path.join(haupt, a.pfad);
    const jetzt = fs.existsSync(abs) ? sha256(fs.readFileSync(abs)) : null;
    if (a.erwartet !== undefined && jetzt !== a.erwartet) { journal.phase = 'abgelehnt'; schreibe(); throw new KonfliktFehler([{ pfad: a.pfad, grund: 'seit dem Planen verändert' }]); }
  }
  const ordner = new Set();
  aktionen.forEach((a, nr) => {
    const abs = path.join(haupt, a.pfad);
    const da = fs.existsSync(abs);
    if (da) fs.copyFileSync(abs, path.join(sicherung, 'dateien', String(nr)));
    journal.eintraege.push({ nr, pfad: a.pfad, vorher: da ? 'datei' : 'fehlt', nurLesen: da && !(fs.statSync(abs).mode & 0o200) });
    for (const d of fehlendeOrdner(haupt, a.pfad)) ordner.add(d);
  });
  journal.neueOrdner = [...ordner].sort((x, y) => y.length - x.length);
  journal.phase = 'anwenden';
  schreibe();
  try {
    aktionen.forEach((a, k) => {
      vorSchritt(k, a.pfad);
      const abs = path.join(haupt, a.pfad);
      if (a.art === 'loeschen') fs.unlinkSync(abs);
      else { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(`${abs}.bw-tmp`, a.inhalt); fs.renameSync(`${abs}.bw-tmp`, abs); }
    });
    for (const a of aktionen) {
      const abs = path.join(haupt, a.pfad);
      if (a.art === 'loeschen' ? fs.existsSync(abs) : Buffer.compare(fs.readFileSync(abs), a.inhalt) !== 0) throw new Error(`Nachprüfung fehlgeschlagen: ${a.pfad}`);
    }
  } catch (f) {
    zurueck(journal);
    journal.phase = 'zurueckgesetzt'; schreibe();
    throw f;
  }
  journal.phase = 'fertig'; schreibe();
  return journal;
}

/** Nach einem Absturz: steht das Journal auf „sichern“ oder „anwenden“, wird zurückgesetzt. Wiederholbar. */
export function wiederherstellen(sicherung) {
  const datei = path.join(sicherung, 'journal.json');
  const j = JSON.parse(fs.readFileSync(datei, 'utf8'));
  if (j.phase === 'anwenden' || j.phase === 'sichern') { zurueck(j); j.phase = 'zurueckgesetzt'; fs.writeFileSync(datei, JSON.stringify(j)); return 'zurueckgesetzt'; }
  return j.phase;
}

/** Sicherungsordner mit unterbrochener Übernahme (Phase „sichern“ oder „anwenden“). */
export function offeneJournale(sicherungsWurzel) {
  if (!fs.existsSync(sicherungsWurzel)) return [];
  const l = [];
  for (const n of fs.readdirSync(sicherungsWurzel)) {
    const d = path.join(sicherungsWurzel, n), j = path.join(d, 'journal.json');
    if (!fs.existsSync(j)) continue;
    try { const phase = JSON.parse(fs.readFileSync(j, 'utf8')).phase; if (phase === 'anwenden' || phase === 'sichern') l.push(d); } catch { l.push(d); }
  }
  return l;
}

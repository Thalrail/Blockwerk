// Orchestrierung: Abschluss eines autonomen Laufs (Branch, Commit, Push, Draft-PR). Der einzige freigegebene Weg dafür; die Sperren für `git push` und `gh pr`
// in .claude/settings.json bleiben bestehen, dieses Werkzeug führt die Schritte mit festen Argumenten selbst aus (kein Shell-Text, keine frei wählbaren Optionen).
// Es gibt hier absichtlich keinen Merge, kein `ready`, kein Force, kein Löschen von Branches auf dem Remote und kein `gh api`.
// Voraussetzungen (alle vor dem ersten Schritt geprüft, sonst Status „abgelehnt“ ohne jede Änderung): autonomer Lauf mit sauberem Start, Arbeit übernommen,
// grüne Tests und gültiges, eingestuftes Review für exakt den übernommenen Codezustand, Hauptbaum byteweise gleich diesem Zustand, nur die übernommenen Dateien
// uncommittet, erlaubter Remote, eigener neuer Branch `claude/<name>`, eindeutig geprüfte PR-Basis, kein Geheimnis, keine Sicherheitsdateien.
// Scheitert ein späterer Schritt, steht das Ergebnis „blockiert“ (mit Schritt und Grund): Der Koordinator stoppt und berichtet; ein erneuter Aufruf setzt fort.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { git, gitStatus } from './git.js';
import { AUSSER, brauche, speichere, laufDir, leseZeilen, freigabeStatus, fremdeAenderungen, baumVon, vor } from './lauf.js';
import { vergleicheMitPlatte, pruefeGeheimnisse } from './schnappschuss.js';

export const GITHUB_REPO = 'Thalrail/Blockwerk';
export const ERLAUBTE_REMOTES = Object.freeze(['https://github.com/thalrail/blockwerk.git', 'https://github.com/thalrail/blockwerk', 'git@github.com:thalrail/blockwerk.git']);
export const BASIS_ZWEIG = 'main';
export const ZWEIG_PRAEFIX = 'claude/';
export const TRAILER = 'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>';
const KURZNAME = /^[a-z0-9][a-z0-9-]{2,40}$/;
const SICHERHEITSDATEIEN = [/^\.claude\//, /^\.github\//, /^tools\/orchestrierung\//, /^\.gitignore$/];
const SCHRITTE = ['branch', 'commit', 'push', 'pr'];

const abgelehnt = (grund, extra = {}) => ({ status: 'abgelehnt', grund, ...extra });
const kurz = (buf) => String(buf ?? '').trim().slice(0, 400);

function nachrichtVon(a, f, titel) {
  const t = f.tests; const rv = f.review;
  return [
    titel, '',
    `Auftrag: ${a.auftrag}`,
    `Tests: ${t.suite}: ${t.gruen} grün, ${t.fehlgeschlagen} fehlgeschlagen (Stand ${f.baum.slice(0, 10)})`,
    `Review: Codex (${rv.verdict}), ${(rv.befunde ?? []).length} Befunde eingestuft`,
    `Lauf: ${a.id}`, '', TRAILER, '',
  ].join('\n');
}

/** Die Befunde des Reviews mit Einstufung und Beleg, für den PR-Text. */
function befundZeilen(w, a, f) {
  const eingestuft = new Map();
  for (const e of leseZeilen(path.join(laufDir(w, a.id), 'befunde.jsonl'))) if (e.baum === f.baum && e.session_id === f.review.session_id) eingestuft.set(e.id, e);
  return (f.review.befunde ?? []).map((b) => {
    const e = eingestuft.get(b.id);
    return `  - ${b.id} (${b.schwere}): ${e?.einstufung ?? 'nicht eingestuft'}${e?.beleg ? `, Beleg: ${e.beleg.split(/\s+/).join(' ').slice(0, 160)}` : ''}`;
  });
}

function prText(a, f, dateien, einschraenkungen, befunde) {
  const t = f.tests; const rv = f.review;
  const zeilen = [
    '## Zusammenfassung', a.auftrag, '',
    '## Änderungen', ...dateien.slice(0, 60).map((d) => `- ${d}`), ...(dateien.length > 60 ? [`- … und ${dateien.length - 60} weitere`] : []), '',
    '## Tests', `- \`${t.suite}\`: ${t.gruen} grün, ${t.fehlgeschlagen} fehlgeschlagen, ${t.uebersprungen} übersprungen (Codezustand ${f.baum.slice(0, 10)})`, '',
    '## Unabhängiges Review (Codex)', `- Ergebnis: ${rv.verdict}, Session ${rv.session_id}, ${(rv.befunde ?? []).length} Befunde (alle eingestuft)`, ...befunde, '',
    '## Bekannte Einschränkungen', einschraenkungen.trim(), '',
    '## Ablauf', `Lauf ${a.id}: ${a.runde} Runde(n), davon ${Math.max(0, a.runde - 1)} Korrekturschleife(n). Dies ist eine Draft-PR; über den Merge entscheidet Jonah.`, '',
    '🤖 Generated with [Claude Code](https://claude.com/claude-code)', '',
  ];
  return zeilen.join('\n');
}

/** Alle Voraussetzungen; liefert `{ fehler }` (abgelehnt, nichts verändert) oder die ermittelten Werte. */
function pruefeVoraussetzungen(w, a, { kurzname, titel, einschraenkungen, basis }, umgebung) {
  if (!a.autonom) return { fehler: abgelehnt('kein-autonomer-lauf', { hinweis: 'Nur ein mit „start --autonom“ begonnener Lauf (sauberer Arbeitsbaum) darf automatisch committen' }) };
  if (!a.uebernommen) return { fehler: abgelehnt('nicht-uebernommen', { hinweis: 'Zuerst uebernehmen (mit grünen Tests und gültigem Review)' }) };
  if (typeof kurzname !== 'string' || !KURZNAME.test(kurzname)) return { fehler: abgelehnt('kurzname', { hinweis: 'a-z, 0-9 und Bindestrich, 3 bis 41 Zeichen' }) };
  if (typeof titel !== 'string' || !titel.trim() || titel.length > 120 || /[\r\n]/.test(titel)) return { fehler: abgelehnt('titel', { hinweis: 'eine Zeile, höchstens 120 Zeichen' }) };
  if (typeof einschraenkungen !== 'string' || einschraenkungen.trim().length < 10) return { fehler: abgelehnt('einschraenkungen', { hinweis: 'Bekannte Einschränkungen angeben (oder ausdrücklich „Keine bekannten Einschränkungen“)' }) };
  const stapel = basis !== BASIS_ZWEIG;
  if (stapel && !(basis.startsWith(ZWEIG_PRAEFIX) && KURZNAME.test(basis.slice(ZWEIG_PRAEFIX.length)))) return { fehler: abgelehnt('basis-nicht-erlaubt', { hinweis: `Basis nur „${BASIS_ZWEIG}“ oder ein ${ZWEIG_PRAEFIX}…-Branch` }) };
  const branch = `${ZWEIG_PRAEFIX}${kurzname}`;
  if (branch === basis) return { fehler: abgelehnt('branch-gleich-basis') };

  const f = freigabeStatus(w, a);
  if (!f.ok) return { fehler: abgelehnt('freigabe', { gruende: f.gruende }) };

  const remote = git(w, ['remote', 'get-url', 'origin']).trim();
  if (!(umgebung.erlaubteRemotes ?? ERLAUBTE_REMOTES).map((x) => x.toLowerCase()).includes(remote.toLowerCase())) return { fehler: abgelehnt('remote-nicht-erlaubt', { remote }) };
  if (!git(w, ['config', 'user.name']).trim() || !git(w, ['config', 'user.email']).trim()) return { fehler: abgelehnt('git-identitaet', { hinweis: 'user.name und user.email fehlen' }) };

  const kopf = git(w, ['rev-parse', 'HEAD']).trim();
  const zweig = gitStatus(w, ['symbolic-ref', '--short', '-q', 'HEAD']).stdout.toString().trim();
  const startZweig = String(a.zweig ?? '').replace(/^refs\/heads\//, '');
  if (kopf !== a.head || !zweig || zweig !== startZweig) return { fehler: abgelehnt('head-veraendert', { erwartet: `${startZweig || 'losgelöst'}@${a.head.slice(0, 7)}`, ist: `${zweig || 'losgelöst'}@${kopf.slice(0, 7)}` }) };

  const dateien = [...a.uebernommen.dateien].map(vor).sort();
  if (!dateien.length) return { fehler: abgelehnt('keine-dateien') };
  const gesperrt = dateien.filter((p) => SICHERHEITSDATEIEN.some((r) => r.test(p)));
  if (gesperrt.length) return { fehler: abgelehnt('sicherheitsdateien', { dateien: gesperrt, hinweis: 'Solche Änderungen committet nie ein automatischer Abschluss' }) };

  const abweichung = vergleicheMitPlatte(w, a.basis, { ausgeschlossen: a.ausgeschlossen, ausser: AUSSER });
  if (abweichung.fehler.length) return { fehler: abgelehnt('arbeitsbaum-weicht-ab', { fehler: abweichung.fehler.slice(0, 6), hinweis: 'Der Hauptbaum ist nicht mehr der geprüfte Codezustand' }) };
  const schmutzig = fremdeAenderungen(w);
  const unerwartet = schmutzig.filter((p) => !dateien.includes(p));
  const fehlend = dateien.filter((p) => !schmutzig.includes(p));
  if (unerwartet.length || fehlend.length) return { fehler: abgelehnt('fremde-aenderungen', { unerwartet: unerwartet.slice(0, 8), fehlend: fehlend.slice(0, 8) }) };
  for (const p of dateien) {
    const abs = path.join(w, p);
    if (!fs.existsSync(abs)) continue;
    try { pruefeGeheimnisse(p, fs.readFileSync(abs)); } catch (fehler) { return { fehler: abgelehnt('geheimnis', { hinweis: String(fehler.message) }) }; }
  }

  const ref = `refs/remotes/origin/${basis}`;
  const hole = gitStatus(w, ['fetch', '--no-tags', 'origin', `+refs/heads/${basis}:${ref}`]);
  if (hole.status !== 0) return { fehler: abgelehnt('fetch-fehlgeschlagen', { basis, meldung: kurz(hole.stderr) }) };
  if (stapel) {
    const spitze = git(w, ['rev-parse', ref]).trim();
    if (spitze !== kopf) return { fehler: abgelehnt('pr-basis-unklar', { meldung: `Der Branch ${basis} auf dem Remote steht nicht auf dem aktuellen HEAD`, remote: spitze.slice(0, 7), kopf: kopf.slice(0, 7) }) };
  } else if (gitStatus(w, ['merge-base', '--is-ancestor', 'HEAD', ref]).status !== 0) {
    const voraus = git(w, ['rev-list', '--count', `${ref}..HEAD`]).trim();
    return { fehler: abgelehnt('pr-basis-unklar', { meldung: `Der aktuelle Branch hat ${voraus} Commit(s), die nicht in origin/${basis} sind; die PR enthielte sie mit. Jonah fragen: Basis wählen`, voraus: Number(voraus) }) };
  }
  if (gitStatus(w, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]).status === 0) return { fehler: abgelehnt('branch-existiert-lokal', { branch }) };
  const fern = gitStatus(w, ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]);
  if (fern.status !== 0) return { fehler: abgelehnt('remote-nicht-erreichbar', { meldung: kurz(fern.stderr) }) };
  if (fern.stdout.toString().trim()) return { fehler: abgelehnt('branch-existiert-remote', { branch }) };
  return { werte: { branch, basis, dateien, freigabe: f, zweig, kopf, titel: titel.trim(), kurzname, einschraenkungen } };
}

/** Stimmt das Bereitgestellte (`git diff --cached`) exakt mit den übernommenen Dateien überein? Beide Listen sortiert. */
export function stagingStimmt(gestaged, erwartet) {
  return JSON.stringify(gestaged) === JSON.stringify(erwartet);
}

function blockiert(w, a, f, schritt, grund) {
  speichere(w, a);
  return { status: 'blockiert', schritt, grund, fortschritt: f.schritte, branch: f.branch, commit: f.commit ?? null, hinweis: 'Stoppen und Jonah berichten; ein erneuter Aufruf setzt beim fehlgeschlagenen Schritt fort' };
}

/**
 * Branch, Commit, Push und Draft-PR für einen übernommenen autonomen Lauf.
 * @param {{kurzname: string, titel: string, einschraenkungen: string, basis?: string, trocken?: boolean}} p
 * @param {{erlaubteRemotes?: string[], gh?: string[]}} umgebung nur für Tests (die Kommandozeile reicht nichts davon durch)
 */
export function abschliessen(w, { kurzname, titel, einschraenkungen = '', basis = BASIS_ZWEIG, trocken = false }, umgebung = {}) {
  const a = brauche(w);
  const gh = umgebung.gh ?? ['gh'];
  let f = a.abschluss;

  if (!f) {
    const v = pruefeVoraussetzungen(w, a, { kurzname, titel, einschraenkungen, basis }, umgebung);
    if (v.fehler) return v.fehler;
    const x = v.werte;
    if (trocken) return { status: 'bereit', branch: x.branch, basis: x.basis, dateien: x.dateien, tests: x.freigabe.tests.suite, review: x.freigabe.review.verdict };
    f = { schritte: [], branch: x.branch, basis: x.basis, titel: x.titel, einschraenkungen: x.einschraenkungen, ursprung: { zweig: x.zweig, head: x.kopf }, dateien: x.dateien, commit: null, pr: null };
    a.abschluss = f; speichere(w, a);
  } else if (trocken) {
    return { status: 'laeuft', fortschritt: f.schritte, branch: f.branch };
  }
  const frei = freigabeStatus(w, a);
  if (!frei.ok) return abgelehnt('freigabe', { gruende: frei.gruende });

  if (f.schritte.includes('pr')) return { status: 'fertig', bereitsErledigt: true, branch: f.branch, commit: f.commit, pr: f.pr };

  // 1. Branch
  if (!f.schritte.includes('branch')) {
    const r = gitStatus(w, ['switch', '-c', f.branch]);
    if (r.status !== 0) { a.abschluss = null; speichere(w, a); return abgelehnt('branch-anlegen-fehlgeschlagen', { meldung: kurz(r.stderr) }); }
    f.schritte.push('branch'); speichere(w, a);
  }
  // 2. Commit (nur die übernommenen Pfade; danach muss der Baum exakt der geprüfte sein)
  if (!f.schritte.includes('commit')) {
    const aktuell = gitStatus(w, ['symbolic-ref', '--short', '-q', 'HEAD']).stdout.toString().trim();
    if (aktuell !== f.branch) return blockiert(w, a, f, 'commit', `Aktueller Branch ist „${aktuell}“, erwartet „${f.branch}“`);
    const pfade = `${f.dateien.join('\0')}\0`;
    const add = gitStatus(w, ['add', '-A', '--pathspec-from-file=-', '--pathspec-file-nul'], { input: pfade });
    const gestaged = git(w, ['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean).map(vor).sort();
    if (add.status !== 0 || !stagingStimmt(gestaged, f.dateien)) {
      gitStatus(w, ['restore', '--staged', '--pathspec-from-file=-', '--pathspec-file-nul'], { input: pfade });
      return blockiert(w, a, f, 'commit', `Staging weicht ab: ${kurz(add.stderr) || `gestaged ${gestaged.length}, erwartet ${f.dateien.length}`}`);
    }
    const nachricht = path.join(os.tmpdir(), `bw-msg-${a.id}.txt`);
    fs.writeFileSync(nachricht, nachrichtVon(a, frei, f.titel));
    const c = gitStatus(w, ['commit', '-q', '-F', nachricht]);
    fs.rmSync(nachricht, { force: true });
    if (c.status !== 0) return blockiert(w, a, f, 'commit', kurz(c.stderr) || kurz(c.stdout));
    f.commit = git(w, ['rev-parse', 'HEAD']).trim();
    if (git(w, ['rev-parse', `${f.commit}^{tree}`]).trim() !== frei.baum) return blockiert(w, a, f, 'commit', 'Der Baum des Commits ist nicht der geprüfte Codezustand; es wird nichts gepusht');
    f.schritte.push('commit'); speichere(w, a);
  }
  // 3. Push (nur der eigene Branch, ausdrücklicher Refspec, nie Force)
  if (!f.schritte.includes('push')) {
    if (git(w, ['rev-parse', 'HEAD']).trim() !== f.commit) return blockiert(w, a, f, 'push', 'HEAD ist nicht mehr der erstellte Commit');
    const p = gitStatus(w, ['push', '-u', 'origin', `refs/heads/${f.branch}:refs/heads/${f.branch}`]);
    if (p.status !== 0) return blockiert(w, a, f, 'push', kurz(p.stderr) || kurz(p.stdout));
    const ls = gitStatus(w, ['ls-remote', '--heads', 'origin', `refs/heads/${f.branch}`]).stdout.toString();
    if (!ls.startsWith(f.commit)) return blockiert(w, a, f, 'push', 'Der Remote-Branch zeigt nicht auf den Commit');
    f.schritte.push('push'); speichere(w, a);
  }
  // 4. Draft-PR (immer --draft, feste Basis und fester Kopf)
  if (!f.schritte.includes('pr')) {
    const dateiListe = git(w, ['diff', '--name-status', `${f.commit}~1`, f.commit]).trim().split('\n').filter(Boolean).map((z) => z.replace('\t', ' '));
    const bodyDatei = path.join(os.tmpdir(), `bw-pr-${a.id}.md`);
    fs.writeFileSync(bodyDatei, prText(a, frei, dateiListe, f.einschraenkungen, befundZeilen(w, a, frei)));
    const [exe, ...vorn] = gh;
    const r = spawnSync(exe, [...vorn, 'pr', 'create', '--draft', '--repo', GITHUB_REPO, '--base', f.basis, '--head', f.branch, '--title', f.titel, '--body-file', bodyDatei], { cwd: w, encoding: 'utf8', env: process.env });
    fs.rmSync(bodyDatei, { force: true });
    if (r.status !== 0) return blockiert(w, a, f, 'pr', kurz(r.stderr) || kurz(r.stdout) || `Exit ${r.status}`);
    f.pr = (r.stdout.split('\n').map((z) => z.trim()).filter((z) => /^https?:\/\/\S+$/.test(z)).at(-1)) ?? null;
    if (!f.pr) return blockiert(w, a, f, 'pr', 'gh lieferte keine PR-Adresse');
    f.schritte.push('pr'); f.abgeschlossen = new Date().toISOString(); speichere(w, a);
  }
  return { status: 'fertig', branch: f.branch, commit: f.commit, basis: f.basis, pr: f.pr, ursprung: f.ursprung, hinweis: 'Draft-PR erstellt; der Hauptbaum steht jetzt auf dem Auftragsbranch. Merge nur durch Jonah' };
}

export { SCHRITTE, baumVon };

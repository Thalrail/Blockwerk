// Orchestrierung: Zustand eines Entwicklungslaufs (Auftrag → Snapshot → Runden mit Agenten → Review → Übernahme → Ende).
// Der Zustand liegt in `.claude/orchestrierung/` (nicht versioniert, nicht im Snapshot): `aktiv.json` für den laufenden Lauf, `laeufe/<id>/` für alles andere,
// `sicherung/<id>/` für Journal und Kopien der Übernahme. Ohne aktiven Lauf legt der WorktreeCreate-Hook keinen Worktree an (fail-closed).
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { git, gitStatus, zustand, zustandsUnterschiede } from './git.js';
import { schnappschuss, seed } from './schnappschuss.js';
import { aenderungen } from './delta.js';
import { planen, anwenden, wiederherstellen, offeneJournale, KonfliktFehler } from './uebernehmen.js';
import { reviewPaket, standardReviewVerzeichnis } from './review-paket.js';
import { pruefeReviewErgebnis } from './review-pruefung.js';
import { pruefeTore, bewerteTore } from './tore.js';

export class LaufFehler extends Error { constructor(m) { super(m); this.name = 'LaufFehler'; } }

/** Verzeichnisse, die im Abdruck des Hauptbaums nicht mitzählen. */
export const AUSSER = Object.freeze(['.claude/worktrees', '.claude/orchestrierung']);
export const MAX_SCHLEIFEN = 3;

const vor = (p) => p.replace(/\\/g, '/');
export const orchDir = (w) => path.join(w, '.claude', 'orchestrierung');
const aktivPfad = (w) => path.join(orchDir(w), 'aktiv.json');
const laufDir = (w, id) => path.join(orchDir(w), 'laeufe', id);
const sicherungsWurzel = (w) => path.join(orchDir(w), 'sicherung');
const jetzt = () => new Date().toISOString();

function schreibeJson(datei, obj) {
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  const t = `${datei}.${process.pid}.tmp`;
  fs.writeFileSync(t, `${JSON.stringify(obj, null, 2)}\n`);
  fs.renameSync(t, datei);
}
const leseJson = (datei) => JSON.parse(fs.readFileSync(datei, 'utf8'));
const anhaengen = (datei, obj) => { fs.mkdirSync(path.dirname(datei), { recursive: true }); fs.appendFileSync(datei, `${JSON.stringify(obj)}\n`); };
const leseZeilen = (datei) => (fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z)) : []);

/** Wurzel des Hauptrepositories zu einem beliebigen Verzeichnis (auch aus einem Worktree heraus). */
export function hauptWurzel(cwd) {
  const gemeinsam = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
  return vor(path.dirname(gemeinsam));
}

/** Der laufende Lauf oder null. */
export function lies(w) { return fs.existsSync(aktivPfad(w)) ? leseJson(aktivPfad(w)) : null; }
const brauche = (w) => { const a = lies(w); if (!a || a.status !== 'aktiv') throw new LaufFehler('Es läuft kein Orchestrierungslauf. Zuerst: start'); return a; };
const speichere = (w, a) => schreibeJson(aktivPfad(w), a);

/** Worktrees, die der Hook für diesen Lauf angelegt hat. */
export const worktrees = (w, id) => leseZeilen(path.join(laufDir(w, id), 'worktrees.jsonl'));

/** Setzt unterbrochene Übernahmen zurück (vor jedem Lauf aufrufen). */
export function pruefeUnterbrochene(w) {
  const l = [];
  for (const d of offeneJournale(sicherungsWurzel(w))) l.push({ sicherung: vor(d), ergebnis: wiederherstellen(d) });
  return l;
}

/**
 * Beginnt einen Lauf: prüft auf unterbrochene Übernahmen, erfasst den Zustand, legt den Snapshot S0 an.
 * @param {{auftrag: string, dateien?: string[], kontext?: string[], id?: string}} opt `dateien`: Globs der Dateien, die der Auftrag ändern darf
 */
export function starten(w, { auftrag, dateien = [], kontext = [], id = null }) {
  if (!auftrag || !String(auftrag).trim()) throw new LaufFehler('Ein Lauf braucht einen Auftrag');
  const a0 = lies(w);
  if (a0?.status === 'aktiv') throw new LaufFehler(`Lauf ${a0.id} läuft noch. Zuerst: ende`);
  const wiederhergestellt = pruefeUnterbrochene(w);
  const laufId = id ?? `L${jetzt().replace(/[-:T]/g, '').slice(0, 14)}-${randomBytes(2).toString('hex')}`;
  const vorher = zustand(w, { ausser: AUSSER });
  const s0 = schnappschuss(w, { id: `${laufId}-s0` });
  const a = {
    id: laufId, status: 'aktiv', auftrag, dateien, kontext, haupt: vor(w), head: vorher.head, zweig: vorher.zweig,
    s0: s0.commit, s0Baum: s0.tree, basis: s0.commit, runde: 0, runden: [], ausgeschlossen: s0.ausgeschlossen, erstellt: jetzt(), uebernommen: null,
  };
  schreibeJson(path.join(laufDir(w, laufId), 'vorher.json'), vorher);
  schreibeJson(path.join(laufDir(w, laufId), 's0.json'), { commit: s0.commit, tree: s0.tree, aufgenommen: s0.aufgenommen, geloescht: s0.geloescht, ausgeschlossen: s0.ausgeschlossen });
  speichere(w, a);
  return { id: laufId, s0: s0.commit, aufgenommen: s0.aufgenommen, geloescht: s0.geloescht, ausgeschlossen: s0.ausgeschlossen, wiederhergestellt };
}

/** Wird vom WorktreeCreate-Hook gerufen: legt einen Worktree auf der aktuellen Basis (S0 oder Zwischen-Snapshot) an. Wirft bei jedem Zweifel. */
export function worktreeAnlegen(w, name) {
  const a = lies(w);
  if (!a || a.status !== 'aktiv') throw new LaufFehler('Kein aktiver Orchestrierungslauf: Worktree-Isolation gibt es nur über /blockwerk-auftrag (Lauf mit „start“ beginnen)');
  const kopf = git(w, ['rev-parse', 'HEAD']).trim();
  if (kopf !== a.head) throw new LaufFehler(`HEAD hat sich seit dem Start des Laufs geändert (${a.head.slice(0, 7)} → ${kopf.slice(0, 7)}): Lauf beenden und neu beginnen`);
  if (gitStatus(w, ['cat-file', '-e', `${a.basis}^{commit}`]).status !== 0) throw new LaufFehler(`Basis-Snapshot ${a.basis.slice(0, 7)} fehlt im Repository`);
  const sauber = String(name).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || 'agent';
  const ziel = vor(path.join(w, '.claude', 'worktrees', `${sauber}-${randomBytes(3).toString('hex')}`));
  seed(w, a.basis, ziel);
  const stand = git(ziel, ['status', '--porcelain']).trim();
  if (git(ziel, ['rev-parse', 'HEAD']).trim() !== a.basis || stand) throw new LaufFehler(`Worktree ${ziel} ist nicht sauber auf der Basis: ${stand.slice(0, 200)}`);
  anhaengen(path.join(laufDir(w, a.id), 'worktrees.jsonl'), { name, pfad: ziel, basis: a.basis, runde: a.runde, zeit: jetzt() });
  return ziel;
}

/** Sichert die Arbeit eines Worktrees als Zwischen-Snapshot, prüft die Tore und macht ihn zur Basis der nächsten Runde. */
export function rundeEnde(w, { worktree }) {
  const a = brauche(w);
  const pfad = vor(path.resolve(worktree));
  if (!worktrees(w, a.id).some((x) => vor(path.resolve(x.pfad)) === pfad)) throw new LaufFehler(`${pfad} ist kein Worktree dieses Laufs`);
  if (a.runde >= MAX_SCHLEIFEN + 1) throw new LaufFehler(`Mehr als ${MAX_SCHLEIFEN} Korrekturschleifen: Abbruch, Jonah fragen`);
  const nr = a.runde + 1;
  const s = schnappschuss(pfad, { id: `${a.id}-r${nr}`, eltern: a.basis });
  const geaendert = aenderungen(w, a.s0, s.commit);
  const { findings } = pruefeTore(w, a.s0, s.commit, { dateien: a.dateien.length ? a.dateien : null, ausgeschlossen: s.ausgeschlossen });
  const unveraendert = s.tree === git(w, ['rev-parse', `${a.basis}^{tree}`]).trim();
  const runde = { nr, commit: s.commit, tree: s.tree, worktree: pfad, geaendert, ausgeschlossen: s.ausgeschlossen, tore: findings, zeit: jetzt(), unveraendert };
  schreibeJson(path.join(laufDir(w, a.id), `runde-${nr}.json`), runde);
  a.runde = nr; a.basis = s.commit; a.ausgeschlossen = s.ausgeschlossen; a.runden.push({ nr, commit: s.commit, geaendert: geaendert.length, stopp: findings.filter((x) => x.stufe === 'stopp').length, fragen: findings.filter((x) => x.stufe === 'frage').length });
  speichere(w, a);
  return { runde: nr, commit: s.commit, geaendert, ausgeschlossen: s.ausgeschlossen, tore: findings, bewertung: bewerteTore(findings), unveraendert: runde.unveraendert };
}

/** Tore für die gesamte bisherige Arbeit (S0 → aktuelle Basis). */
export function tore(w, { erlaubt = [] } = {}) {
  const a = brauche(w);
  if (a.runde < 1) throw new LaufFehler('Es gibt noch keine Runde mit Arbeit');
  const { findings } = pruefeTore(w, a.s0, a.basis, { dateien: a.dateien.length ? a.dateien : null, ausgeschlossen: a.ausgeschlossen });
  return { findings, bewertung: bewerteTore(findings, erlaubt) };
}

/** Erzeugt das isolierte Review-Paket für S0 → aktuelle Basis. */
export function paket(w, { kontext = [], hinweise = '', wurzel = null } = {}) {
  const a = brauche(w);
  if (a.runde < 1) throw new LaufFehler('Es gibt noch keine Runde mit Arbeit');
  const p = reviewPaket(w, a.s0, a.basis, wurzel ?? standardReviewVerzeichnis(), { id: `${a.id}-r${a.runde}`, kontext: [...a.kontext, ...kontext], hinweise: `${hinweise}\n\nAuftrag: ${a.auftrag}` });
  anhaengen(path.join(laufDir(w, a.id), 'pakete.jsonl'), { runde: a.runde, dir: vor(p.dir), base: p.base, head: p.head, diffSha256: p.diffSha256, tokenSchaetzung: p.tokenSchaetzung, zeit: jetzt() });
  return p;
}

/** Prüft und protokolliert die Kopffelder eines Codex-Ergebnisses. */
export function reviewMelden(w, kopf) {
  const a = brauche(w);
  const r = pruefeReviewErgebnis(kopf);
  anhaengen(path.join(laufDir(w, a.id), 'reviews.jsonl'), { runde: a.runde, gueltig: r.gueltig, gruende: r.gruende, verdict: kopf?.verdict ?? null, session_id: kopf?.session_id ?? null, zeit: jetzt() });
  return r;
}

/** Zustand des Hauptrepositories gegenüber dem Start des Laufs: nur die Buchführung (HEAD, Zweig, Stash, Refs, Index) und optional erwartete Dateiänderungen. */
export function hauptKontrolle(w, { erwarteteDateien = [] } = {}) {
  const a = brauche(w);
  const vorher = leseJson(path.join(laufDir(w, a.id), 'vorher.json'));
  const unterschiede = zustandsUnterschiede(vorher, zustand(w, { ausser: AUSSER }));
  const buch = unterschiede.filter((u) => !u.startsWith('datei:'));
  const dateien = unterschiede.filter((u) => u.startsWith('datei:')).map((u) => u.slice(6));
  const unerwartet = dateien.filter((p) => !erwarteteDateien.includes(p));
  return { unveraendert: buch.length === 0 && unerwartet.length === 0, buchfuehrung: buch, unerwarteteDateien: unerwartet, erwarteteDateien: dateien.filter((p) => erwarteteDateien.includes(p)) };
}

/** Übernimmt die geprüfte Arbeit in den Hauptarbeitsbaum (nur ohne offene Tore und ohne Konflikte). */
export function uebernehmen(w, { erlaubt = [], vorSchritt } = {}) {
  const a = brauche(w);
  if (a.uebernommen) throw new LaufFehler('Die Arbeit dieses Laufs ist schon übernommen');
  if (a.runde < 1 || a.basis === a.s0) throw new LaufFehler('Es gibt nichts zu übernehmen');
  const { findings } = pruefeTore(w, a.s0, a.basis, { dateien: a.dateien.length ? a.dateien : null, ausgeschlossen: a.ausgeschlossen });
  const bew = bewerteTore(findings, erlaubt);
  if (!bew.frei) return { status: 'abgelehnt', grund: 'tore', stopp: bew.stopp, offen: bew.offen };
  let aktionen;
  try { aktionen = planen(w, a.s0, a.basis); } catch (f) { if (f instanceof KonfliktFehler) return { status: 'abgelehnt', grund: 'konflikt', konflikte: f.konflikte }; throw f; }
  const sicherung = path.join(sicherungsWurzel(w), a.id);
  try { anwenden(w, aktionen, sicherung, { vorSchritt }); } catch (f) {
    if (f instanceof KonfliktFehler) return { status: 'abgelehnt', grund: 'konflikt', konflikte: f.konflikte };
    return { status: 'fehlgeschlagen', grund: String(f.message), hinweis: 'Alles wurde zurückgesetzt; der Hauptbaum ist unverändert' };
  }
  const dateien = aktionen.map((x) => x.pfad);
  const kontrolle = hauptKontrolle(w, { erwarteteDateien: dateien });
  a.uebernommen = { zeit: jetzt(), dateien, sicherung: vor(sicherung) };
  speichere(w, a);
  return { status: 'uebernommen', dateien, kontrolle, infos: findings.filter((x) => x.stufe === 'info') };
}

/** Beendet den Lauf: entfernt seine Worktrees (nur unter .claude/worktrees) und archiviert den Zustand. */
export function beenden(w, { verwerfen = false } = {}) {
  const a = lies(w);
  if (!a) throw new LaufFehler('Es gibt keinen Lauf');
  if (a.status === 'aktiv' && a.basis !== a.s0 && !a.uebernommen && !verwerfen) throw new LaufFehler('Der Lauf enthält nicht übernommene Arbeit. Zuerst übernehmen, oder mit verwerfen ausdrücklich verwerfen');
  const entfernt = [];
  const erlaubtWurzel = vor(path.join(w, '.claude', 'worktrees'));
  for (const x of worktrees(w, a.id)) {
    const p = vor(path.resolve(x.pfad));
    if (!p.startsWith(`${erlaubtWurzel}/`)) continue;
    if (gitStatus(w, ['worktree', 'remove', '--force', p]).status === 0) entfernt.push(p);
    else if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); entfernt.push(p); }
  }
  gitStatus(w, ['worktree', 'prune']);
  a.status = 'beendet'; a.ende = jetzt();
  schreibeJson(path.join(laufDir(w, a.id), 'lauf.json'), a);
  fs.rmSync(aktivPfad(w), { force: true });
  return { id: a.id, entfernteWorktrees: entfernt, uebernommen: Boolean(a.uebernommen) };
}

export function status(w) {
  const a = lies(w);
  if (!a) return { aktiv: false, unterbrochen: offeneJournale(sicherungsWurzel(w)).map(vor) };
  return { aktiv: a.status === 'aktiv', id: a.id, auftrag: a.auftrag, runde: a.runde, maxSchleifen: MAX_SCHLEIFEN, s0: a.s0.slice(0, 10), basis: a.basis.slice(0, 10), worktrees: worktrees(w, a.id).map((x) => x.pfad), runden: a.runden, uebernommen: Boolean(a.uebernommen), unterbrochen: offeneJournale(sicherungsWurzel(w)).map(vor) };
}

export { wiederherstellen };

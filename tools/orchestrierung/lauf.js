// Orchestrierung: Zustand eines Entwicklungslaufs (Auftrag → Snapshot → Runden mit Agenten → Review → Übernahme → Ende).
// Der Zustand liegt in `.claude/orchestrierung/` (nicht versioniert, nicht im Snapshot): `aktiv.json` für den laufenden Lauf, `laeufe/<id>/` für alles andere,
// `sicherung/<id>/` für Journal und Kopien der Übernahme. Ohne aktiven Lauf legt der WorktreeCreate-Hook keinen Worktree an (fail-closed).
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, gitStatus, blobSha, zustand, zustandsUnterschiede, mitHaertung } from './git.js';
import { gitAbdruck, abdruckUnterschiede as gitUnterschiede } from './git-abdruck.js';
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
/** Nachweisdateien, auf die sich die Freigabe stützt. Jeder Eintrag geht durch `anhaengen`, das ihren Hash in `integritaet.json` (Protokoll) mitführt. */
const NACHWEISE = Object.freeze(['tests.jsonl', 'reviews.jsonl', 'befunde.jsonl', 'pakete.jsonl']);
const dateiSha = (p) => { try { return createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } catch { return null; } };
const anhaengen = (datei, obj) => {
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  fs.appendFileSync(datei, `${JSON.stringify(obj)}\n`);
  const n = path.basename(datei);
  if (!NACHWEISE.includes(n)) return;
  const f = path.join(path.dirname(datei), 'integritaet.json');
  let j = {}; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* wird neu angelegt; ohne Git-Basislinie gilt der Lauf später als unprüfbar */ }
  schreibeJson(f, { ...j, ledger: { ...(j.ledger ?? {}), [n]: dateiSha(datei) } });
};
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

/** Uncommittete Änderungen im Hauptbaum (geändert, gelöscht, gestaged, neu und nicht ignoriert), ohne Laufzustand und Worktrees. */
export function fremdeAenderungen(w) {
  const lies0 = (args) => git(w, args).split('\0').filter(Boolean);
  const alle = new Set([...lies0(['ls-files', '-z', '-m', '-d', '-o', '--exclude-standard']), ...lies0(['diff', '--cached', '--name-only', '-z'])]);
  return [...alle].map(vor).filter((p) => !AUSSER.some((x) => p === x || p.startsWith(`${x}/`))).sort();
}

/** Baum-Hash eines Snapshot-Commits. */
const baumVon = (w, commit) => git(w, ['rev-parse', `${commit}^{tree}`]).trim();

/**
 * Beginnt einen Lauf: prüft auf unterbrochene Übernahmen, erfasst den Zustand, legt den Snapshot S0 an.
 * @param {{auftrag: string, dateien?: string[], kontext?: string[], id?: string, autonom?: boolean}} opt `dateien`: Globs der Dateien, die der Auftrag ändern darf;
 *   `autonom`: Lauf bis zur Draft-PR (`abschluss`); verlangt einen sauberen Arbeitsbaum, damit nie fremde uncommittete Änderungen in einen Commit geraten
 */
export function starten(w, { auftrag, dateien = [], kontext = [], id = null, autonom = false }) {
  if (!auftrag || !String(auftrag).trim()) throw new LaufFehler('Ein Lauf braucht einen Auftrag');
  const a0 = lies(w);
  if (a0?.status === 'aktiv') throw new LaufFehler(`Lauf ${a0.id} läuft noch. Zuerst: ende`);
  if (autonom) {
    const fremd = fremdeAenderungen(w);
    if (fremd.length) throw new LaufFehler(`Ein autonomer Lauf braucht einen sauberen Arbeitsbaum (fremde uncommittete Änderungen würden sonst in den Commit geraten): ${fremd.slice(0, 8).join(', ')}${fremd.length > 8 ? ` … (${fremd.length} Dateien)` : ''}. Jonah fragen`);
  }
  const wiederhergestellt = pruefeUnterbrochene(w);
  const laufId = id ?? `L${jetzt().replace(/[-:T]/g, '').slice(0, 14)}-${randomBytes(2).toString('hex')}`;
  const vorher = zustand(w, { ausser: AUSSER });
  const s0 = schnappschuss(w, { id: `${laufId}-s0` });
  const a = {
    id: laufId, status: 'aktiv', auftrag, dateien, kontext, haupt: vor(w), head: vorher.head, zweig: vorher.zweig,
    s0: s0.commit, s0Baum: s0.tree, basis: s0.commit, runde: 0, runden: [], ausgeschlossen: s0.ausgeschlossen, erstellt: jetzt(), uebernommen: null,
    autonom: Boolean(autonom), abschluss: null,
  };
  schreibeJson(path.join(laufDir(w, laufId), 'vorher.json'), vorher);
  schreibeJson(path.join(laufDir(w, laufId), 'integritaet.json'), { git: mitHaertung(() => gitAbdruck(w)), ledger: {}, zeit: jetzt() });
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
  anhaengen(path.join(laufDir(w, a.id), 'pakete.jsonl'), { runde: a.runde, baum: baumVon(w, a.basis), basis: a.basis, dir: vor(p.dir), base: p.base, head: p.head, diffSha256: p.diffSha256, tokenSchaetzung: p.tokenSchaetzung, zeit: jetzt() });
  return p;
}

const SCHWEREN = ['critical', 'major', 'minor', 'info'];
const EINSTUFUNGEN = ['bestaetigt', 'widerlegt', 'hinweis'];
const MIN_BELEG = 20;

/**
 * Prüft und protokolliert die Kopffelder eines Codex-Ergebnisses, gebunden an das Review-Paket des aktuellen Stands (Codezustand = Baum der Basis).
 * `befunde`: alle Befunde, die das Ergebnis nennt, als [{id, schwere, kurz}]; jeder muss danach mit `befundMelden` eingestuft werden.
 */
export function reviewMelden(w, kopf, befunde = []) {
  const a = brauche(w);
  nichtGesperrt(w, a);
  const baum = baumVon(w, a.basis);
  const paketEintrag = leseZeilen(path.join(laufDir(w, a.id), 'pakete.jsonl')).filter((x) => x.baum === baum).at(-1);
  if (!paketEintrag) throw new LaufFehler('Für den aktuellen Codezustand gibt es kein Review-Paket (zuerst: paket). Ein Review zählt nur für genau den Stand, den das Paket enthielt');
  if (!Array.isArray(befunde)) throw new LaufFehler('befunde muss eine Liste sein');
  const ids = new Set();
  for (const b of befunde) {
    if (!b || typeof b.id !== 'string' || !b.id.trim()) throw new LaufFehler('Jeder Befund braucht eine id');
    if (ids.has(b.id)) throw new LaufFehler(`Befund ${b.id} doppelt gemeldet`);
    ids.add(b.id);
    if (!SCHWEREN.includes(b.schwere)) throw new LaufFehler(`Befund ${b.id}: schwere muss eine von ${SCHWEREN.join(', ')} sein`);
  }
  const r = pruefeReviewErgebnis(kopf);
  anhaengen(path.join(laufDir(w, a.id), 'reviews.jsonl'), {
    runde: a.runde, baum, gueltig: r.gueltig, gruende: r.gruende, verdict: kopf?.verdict ?? null, session_id: kopf?.session_id ?? null,
    befunde: befunde.map((b) => ({ id: b.id, schwere: b.schwere, kurz: String(b.kurz ?? '').slice(0, 200) })), zeit: jetzt(),
  });
  return { ...r, baum, befunde: befunde.length };
}

/**
 * Stuft einen Befund des aktuellen Reviews ein: `bestaetigt` (echter Fehler: blockiert, muss in einer neuen Runde behoben werden),
 * `widerlegt` (mit Beleg gegen den Code, mindestens 20 Zeichen) oder `hinweis` (nur bei minor/info, mit Beleg; blockiert nicht).
 */
export function befundMelden(w, { id, einstufung, beleg = '' }) {
  const a = brauche(w);
  nichtGesperrt(w, a);
  const baum = baumVon(w, a.basis);
  const rv = leseZeilen(path.join(laufDir(w, a.id), 'reviews.jsonl')).filter((x) => x.baum === baum).at(-1);
  if (!rv) throw new LaufFehler('Für den aktuellen Codezustand gibt es noch kein gemeldetes Review (review-melden)');
  const b = (rv.befunde ?? []).find((x) => x.id === id);
  if (!b) throw new LaufFehler(`Befund „${String(id)}“ gehört nicht zum Review des aktuellen Codezustands`);
  if (!EINSTUFUNGEN.includes(einstufung)) throw new LaufFehler(`einstufung muss eine von ${EINSTUFUNGEN.join(', ')} sein`);
  if (einstufung !== 'bestaetigt' && String(beleg).trim().length < MIN_BELEG) throw new LaufFehler(`„${einstufung}“ braucht einen Beleg gegen den Code (mindestens ${MIN_BELEG} Zeichen)`);
  if (einstufung === 'hinweis' && !['minor', 'info'].includes(b.schwere)) throw new LaufFehler(`Befund ${id} ist „${b.schwere}“: er kann nicht als bloßer Hinweis durchgehen (bestätigen oder mit Beleg widerlegen)`);
  anhaengen(path.join(laufDir(w, a.id), 'befunde.jsonl'), { runde: a.runde, baum, session_id: rv.session_id, id, einstufung, beleg: String(beleg).slice(0, 1000), zeit: jetzt() });
  return { id, einstufung, baum };
}

/** Stimmt jede Datei des Commit-Baums byteweise mit dem Verzeichnis überein? (zusätzliche Dateien im Verzeichnis, z. B. Testausgaben, stören nicht) */
function gleichMitCommit(verzeichnis, commit) {
  const abweichungen = [];
  for (const e of git(verzeichnis, ['ls-tree', '-r', '-z', '--full-tree', commit]).split('\0').filter(Boolean)) {
    const [meta, p] = e.split('\t'); const [, art, sha] = meta.split(' ');
    if (art !== 'blob') continue;
    const abs = path.join(verzeichnis, p);
    if (!fs.existsSync(abs)) { abweichungen.push(`${p}: fehlt`); continue; }
    if (blobSha(fs.readFileSync(abs)) !== sha) abweichungen.push(`${p}: Inhalt weicht ab`);
  }
  return abweichungen;
}

/** Umgebungsvariablen, die ein Testprozess bekommt (Positivliste, Namen ohne Beachtung der Groß-/Kleinschreibung wie unter Windows). Nichts anderes wird weitergereicht. */
export const TEST_UMGEBUNG_ERLAUBT = Object.freeze(['PATH', 'SystemRoot', 'windir', 'ComSpec', 'PATHEXT']);

/**
 * Umgebung für die Tests des Agenten: nur die Positivliste, dazu ein leeres privates Verzeichnis als Home und Temp (damit keine Konfigurationen des Benutzers gelesen werden)
 * und ohne Git-Konfiguration. Das ist **Bereinigung, keine Isolation**: der Prozess läuft weiter unter dem Benutzerkonto und kann Dateien erreichen, die dieses Konto erreicht.
 */
export function testUmgebung(quelle, privat) {
  const erlaubt = new Set(TEST_UMGEBUNG_ERLAUBT.map((n) => n.toLowerCase()));
  const env = {};
  for (const [k, v] of Object.entries(quelle)) if (erlaubt.has(k.toLowerCase()) && typeof v === 'string') env[k] = v;
  Object.assign(env, {
    HOME: privat, USERPROFILE: privat, TEMP: privat, TMP: privat, TMPDIR: privat,
    GIT_CONFIG_GLOBAL: path.join(privat, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0',
  });
  return env;
}

/**
 * Liest die Zusammenfassung von `node --test` aus der Ausgabe. Gilt nur der **letzte** Block `ℹ tests …` (die echte Zusammenfassung kommt zuletzt; was ein Test früher ausgibt, zählt nicht),
 * und nur, wenn er vollständig ist und rechnet (tests = pass + fail + cancelled + skipped + todo). Sonst `null`.
 */
export function liesTestZaehler(ausgabe) {
  const zeilen = String(ausgabe ?? '').split(/\r?\n/);
  let start = -1;
  zeilen.forEach((z, i) => { if (/^ℹ tests [0-9]+$/.test(z)) start = i; });
  if (start < 0) return null;
  const w = {};
  for (let i = start; i < zeilen.length; i++) {
    const m = zeilen[i].match(/^ℹ (tests|suites|pass|fail|cancelled|skipped|todo) ([0-9]+)$/);
    if (m) w[m[1]] = Number(m[2]);
    else if (!/^ℹ duration_ms /.test(zeilen[i])) break;
  }
  for (const k of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) if (!Number.isInteger(w[k])) return null;
  if (w.tests !== w.pass + w.fail + w.cancelled + w.skipped + w.todo) return null;
  return w;
}

/** Abdruck des Laufzustands: jede Datei unter `.claude/orchestrierung` (Pfad → Hash). */
export function laufAbdruck(w) {
  const m = {};
  const geh = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name); const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) geh(p, r);
      else { try { m[r] = createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } catch { m[r] = 'unlesbar'; } }
    }
  };
  if (fs.existsSync(orchDir(w))) geh(orchDir(w), '');
  return m;
}
const abdruckUnterschiede = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().filter((p) => a[p] !== b[p]).map((p) => `lauf:${p}`);

const sperrDatei = (w, id) => path.join(laufDir(w, id), 'gesperrt.json');
/** Grund der Sperre oder null. Ein gesperrter Lauf wird nie wieder vertrauenswürdig: weder Tests noch Review noch Übernahme noch Abschluss sind möglich (nur `ende`, dann ein neuer Lauf nach Prüfung durch Jonah). */
export function sperrGrund(w, a) {
  if (a?.gesperrt) return a.gesperrt.grund;
  if (a?.id && fs.existsSync(sperrDatei(w, a.id))) { try { return leseJson(sperrDatei(w, a.id)).grund; } catch { return 'Sperrdatei unlesbar'; } }
  return null;
}
const nichtGesperrt = (w, a) => {
  const g = sperrGrund(w, a);
  if (g) throw new LaufFehler(`Der Lauf ist gesperrt (${g}). Er wird nicht wieder vertrauenswürdig: Jonah informieren, den Lauf mit „ende“ beenden und nach seiner Prüfung neu starten`);
};
function sperren(w, a, grund) {
  const eintrag = { grund, zeit: jetzt() };
  try { schreibeJson(sperrDatei(w, a.id), eintrag); } catch { /* der Eintrag in aktiv.json unten genügt */ }
  a.gesperrt = eintrag;
  try { speichere(w, a); } catch { /* Sperrdatei ist schon geschrieben, sonst bleibt der Lauf ohnehin unbrauchbar */ }
}

/**
 * Prüft die Basislinie des Laufs (`integritaet.json`, beim Start festgelegt): Git-Konfiguration, Hooks, Info und globale Konfigurationsdateien müssen unverändert sein,
 * und die Nachweisdateien (Tests, Reviews, Befunde, Pakete) müssen genau dem entsprechen, was das Werkzeug zuletzt geschrieben hat. Liefert die Abweichungen (leer = in Ordnung).
 * Die Basislinie liegt im Laufverzeichnis und schützt daher gegen versehentliche und nachträgliche Änderungen, nicht gegen einen Prozess, der beides konsistent umschreibt.
 */
export function integritaetPruefen(w, a) {
  let b;
  try { b = leseJson(path.join(laufDir(w, a.id), 'integritaet.json')); } catch { return ['integritaet:Basislinie fehlt oder ist unlesbar']; }
  const probleme = gitUnterschiede(b.git ?? {}, mitHaertung(() => gitAbdruck(w)), 'git');
  for (const n of NACHWEISE) if ((b.ledger?.[n] ?? null) !== dateiSha(path.join(laufDir(w, a.id), n))) probleme.push(`protokoll:${n}`);
  return probleme;
}
/** Legt die Git-Basislinie neu fest, nachdem das Werkzeug selbst etwas geändert hat (z. B. `push -u` schreibt Zweig-Einträge in die Konfiguration). */
export function integritaetGitNeu(w, a) {
  const f = path.join(laufDir(w, a.id), 'integritaet.json');
  let b = {}; try { b = leseJson(f); } catch { /* wird neu angelegt */ }
  schreibeJson(f, { ...b, git: mitHaertung(() => gitAbdruck(w)), zeit: jetzt() });
}
/** Sperrt den Lauf wegen unerwarteter Änderungen und liefert den Ablehnungsbefund. */
export function integritaetVerletzt(w, a, verstoss, wo) {
  sperren(w, a, `Integritätsverletzung ${wo}: ${verstoss.slice(0, 5).join('; ')}`);
  return { status: 'abgelehnt', grund: 'integritaet', verstoss, hinweis: 'Der Lauf ist gesperrt und wird nicht wieder vertrauenswürdig. Stoppen und Jonah berichten' };
}

/** Die Testläufe, die das Werkzeug selbst startet (feste Argumente für Node, kein Shell-Text). `kurz` ist die vollständige Suite und für die Freigabe Pflicht. */
export const SUITEN = Object.freeze({
  kurz: ['--test', '--test-reporter=spec', 'test/**/*.test.js'],
  orchestrierung: ['--test', '--test-reporter=spec', 'test/orchestrierung/*.orchestrierung.js'],
  pruefstein: ['--test', '--test-reporter=spec', 'test/pruefstein/*.pruefstein.js'],
});

/**
 * Startet eine Testsuite im Worktree **selbst** und protokolliert das echte Ergebnis (Exit-Code und die Zahlen aus der Ausgabe von `node --test`),
 * statt Zahlen des Koordinators zu glauben. Der Worktree muss vorher der gesicherten Basis entsprechen und danach unverändert sein
 * (Tests dürfen den geprüften Stand nicht verändern).
 */
export function testsAusfuehren(w, optionen) { return mitHaertung(() => testsAusfuehrenIntern(w, optionen)); }
function testsAusfuehrenIntern(w, { worktree, suite = 'kurz', timeoutMs = 1800000 }) {
  const a = brauche(w);
  nichtGesperrt(w, a);
  if (!Object.hasOwn(SUITEN, suite)) throw new LaufFehler(`Unbekannte Suite „${String(suite)}“. Erlaubt: ${Object.keys(SUITEN).join(', ')}`);
  const pfad = vor(path.resolve(worktree));
  if (a.runde < 1) throw new LaufFehler('Es gibt noch keine Runde mit Arbeit');
  if (!worktrees(w, a.id).some((x) => vor(path.resolve(x.pfad)) === pfad)) throw new LaufFehler(`${pfad} ist kein Worktree dieses Laufs`);
  const vorher = gleichMitCommit(pfad, a.basis);
  if (vorher.length) throw new LaufFehler(`Der Worktree weicht vom gesicherten Stand ab (zuerst runde-ende, dann testen): ${vorher.slice(0, 3).join('; ')}`);
  // Abdruck von Hauptbaum, HEAD und Laufzustand vor den Tests; die Tests sind Code des Agenten und laufen unter dem Benutzerkonto
  const z0 = zustand(w, { ausser: AUSSER }); const l0 = laufAbdruck(w); const g0 = gitAbdruck(w, { mitWorktrees: true });
  const privat = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-test-'));
  let r;
  try {
    fs.writeFileSync(path.join(privat, 'gitconfig'), '');
    r = spawnSync(process.execPath, SUITEN[suite], { cwd: pfad, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 256 << 20, env: testUmgebung(process.env, privat) });
  } finally {
    try { fs.rmSync(privat, { recursive: true, force: true, maxRetries: 3 }); } catch { /* egal */ }
  }
  const verdacht = [...gitUnterschiede(g0, gitAbdruck(w, { mitWorktrees: true }), 'git'), ...zustandsUnterschiede(z0, zustand(w, { ausser: AUSSER })), ...abdruckUnterschiede(l0, laufAbdruck(w))];
  if (verdacht.length) {
    sperren(w, a, `Manipulationsverdacht: Während der Tests änderten sich ${verdacht.length} Stelle(n) außerhalb des Worktrees: ${verdacht.slice(0, 5).join('; ')}`);
    throw new LaufFehler(`MANIPULATIONSVERDACHT: Während der Tests änderten sich ${verdacht.length} Stelle(n) außerhalb des Worktrees (${verdacht.slice(0, 5).join('; ')}). Der Lauf ist gesperrt, das Ergebnis wird nicht protokolliert. Stoppen und Jonah berichten`);
  }
  const z = liesTestZaehler(r.stdout);
  if (!z) throw new LaufFehler(`Die Testausgabe war nicht lesbar oder nicht stimmig (Exit ${r.status}, ${r.error ? r.error.message : 'keine vollständige, rechnende Zusammenfassung'}); es wird nichts protokolliert`);
  const exit = r.status ?? 1;
  if (exit === 0 && (z.fail > 0 || z.cancelled > 0)) throw new LaufFehler('Die Testausgabe widerspricht dem Exit-Code (Exit 0, aber fehlgeschlagene Tests gemeldet); es wird nichts protokolliert');
  const nachher = gleichMitCommit(pfad, a.basis);
  if (nachher.length) throw new LaufFehler(`Die Tests haben den Worktree verändert (${nachher.slice(0, 3).join('; ')}); das Ergebnis gilt nicht für den gesicherten Stand`);
  return testsMelden(w, { worktree, suite, gruen: z.pass, fehlgeschlagen: z.fail + z.cancelled, uebersprungen: z.skipped, exit, quelle: 'werkzeug' });
}

/**
 * Protokolliert einen Testlauf für den aktuellen Codezustand. Der Worktree muss byteweise der gesicherten Basis entsprechen
 * (sonst wären die Tests für einen anderen Stand gelaufen). Die Kommandozeile bietet nur `tests-ausfuehren` an (Ergebnis vom Werkzeug selbst gelesen).
 */
export function testsMelden(w, { worktree, suite, gruen, fehlgeschlagen, uebersprungen = 0, exit, quelle = 'gemeldet' }) {
  const a = brauche(w);
  nichtGesperrt(w, a);
  if (a.runde < 1) throw new LaufFehler('Es gibt noch keine Runde mit Arbeit');
  const pfad = vor(path.resolve(worktree));
  if (!worktrees(w, a.id).some((x) => vor(path.resolve(x.pfad)) === pfad)) throw new LaufFehler(`${pfad} ist kein Worktree dieses Laufs`);
  if (typeof suite !== 'string' || !suite.trim()) throw new LaufFehler('suite fehlt (z. B. "npm run test:kurz")');
  for (const [k, v] of Object.entries({ gruen, fehlgeschlagen, uebersprungen, exit })) if (!Number.isInteger(v) || v < 0) throw new LaufFehler(`${k} muss eine ganze Zahl ab 0 sein`);
  const abweichungen = gleichMitCommit(pfad, a.basis);
  if (abweichungen.length) throw new LaufFehler(`Der Worktree weicht vom gesicherten Stand ab (zuerst runde-ende, dann testen): ${abweichungen.slice(0, 3).join('; ')}`);
  const baum = baumVon(w, a.basis);
  const eintrag = { runde: a.runde, baum, suite: suite.trim(), gruen, fehlgeschlagen, uebersprungen, exit, quelle, nachweis: 'worktree-gleich-basis', zeit: jetzt() };
  anhaengen(path.join(laufDir(w, a.id), 'tests.jsonl'), eintrag);
  return { ...eintrag, bestanden: exit === 0 && fehlgeschlagen === 0 && gruen > 0 };
}

/**
 * Darf die Arbeit übernommen werden? Nur mit grünem Teststatus UND gültigem, vollständig eingestuftem Review, beide für exakt denselben Codezustand
 * (Baum der aktuellen Basis). Jede neue Runde ändert den Stand und macht frühere Meldungen wirkungslos.
 */
export function freigabeStatus(w, a = brauche(w)) {
  const baum = baumVon(w, a.basis);
  const gruende = [];
  const sperre = sperrGrund(w, a);
  if (sperre) gruende.push(`Lauf gesperrt: ${sperre}`);
  const dir = laufDir(w, a.id);
  // je Suite zählt der jüngste Lauf für genau diesen Codezustand; die vollständige Suite `kurz` ist Pflicht, weitere gestartete Suiten müssen ebenfalls grün sein
  const jeSuite = new Map();
  for (const x of leseZeilen(path.join(dir, 'tests.jsonl'))) if (x.baum === baum) jeSuite.set(x.suite, x);
  const t = jeSuite.get('kurz') ?? null;
  if (!t) gruende.push('Keine Testmeldung der Suite „kurz“ für exakt diesen Codezustand (tests-ausfuehren --worktree <pfad> nach runde-ende)');
  for (const [name, x] of jeSuite) if (x.exit !== 0 || x.fehlgeschlagen !== 0 || !(x.gruen > 0)) gruende.push(`Tests „${name}“ nicht grün: ${x.gruen} grün, ${x.fehlgeschlagen} fehlgeschlagen, Exit ${x.exit}`);
  const rv = leseZeilen(path.join(dir, 'reviews.jsonl')).filter((x) => x.baum === baum).at(-1) ?? null;
  if (!rv) gruende.push('Kein Codex-Review für exakt diesen Codezustand (paket, review_code, review-melden)');
  else if (!rv.gueltig) gruende.push(`Review ungültig: ${(rv.gruende ?? []).join('; ')}`);
  else {
    if (rv.verdict === 'reject') gruende.push('Das Review lautet „reject“');
    if (rv.verdict !== 'approve' && !(rv.befunde ?? []).length) gruende.push(`Review „${rv.verdict}“ ohne gemeldete Befunde: Befunde mit review-melden --befunde erfassen`);
    const eingestuft = new Map();
    for (const e of leseZeilen(path.join(dir, 'befunde.jsonl'))) if (e.baum === baum && e.session_id === rv.session_id) eingestuft.set(e.id, e);
    for (const b of rv.befunde ?? []) {
      const e = eingestuft.get(b.id);
      if (!e) gruende.push(`Befund ${b.id} (${b.schwere}) ist nicht eingestuft`);
      else if (e.einstufung === 'bestaetigt') gruende.push(`Befund ${b.id} ist bestätigt und noch nicht behoben (neue Runde und neues Review nötig)`);
      else if (b.schwere === 'critical') gruende.push(`Kritischer Befund ${b.id} ist nur eingestuft („${e.einstufung}“), nicht behoben: das Urteil über einen kritischen Befund trifft Jonah, nicht der Koordinator (Rückfrage; automatisch geht es erst mit einem neuen Review ohne diesen Befund weiter)`);
    }
  }
  return { ok: gruende.length === 0, gruende, baum, tests: t, review: rv };
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

/**
 * Übernimmt die geprüfte Arbeit in den Hauptarbeitsbaum: nur ohne offene Tore, ohne Konflikte und mit Freigabe (grüne Tests und gültiges, eingestuftes Review
 * für exakt diesen Codezustand). `freigabePruefen: false` gibt es nur für Tests der Mechanik; die Kommandozeile setzt es nie.
 */
export function uebernehmen(w, optionen = {}) { return mitHaertung(() => uebernehmenIntern(w, optionen)); }
function uebernehmenIntern(w, { erlaubt = [], vorSchritt, freigabePruefen = true } = {}) {
  const a = brauche(w);
  const gesperrt = sperrGrund(w, a);
  if (gesperrt) return { status: 'abgelehnt', grund: 'gesperrt', hinweis: gesperrt };
  if (a.uebernommen) throw new LaufFehler('Die Arbeit dieses Laufs ist schon übernommen');
  if (a.runde < 1 || a.basis === a.s0) throw new LaufFehler('Es gibt nichts zu übernehmen');
  const { findings } = pruefeTore(w, a.s0, a.basis, { dateien: a.dateien.length ? a.dateien : null, ausgeschlossen: a.ausgeschlossen });
  const bew = bewerteTore(findings, erlaubt);
  if (!bew.frei) return { status: 'abgelehnt', grund: 'tore', stopp: bew.stopp, offen: bew.offen };
  if (freigabePruefen) {
    const f = freigabeStatus(w, a);
    if (!f.ok) return { status: 'abgelehnt', grund: 'freigabe', gruende: f.gruende };
  }
  // unmittelbar vor der Übernahme noch einmal: Git-Konfiguration und Hooks, Nachweisdateien, bei autonomen Läufen auch Hauptbaum, HEAD und Zweig seit dem Start
  const haupt = a.autonom ? hauptKontrolle(w) : null;
  const verstoss = [...integritaetPruefen(w, a), ...(haupt && !haupt.unveraendert ? [...haupt.buchfuehrung.map((x) => `haupt:${x}`), ...haupt.unerwarteteDateien.map((x) => `haupt:datei:${x}`)] : [])];
  if (verstoss.length) return integritaetVerletzt(w, a, verstoss, 'vor der Übernahme');
  let aktionen;
  try { aktionen = planen(w, a.s0, a.basis); } catch (f) { if (f instanceof KonfliktFehler) return { status: 'abgelehnt', grund: 'konflikt', konflikte: f.konflikte }; throw f; }
  const sicherung = path.join(sicherungsWurzel(w), a.id);
  try { anwenden(w, aktionen, sicherung, { vorSchritt }); } catch (f) {
    if (f instanceof KonfliktFehler) return { status: 'abgelehnt', grund: 'konflikt', konflikte: f.konflikte };
    return { status: 'fehlgeschlagen', grund: String(f.message), hinweis: 'Alles wurde zurückgesetzt; der Hauptbaum ist unverändert' };
  }
  const dateien = aktionen.map((x) => x.pfad);
  const kontrolle = hauptKontrolle(w, { erwarteteDateien: dateien });
  a.uebernommen = { zeit: jetzt(), dateien, sicherung: vor(sicherung), erlaubt: [...erlaubt] };
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
  return { aktiv: a.status === 'aktiv', id: a.id, auftrag: a.auftrag, runde: a.runde, maxSchleifen: MAX_SCHLEIFEN, s0: a.s0.slice(0, 10), basis: a.basis.slice(0, 10), worktrees: worktrees(w, a.id).map((x) => x.pfad), runden: a.runden, uebernommen: Boolean(a.uebernommen), autonom: Boolean(a.autonom), abschluss: a.abschluss ?? null, unterbrochen: offeneJournale(sicherungsWurzel(w)).map(vor) };
}

export { wiederherstellen, brauche, speichere, laufDir, leseZeilen, baumVon, vor };

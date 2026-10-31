// Orchestrierung: Kommandozeile für den Koordinator (Skill /blockwerk-auftrag). Jede Antwort ist ein JSON-Objekt auf stdout; bei einem Fehler
// steht {"fehler": "..."} auf stdout und der Exit-Code ist 1. Aufruf: node tools/orchestrierung/cli.js <befehl> [--option wert] [--schalter]
//   start --auftrag "<Text>" [--dateien "glob,glob"] [--kontext "datei,datei"] [--autonom]
//   status | runde-ende --worktree <pfad> | tore [--erlaubt "tor,tor:pfad"] | paket [--kontext "a,b"] [--hinweise "<Text>"]
//   tests-ausfuehren --worktree <pfad> [--suite kurz|orchestrierung|pruefstein]   (das Werkzeug startet die Tests selbst und liest das echte Ergebnis; Zahlen lassen sich nicht melden)
//   review-melden --json '<Kopffelder des Codex-Ergebnisses>' [--befunde '[{"id","schwere","kurz"}]'] | befund-melden --json '{"id","einstufung","beleg"}'
//   uebernehmen [--erlaubt "..."] | haupt-kontrolle | wiederherstellen | ende [--verwerfen]
//   abschluss --kurzname <name> --titel "<Text>" --einschraenkungen "<Text>" [--basis claude/<name>] [--trocken]   (Branch, Commit, Push, Draft-PR; nie Merge)
// Jeder Befehl kennt nur seine eigenen Optionen; unbekannte werden abgelehnt (Remote, Branch-Präfix und Basis lassen sich über die Kommandozeile nicht umbiegen).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as lauf from './lauf.js';
import { abschliessen } from './abschluss.js';
import { standardReviewVerzeichnis } from './review-paket.js';

function optionen(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const n = a.slice(2); const nxt = argv[i + 1]; if (nxt === undefined || nxt.startsWith('--')) o[n] = true; else { o[n] = nxt; i++; } } else o._.push(a);
  }
  return o;
}
const liste = (v) => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
const json = (v, was) => { try { return JSON.parse(v); } catch { throw new lauf.LaufFehler(`${was} ist kein gültiges JSON`); } };

const ERLAUBT = {
  start: ['auftrag', 'dateien', 'kontext', 'autonom'], status: [], 'runde-ende': ['worktree'], tore: ['erlaubt'], paket: ['kontext', 'hinweise'],
  'tests-ausfuehren': ['worktree', 'suite'], 'review-melden': ['json', 'befunde'], 'befund-melden': ['json'], uebernehmen: ['erlaubt'], 'haupt-kontrolle': ['erwartet'],
  wiederherstellen: [], ende: ['verwerfen'], abschluss: ['kurzname', 'titel', 'einschraenkungen', 'basis', 'trocken'],
};

export function fuehreAus(argv, cwd = process.cwd()) {
  const [befehl, ...rest] = argv;
  const o = optionen(rest);
  if (ERLAUBT[befehl]) {
    const fremd = Object.keys(o).filter((k) => k !== '_' && !ERLAUBT[befehl].includes(k));
    if (fremd.length) throw new lauf.LaufFehler(`Unbekannte Option(en) für ${befehl}: ${fremd.map((k) => `--${k}`).join(', ')}. Erlaubt: ${ERLAUBT[befehl].map((k) => `--${k}`).join(' ') || 'keine'}`);
  }
  const w = lauf.hauptWurzel(cwd);
  // zweite Schranke neben dem Wächter: Agenten arbeiten in ihrem Worktree; dieses Werkzeug bedient nur der Koordinator im Hauptverzeichnis
  if (befehl !== 'status' && lauf.vor(path.resolve(cwd)).toLowerCase().startsWith(`${lauf.vor(w).toLowerCase()}/.claude/worktrees/`)) {
    throw new lauf.LaufFehler('Dieses Werkzeug bedient nur der Koordinator im Hauptverzeichnis, nicht ein Agent aus seinem Worktree');
  }
  switch (befehl) {
    case 'start': {
      const dateien = liste(o.dateien);
      if (!dateien.length) throw new lauf.LaufFehler('start braucht --dateien (Globs der Dateien, die der Auftrag ändern darf); sonst gäbe es kein Tor „ausserhalb-auftrag“');
      return lauf.starten(w, { auftrag: o.auftrag, dateien, kontext: liste(o.kontext), autonom: o.autonom === true });
    }
    case 'status': return lauf.status(w);
    case 'runde-ende': return lauf.rundeEnde(w, { worktree: o.worktree });
    case 'tore': return lauf.tore(w, { erlaubt: liste(o.erlaubt) });
    case 'paket': {
      const p = lauf.paket(w, { kontext: liste(o.kontext), hinweise: typeof o.hinweise === 'string' ? o.hinweise : '' });
      return { ...p, geaendert: p.geaendert.map((x) => `${x.status} ${x.pfad}`), reviewVerzeichnis: standardReviewVerzeichnis() };
    }
    case 'tests-ausfuehren': return lauf.testsAusfuehren(w, { worktree: o.worktree, suite: typeof o.suite === 'string' ? o.suite : 'kurz' });
    case 'review-melden': return lauf.reviewMelden(w, json(o.json, '--json'), o.befunde === undefined ? [] : json(o.befunde, '--befunde'));
    case 'befund-melden': return lauf.befundMelden(w, json(o.json, '--json'));
    // die Kommandozeile reicht nie Remote, Branch-Präfix oder gh-Programm durch: nur die festen Werte aus abschluss.js gelten
    case 'uebernehmen': return lauf.uebernehmen(w, { erlaubt: liste(o.erlaubt) });
    case 'haupt-kontrolle': return lauf.hauptKontrolle(w, { erwarteteDateien: liste(o.erwartet) });
    case 'wiederherstellen': return { wiederhergestellt: lauf.pruefeUnterbrochene(w) };
    case 'ende': return lauf.beenden(w, { verwerfen: o.verwerfen === true });
    case 'abschluss': return abschliessen(w, { kurzname: o.kurzname, titel: o.titel, einschraenkungen: typeof o.einschraenkungen === 'string' ? o.einschraenkungen : '', basis: typeof o.basis === 'string' ? o.basis : 'main', trocken: o.trocken === true });
    default: throw new lauf.LaufFehler(`Unbekannter Befehl „${String(befehl)}“. Befehle: ${Object.keys(ERLAUBT).join(', ')}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try { process.stdout.write(`${JSON.stringify(fuehreAus(process.argv.slice(2)), null, 2)}\n`); } catch (f) { process.stdout.write(`${JSON.stringify({ fehler: String(f.message) })}\n`); process.exitCode = 1; }
}

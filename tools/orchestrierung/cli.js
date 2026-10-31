// Orchestrierung: Kommandozeile für den Koordinator (Skill /blockwerk-auftrag). Jede Antwort ist ein JSON-Objekt auf stdout; bei einem Fehler
// steht {"fehler": "..."} auf stdout und der Exit-Code ist 1. Aufruf: node tools/orchestrierung/cli.js <befehl> [--option wert] [--schalter]
//   start --auftrag "<Text>" [--dateien "glob,glob"] [--kontext "datei,datei"]
//   status | runde-ende --worktree <pfad> | tore [--erlaubt "tor,tor:pfad"] | paket [--kontext "a,b"] [--hinweise "<Text>"]
//   review-melden --json '<Kopffelder des Codex-Ergebnisses>' | uebernehmen [--erlaubt "..."] | haupt-kontrolle | wiederherstellen | ende [--verwerfen]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as lauf from './lauf.js';
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

export function fuehreAus(argv, cwd = process.cwd()) {
  const [befehl, ...rest] = argv;
  const o = optionen(rest);
  const w = lauf.hauptWurzel(cwd);
  switch (befehl) {
    case 'start': {
      const dateien = liste(o.dateien);
      if (!dateien.length) throw new lauf.LaufFehler('start braucht --dateien (Globs der Dateien, die der Auftrag ändern darf); sonst gäbe es kein Tor „ausserhalb-auftrag“');
      return lauf.starten(w, { auftrag: o.auftrag, dateien, kontext: liste(o.kontext) });
    }
    case 'status': return lauf.status(w);
    case 'runde-ende': return lauf.rundeEnde(w, { worktree: o.worktree });
    case 'tore': return lauf.tore(w, { erlaubt: liste(o.erlaubt) });
    case 'paket': {
      const p = lauf.paket(w, { kontext: liste(o.kontext), hinweise: typeof o.hinweise === 'string' ? o.hinweise : '' });
      return { ...p, geaendert: p.geaendert.map((x) => `${x.status} ${x.pfad}`), reviewVerzeichnis: standardReviewVerzeichnis() };
    }
    case 'review-melden': return lauf.reviewMelden(w, JSON.parse(o.json));
    case 'uebernehmen': return lauf.uebernehmen(w, { erlaubt: liste(o.erlaubt) });
    case 'haupt-kontrolle': return lauf.hauptKontrolle(w, { erwarteteDateien: liste(o.erwartet) });
    case 'wiederherstellen': return { wiederhergestellt: lauf.pruefeUnterbrochene(w) };
    case 'ende': return lauf.beenden(w, { verwerfen: o.verwerfen === true });
    default: throw new lauf.LaufFehler(`Unbekannter Befehl „${String(befehl)}“. Befehle: start, status, runde-ende, tore, paket, review-melden, uebernehmen, haupt-kontrolle, wiederherstellen, ende`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try { process.stdout.write(`${JSON.stringify(fuehreAus(process.argv.slice(2)), null, 2)}\n`); } catch (f) { process.stdout.write(`${JSON.stringify({ fehler: String(f.message) })}\n`); process.exitCode = 1; }
}

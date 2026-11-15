// PreToolUse-Referenzschutz (Bash und PowerShell, Hauptsitzung UND Agenten): Während ein überwachter Orchestrierungslauf aktiv ist (`.claude/orchestrierung/aktiv.json`),
// legt niemand von Hand Git-Referenzen des Hauptrepositorys an oder ändert sie: kein neuer Branch oder Tag, kein update-ref, kein fetch/pull (Remote-Tracking-Referenzen),
// kein switch -c / checkout -b, kein worktree add. Der Integritätswächter (tools/orchestrierung/git.js `zustand`) vergleicht den Hash über ALLE Referenzen und sperrt den Lauf
// bei jeder Abweichung; dieser Hook verhindert den Versehens-Fall vorher. Referenzen werden nur vor `start` oder nach `ende` angelegt; Zwischenstände sichert `runde-ende`
// als Pack-Datei (tools/orchestrierung/sicherung.js), nicht als Branch.
// Er ist eine Schranke gegen Versehen, kein Sandkasten (ein eingebettetes Skript mit anderen Mitteln wird nicht erkannt: dafür bleibt der Wächter) und öffnet nie etwas:
// Ohne aktiven Lauf, bei unlesbarer Eingabe oder bei jedem eigenen Fehler lässt er den Aufruf durch (die Sitzung wird nie wegen eines Hookfehlers blockiert).
// Die Aufrufe des Orchestrierungs-Werkzeugs selbst (`node tools/orchestrierung/cli.js …`) sind nicht betroffen: Seine Git-Schritte laufen als Kindprozesse, nicht als Aufruf dieser Werkzeuge.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hauptWurzel, orchDir, lies } from '../../tools/orchestrierung/lauf.js';

const MIT_WERT = new Set(['-c', '-C', '--git-dir', '--work-tree', '--namespace', '--exec-path']);

/** Git-Aufrufe in einem Befehl: Unterbefehl und die Argumente bis zum Ende des Satzes (auch in eingebetteten Skripten und Ketten mit && ; |). */
export function gitAufrufe(cmd) {
  const l = [];
  for (const m of String(cmd).matchAll(/\bgit(?:\.exe)?\b/gi)) {
    const rest = String(cmd).slice(m.index + m[0].length).split(/[;|&\n]/)[0].slice(0, 400);
    const tok = rest.split(/[\s'"`(),[\]]+/).filter(Boolean);
    for (let i = 0; i < tok.length; i++) {
      if (MIT_WERT.has(tok[i])) { i++; continue; }
      if (tok[i].startsWith('-')) continue;
      l.push({ sub: tok[i], args: tok.slice(i + 1) });
      break;
    }
  }
  return l;
}

const hat = (args, menge) => args.some((a) => menge.has(a) || [...menge].some((m) => m.startsWith('--') && a.startsWith(`${m}=`)));
const positional = (args) => args.filter((a) => !a.startsWith('-'));
const ANZEIGE_BRANCH = new Set(['-l', '--list', '-a', '--all', '-r', '--remotes', '-v', '-vv', '--verbose', '--show-current', '--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--sort', '--format', '--column', '--no-column', '--color', '--no-color', '-i', '--ignore-case']);
const AENDERN_BRANCH = new Set(['-d', '-D', '--delete', '-m', '-M', '--move', '-c', '-C', '--copy', '-f', '--force', '-u', '--set-upstream-to', '--unset-upstream', '-t', '--track', '--no-track', '--edit-description', '--create-reflog']);
const ANZEIGE_TAG = new Set(['-l', '--list', '-n', '--contains', '--no-contains', '--points-at', '--merged', '--no-merged', '-v', '--verify', '--sort', '--format', '--column', '--no-column', '-i', '--ignore-case']);
const AENDERN_TAG = new Set(['-d', '--delete', '-f', '--force', '-a', '--annotate', '-s', '--sign', '-u', '--local-user', '-m', '--message', '-F', '--file']);

/** Gibt den Grund zurück, wenn der Git-Aufruf Referenzen oder die Verwaltungsdaten des Hauptrepositorys schreiben würde, sonst null. */
export function schreibtReferenzen({ sub, args }) {
  switch (sub) {
    case 'branch': return hat(args, AENDERN_BRANCH) || (!hat(args, ANZEIGE_BRANCH) && positional(args).length > 0) ? 'ein Branch wird angelegt, umbenannt oder gelöscht' : null;
    case 'tag': return hat(args, AENDERN_TAG) || (!hat(args, ANZEIGE_TAG) && positional(args).length > 0) ? 'ein Tag wird angelegt oder gelöscht' : null;
    case 'update-ref': return 'update-ref ändert Referenzen unmittelbar';
    case 'symbolic-ref': return args.includes('-d') || args.includes('--delete') || positional(args).length >= 2 ? 'symbolic-ref ändert eine symbolische Referenz' : null;
    case 'fetch': case 'pull': return `${sub} ändert die Remote-Tracking-Referenzen`;
    case 'remote': return positional(args).length && !['show', 'get-url'].includes(positional(args)[0]) ? 'remote ändert Remotes oder Remote-Tracking-Referenzen' : null;
    case 'switch': return hat(args, new Set(['-c', '-C', '--create', '--force-create', '--orphan'])) ? 'switch legt einen Branch an' : null;
    case 'checkout': return hat(args, new Set(['-b', '-B', '--orphan'])) ? 'checkout legt einen Branch an' : null;
    case 'worktree': return positional(args)[0] === 'add' && !args.includes('--detach') ? 'worktree add legt einen Branch an' : (args.includes('-b') || args.includes('-B') ? 'worktree legt einen Branch an' : null);
    case 'replace': case 'notes': return `${sub} schreibt Referenzen`;
    default: return null;
  }
}

/** Grund (Text) oder null für einen ganzen Befehl. */
export function pruefeBefehl(cmd) {
  for (const a of gitAufrufe(cmd)) {
    const grund = schreibtReferenzen(a);
    if (grund) return `git ${a.sub}: ${grund}. Während eines überwachten Orchestrierungslaufs ist das gesperrt (der Integritätswächter sperrt den Lauf bei jeder Referenzänderung). Referenzen nur vor start oder nach ende anlegen; Zwischenstände sichert runde-ende als Pack-Datei.`;
  }
  return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    let roh = '';
    process.stdin.setEncoding('utf8');
    for await (const c of process.stdin) roh += c;
    const ein = JSON.parse(roh);
    if (!['Bash', 'PowerShell'].includes(ein?.tool_name)) process.exit(0);
    let wurzel = null;
    for (const start of [ein.cwd, process.env.CLAUDE_PROJECT_DIR, process.cwd()]) { if (!start || wurzel) continue; try { wurzel = hauptWurzel(start); } catch { /* nächster Versuch */ } }
    if (!wurzel || lies(wurzel)?.status !== 'aktiv') process.exit(0);
    const grund = pruefeBefehl(String(ein.tool_input?.command ?? ''));
    if (grund) {
      try { fs.appendFileSync(path.join(orchDir(wurzel), 'hook.log'), `${JSON.stringify({ zeit: new Date().toISOString(), ereignis: 'PreToolUse', werkzeug: ein.tool_name, ergebnis: 'referenzschutz', grund: grund.slice(0, 120) })}\n`); } catch { /* Protokoll ist nicht kritisch */ }
      process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `Blockwerk-Referenzschutz: ${grund}` } })}\n`);
    }
  } catch { process.exit(0); } // eigener Fehler: nie blockieren
}

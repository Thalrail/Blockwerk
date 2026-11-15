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

/**
 * Zerlegt einen Befehl in Sätze (getrennt durch ; | & oder Zeilenumbruch außerhalb von Anführungszeichen) und Wörter. Anführungszeichen werden entfernt, ein Wort in
 * Anführungszeichen bleibt ganz (Pfade mit Leerzeichen: git -C "C:/Mein Ordner" branch x).
 */
export function saetze(cmd) {
  const s = [];
  let wort = null, satz = [], q = null;
  const wortEnde = () => { if (wort !== null) { satz.push(wort); wort = null; } };
  const satzEnde = () => { wortEnde(); if (satz.length) s.push(satz); satz = []; };
  for (const ch of String(cmd)) {
    if (q) { if (ch === q) q = null; else wort = (wort ?? '') + ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; wort ??= ''; continue; }
    if (ch === '\n' || ch === ';' || ch === '|' || ch === '&') { satzEnde(); continue; }
    if (/\s/.test(ch)) { wortEnde(); continue; }
    wort = (wort ?? '') + ch;
  }
  satzEnde();
  return s;
}

const IST_GIT = /(^|[\\/])git(\.exe)?$/i;
/** Unterbefehl und Argumente ab dem Wort nach `git` (Optionen mit Wert wie -C <Pfad> werden übersprungen) oder null. */
const entschaerfe = (w) => w.replace(/[\\`](?=[A-Za-z-])/g, ''); // git br\anch → git branch (Bash), git br`anch (PowerShell); Pfade sind hier nie das Ziel
function nachGit(roh, ab) {
  const tok = roh.map(entschaerfe);
  for (let i = ab; i < tok.length; i++) {
    if (MIT_WERT.has(tok[i])) { i++; continue; }
    if (tok[i].startsWith('-')) continue;
    return { sub: tok[i], args: tok.slice(i + 1) };
  }
  return null;
}

/**
 * Git-Aufrufe in einem Befehl: Unterbefehl und Argumente. Zwei Wege, beide zählen: (1) streng über die Wörter eines Satzes (Anführungszeichen-bewusst, auch ein Pfad zu git.exe),
 * (2) großzügig über jedes Vorkommen des Worts git, auch in eingebetteten Skripten wie node -e "…git branch x…" (kann bei Text in Meldungen Fehlalarm geben; blockiert dann nur).
 */
export function gitAufrufe(roh) {
  const cmd = String(roh).replace(/\\\r?\n/g, ' ').replace(/`\r?\n/g, ' '); // Zeilenfortsetzungen (Bash \ und PowerShell `) sind ein Leerzeichen
  const l = [];
  for (const tok of saetze(cmd)) {
    for (let k = 0; k < tok.length; k++) { if (!IST_GIT.test(tok[k])) continue; const a = nachGit(tok, k + 1); if (a) l.push(a); }
  }
  for (const m of String(cmd).matchAll(/\bgit(?:\.exe)?\b/gi)) {
    const rest = String(cmd).slice(m.index + m[0].length).split(/[;|&\n]/)[0].slice(0, 400);
    const a = nachGit(rest.split(/[\s'"`(),[\]]+/).filter(Boolean), 0);
    if (a) l.push(a);
  }
  return [...new Map(l.map((a) => [`${a.sub}\0${a.args.join('\0')}`, a])).values()]; // beide Wege liefern oft denselben Aufruf
}

const hat = (args, menge) => args.some((a) => { const o = a.split('=')[0]; return menge.has(a) || menge.has(o) || (o.startsWith('--') && o.length >= 4 && [...menge].some((m) => m.startsWith('--') && m.startsWith(o))); }); // auch eindeutige Kurzformen langer Optionen (--creat)
const positional = (args) => args.filter((a) => !a.startsWith('-'));
/** Kurzoptionen können gebündelt und mit angehängtem Wert vorkommen (-cname, -bname, -fb): enthält eines der Kurz-Bündel (-x…, nicht --lang) einen der Buchstaben? */
const kurz = (args, buchstaben) => args.some((a) => /^-[^-]/.test(a) && [...a.slice(1)].some((ch) => buchstaben.includes(ch)));
const ANZEIGE_BRANCH = new Set(['-l', '--list', '-a', '--all', '-r', '--remotes', '-v', '-vv', '--verbose', '--show-current', '--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--sort', '--format', '--column', '--no-column', '--color', '--no-color', '-i', '--ignore-case']);
const AENDERN_BRANCH = new Set(['-d', '-D', '--delete', '-m', '-M', '--move', '-c', '-C', '--copy', '-f', '--force', '-u', '--set-upstream-to', '--unset-upstream', '-t', '--track', '--no-track', '--edit-description', '--create-reflog']);
const ANZEIGE_TAG = new Set(['-l', '--list', '-n', '--contains', '--no-contains', '--points-at', '--merged', '--no-merged', '-v', '--verify', '--sort', '--format', '--column', '--no-column', '-i', '--ignore-case']);
const AENDERN_TAG = new Set(['-d', '--delete', '-f', '--force', '-a', '--annotate', '-s', '--sign', '-u', '--local-user', '-m', '--message', '-F', '--file']);

/** Gibt den Grund zurück, wenn der Git-Aufruf Referenzen oder die Verwaltungsdaten des Hauptrepositorys schreiben würde, sonst null. */
export function schreibtReferenzen({ sub, args }) {
  switch (sub) {
    case 'branch': return hat(args, AENDERN_BRANCH) || kurz(args, 'dDmMcCfutT') || (!hat(args, ANZEIGE_BRANCH) && !kurz(args, 'larvi') && positional(args).length > 0) ? 'ein Branch wird angelegt, umbenannt oder gelöscht' : null;
    case 'tag': return hat(args, AENDERN_TAG) || kurz(args, 'dfasumF') || (!hat(args, ANZEIGE_TAG) && !kurz(args, 'lnvi') && positional(args).length > 0) ? 'ein Tag wird angelegt oder gelöscht' : null;
    case 'update-ref': return 'update-ref ändert Referenzen unmittelbar';
    case 'symbolic-ref': return args.includes('-d') || args.includes('--delete') || kurz(args, 'd') || positional(args).length >= 2 ? 'symbolic-ref ändert eine symbolische Referenz' : null;
    case 'fetch': case 'pull': return `${sub} ändert die Remote-Tracking-Referenzen`;
    case 'remote': return positional(args).length && !['show', 'get-url'].includes(positional(args)[0]) ? 'remote ändert Remotes oder Remote-Tracking-Referenzen' : null;
    case 'switch': return hat(args, new Set(['-c', '-C', '--create', '--force-create', '--orphan'])) || kurz(args, 'cC') ? 'switch legt einen Branch an' : null;
    case 'checkout': return hat(args, new Set(['-b', '-B', '--orphan', '--track'])) || kurz(args, 'bBt') ? 'checkout legt einen Branch an' : null;
    case 'worktree': return positional(args)[0] === 'add' && !args.includes('--detach') ? 'worktree add legt einen Branch an' : (args.includes('-b') || args.includes('-B') || kurz(args, 'bB') ? 'worktree legt einen Branch an' : null);
    case 'commit': case 'merge': case 'cherry-pick': case 'revert': case 'am': return `${sub} bewegt den Branch (die Referenz) des Hauptrepositorys`;
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

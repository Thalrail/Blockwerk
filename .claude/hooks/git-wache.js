// PreToolUse-Wächter für Agenten (Bash, Write, Edit, MultiEdit, NotebookEdit). Wirkt NUR, wenn der Hook aus einem Subagenten feuert (`agent_id` ist gesetzt,
// laut Schema von Claude Code 2.1.308 sonst nie): die Hauptsitzung bleibt unbeschränkt, ein Fehler dieses Hooks blockiert sie nie.
// Zusätzlich zum Prompt des Entwicklers begrenzt er technisch: keine Git-Schreiboperationen, kein gh/npm install/Netz-Download, kein Verlassen des eigenen Worktrees,
// keine Änderung an Hooks, Einstellungen, Agenten und Skills. Er ist eine zweite Schranke, kein Sandkasten (ein eingebettetes Skript mit anderen Mitteln wäre nicht erkannt).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hauptWurzel, orchDir } from '../../tools/orchestrierung/lauf.js';

const GIT_VERBOTEN = new Set(['commit', 'push', 'branch', 'checkout', 'switch', 'merge', 'cherry-pick', 'rebase', 'reset', 'stash', 'clean', 'tag', 'worktree',
  'update-ref', 'update-index', 'config', 'remote', 'fetch', 'pull', 'restore', 'rm', 'mv', 'add', 'am', 'apply', 'revert', 'gc', 'prune', 'symbolic-ref',
  'submodule', 'read-tree', 'write-tree', 'commit-tree', 'filter-branch', 'reflog']);
const MIT_WERT = new Set(['-c', '-C', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
const sonstVerboten = [
  [/\bgh(\.exe)?\s/i, 'GitHub-CLI (gh) ist für Agenten gesperrt'],
  [/\b(npm|pnpm|yarn)(\.cmd)?\s+(install|i|add|ci|update|upgrade|publish|exec|link|dlx)\b/i, 'Paketinstallation ist für Agenten gesperrt (keine neuen Abhängigkeiten)'],
  [/\bnpx(\.cmd)?\s/i, 'npx ist für Agenten gesperrt'],
  [/\b(curl|wget|Invoke-WebRequest|iwr|certutil|bitsadmin)\b/i, 'Netz-Downloads sind für Agenten gesperrt'],
  [/\bclaude(\.exe)?\s/i, 'Agenten starten keine weiteren Claude-Sitzungen'],
  [/(^|[\s'"=(])\.\.(?=[/\\\s'";|&)]|$)/, 'Verlassen des Worktrees über „..“ ist gesperrt'],
];

/** Git-Unterbefehle, die in einem Befehl vorkommen (auch in eingebetteten Skripten wie node -e "…git push…"). */
export function gitUnterbefehle(cmd) {
  const l = [];
  for (const m of cmd.matchAll(/\bgit(?:\.exe)?\b/gi)) {
    const rest = cmd.slice(m.index + m[0].length).split(/[;|&\n]/)[0].slice(0, 300);
    const tok = rest.split(/[\s'"`(),[\]]+/).filter(Boolean);
    for (let i = 0; i < tok.length; i++) {
      if (MIT_WERT.has(tok[i])) { i++; continue; }
      if (tok[i].startsWith('-')) continue;
      l.push(tok[i]); break;
    }
  }
  return l;
}

/** Pfad mit aufgelösten Verknüpfungen und Kurznamen; nicht vorhandene Enden werden unverändert angehängt. */
function echt(p) {
  let rest = '', d = path.resolve(p);
  while (!fs.existsSync(d) && path.dirname(d) !== d) { rest = path.join(path.basename(d), rest); d = path.dirname(d); }
  let basis = d;
  try { basis = fs.realpathSync.native(d); } catch { /* bleibt */ }
  return path.join(basis, rest);
}
const norm = (p) => echt(p).replace(/\\/g, '/');

/** Gibt den Grund zurück, warum der Aufruf gesperrt ist, oder null. */
export function pruefeAufruf(ein, wurzel) {
  const werkzeug = ein.tool_name, eingabe = ein.tool_input ?? {};
  const erlaubtWurzel = `${norm(wurzel)}/.claude/worktrees/`;
  if (werkzeug === 'Bash') {
    const cmd = String(eingabe.command ?? '');
    for (const sub of gitUnterbefehle(cmd)) if (GIT_VERBOTEN.has(sub)) return `git ${sub} ist für Agenten gesperrt (Git-Schreiboperationen macht nur der Koordinator nach Freigabe von Jonah)`;
    for (const [re, grund] of sonstVerboten) if (re.test(cmd)) return grund;
    const hauptPfad = norm(wurzel);
    const ohneWorktrees = cmd.replace(/\\/g, '/').split(`${hauptPfad}/.claude/worktrees/`).join('');
    if (ohneWorktrees.toLowerCase().includes(hauptPfad.toLowerCase())) return 'Agenten arbeiten nur in ihrem Worktree, nicht im Hauptverzeichnis';
    return null;
  }
  if (!['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(werkzeug)) return null; // Lesen ist nicht Sache des Wächters
  const ziel = eingabe.file_path ?? eingabe.notebook_path ?? eingabe.path;
  if (typeof ziel !== 'string' || !ziel) return null;
  const abs = norm(path.isAbsolute(ziel) ? ziel : path.join(ein.cwd ?? wurzel, ziel));
  if (!abs.toLowerCase().startsWith(erlaubtWurzel.toLowerCase())) return `Schreiben nur im eigenen Worktree (${erlaubtWurzel}…), nicht in ${abs}`;
  const imWorktree = abs.slice(erlaubtWurzel.length).split('/').slice(1).join('/');
  if (/(^|\/)\.git(\/|$)/.test(imWorktree)) return 'Das Git-Verzeichnis ist gesperrt';
  if (/^\.claude\//.test(imWorktree) || /^tools\/orchestrierung\//.test(imWorktree)) return 'Alles unter .claude/ (Hooks, Einstellungen, Agenten, Skills, Orchestrierung) und tools/orchestrierung/ ändert nur der Koordinator';
  return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  let roh = '';
  process.stdin.setEncoding('utf8');
  for await (const c of process.stdin) roh += c;
  let ein = null;
  try { ein = JSON.parse(roh); } catch { process.exit(0); } // unlesbare Eingabe: die Sitzung nie blockieren
  if (!ein?.agent_id) process.exit(0); // Hauptsitzung: unbeschränkt
  // Ab hier ist es ein Agent: im Zweifel gesperrt (ein Fehler des Wächters lähmt den Agenten sichtbar, öffnet aber nichts)
  let wurzel = null;
  for (const start of [ein.cwd, process.env.CLAUDE_PROJECT_DIR, process.cwd()]) { if (!start || wurzel) continue; try { wurzel = hauptWurzel(start); } catch { /* nächster Versuch */ } }
  const sperre = (grund) => {
    if (wurzel) { try { fs.mkdirSync(orchDir(wurzel), { recursive: true }); fs.appendFileSync(path.join(orchDir(wurzel), 'hook.log'), `${JSON.stringify({ zeit: new Date().toISOString(), ereignis: 'PreToolUse', werkzeug: ein.tool_name, ergebnis: 'gesperrt', grund })}\n`); } catch { /* egal */ } }
    process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `Blockwerk-Wächter: ${grund}` } })}\n`);
  };
  if (!wurzel) sperre('Das Hauptverzeichnis konnte nicht bestimmt werden (im Zweifel gesperrt)');
  else { try { const grund = pruefeAufruf(ein, wurzel); if (grund) sperre(grund); } catch (f) { sperre(`Prüfung fehlgeschlagen, im Zweifel gesperrt: ${f.message}`); } }
}

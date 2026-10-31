// Hook für WorktreeCreate / WorktreeRemove (Claude Code 2.1.308, im Wegwerf-Repo nachgewiesen).
// Create: legt den Worktree des Agenten auf dem Snapshot des laufenden Orchestrierungslaufs an (S0 oder Zwischen-Snapshot der letzten Runde) und gibt seinen
// absoluten Pfad auf stdout aus. Bei jedem Zweifel Exit-Code 1: Claude bricht den Agentenstart ab (fail-closed), es gibt keinen stillen Rückfall.
// Remove: tut nichts – der Koordinator räumt mit „ende“ auf, die Worktrees bleiben für Korrekturschleifen erhalten.
// Protokoll: .claude/orchestrierung/hook.log (nur Ereignis, Name, Ergebnis; nie Umgebungswerte, Befehle oder Inhalte).
import fs from 'node:fs';
import path from 'node:path';
import { hauptWurzel, worktreeAnlegen, orchDir } from '../../tools/orchestrierung/lauf.js';

let roh = '';
process.stdin.setEncoding('utf8');
for await (const c of process.stdin) roh += c;
let ein = null;
try { ein = JSON.parse(roh); } catch { /* bleibt null */ }

const cwd = ein?.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const protokoll = (obj) => {
  try {
    const w = hauptWurzel(cwd);
    fs.mkdirSync(orchDir(w), { recursive: true });
    fs.appendFileSync(path.join(orchDir(w), 'hook.log'), `${JSON.stringify({ zeit: new Date().toISOString(), ...obj })}\n`);
  } catch { /* Protokollfehler dürfen den Hook nicht kippen */ }
};

if (ein?.hook_event_name === 'WorktreeCreate') {
  try {
    const w = hauptWurzel(cwd);
    const ziel = worktreeAnlegen(w, ein.name);
    protokoll({ ereignis: 'WorktreeCreate', name: ein.name, ergebnis: 'erstellt', ziel });
    process.stdout.write(`${ziel}\n`);
  } catch (f) {
    protokoll({ ereignis: 'WorktreeCreate', name: ein?.name ?? null, ergebnis: 'abgelehnt', grund: String(f.message).slice(0, 300) });
    process.stderr.write(`Blockwerk-Orchestrierung: ${f.message}\n`);
    process.exit(1);
  }
} else if (ein?.hook_event_name === 'WorktreeRemove') {
  protokoll({ ereignis: 'WorktreeRemove', pfad: ein.worktree_path, ergebnis: 'nicht entfernt (der Koordinator räumt mit „ende“ auf)' });
} else {
  process.stderr.write('Blockwerk-Orchestrierung: unbekanntes oder unlesbares Hook-Ereignis\n');
  process.exit(1);
}

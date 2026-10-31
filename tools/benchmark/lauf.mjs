// Benchmark-Lauf: node tools/benchmark/lauf.mjs --basis <Ordner> --aufgabe T1|T2|T3 --modell sonnet|haiku [--name X] [--budget 2] [--ausgabe <Ordner>]
// Kopiert die Basis (ohne .git und node_modules) in einen neuen Ordner, setzt einen Git-Ausgangspunkt, baut ggf. den Fehler ein, startet `claude -p`
// (nur Projekteinstellungen, keine MCP-Server, keine Hooks) und wertet Tokens, Aufrufe, Dauer, Kosten und die Abnahme aus. Ergebnis: eine JSON-Zeile.
// Programmpfad über CLAUDE_EXE, sonst `claude`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { AUFGABEN } from './aufgaben.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const basis = path.resolve(arg('basis'));
const aufgabeId = arg('aufgabe');
const modell = arg('modell', 'sonnet');
const name = arg('name', `${path.basename(basis)}-${modell}`);
const ausgabe = path.resolve(arg('ausgabe', path.join(os.tmpdir(), 'blockwerk-benchmark')));
const aufgabe = AUFGABEN[aufgabeId];
if (!aufgabe) { console.error('Aufgabe unbekannt'); process.exit(2); }
const exe = process.env.CLAUDE_EXE || 'claude';

const ziel = path.join(ausgabe, `${aufgabeId}-${name}`);
fs.rmSync(ziel, { recursive: true, force: true });
const AUSGELASSEN = /[\\/](\.git|node_modules)$|[\\/]\.claude[\\/](worktrees|orchestrierung|hooks)$|[\\/]\.claude[\\/]settings\.json$/;
fs.cpSync(basis, ziel, { recursive: true, filter: (q) => !AUSGELASSEN.test(q) });
aufgabe.vorbereiten(ziel);
const git = (...a) => spawnSync('git', ['-c', 'user.name=bench', '-c', 'user.email=b@b', ...a], { cwd: ziel, encoding: 'utf8' });
git('init', '-q'); git('add', '-A'); git('commit', '-q', '-m', 'Ausgangspunkt');

// Nur das Nötigste an Umgebung (keine Zugangsdaten); Anmeldung des Programms liegt in dessen eigenem Profil
const env = {};
for (const k of ['PATH', 'Path', 'SystemRoot', 'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'COMSPEC', 'PATHEXT']) if (process.env[k]) env[k] = process.env[k];
// Bash nur für Tests, Karte und Git-Lesebefehle; kein Netz, kein Schreiben außerhalb der Kopie über Befehle
const ERLAUBT = 'Read,Grep,Glob,Edit,Write,Skill,Bash(node --test *),Bash(node tools/karte.js *),Bash(npm run test:kurz),Bash(git diff *),Bash(git status *)';
const t0 = Date.now();
const r = spawnSync(exe, ['-p', aufgabe.auftrag, '--model', modell, '--setting-sources', 'project', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
  '--no-session-persistence', '--permission-mode', 'acceptEdits', '--allowedTools', ERLAUBT, '--max-budget-usd', arg('budget', '2'),
  '--output-format', 'stream-json', '--verbose'], { cwd: ziel, env, encoding: 'utf8', timeout: 1500000, maxBuffer: 256 << 20 });
const dauer = (Date.now() - t0) / 1000;
const ev = (r.stdout || '').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const aufrufe = new Map();
let werkzeuge = 0, agenten = 0;
for (const e of ev) {
  if (e.type !== 'assistant' || e.parent_tool_use_id) continue;
  aufrufe.set(e.message.id, e.message.usage);
  for (const c of e.message.content ?? []) if (c.type === 'tool_use') { werkzeuge++; if (c.name === 'Agent' || c.name === 'Task') agenten++; }
}
const u = [...aufrufe.values()];
const kontext = (x) => (x.input_tokens ?? 0) + (x.cache_creation_input_tokens ?? 0) + (x.cache_read_input_tokens ?? 0);
const res = ev.find((e) => e.type === 'result');
const abnahme = aufgabe.abnehmen(ziel, res?.result ?? '');
console.log(JSON.stringify({
  aufgabe: aufgabeId, name, modell, ok: abnahme.ok, abnahme: abnahme.hinweis,
  startKontext: u[0] ? kontext(u[0]) : null, modellrunden: u.length, kontextSumme: u.reduce((s, x) => s + kontext(x), 0),
  neuGeschrieben: u.reduce((s, x) => s + (x.cache_creation_input_tokens ?? 0), 0), ausgabeTokens: u.reduce((s, x) => s + (x.output_tokens ?? 0), 0),
  werkzeugaufrufe: werkzeuge, agentenaufrufe: agenten, dauerSek: Math.round(dauer), kosteUsd: res?.total_cost_usd ?? null, status: res?.subtype ?? `exit ${r.status}`,
}));

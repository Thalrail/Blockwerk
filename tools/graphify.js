// Optionales Codeanalyse-Werkzeug (Graphify, lokal, ohne LLM). Standard bleibt `tools/karte.js`; das hier nur für Aufrufketten und modulübergreifende Analysen.
//   node tools/graphify.js status            verfügbar? Graph vorhanden? veraltet?
//   node tools/graphify.js bauen             Graph aus src, tools, test neu erstellen (rund 1 Minute; nur auf Bedarf)
//   node tools/graphify.js erklaere <Name>   Funktion mit Aufrufern und Aufgerufenen
//   node tools/graphify.js pfad <A> <B>      kürzester Aufrufpfad (A ruft ... B)
// Graphify liegt in `.werkzeuge/graphify/venv` (oder GRAPHIFY_EXE), ist keine Abhängigkeit und fehlt es, endet jeder Befehl mit Code 3 und dem Hinweis auf die Karte.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arbeit = path.join(os.tmpdir(), 'blockwerk-graphify'); // außerhalb des Repos
const kopie = path.join(arbeit, 'kopie');
const quellen = ['src', 'tools', 'test'];
const NICHT_VERFUEGBAR = 'Graphify nicht verfügbar: stattdessen `node tools/karte.js` verwenden (Einrichtung: docs/token-effizienz.md).';

export function programm(env = process.env) {
  const kandidaten = [env.GRAPHIFY_EXE, ...['Scripts/graphify.exe', 'bin/graphify'].map((p) => path.join(wurzel, '.werkzeuge', 'graphify', 'venv', p))];
  return kandidaten.find((p) => p && fs.existsSync(p)) ?? null;
}

const graphDatei = () => path.join(kopie, 'graphify-out', 'graph.json');

function neuesteQuelle(ordner) {
  let neu = 0;
  for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const voll = path.join(ordner, e.name);
    if (e.isDirectory()) neu = Math.max(neu, neuesteQuelle(voll));
    else if (/\.m?js$/.test(e.name)) neu = Math.max(neu, fs.statSync(voll).mtimeMs);
  }
  return neu;
}

export function status(env = process.env) {
  const exe = programm(env);
  if (!exe) return { verfuegbar: false, text: NICHT_VERFUEGBAR };
  if (!fs.existsSync(graphDatei())) return { verfuegbar: true, graph: false, text: 'Graphify da, aber noch kein Graph: `node tools/graphify.js bauen`.' };
  const stand = fs.statSync(graphDatei()).mtimeMs;
  const veraltet = quellen.some((q) => neuesteQuelle(path.join(wurzel, q)) > stand);
  return { verfuegbar: true, graph: true, veraltet, text: veraltet ? 'Graph veraltet: vor der Analyse `node tools/graphify.js bauen`.' : 'Graph aktuell.' };
}

// Keine Zugangsdaten und keine Modell-Schlüssel an Graphify: nur Pfad- und Profilvariablen
function umgebung() {
  const env = {};
  for (const k of ['PATH', 'Path', 'SystemRoot', 'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'COMSPEC', 'PATHEXT']) if (process.env[k]) env[k] = process.env[k];
  return env;
}

function lauf(exe, args, cwd) {
  const r = spawnSync(exe, args, { cwd, env: umgebung(), encoding: 'utf8', timeout: 600000, maxBuffer: 64 << 20 });
  return { code: r.status ?? 1, text: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

export function bauen(exe) {
  fs.rmSync(kopie, { recursive: true, force: true });
  fs.mkdirSync(kopie, { recursive: true });
  for (const q of quellen) fs.cpSync(path.join(wurzel, q), path.join(kopie, q), { recursive: true, filter: (p) => !/[\\/]node_modules$/.test(p) });
  return lauf(exe, ['update', '.'], kopie);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [befehl, a, b] = process.argv.slice(2);
  const exe = programm();
  if (!exe) { console.error(NICHT_VERFUEGBAR); process.exit(3); }
  let r;
  if (befehl === 'status') { console.log(status().text); process.exit(0); }
  else if (befehl === 'bauen') { r = bauen(exe); r.text = r.text.split('\n').slice(-6).join('\n'); }
  else if ((befehl === 'erklaere' && a) || (befehl === 'pfad' && a && b)) {
    if (!fs.existsSync(graphDatei())) { console.error('Noch kein Graph: `node tools/graphify.js bauen`.'); process.exit(4); }
    if (status().veraltet) console.error('Hinweis: Graph veraltet (Quellen neuer), ggf. `bauen`.');
    r = lauf(exe, befehl === 'erklaere' ? ['explain', a] : ['path', a, b, '--undirected'], kopie);
  } else { console.error('Aufruf: node tools/graphify.js status | bauen | erklaere <Name> | pfad <A> <B>'); process.exit(2); }
  console.log(r.text);
  process.exit(r.code);
}

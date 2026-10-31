// Hilfen für die Orchestrierungs-Tests: Wegwerf-Repositories in einem Temp-Ordner (nie das echte Blockwerk-Repository).
// Eine Vorlage mit künstlichem uncommittetem Stand wird einmal gebaut und für jeden Test kopiert (schnell).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git } from '../../tools/orchestrierung/git.js';

export const WURZEL = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-orch-test-'));
process.on('exit', () => { try { fs.rmSync(WURZEL, { recursive: true, force: true, maxRetries: 3 }); } catch { /* egal */ } });

export const w = (repo, p, inhalt) => { const abs = path.join(repo, p); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, inhalt); };
export const r = (repo, p) => fs.readFileSync(path.join(repo, p));
export const text = (repo, p) => r(repo, p).toString('utf8');
let zaehler = 0;
export const neuerName = (n = 'x') => path.join(WURZEL, `${n}${++zaehler}`);

const vorlagen = new Map();

/** Vorlage: Blockwerk-ähnliches Repository mit Commit, Stash-Eintrag und künstlichem uncommittetem Stand. */
export function vorlage({ autocrlf = false } = {}) {
  const schluessel = String(autocrlf);
  if (vorlagen.has(schluessel)) return vorlagen.get(schluessel);
  const dir = path.join(WURZEL, `vorlage-${schluessel}`);
  fs.mkdirSync(dir, { recursive: true });
  const g = (...a) => git(dir, a);
  g('init', '-q', '-b', 'main'); g('config', 'user.name', 't'); g('config', 'user.email', 't@t'); g('config', 'core.autocrlf', String(autocrlf)); g('config', 'core.filemode', 'false');
  w(dir, 'package.json', `${JSON.stringify({ name: 'x', type: 'module', engines: { node: '>=22' }, scripts: { test: 'echo' } }, null, 2)}\n`);
  w(dir, '.gitignore', 'ignoriert/\n*.log\n.claude/worktrees/\n.claude/orchestrierung/\n');
  w(dir, '.claude/launch.json', '{"version":"0.0.1"}\n');
  w(dir, 'docs/entscheidungen.md', '# Entscheidungen\n');
  w(dir, 'docs/stand.md', '# Stand\n');
  w(dir, 'docs/crlf.md', 'x\r\ny\r\n');
  w(dir, 'docs/keep.md', 'bleibt\n');
  w(dir, 'docs/zu_loeschen.md', 'weg\n');
  w(dir, 'src/a.js', 'eins\nzwei\ndrei\nvier\nfünf\n');
  w(dir, 'src/b.js', 'export const b = 1;\n');
  w(dir, 'src/ebene1/e1.js', 'export const e1 = 1;\n');
  w(dir, 'src/ebene2/e2.js', "import { e1 } from '../ebene1/e1.js';\nexport const e2 = e1;\n");
  w(dir, 'src/ebene3/e3.js', "import { e2 } from '../ebene2/e2.js';\nexport const e3 = e2;\n");
  w(dir, 'data/data.bin', Buffer.from([0, 1, 2, 255, 254, 0, 10, 13, 10, 7]));
  w(dir, 'data/regeln/lore.json', `${JSON.stringify({ bereich: 'lore', regeln: [
    { id: 'lore.auslauf', titel: 't', regel: 'r', quelle: 'q', status: 'simuliert', ungeprueft: false, parameter: { n: 1 } },
    { id: 'plan.beispiel', titel: 't', regel: 'r', quelle: 'q', status: 'simuliert', ungeprueft: false, parameter: { n: 1 } },
  ] }, null, 2)}\n`);
  g('add', '-A'); g('commit', '-q', '-m', 'basis');
  w(dir, 'docs/keep.md', 'stash-inhalt\n'); g('stash', 'push', '-q'); // ein Stash-Eintrag, der unberührt bleiben muss
  // künstlicher uncommitteter Stand: geändert (auch gestaged + weiter geändert), gelöscht, neu, ignoriert, sensibel, nicht erlaubt
  w(dir, 'src/a.js', 'eins\nZWEI\ndrei\nvier\nfünf\n');
  w(dir, 'src/b.js', 'export const b = 2;\n'); g('add', 'src/b.js'); w(dir, 'src/b.js', 'export const b = 3;\n');
  fs.rmSync(path.join(dir, 'docs/zu_loeschen.md'));
  w(dir, 'docs/neu.md', 'neu\n'); w(dir, 'src/neu/dir/y.js', "import { b } from '../../b.js';\nexport default b;\n"); w(dir, 'data/neu.bin', Buffer.from([9, 0, 8, 0, 255]));
  w(dir, 'ignoriert/zeug.txt', 'ignoriert\n'); w(dir, 'debug.log', 'log\n');
  w(dir, '.env', 'TOKEN=abc\n'); w(dir, 'fremd/zeug.txt', 'nicht erlaubt\n'); w(dir, 'data/token.json', '{}\n'); w(dir, '.claude/settings.local.json', '{}\n');
  vorlagen.set(schluessel, dir);
  return dir;
}

/** Eigene Kopie der Vorlage (samt .git). */
export function neuesRepo(opt) {
  const ziel = neuerName('repo');
  fs.cpSync(vorlage(opt), ziel, { recursive: true });
  return ziel;
}

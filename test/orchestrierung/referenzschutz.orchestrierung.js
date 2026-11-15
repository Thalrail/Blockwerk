// Orchestrierung: Referenzschutz (.claude/hooks/ref-wache.js). Während eines aktiven Laufs legt niemand von Hand Branches, Tags oder andere Referenzen des Hauptrepositorys an
// (Hauptsitzung und Agenten, Bash und PowerShell). Ohne Lauf, bei unlesbarer Eingabe und bei eigenen Fehlern lässt der Hook alles durch (er blockiert nie wegen eines Hookfehlers).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { git, zustand } from '../../tools/orchestrierung/git.js';
import * as lauf from '../../tools/orchestrierung/lauf.js';
import { pruefeBefehl, gitAufrufe } from '../../.claude/hooks/ref-wache.js';
import { neuesRepo } from './hilfe.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WACHE = path.resolve(HIER, '../../.claude/hooks/ref-wache.js');
const wurzel = path.resolve(HIER, '../..');
const ruf = (cwd, ein) => {
  const r = spawnSync(process.execPath, [WACHE], { input: typeof ein === 'string' ? ein : JSON.stringify(ein), encoding: 'utf8', cwd });
  let aus = null; try { aus = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { /* leer */ }
  return { status: r.status, aus, stdout: r.stdout };
};
const befehl = (repo, tool_name, command, extra = {}) => ({ tool_name, tool_input: { command }, cwd: repo, hook_event_name: 'PreToolUse', ...extra });
const gesperrt = (r) => r.aus?.hookSpecificOutput?.permissionDecision === 'deny';

const GESPERRT = [
  'git branch neu', 'git branch -f x HEAD', 'git branch -d alt', 'git branch -D alt', 'git branch -m a b', 'git branch -u origin/main', 'git branch --set-upstream-to=origin/main',
  'git tag v1', 'git tag -a v1 -m x', 'git tag -d v1', 'git update-ref refs/heads/x HEAD', 'git symbolic-ref HEAD refs/heads/x', 'git symbolic-ref -d HEAD',
  'git fetch', 'git fetch origin', 'git pull', 'git remote add x url', 'git remote update', 'git remote prune origin', 'git switch -c neu', 'git switch --create neu',
  'git checkout -b neu', 'git checkout -B neu', 'git worktree add ../x', 'git worktree add -b x ../x', 'git replace a b', 'git notes add -m x',
  'git status && git branch zwischenstand', 'cd repo; git tag marke', 'git -C /pfad branch neu', 'git.exe fetch --all', `node -e "require('child_process').execSync('git branch x')"`,
  'echo ok | git update-ref refs/x HEAD',
];
const ERLAUBT = [
  'git status', 'git status --short', 'git diff', 'git diff --stat', 'git log --oneline -5', 'git show HEAD', 'git branch', 'git branch --list', 'git branch --list claude/*', 'git branch -a', 'git branch -r',
  'git branch -vv', 'git branch --show-current', 'git branch --contains abc123', 'git tag', 'git tag -l', 'git tag --list v*', 'git remote', 'git remote -v', 'git remote get-url origin',
  'git symbolic-ref HEAD', 'git switch main', 'git checkout -- datei', 'git worktree list', 'git rev-parse HEAD', 'git for-each-ref', 'git cat-file -t abc', 'git ls-files',
  'node tools/orchestrierung/cli.js status', 'node tools/orchestrierung/cli.js ende --verwerfen', 'npm run test:kurz', 'cat .gitignore', 'ls -la',
];

test('pruefeBefehl: alle Aufrufe, die Referenzen schreiben, werden erkannt (auch in Ketten, mit -C und in eingebetteten Skripten); Lesendes und das Orchestrierungs-Werkzeug nicht', () => {
  for (const c of GESPERRT) assert.ok(pruefeBefehl(c), `sollte gesperrt sein: ${c}`);
  for (const c of ERLAUBT) assert.equal(pruefeBefehl(c), null, `sollte erlaubt sein: ${c}`);
  assert.match(pruefeBefehl('git branch x'), /Integritätswächter/);
  assert.deepEqual(gitAufrufe('git -C /x branch neu').map((a) => a.sub), ['branch']);
});

test('Hook im aktiven Lauf: sperrt in Bash und PowerShell, auch für Agenten und in Ketten; erlaubt Lesendes und das Werkzeug', () => {
  const repo = neuesRepo();
  lauf.starten(repo, { auftrag: 'Referenzschutz', dateien: ['src/**'] });
  for (const tool of ['Bash', 'PowerShell']) {
    for (const c of ['git branch claude/zwischenstand', 'git tag x', 'git status && git switch -c y', 'git fetch origin']) {
      const r = ruf(repo, befehl(repo, tool, c));
      assert.ok(gesperrt(r), `${tool}: ${c}`);
      assert.match(r.aus.hookSpecificOutput.permissionDecisionReason, /Referenzschutz/);
    }
    for (const c of ['git status', 'git branch --list', 'git log --oneline -3', 'node tools/orchestrierung/cli.js status']) {
      const r = ruf(repo, befehl(repo, tool, c));
      assert.equal(r.status, 0); assert.equal(r.aus, null, `${tool}: ${c}`);
    }
  }
  assert.ok(gesperrt(ruf(repo, befehl(repo, 'Bash', 'git branch x', { agent_id: 'a1' }))), 'gilt auch für Agenten');
  // andere Werkzeuge sind nicht Sache dieses Hooks
  assert.equal(ruf(repo, { tool_name: 'Write', tool_input: { file_path: path.join(repo, 'x'), content: 'git branch x' }, cwd: repo }).aus, null);
  // das Anwenden hat keine Referenz angelegt (der Hook blockiert, er führt nichts aus)
  assert.equal(git(repo, ['branch', '--list', 'claude/zwischenstand']).trim(), '');
  assert.ok(fs.readFileSync(path.join(repo, '.claude', 'orchestrierung', 'hook.log'), 'utf8').includes('"ergebnis":"referenzschutz"'));
});

test('Hook ohne Lauf oder nach dem Beenden: alles erlaubt; Versehen im Lauf blockiert, nach ende ist der Weg wieder frei', () => {
  const repo = neuesRepo();
  assert.equal(ruf(repo, befehl(repo, 'Bash', 'git branch frei')).aus, null, 'ohne Lauf');
  lauf.starten(repo, { auftrag: 'Referenzschutz', dateien: ['src/**'] });
  assert.ok(gesperrt(ruf(repo, befehl(repo, 'Bash', 'git branch gesperrt'))));
  lauf.beenden(repo);
  assert.equal(ruf(repo, befehl(repo, 'Bash', 'git branch wieder-frei')).aus, null, 'nach ende');
});

test('Negativ (öffnet nie etwas, blockiert nie wegen eigener Fehler): unlesbare Eingabe, kein Git-Verzeichnis, kaputter Laufzustand → durchgelassen, ohne Ausgabe', () => {
  const repo = neuesRepo();
  lauf.starten(repo, { auftrag: 'Referenzschutz', dateien: ['src/**'] });
  assert.deepEqual(ruf(repo, 'kein json'), { status: 0, aus: null, stdout: '' });
  assert.deepEqual(ruf(repo, '').aus, null);
  const leer = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-kein-git-'));
  try { assert.equal(ruf(leer, befehl(leer, 'Bash', 'git branch x')).aus, null); } finally { fs.rmSync(leer, { recursive: true, force: true }); }
  fs.writeFileSync(path.join(repo, '.claude', 'orchestrierung', 'aktiv.json'), '{ kaputt');
  const r = ruf(repo, befehl(repo, 'Bash', 'git branch x'));
  assert.equal(r.status, 0); assert.equal(r.aus, null);
});

test('Der Hook ändert selbst nichts am Hauptrepository (Abdruck vorher = nachher) und der Wächter bleibt streng: eine echte Referenzänderung sperrt weiterhin die Kontrolle', () => {
  const repo = neuesRepo();
  lauf.starten(repo, { auftrag: 'Referenzschutz', dateien: ['src/**'] });
  const vorher = zustand(repo, { ausser: lauf.AUSSER });
  ruf(repo, befehl(repo, 'Bash', 'git branch x'));
  const nachher = zustand(repo, { ausser: lauf.AUSSER });
  for (const k of ['head', 'zweig', 'stash', 'refs', 'index']) assert.equal(nachher[k], vorher[k], k);
  git(repo, ['branch', 'x']); // der Hook ist eine Schranke gegen Versehen: ein Umweg am Hook vorbei wird vom Wächter trotzdem erkannt
  assert.equal(lauf.hauptKontrolle(repo).unveraendert, false);
});

test('settings.json: der Referenzschutz ist für Bash und PowerShell verdrahtet, die bisherigen Wächter und Sperren bleiben unverändert', () => {
  const e = JSON.parse(fs.readFileSync(path.join(wurzel, '.claude/settings.json'), 'utf8'));
  const pre = e.hooks.PreToolUse;
  assert.equal(pre[0].matcher, 'Bash|Write|Edit|MultiEdit|NotebookEdit');
  assert.ok(pre[0].hooks.some((h) => h.command.includes('git-wache.js')));
  const ref = pre.find((x) => x.hooks.some((h) => h.command.includes('ref-wache.js')));
  assert.ok(ref, 'ref-wache.js ist eingetragen');
  assert.deepEqual(ref.matcher.split('|').sort(), ['Bash', 'PowerShell']);
  assert.ok(fs.existsSync(path.join(wurzel, '.claude', 'hooks', 'ref-wache.js')));
  for (const sperre of ['Bash(git push *)', 'Bash(gh pr *)', 'Bash(git reset *)', 'Bash(git clean *)', 'Bash(git stash *)', 'Bash(git rebase *)']) assert.ok(e.permissions.deny.includes(sperre), sperre);
  assert.ok(e.permissions.ask.includes('Bash(git commit *)'));
});

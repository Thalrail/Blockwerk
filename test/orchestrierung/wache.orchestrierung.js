// Orchestrierung: PreToolUse-Wächter für Agenten (Git-Schreiboperationen, Installationen, Verlassen des Worktrees, geschützte Dateien).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitUnterbefehle, pruefeAufruf } from '../../.claude/hooks/git-wache.js';
import { neuesRepo } from './hilfe.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WACHE = path.resolve(HIER, '../../.claude/hooks/git-wache.js');
const vor = (p) => p.replace(/\\/g, '/');

const ruf = (repo, ein) => { fs.mkdirSync(path.join(repo, '.claude', 'worktrees', 'agent-1'), { recursive: true }); const r = spawnSync(process.execPath, [WACHE], { input: typeof ein === 'string' ? ein : JSON.stringify(ein), encoding: 'utf8', cwd: repo, env: { ...process.env, CLAUDE_PROJECT_DIR: repo } }); return { status: r.status, aus: r.stdout.trim() ? JSON.parse(r.stdout) : null, err: r.stderr }; };
const agent = (repo, tool_name, tool_input, extra = {}) => ({ agent_id: 'a1', tool_name, tool_input, cwd: `${vor(repo)}/.claude/worktrees/agent-1`, hook_event_name: 'PreToolUse', ...extra });
const gesperrt = (r) => r.aus?.hookSpecificOutput?.permissionDecision === 'deny';

test('Git-Unterbefehle werden auch in Optionen und eingebetteten Skripten erkannt', () => {
  assert.deepEqual(gitUnterbefehle('git status'), ['status']);
  assert.deepEqual(gitUnterbefehle('git -C /x commit -m "a"'), ['commit']);
  assert.deepEqual(gitUnterbefehle('git -c core.x=1 push origin main'), ['push']);
  assert.deepEqual(gitUnterbefehle(`node -e "require('child_process').execSync('git reset --hard')"`), ['reset']);
  assert.deepEqual(gitUnterbefehle('echo hallo && git diff HEAD -- docs/add.md'), ['diff']);
  assert.deepEqual(gitUnterbefehle('git.exe stash list'), ['stash']);
  assert.deepEqual(gitUnterbefehle('cat .gitignore'), [], '.gitignore ist kein Git-Aufruf');
});

test('Wächter: Hauptsitzung bleibt unbeschränkt, unlesbare Eingabe blockiert nie', () => {
  const repo = neuesRepo();
  const haupt = ruf(repo, { tool_name: 'Bash', tool_input: { command: 'git commit -m x' }, cwd: repo });
  assert.equal(haupt.status, 0); assert.equal(haupt.aus, null);
  for (const roh of ['kein json', '', '{}', '{"agent_id":"a"}']) { const r = ruf(repo, roh); assert.equal(r.status, 0, roh); assert.equal(r.aus, null, roh); }
});

test('Wächter: Agenten dürfen lesen und prüfen, aber nicht in Git schreiben, installieren, laden oder ausbrechen', () => {
  const repo = neuesRepo();
  const bash = (command) => ruf(repo, agent(repo, 'Bash', { command }));
  for (const ok of ['git status', 'git diff --stat', 'git log --oneline -5', 'git show HEAD:src/a.js', 'git rev-parse HEAD', 'git ls-files', 'npm test', 'node --test test/x.test.js', 'ls -a', 'cat package.json', 'git diff --check']) {
    assert.equal(gesperrt(bash(ok)), false, ok);
  }
  for (const nein of ['git commit -m x', 'git push origin main', 'git branch neu', 'git checkout -b x', 'git switch main', 'git merge x', 'git rebase main', 'git reset --hard',
    'git stash', 'git clean -fd', 'git tag v1', 'git worktree add x', 'git add -A', 'git apply p.patch', 'git config user.name x', 'git -C . commit -m x', 'git update-ref HEAD x',
    `node -e "require('child_process').execSync('git push')"`, 'gh pr create', 'gh api repos/x', 'npm install lodash', 'npm i x', 'npm ci', 'npx foo', 'curl https://x.de', 'wget https://x.de',
    'claude -p hallo', 'cd .. && ls', 'cat ../../x', `cat ${vor(repo)}/package.json`]) {
    assert.equal(gesperrt(bash(nein)), true, nein);
  }
  // der eigene Worktree unter dem Hauptverzeichnis ist ausdrücklich erlaubt
  assert.equal(gesperrt(bash(`cat ${vor(repo)}/.claude/worktrees/agent-1/package.json`)), false);
  assert.match(bash('git commit -m x').aus.hookSpecificOutput.permissionDecisionReason, /Blockwerk-Wächter: git commit ist für Agenten gesperrt/);
});

test('Wächter: Schreiben nur im eigenen Worktree und nie an Hooks, Einstellungen, Agenten, Skills, Orchestrierung oder .git', () => {
  const repo = neuesRepo();
  const wt = `${vor(repo)}/.claude/worktrees/agent-1`;
  const schreibe = (tool, file_path) => ruf(repo, agent(repo, tool, { file_path }));
  for (const tool of ['Write', 'Edit']) {
    assert.equal(gesperrt(schreibe(tool, `${wt}/src/a.js`)), false, `${tool} im Worktree`);
    assert.equal(gesperrt(schreibe(tool, 'src/relativ.js')), false, `${tool} relativ zum Worktree`);
    assert.equal(gesperrt(schreibe(tool, `${vor(repo)}/src/a.js`)), true, `${tool} im Hauptbaum`);
    assert.equal(gesperrt(schreibe(tool, `${wt}/../../../src/a.js`)), true, `${tool} mit .. im Pfad`);
    assert.equal(gesperrt(schreibe(tool, 'C:/Windows/x.txt')), true, `${tool} außerhalb`);
    for (const p of ['.claude/settings.json', '.claude/launch.json', '.claude/hooks/x.js', '.claude/agents/x.md', '.claude/skills/x/SKILL.md', '.claude/orchestrierung/aktiv.json', 'tools/orchestrierung/x.js', '.git/config']) {
      assert.equal(gesperrt(schreibe(tool, `${wt}/${p}`)), true, `${tool} ${p}`);
    }
  }
  assert.equal(gesperrt(ruf(repo, agent(repo, 'NotebookEdit', { notebook_path: `${vor(repo)}/x.ipynb` }))), true);
  assert.equal(gesperrt(ruf(repo, agent(repo, 'Read', { file_path: `${vor(repo)}/src/a.js` }))), false, 'Lesen ist nicht Sache des Wächters');
  assert.equal(pruefeAufruf(agent(repo, 'Write', { file_path: `${wt}/src/x.js` }), repo), null);
});

test('Wächter: kann er bei einem Agenten nichts prüfen, sperrt er (fail-closed); die Hauptsitzung bleibt frei', () => {
  const ohneGit = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-kein-git-'));
  try {
    const env = { ...process.env }; delete env.CLAUDE_PROJECT_DIR;
    const r = spawnSync(process.execPath, [WACHE], { input: JSON.stringify({ agent_id: 'a1', tool_name: 'Bash', tool_input: { command: 'ls' }, cwd: ohneGit }), encoding: 'utf8', cwd: ohneGit, env });
    assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny');
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason, /im Zweifel gesperrt/);
    const haupt = spawnSync(process.execPath, [WACHE], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push' }, cwd: ohneGit }), encoding: 'utf8', cwd: ohneGit, env });
    assert.equal(haupt.stdout, '');
  } finally { fs.rmSync(ohneGit, { recursive: true, force: true }); }
});

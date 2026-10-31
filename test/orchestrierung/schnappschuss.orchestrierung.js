// Orchestrierung: Snapshot, Seed, mehrere Runden, Wiederherstellung eines verlorenen Worktrees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { git, zustand, baumHash } from '../../tools/orchestrierung/git.js';
import { schnappschuss, vergleicheMitPlatte, seed, GeheimnisFehler } from '../../tools/orchestrierung/schnappschuss.js';
import { aenderungen, patch } from '../../tools/orchestrierung/delta.js';
import { neuesRepo, neuerName, w, r, text } from './hilfe.js';

test('Snapshot: vollständig, bytegenau, nichts am Original verändert, deterministisch', () => {
  const repo = neuesRepo();
  const vorher = zustand(repo);
  const s = schnappschuss(repo, { id: 'a' });
  assert.deepEqual(zustand(repo), vorher, 'HEAD, Zweig, Index, Stash, Refs und Arbeitsbaum unverändert');
  assert.deepEqual(vergleicheMitPlatte(repo, s.commit, { ausgeschlossen: s.ausgeschlossen }).fehler, []);
  const dateien = git(repo, ['ls-tree', '-r', '--name-only', s.commit]).split('\n').filter(Boolean);
  for (const p of ['docs/neu.md', 'src/neu/dir/y.js', 'data/neu.bin']) assert.ok(dateien.includes(p), `${p} (untracked, erlaubt) fehlt`);
  assert.ok(!dateien.includes('docs/zu_loeschen.md'), 'gelöschte Datei fehlt');
  assert.ok(!dateien.some((p) => /ignoriert|debug\.log|\.env|fremd|token\.json|settings\.local/.test(p)), 'ignoriert, sensibel und nicht erlaubt fehlen');
  assert.deepEqual(s.ausgeschlossen.map((x) => `${x.pfad}:${x.grund}`).sort(), ['.claude/settings.local.json:verboten', '.env:verboten', 'data/token.json:verboten', 'fremd/zeug.txt:nicht-erlaubt']);
  assert.equal(git(repo, ['show', `${s.commit}:src/b.js`]), 'export const b = 3;\n', 'die ungestagete Fassung gewinnt');
  assert.equal(git(repo, ['rev-parse', `${s.commit}^`]).trim(), vorher.head, 'Elternteil ist HEAD');
  assert.equal(schnappschuss(repo, { id: 'a' }).commit, s.commit, 'gleicher Stand = gleicher Commit');
  assert.deepEqual(zustand(repo), vorher);
});

test('Snapshot bleibt bytegenau, auch mit core.autocrlf=true im Repository (CRLF-Datei)', () => {
  const repo = neuesRepo({ autocrlf: true });
  const s = schnappschuss(repo, { id: 'c' });
  assert.deepEqual(vergleicheMitPlatte(repo, s.commit, { ausgeschlossen: s.ausgeschlossen }).fehler, []);
  const wt = seed(repo, s.commit, neuerName('wt'));
  assert.equal(r(wt, 'docs/crlf.md').toString('latin1'), 'x\r\ny\r\n');
});

test('Geheimnis im Arbeitsstand bricht ab, es entsteht kein Snapshot und kein Objekt', () => {
  const repo = neuesRepo();
  w(repo, 'src/neu/geheim.js', `const x = "ghp_${'A'.repeat(36)}";\n`);
  const vorher = zustand(repo), objekte = git(repo, ['count-objects', '-v']);
  assert.throws(() => schnappschuss(repo, { id: 'g' }), GeheimnisFehler);
  assert.deepEqual(zustand(repo), vorher);
  assert.equal(git(repo, ['count-objects', '-v']), objekte);
});

test('Seed: Worktree genau auf dem Snapshot, losgelöst, Original unberührt', () => {
  const repo = neuesRepo();
  const vorher = zustand(repo);
  const s0 = schnappschuss(repo, { id: 'a' });
  const wt = seed(repo, s0.commit, path.join(repo, '.claude', 'worktrees', 'agent-1'));
  assert.deepEqual(zustand(repo, { ausser: ['.claude/worktrees'] }).index, vorher.index);
  assert.deepEqual(vergleicheMitPlatte(wt, s0.commit).fehler, [], 'Worktree = Snapshot, Byte für Byte');
  assert.equal(git(wt, ['rev-parse', 'HEAD']).trim(), s0.commit);
  assert.notEqual(spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: wt }).status, 0, 'losgelöst: kein Zweig');
  assert.equal(git(wt, ['status', '--porcelain']).trim(), '', 'sauber');
  assert.ok(!git(repo, ['branch', '--list']).includes('worktree'));
  assert.equal(text(wt, 'src/a.js'), text(repo, 'src/a.js'), 'uncommitteter Inhalt ist im Worktree sichtbar');
  assert.ok(!fs.existsSync(path.join(wt, 'docs/zu_loeschen.md')) && fs.existsSync(path.join(wt, 'docs/neu.md')));
});

test('Mehrere Runden: Folge-Snapshots enthalten nur die Arbeit der Runde; verlorener Worktree wird exakt wiederhergestellt', () => {
  const repo = neuesRepo();
  const s0 = schnappschuss(repo, { id: 'a' });
  const wt = seed(repo, s0.commit, neuerName('wt'));
  w(wt, 'src/a.js', 'eins\nZWEI\ndrei\nVIER\nfünf\n');
  const s1 = schnappschuss(wt, { id: 'r1', eltern: s0.commit });
  w(wt, 'docs/neu.md', 'neu\nrunde2\n');
  const s2 = schnappschuss(wt, { id: 'r2', eltern: s1.commit });
  assert.deepEqual(aenderungen(wt, s0.commit, s1.commit).map((x) => x.pfad), ['src/a.js']);
  assert.deepEqual(aenderungen(wt, s1.commit, s2.commit).map((x) => x.pfad), ['docs/neu.md']);
  assert.deepEqual(aenderungen(wt, s0.commit, s2.commit).map((x) => x.pfad), ['docs/neu.md', 'src/a.js']);
  const p = patch(repo, s0.commit, s2.commit);
  fs.rmSync(wt, { recursive: true, force: true });
  git(repo, ['worktree', 'prune']);
  const wt2 = seed(repo, s0.commit, neuerName('wt'));
  const pf = neuerName('p') + '.patch'; fs.writeFileSync(pf, p);
  git(wt2, ['apply', '--binary', pf]);
  assert.equal(schnappschuss(wt2, { id: 'r2b', eltern: s0.commit }).tree, s2.tree, 'wiederhergestellter Worktree hat exakt denselben Baum');
});

test('Hauptarbeitsbaum bleibt während der isolierten Entwicklung unverändert', () => {
  const repo = neuesRepo();
  const s0 = schnappschuss(repo, { id: 'a' });
  const vorher = zustand(repo);
  const wt = seed(repo, s0.commit, path.join(repo, '.claude', 'worktrees', 'agent-1'));
  w(wt, 'src/a.js', 'ganz anders\n'); w(wt, 'src/neu2.js', 'x\n'); fs.rmSync(path.join(wt, 'docs/keep.md'));
  schnappschuss(wt, { id: 'r1', eltern: s0.commit });
  const nachher = zustand(repo, { ausser: ['.claude/worktrees'] });
  assert.deepEqual({ ...nachher, dateien: undefined, baum: undefined }, { ...vorher, dateien: undefined, baum: undefined });
  assert.deepEqual(Object.fromEntries(Object.entries(nachher.dateien)), Object.fromEntries(Object.entries(vorher.dateien).filter(([p]) => !p.startsWith('.claude/worktrees/'))));
  assert.ok(baumHash(repo, { ausser: ['.claude/worktrees'] }).hash.length === 64);
});

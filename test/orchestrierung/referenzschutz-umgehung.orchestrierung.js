// Orchestrierung: Referenzschutz, Schreibweisen und Umgehungsversuche (Codex-Review und Sicherheitshinweis, 15.11.2026). Der Hook ist eine Schranke gegen Versehen und kein Sandkasten;
// was er nicht erkennt (Variablen als Befehl, Aliase, DWIM wie `git switch <Remote-Branch>`, eigene Skripte), erkennt der Integritätswächter nachträglich.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeBefehl } from '../../.claude/hooks/ref-wache.js';

const GESPERRT = [
  // Zeilenfortsetzungen (Bash: Backslash am Zeilenende, PowerShell: Backtick am Zeilenende)
  'git \\\n  branch backup', 'git `\n fetch origin', 'git -C . \\\r\n tag x',
  // gebündeltes Löschen bei symbolic-ref
  'git symbolic-ref -qd refs/remotes/origin/HEAD',
  // eindeutige Kurzformen langer Optionen (git akzeptiert --creat für --create)
  'git switch --creat neu', 'git checkout --orph x', 'git branch --dele x', 'git branch --delet x', 'git tag --delet x', 'git branch --set-upstream-to=origin/main', 'git branch --set-upstream x',
  // Shell-Escapes im Unterbefehl
  'git br\\anch x', 'git br`anch x', 'git "branch" x', "git 'tag' x",
  // Aufrufe, die den Branch des Hauptrepositorys bewegen
  'git commit -m x', 'git merge x', 'git cherry-pick abc', 'git revert HEAD', 'git am x.patch',
  // Umgebungsvariablen, Präfixe und Optionen vor dem Unterbefehl
  'GIT_DIR=x git branch y', 'env git tag z', 'command git fetch', 'git --no-pager branch y', 'git -c user.name=x branch y', 'git -P tag y',
];
const ERLAUBT = [
  'git \\\n  status', 'git `\n log --oneline -3',
  'git tag -n5 v1', 'git tag -l -n3 "v*"', 'git branch -av main', 'git branch -vv --contains abc', 'git branch --list "claude/*"', 'git branch --no-contains abc', 'git branch --show-current',
  'git symbolic-ref -q refs/remotes/origin/HEAD', 'git symbolic-ref HEAD', 'git show-ref', 'git rev-parse --abbrev-ref HEAD', 'git log --all --oneline', 'git diff --check', 'git diff --stat origin/main',
  'git ls-files --others', 'git check-ignore -v x', 'git status --porcelain', 'git worktree list', 'git for-each-ref refs/heads',
];

test('Referenzschutz: Zeilenfortsetzungen, Kurzformen langer Optionen, Shell-Escapes, den Branch bewegende Aufrufe und Präfixe werden gesperrt', () => {
  for (const c of GESPERRT) assert.ok(pruefeBefehl(c), `sollte gesperrt sein: ${JSON.stringify(c)}`);
});

test('Referenzschutz: lesende Aufrufe auch mit Suchmustern, gebündelten Kurzoptionen und Zeilenfortsetzungen bleiben frei (keine neue Fehlalarmklasse)', () => {
  for (const c of ERLAUBT) assert.equal(pruefeBefehl(c), null, `sollte erlaubt sein: ${JSON.stringify(c)}`);
});

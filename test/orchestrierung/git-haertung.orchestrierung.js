// Tests für die gehärteten Git-Aufrufe, den Git-Abdruck und die Prüfung der Git-Konfiguration (Hooks, fsmonitor, Filter, Credential-Helper, Umleitung des Push-Ziels).
// Bereinigung und Erkennung, keine Prozessisolation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { git, gitStatus, mitHaertung, haerteUmgebung, haertePfad, istGehaertet } from '../../tools/orchestrierung/git.js';
import { gitAbdruck, abdruckUnterschiede, pruefeGitKonfiguration, aktiveHooks, gitVerzeichnisse } from '../../tools/orchestrierung/git-abdruck.js';
import { neuerName, w } from './hilfe.js';

const vor = (p) => p.replace(/\\/g, '/');

function repo() {
  const r = neuerName('hart');
  fs.mkdirSync(r, { recursive: true });
  const g = (...a) => git(r, a);
  g('init', '-q', '-b', 'main'); g('config', 'user.name', 'Test'); g('config', 'user.email', 't@t'); g('config', 'core.autocrlf', 'false');
  w(r, 'a.txt', 'eins\n');
  g('add', '-A'); g('commit', '-q', '-m', 'basis');
  return r;
}
/** Hook, der beim Ausführen eine Markierungsdatei schreibt. */
function markierenderHook(r, name, marker) {
  const datei = path.join(gitVerzeichnisse(r).commonDir, 'hooks', name);
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  fs.writeFileSync(datei, `#!/bin/sh\necho gelaufen > "${vor(marker)}"\nexit 0\n`, { mode: 0o755 });
  return datei;
}

test('haerteUmgebung: Anmeldeverfahren bleiben erhalten (Profil, AppData, ProgramData, PATH), alles Gefährliche fällt weg', () => {
  const quelle = {
    Path: 'C:\\bin', SystemRoot: 'C:\\Windows', USERPROFILE: 'C:\\Users\\j', APPDATA: 'C:\\Users\\j\\AppData\\Roaming', LOCALAPPDATA: 'C:\\Users\\j\\AppData\\Local', ProgramData: 'C:\\ProgramData', 'ProgramFiles(x86)': 'C:\\x86', HOME: 'C:\\Users\\j',
    GIT_ASKPASS: 'evil', GIT_SSH_COMMAND: 'evil', GIT_EXEC_PATH: 'evil', GIT_DIR: 'evil', GIT_CONFIG_GLOBAL: 'evil', GIT_CONFIG_COUNT: '1', GIT_EXTERNAL_DIFF: 'evil', GIT_PROXY_COMMAND: 'evil', SSH_ASKPASS: 'evil', SSH_AUTH_SOCK: 'x',
    HTTP_PROXY: 'http://evil', HTTPS_PROXY: 'http://evil', ALL_PROXY: 'x', GH_TOKEN: 'geheim', GITHUB_TOKEN: 'geheim', GCM_CREDENTIAL_STORE: 'x', NODE_OPTIONS: '--require evil', CLAUDECODE: '1', ANTHROPIC_API_KEY: 'geheim', PAGER: 'evil', EDITOR: 'evil', GH_PAGER: 'evil', GH_BROWSER: 'evil',
  };
  const e = haerteUmgebung(quelle);
  for (const behalten of ['Path', 'SystemRoot', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ProgramData', 'ProgramFiles(x86)', 'HOME']) assert.equal(e[behalten], quelle[behalten], `${behalten} bleibt (Git Credential Manager braucht das Benutzerprofil)`);
  assert.deepEqual(Object.keys(e).sort(), ['APPDATA', 'HOME', 'LOCALAPPDATA', 'Path', 'ProgramData', 'ProgramFiles(x86)', 'SystemRoot', 'USERPROFILE'].sort());
  // gh darf seine Token-Variablen behalten, sonst nichts
  const gh = haerteUmgebung(quelle, ['GH_TOKEN', 'GITHUB_TOKEN']);
  assert.equal(gh.GH_TOKEN, 'geheim'); assert.equal(gh.GITHUB_TOKEN, 'geheim');
  assert.equal(gh.GIT_ASKPASS, undefined); assert.equal(gh.HTTPS_PROXY, undefined); assert.equal(gh.GH_PAGER, undefined);
});

test('gehärteter Modus: ein Hook wird ohne Härtung ausgeführt und mit Härtung nicht (Hook-Mechanismus wirkt auf dieser Plattform, der Test ist also nicht leer)', () => {
  const r = repo();
  const marker = neuerName('marker') + '.txt';
  markierenderHook(r, 'post-commit', marker);
  const roh = gitStatus(r, ['commit', '--allow-empty', '-q', '-m', 'ohne Härtung']);
  assert.equal(roh.status, 0, roh.stderr.toString());
  assert.equal(fs.existsSync(marker), true, 'ohne Härtung läuft der Hook');
  fs.rmSync(marker);
  assert.equal(istGehaertet(), false);
  const hart = mitHaertung(() => {
    assert.equal(istGehaertet(), true);
    return gitStatus(r, ['commit', '--allow-empty', '-q', '-m', 'mit Härtung']);
  });
  assert.equal(hart.status, 0, hart.stderr.toString());
  assert.equal(fs.existsSync(marker), false, 'mit Härtung läuft kein Hook');
  assert.equal(istGehaertet(), false, 'der Modus endet mit dem Aufruf');
});

test('gehärteter Modus: eine in der Konfiguration eingetragene Hook-Verzeichnis-, fsmonitor-, ssh- und askpass-Einstellung wird überschrieben', () => {
  const r = repo();
  const marker = neuerName('marker') + '.txt';
  const eigeneHooks = path.join(r, 'meine-hooks');
  fs.mkdirSync(eigeneHooks);
  fs.writeFileSync(path.join(eigeneHooks, 'post-commit'), `#!/bin/sh\necho gelaufen > "${vor(marker)}"\n`, { mode: 0o755 });
  git(r, ['config', '--local', 'core.hooksPath', vor(eigeneHooks)]);
  git(r, ['config', '--local', 'core.sshCommand', 'evil-ssh']);
  git(r, ['config', '--local', 'core.askPass', 'evil-askpass']);
  git(r, ['config', '--local', 'core.fsmonitor', 'evil-fsmonitor']);
  assert.equal(gitStatus(r, ['commit', '--allow-empty', '-q', '-m', 'roh']).status, 0);
  assert.equal(fs.existsSync(marker), true, 'ohne Härtung gilt core.hooksPath');
  fs.rmSync(marker);
  mitHaertung(() => {
    const wert = (k) => git(r, ['config', '--get', k]).trim();
    assert.equal(wert('core.hooksPath'), haertePfad(), 'Hook-Verzeichnis ist ein nicht vorhandener Pfad');
    assert.equal(fs.existsSync(haertePfad()), false);
    assert.equal(wert('core.fsmonitor'), 'false'); assert.equal(wert('core.sshCommand'), 'ssh'); assert.equal(wert('core.askPass'), '');
    assert.equal(wert('commit.gpgSign'), 'false'); assert.equal(wert('protocol.ext.allow'), 'never');
    assert.equal(gitStatus(r, ['commit', '--allow-empty', '-q', '-m', 'hart']).status, 0);
  });
  assert.equal(fs.existsSync(marker), false, 'mit Härtung läuft auch der in core.hooksPath eingetragene Hook nicht');
});

test('gehärteter Modus: Umgebungsvariablen wie GIT_CONFIG_GLOBAL, GIT_DIR oder ein fremdes Home beeinflussen Git nicht mehr', () => {
  const r = repo();
  const fremd = neuerName('fremdkonfig') + '.conf';
  fs.writeFileSync(fremd, '[core]\n\tsshCommand = evil\n[alias]\n\tfremd = status\n');
  const alt = { GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL };
  process.env.GIT_CONFIG_GLOBAL = fremd;
  try {
    assert.equal(git(r, ['config', '--get', 'core.sshCommand']).trim(), 'evil', 'ohne Härtung gilt die Umgebungsvariable');
    assert.equal(git(r, ['config', '--get', 'alias.fremd']).trim(), 'status');
    mitHaertung(() => {
      assert.equal(git(r, ['config', '--get', 'core.sshCommand']).trim(), 'ssh', 'mit Härtung nicht');
      // ein Schlüssel, den die Härtung nicht selbst überschreibt: die fremde Datei darf gar nicht gelesen werden
      assert.equal(gitStatus(r, ['config', '--get', 'alias.fremd']).status, 1, 'GIT_CONFIG_GLOBAL erreicht Git im gehärteten Modus nicht');
    });
  } finally { if (alt.GIT_CONFIG_GLOBAL === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = alt.GIT_CONFIG_GLOBAL; }
});

test('pruefeGitKonfiguration: das gewöhnliche Anmeldeverfahren und die Systemkonfiguration dieses Rechners sind in Ordnung', () => {
  const r = repo();
  assert.deepEqual(pruefeGitKonfiguration(r), [], 'eine saubere Konfiguration (mit Git-LFS-Filtern und Credential Manager im System, wenn vorhanden) wird nicht beanstandet');
  for (const helper of ['manager', 'manager-core', 'store', 'cache --timeout=3600', 'wincred', 'osxkeychain', '', 'C:/Program Files/Git/mingw64/bin/git-credential-manager.exe', '/usr/lib/git-core/git-credential-libsecret']) {
    const x = repo();
    git(x, ['config', '--local', 'credential.helper', helper]);
    assert.deepEqual(pruefeGitKonfiguration(x), [], `Credential-Helper „${helper}“ ist erlaubt`);
  }
  const y = repo();
  git(y, ['config', '--local', 'core.fsmonitor', 'false']);
  git(y, ['config', '--local', 'http.sslBackend', 'schannel']);
  assert.deepEqual(pruefeGitKonfiguration(y), [], 'fsmonitor=false und sslBackend sind erlaubt');
});

const GEFAEHRLICH = [
  ['credential.helper', '!evil'], ['credential.helper', 'evil-helper'], ['credential.https://github.com.helper', '!evil'],
  ['filter.evil.clean', 'evil'], ['filter.evil.smudge', 'evil'], ['filter.lfs.clean', 'evil'],
  ['url.https://evil.example/.insteadOf', 'https://github.com/'], ['url.https://evil.example/.pushInsteadOf', 'https://github.com/'],
  ['remote.origin.pushurl', 'https://evil.example/x.git'], ['remote.origin.proxy', 'http://evil'], ['remote.origin.receivepack', 'evil'],
  ['http.proxy', 'http://evil'], ['http.sslVerify', 'false'], ['http.extraHeader', 'X: y'],
  ['core.hooksPath', '/tmp/evil'], ['core.sshCommand', 'evil'], ['core.fsmonitor', 'evil'], ['core.askPass', 'evil'], ['core.gitProxy', 'evil'], ['core.worktree', '/tmp/x'],
  ['diff.external', 'evil'], ['protocol.ext.allow', 'always'], ['submodule.x.update', '!evil'],
];
test('pruefeGitKonfiguration: Credential-Helper mit Shell, Filter, Umleitungen des Push-Ziels, Proxy, Hook-Verzeichnis, fsmonitor, ssh/askpass und externe Programme werden beanstandet', () => {
  for (const [k, v] of GEFAEHRLICH) {
    const r = repo();
    git(r, ['config', '--local', k, v]);
    const probleme = pruefeGitKonfiguration(r);
    assert.ok(probleme.length >= 1 && probleme.some((p) => p.toLowerCase().startsWith(k.toLowerCase())), `${k}=${v} wird beanstandet: ${JSON.stringify(probleme)}`);
  }
});

test('pruefeGitKonfiguration: eine Datei außerhalb von .git (umgeleitetes globales Konfig) wird erkannt, die eigenen Einstellungen des gehärteten Modus nicht beanstandet', () => {
  const r = repo();
  const fremd = neuerName('global') + '.conf';
  fs.writeFileSync(fremd, '[credential]\n\thelper = !evil\n');
  const alt = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = fremd;
  try {
    assert.ok(pruefeGitKonfiguration(r).some((p) => p.startsWith('credential.helper')), 'globale Konfiguration wird geprüft');
  } finally { if (alt === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = alt; }
  assert.deepEqual(mitHaertung(() => pruefeGitKonfiguration(r)), [], 'die Einstellungen aus GIT_CONFIG_COUNT (hooksPath, sshCommand, …) zählen nicht als Verstoß');
});

test('gitAbdruck: neue Hooks, geänderte Konfiguration, geänderte Attribute, neue globale Konfiguration und Worktree-Metadaten fallen auf', () => {
  const r = repo();
  const home = neuerName('home'); fs.mkdirSync(home, { recursive: true });
  const umg = { HOME: home, USERPROFILE: home };
  const basis = gitAbdruck(r, { umgebung: umg, mitWorktrees: true });
  assert.deepEqual(abdruckUnterschiede(basis, gitAbdruck(r, { umgebung: umg, mitWorktrees: true })), [], 'unverändert = gleich');

  const hook = markierenderHook(r, 'pre-commit', neuerName('m') + '.txt');
  assert.deepEqual(abdruckUnterschiede(basis, gitAbdruck(r, { umgebung: umg, mitWorktrees: true })), ['git:git/hooks/pre-commit']);
  assert.deepEqual(aktiveHooks(r), ['pre-commit']);
  fs.writeFileSync(hook, '#!/bin/sh\nexit 0\n');
  assert.equal(abdruckUnterschiede(basis, gitAbdruck(r, { umgebung: umg })).length >= 1, true, 'geänderter Hook');
  fs.rmSync(hook);
  assert.deepEqual(abdruckUnterschiede(basis, gitAbdruck(r, { umgebung: umg, mitWorktrees: true })), [], 'wieder entfernt = wieder gleich');

  git(r, ['config', '--local', 'alias.x', 'status']);
  assert.deepEqual(abdruckUnterschiede(basis, gitAbdruck(r, { umgebung: umg })), ['git:git/config']);
  git(r, ['config', '--local', '--unset', 'alias.x']);

  const info = path.join(gitVerzeichnisse(r).commonDir, 'info');
  fs.mkdirSync(info, { recursive: true });
  fs.writeFileSync(path.join(info, 'attributes'), '*.txt filter=evil\n');
  assert.deepEqual(abdruckUnterschiede(basis, gitAbdruck(r, { umgebung: umg })), ['git:git/info/attributes']);
  fs.rmSync(path.join(info, 'attributes'));

  fs.writeFileSync(path.join(home, '.gitconfig'), '[alias]\n\tx = status\n');
  assert.ok(abdruckUnterschiede(basis, gitAbdruck(r, { umgebung: umg })).some((u) => u.endsWith('/.gitconfig')), 'neue globale Konfiguration');
  fs.rmSync(path.join(home, '.gitconfig'));

  // Worktree-Metadaten nur mit mitWorktrees
  const wt = neuerName('wt');
  git(r, ['worktree', 'add', '-q', '--detach', wt]);
  const mit = gitAbdruck(r, { umgebung: umg, mitWorktrees: true });
  assert.ok(Object.keys(mit).some((k) => k.startsWith('worktrees/')), 'Worktree-Metadaten im Abdruck');
  assert.ok(!Object.keys(gitAbdruck(r, { umgebung: umg })).some((k) => k.startsWith('worktrees/')), 'ohne mitWorktrees nicht');
  const meta = path.join(gitVerzeichnisse(r).commonDir, 'worktrees', path.basename(wt), 'config.worktree');
  fs.writeFileSync(meta, '[core]\n\tfsmonitor = evil\n');
  assert.ok(abdruckUnterschiede(mit, gitAbdruck(r, { umgebung: umg, mitWorktrees: true })).some((u) => u.endsWith('config.worktree')), 'Konfiguration des Worktrees');
});

test('gitVerzeichnisse: ein Worktree zeigt auf das gemeinsame Git-Verzeichnis des Hauptrepositories (dort liegen Hooks und Konfiguration)', () => {
  const r = repo();
  const wt = neuerName('wt2');
  git(r, ['worktree', 'add', '-q', '--detach', wt]);
  assert.equal(path.resolve(gitVerzeichnisse(wt).commonDir), path.resolve(gitVerzeichnisse(r).commonDir));
  assert.notEqual(path.resolve(gitVerzeichnisse(wt).gitDir), path.resolve(gitVerzeichnisse(r).gitDir));
});

// Tests für `tests-ausfuehren`: bereinigte Umgebung (Positivliste), nur die echte Zusammenfassung zählt, Manipulationen während der Tests sperren den Lauf.
// Hinweis: Das ist Bereinigung und Erkennung, keine Prozessisolation (der Testprozess läuft unter dem Benutzerkonto).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { git } from '../../tools/orchestrierung/git.js';
import * as lauf from '../../tools/orchestrierung/lauf.js';
import { neuerName, w } from './hilfe.js';

function sauberesRepo() {
  const repo = neuerName('testlauf');
  fs.mkdirSync(repo, { recursive: true });
  const g = (...a) => git(repo, a);
  g('init', '-q', '-b', 'main'); g('config', 'user.name', 'Test'); g('config', 'user.email', 't@t'); g('config', 'core.autocrlf', 'false');
  w(repo, '.gitignore', '.claude/worktrees/\n.claude/orchestrierung/\n');
  w(repo, 'package.json', `${JSON.stringify({ name: 'x', type: 'module' }, null, 2)}\n`);
  w(repo, 'src/a.js', 'eins\n');
  w(repo, 'test/ok.test.js', "import { test } from 'node:test';\ntest('läuft', () => {});\n");
  g('add', '-A'); g('commit', '-q', '-m', 'basis');
  return repo;
}

/** Lauf mit einem Worktree, in dem `dateien` (Pfad → Inhalt) liegen; die Runde ist gesichert. */
function lauf1(dateien) {
  const repo = sauberesRepo();
  lauf.starten(repo, { auftrag: 'x', dateien: ['src/**', 'test/**'], autonom: true });
  const wt = lauf.worktreeAnlegen(repo, 'agent-t');
  for (const [p, inhalt] of Object.entries(dateien(repo))) w(wt, p, inhalt);
  lauf.rundeEnde(repo, { worktree: wt });
  return { repo, wt };
}

const GEHEIM = { GH_TOKEN: 'geheim-gh', GITHUB_TOKEN: 'geheim-github', ANTHROPIC_API_KEY: 'geheim-anthropic', CLAUDE_CODE_MESSAGING_TOKEN: 'geheim-claude', OPENAI_API_KEY: 'geheim-openai', CODEX_HOME: 'geheim-codex', NODE_OPTIONS: '--max-old-space-size=512', GIT_ASKPASS: 'geheim-askpass', AWS_SECRET_ACCESS_KEY: 'geheim-aws' };

test('testUmgebung: nur die Positivliste, Home und Temp privat, keine Git-Konfiguration; keine Zugangsdaten, keine Claude-/Codex-/GitHub-Variablen', () => {
  const quelle = { Path: 'C:\\bin', SystemRoot: 'C:\\Windows', COMSPEC: 'cmd.exe', PATHEXT: '.EXE', ...GEHEIM, CLAUDECODE: '1', HOME: 'C:\\Users\\echt', USERPROFILE: 'C:\\Users\\echt', APPDATA: 'C:\\Users\\echt\\AppData', TEMP: 'C:\\echt-temp', NODE_TEST_CONTEXT: 'child-v8' };
  const e = lauf.testUmgebung(quelle, '/privat');
  assert.deepEqual(Object.keys(e).sort(), ['COMSPEC', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM', 'GIT_TERMINAL_PROMPT', 'HOME', 'Path', 'PATHEXT', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'USERPROFILE'].sort(), 'genau diese Namen, Groß-/Kleinschreibung der Quelle bleibt');
  for (const name of [...Object.keys(GEHEIM), 'CLAUDECODE', 'APPDATA', 'NODE_TEST_CONTEXT']) assert.equal(e[name], undefined, `${name} wird nicht weitergegeben`);
  for (const k of ['HOME', 'USERPROFILE', 'TEMP', 'TMP', 'TMPDIR']) assert.equal(e[k], '/privat', `${k} ist das private Verzeichnis`);
  assert.equal(e.GIT_CONFIG_NOSYSTEM, '1');
  assert.ok(!Object.values(e).some((v) => /geheim|echt/.test(v)), 'kein Wert aus der echten Umgebung außer PATH, SystemRoot, COMSPEC, PATHEXT');
});

test('tests-ausfuehren: der Testprozess sieht wirklich keine Geheimnisse und ein privates Home (Test im Worktree prüft es selbst)', () => {
  const namen = Object.keys(GEHEIM);
  const homeDatei = neuerName('home') + '.txt'; // außerhalb von Repository und Laufzustand: der Test meldet hier sein HOME
  const f = lauf1(() => ({
    'test/umgebung.test.js': `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport os from 'node:os';\n`
      + `test('keine Geheimnisse', () => {\n  for (const n of ${JSON.stringify(namen)}) assert.equal(process.env[n], undefined, n);\n`
      + `  assert.equal(Object.keys(process.env).filter((k) => /^(CLAUDE|ANTHROPIC|CODEX|GH_|GITHUB|OPENAI)/i.test(k)).length, 0);\n`
      + `  assert.match(process.env.HOME, /bw-test-/); assert.equal(process.env.HOME, process.env.USERPROFILE); assert.equal(os.tmpdir(), process.env.TEMP);\n`
      + `  assert.equal(process.env.GIT_CONFIG_NOSYSTEM, '1');\n  fs.writeFileSync(${JSON.stringify(homeDatei)}, process.env.HOME);\n});\n`,
  }));
  const vorher = {};
  for (const [k, v] of Object.entries(GEHEIM)) { vorher[k] = process.env[k]; process.env[k] = v; }
  try {
    const r = lauf.testsAusfuehren(f.repo, { worktree: f.wt });
    assert.equal(r.bestanden, true, JSON.stringify(r));
    assert.equal(r.gruen, 2, 'der Test hat die Umgebung wirklich geprüft und bestanden');
  } finally {
    for (const [k, v] of Object.entries(vorher)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
  // genau das private Verzeichnis dieses Laufs (andere Läufe, auch parallele, stören nicht)
  const sein = fs.readFileSync(homeDatei, 'utf8');
  assert.match(sein, /bw-test-/);
  assert.equal(fs.existsSync(sein), false, 'das private Verzeichnis wird nach dem Lauf entfernt');
});

test('liesTestZaehler: nur der letzte, vollständige und rechnende Block zählt; erfundene Zahlen früher in der Ausgabe werden ignoriert', () => {
  const echt = 'ℹ tests 6\nℹ suites 1\nℹ pass 2\nℹ fail 1\nℹ cancelled 0\nℹ skipped 1\nℹ todo 2\nℹ duration_ms 262.9\n';
  assert.deepEqual(lauf.liesTestZaehler(echt), { tests: 6, suites: 1, pass: 2, fail: 1, cancelled: 0, skipped: 1, todo: 2 });
  const erfunden = 'ℹ tests 999\nℹ suites 0\nℹ pass 999\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 1\n';
  assert.equal(lauf.liesTestZaehler(erfunden + echt).pass, 2, 'der echte Block steht zuletzt und gilt');
  assert.equal(lauf.liesTestZaehler(erfunden + echt).fail, 1);
  assert.equal(lauf.liesTestZaehler('ℹ tests 5\nℹ pass 99\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\n'), null, 'rechnet nicht');
  assert.equal(lauf.liesTestZaehler('ℹ tests 5\nℹ pass 5\nℹ fail 0\n'), null, 'unvollständig');
  assert.equal(lauf.liesTestZaehler(`${echt}ℹ tests 5\nℹ pass 5\n`), null, 'ein unvollständiger letzter Block macht die Ausgabe unlesbar statt den alten gelten zu lassen');
  assert.equal(lauf.liesTestZaehler('  ℹ pass 5\n# pass 5\n'), null, 'eingerückte oder fremde Formate zählen nicht');
  assert.equal(lauf.liesTestZaehler(''), null);
  assert.equal(lauf.liesTestZaehler(undefined), null);
});

test('tests-ausfuehren: ein Test, der erfundene Erfolgszahlen ausgibt, ändert nichts am echten Ergebnis', () => {
  const f = lauf1(() => ({
    'test/luege.test.js': "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n"
      + "test('lügt und scheitert', () => {\n  console.log('ℹ tests 999\\nℹ suites 0\\nℹ pass 999\\nℹ fail 0\\nℹ cancelled 0\\nℹ skipped 0\\nℹ todo 0\\nℹ duration_ms 1');\n  assert.equal(1, 2);\n});\n",
  }));
  const r = lauf.testsAusfuehren(f.repo, { worktree: f.wt });
  assert.equal(r.bestanden, false);
  assert.equal(r.fehlgeschlagen, 1);
  assert.notEqual(r.gruen, 999);
  assert.notEqual(r.exit, 0);
  assert.equal(lauf.freigabeStatus(f.repo).ok, false);
});

/** Ein Test im Worktree, der etwas im Hauptverzeichnis anrichtet (absolute Pfade stehen im Quelltext, die Umgebung ist ja bereinigt). */
const boeserTest = (code) => ({ 'test/boese.test.js': `import { test } from 'node:test';\nimport fs from 'node:fs';\nimport { execFileSync } from 'node:child_process';\ntest('böse', () => {\n${code}\n});\n` });

const faelle = [
  ['hängt eine gefälschte Testmeldung an den Laufzustand', (repo) => {
    const id = lauf.lies(repo).id;
    const datei = path.join(repo, '.claude', 'orchestrierung', 'laeufe', id, 'tests.jsonl');
    return boeserTest(`fs.appendFileSync(${JSON.stringify(datei)}, '{"fake":true}\\n');`);
  }],
  ['legt eine Datei im Hauptbaum an', (repo) => boeserTest(`fs.writeFileSync(${JSON.stringify(path.join(repo, 'src', 'unerlaubt.js'))}, 'x');`)],
  ['ändert eine versionierte Datei im Hauptbaum', (repo) => boeserTest(`fs.writeFileSync(${JSON.stringify(path.join(repo, 'src', 'a.js'))}, 'verändert\\n');`)],
  ['bewegt HEAD im Hauptrepository', (repo) => boeserTest(`execFileSync('git', ['-C', ${JSON.stringify(repo)}, 'commit', '--allow-empty', '-q', '-m', 'x']);`)],
  ['löscht den Laufzustand', (repo) => boeserTest(`fs.rmSync(${JSON.stringify(path.join(repo, '.claude', 'orchestrierung', 'aktiv.json'))});`)],
];

for (const [name, bau] of faelle) {
  test(`Manipulationserkennung: ein Test, der ${name}, sperrt den Lauf; erneute Tests machen ihn nicht wieder vertrauenswürdig`, () => {
    const f = lauf1(bau);
    const a = fs.existsSync(path.join(f.repo, '.claude', 'orchestrierung', 'aktiv.json')) ? lauf.lies(f.repo) : null;
    assert.ok(a, 'aktiver Lauf vor den Tests');
    assert.throws(() => lauf.testsAusfuehren(f.repo, { worktree: f.wt }), /MANIPULATIONSVERDACHT/);
    // nichts wurde als Ergebnis protokolliert
    const tests = path.join(lauf.laufDir(f.repo, a.id), 'tests.jsonl');
    assert.ok(!fs.existsSync(tests) || !/"suite"/.test(fs.readFileSync(tests, 'utf8')), 'kein Testergebnis protokolliert');
    // gesperrt: Sperrdatei vorhanden
    assert.ok(fs.existsSync(path.join(lauf.laufDir(f.repo, a.id), 'gesperrt.json')), 'Sperrdatei geschrieben');
    if (!fs.existsSync(path.join(f.repo, '.claude', 'orchestrierung', 'aktiv.json'))) {
      // Der Laufzustand ist gelöscht: ohne aktiven Lauf geht gar nichts mehr (fail-closed)
      assert.throws(() => lauf.freigabeStatus(f.repo), /kein Orchestrierungslauf/);
      return;
    }
    assert.equal(lauf.sperrGrund(f.repo, lauf.lies(f.repo)).startsWith('Manipulationsverdacht'), true);
    assert.match(lauf.freigabeStatus(f.repo).gruende.join(' | '), /Lauf gesperrt/);
    assert.equal(lauf.freigabeStatus(f.repo).ok, false);
    // der Agent räumt auf (böser Test entfernt, neue Runde): ein neuer Testlauf, Review und Meldungen sind trotzdem verweigert
    fs.rmSync(path.join(f.wt, 'test', 'boese.test.js'));
    lauf.rundeEnde(f.repo, { worktree: f.wt });
    assert.throws(() => lauf.testsAusfuehren(f.repo, { worktree: f.wt }), /gesperrt/);
    assert.throws(() => lauf.testsMelden(f.repo, { worktree: f.wt, suite: 'kurz', gruen: 5, fehlgeschlagen: 0, exit: 0 }), /gesperrt/);
    assert.throws(() => lauf.reviewMelden(f.repo, { review_mode: 'single', failover_occurred: false, provider: 'codex', verdict: 'approve', session_id: 's', models: [{ provider: 'codex' }] }), /gesperrt/);
    assert.throws(() => lauf.befundMelden(f.repo, { id: 'F1', einstufung: 'bestaetigt' }), /gesperrt/);
    const u = lauf.uebernehmen(f.repo);
    assert.equal(u.status, 'abgelehnt'); assert.equal(u.grund, 'freigabe');
    // auch wer die Sperre in aktiv.json entfernt, hebt sie nicht auf (Sperrdatei im Laufverzeichnis)
    const aktiv = path.join(f.repo, '.claude', 'orchestrierung', 'aktiv.json');
    const j = JSON.parse(fs.readFileSync(aktiv, 'utf8')); delete j.gesperrt; fs.writeFileSync(aktiv, JSON.stringify(j));
    assert.throws(() => lauf.testsAusfuehren(f.repo, { worktree: f.wt }), /gesperrt/);
    assert.equal(lauf.freigabeStatus(f.repo).ok, false);
  });
}

test('Manipulationserkennung: ein harmloser Testlauf löst keinen Alarm aus und hinterlässt weder Sperre noch Spuren', () => {
  const f = lauf1(() => ({ 'src/a.js': 'zwei\n' }));
  const a = lauf.lies(f.repo);
  const r = lauf.testsAusfuehren(f.repo, { worktree: f.wt });
  assert.equal(r.bestanden, true);
  assert.equal(lauf.sperrGrund(f.repo, lauf.lies(f.repo)), null);
  assert.ok(!fs.existsSync(path.join(lauf.laufDir(f.repo, a.id), 'gesperrt.json')));
  assert.equal(git(f.repo, ['status', '--porcelain']).trim(), '');
  // und dasselbe zweimal hintereinander
  assert.equal(lauf.testsAusfuehren(f.repo, { worktree: f.wt }).bestanden, true);
});

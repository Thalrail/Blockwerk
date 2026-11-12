// Orchestrierung: autonomer Abschluss (Gates, Branch, Commit, Push, Draft-PR). Alles in Wegwerf-Repositories mit einem lokalen Bare-Repository als Test-Remote;
// `gh` ist eine Attrappe, die ihre Argumente protokolliert. Es geht nie etwas ins Netz und nie in das echte Blockwerk-Repository.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { git, gitStatus, haerteUmgebung } from '../../tools/orchestrierung/git.js';
import * as lauf from '../../tools/orchestrierung/lauf.js';
import { abschliessen, stagingStimmt, ERLAUBTE_REMOTES, GITHUB_REPO, TRAILER } from '../../tools/orchestrierung/abschluss.js';
import { fuehreAus } from '../../tools/orchestrierung/cli.js';
import { neuerName, WURZEL, w, text } from './hilfe.js';

const GUT = { review_mode: 'single', failover_occurred: false, provider: 'codex', verdict: 'approve', session_id: 's-gut', models: [{ provider: 'codex' }] };
const AENDERUNG = { review_mode: 'single', failover_occurred: false, provider: 'codex', verdict: 'request_changes', session_id: 's-aend', models: [{ provider: 'codex' }] };
const TESTS = { suite: 'kurz', gruen: 12, fehlgeschlagen: 0, uebersprungen: 0, exit: 0 };
const ABSCHLUSS = { kurzname: 'karte-funktionen', titel: 'karte.js: Aufrufer auf Funktionsebene', einschraenkungen: 'Namensfunde ohne Scope; unklare Treffer sind gekennzeichnet.' };

// gh-Attrappe: protokolliert Argumente und PR-Text; GH_FAIL=1 lässt sie scheitern
const GH_SKRIPT = path.join(WURZEL, 'gh-attrappe.mjs');
fs.writeFileSync(GH_SKRIPT, `import fs from 'node:fs';
const args = process.argv.slice(2);
const i = args.indexOf('--body-file');
fs.appendFileSync(process.env.GH_LOG, JSON.stringify({ args, env: Object.keys(process.env), configAnzahl: process.env.GIT_CONFIG_COUNT, body: i >= 0 ? fs.readFileSync(args[i + 1], 'utf8') : null }) + '\\n');
if (process.env.GH_FAIL === '1') { console.error('gh: kaputt'); process.exit(1); }
console.log('https://example.test/Thalrail/Blockwerk/pull/1');
`);

function ghUmgebung(bare, { scheitern = false } = {}) {
  const log = neuerName('gh-log');
  process.env.GH_LOG = log; process.env.GH_FAIL = scheitern ? '1' : '0';
  return { umgebung: { erlaubteRemotes: [bare], gh: [process.execPath, GH_SKRIPT], ghEnv: { GH_LOG: log, GH_FAIL: scheitern ? '1' : '0' } }, aufrufe: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z)) : []) };
}

/** Sauberes Arbeitsrepository mit lokalem Bare-Remote `origin`, Branch main gepusht. */
function sauberesRepo() {
  const bare = neuerName('remote');
  fs.mkdirSync(bare, { recursive: true });
  git(bare, ['init', '-q', '--bare', '-b', 'main']);
  const repo = neuerName('arbeit');
  fs.mkdirSync(repo, { recursive: true });
  const g = (...a) => git(repo, a);
  g('init', '-q', '-b', 'main'); g('config', 'user.name', 'Test'); g('config', 'user.email', 't@t'); g('config', 'core.autocrlf', 'false');
  w(repo, '.gitignore', '.claude/worktrees/\n.claude/orchestrierung/\n');
  w(repo, 'package.json', `${JSON.stringify({ name: 'x', type: 'module' }, null, 2)}\n`);
  w(repo, 'src/a.js', 'eins\nzwei\n'); w(repo, 'docs/stand.md', '# Stand\n');
  w(repo, 'test/ok.test.js', "import { test } from 'node:test';\ntest('läuft', () => {});\n");
  g('add', '-A'); g('commit', '-q', '-m', 'basis');
  g('remote', 'add', 'origin', bare); g('push', '-q', '-u', 'origin', 'main');
  return { repo, bare };
}

const remoteZweige = (bare) => git(bare, ['for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads']).trim().split('\n').filter(Boolean);

/** Läuft Start → Entwickler (Worktree) → Runde → Paket → Review → Tests und optional Übernahme. */
function fluss({ autonom = true, vorStart, review = GUT, befunde = [], tests = TESTS, uebernehmen = true, aendere } = {}) {
  const { repo, bare } = sauberesRepo();
  vorStart?.(repo, bare);
  lauf.starten(repo, { auftrag: 'Testauftrag: Funktionsebene', dateien: ['src/**', 'docs/**'], autonom });
  const wt = lauf.worktreeAnlegen(repo, 'agent-t');
  if (aendere) aendere(wt); else { w(wt, 'src/a.js', 'eins\nzwei geändert\n'); w(wt, 'src/neu.js', 'export const n = 1;\n'); }
  lauf.rundeEnde(repo, { worktree: wt });
  const iso = neuerName('review'); fs.mkdirSync(iso, { recursive: true });
  lauf.paket(repo, { wurzel: iso, hinweise: 't' });
  if (review) lauf.reviewMelden(repo, review, befunde);
  if (tests) lauf.testsMelden(repo, { worktree: wt, ...tests });
  const u = uebernehmen ? lauf.uebernehmen(repo) : null;
  return { repo, bare, wt, iso, u };
}

test('Start im autonomen Modus verlangt einen sauberen Arbeitsbaum (geändert, gestaged, neu); der normale Start bleibt möglich', () => {
  for (const verschmutze of [(r) => w(r, 'src/a.js', 'anders\n'), (r) => { w(r, 'docs/stand.md', 'x\n'); git(r, ['add', 'docs/stand.md']); }, (r) => w(r, 'src/frisch.js', 'x\n'), (r) => fs.rmSync(path.join(r, 'docs/stand.md'))]) {
    const { repo } = sauberesRepo();
    verschmutze(repo);
    assert.throws(() => lauf.starten(repo, { auftrag: 'x', dateien: ['src/**'], autonom: true }), /sauberen Arbeitsbaum/);
    assert.equal(lauf.lies(repo), null, 'es wurde kein Lauf angelegt');
    assert.ok(lauf.starten(repo, { auftrag: 'x', dateien: ['src/**'] }).s0, 'ohne autonom bleibt der Start wie bisher');
  }
  const { repo } = sauberesRepo();
  assert.ok(lauf.starten(repo, { auftrag: 'x', dateien: ['src/**'], autonom: true }).s0);
  assert.equal(lauf.status(repo).autonom, true);
});

test('tests-melden: nur für einen Worktree des Laufs, nur mit gültigen Zahlen und nur, wenn der Worktree byteweise der gesicherten Basis entspricht', () => {
  const { repo } = sauberesRepo();
  lauf.starten(repo, { auftrag: 'x', dateien: ['src/**'], autonom: true });
  const wt = lauf.worktreeAnlegen(repo, 'agent-t');
  assert.throws(() => lauf.testsMelden(repo, { worktree: wt, ...TESTS }), /noch keine Runde/);
  w(wt, 'src/a.js', 'neu\n');
  lauf.rundeEnde(repo, { worktree: wt });
  assert.throws(() => lauf.testsMelden(repo, { worktree: repo, ...TESTS }), /kein Worktree dieses Laufs/);
  assert.throws(() => lauf.testsMelden(repo, { worktree: wt, ...TESTS, gruen: -1 }), /ganze Zahl/);
  assert.throws(() => lauf.testsMelden(repo, { worktree: wt, ...TESTS, gruen: '12' }), /ganze Zahl/);
  assert.throws(() => lauf.testsMelden(repo, { worktree: wt, ...TESTS, suite: ' ' }), /suite fehlt/);
  w(wt, 'src/a.js', 'nach der Runde noch geändert\n');
  assert.throws(() => lauf.testsMelden(repo, { worktree: wt, ...TESTS }), /weicht vom gesicherten Stand ab/, 'Tests für einen anderen Stand zählen nicht');
  w(wt, 'src/a.js', 'neu\n'); w(wt, 'testausgabe.log', 'Zusatzdatei stört nicht\n');
  const r = lauf.testsMelden(repo, { worktree: wt, ...TESTS });
  assert.equal(r.bestanden, true);
  assert.equal(lauf.testsMelden(repo, { worktree: wt, ...TESTS, fehlgeschlagen: 1, exit: 1 }).bestanden, false);
});

test('review-melden: braucht ein Review-Paket für genau den aktuellen Stand; Befunde werden geprüft; ungültige Reviews zählen nicht', () => {
  const { repo } = sauberesRepo();
  lauf.starten(repo, { auftrag: 'x', dateien: ['src/**'], autonom: true });
  const wt = lauf.worktreeAnlegen(repo, 'agent-t');
  w(wt, 'src/a.js', 'neu\n');
  lauf.rundeEnde(repo, { worktree: wt });
  assert.throws(() => lauf.reviewMelden(repo, GUT), /kein Review-Paket/);
  const iso = neuerName('review'); fs.mkdirSync(iso, { recursive: true });
  lauf.paket(repo, { wurzel: iso });
  assert.throws(() => lauf.reviewMelden(repo, GUT, [{ id: 'B1', schwere: 'major' }, { id: 'B1', schwere: 'minor' }]), /doppelt/);
  assert.throws(() => lauf.reviewMelden(repo, GUT, [{ id: 'B1', schwere: 'wichtig' }]), /schwere muss/);
  assert.throws(() => lauf.reviewMelden(repo, GUT, [{ schwere: 'minor' }]), /braucht eine id/);
  const schlecht = lauf.reviewMelden(repo, { ...GUT, failover_occurred: true, provider: 'gemini' });
  assert.equal(schlecht.gueltig, false);
  assert.match(lauf.freigabeStatus(repo).gruende.join(' | '), /Review ungültig/);
  // neue Runde: das Paket von vorher gilt nicht mehr
  w(wt, 'src/a.js', 'noch neuer\n');
  lauf.rundeEnde(repo, { worktree: wt });
  assert.throws(() => lauf.reviewMelden(repo, GUT), /kein Review-Paket/);
});

test('Gate: Übernahme nur mit grünen Tests UND gültigem Review für exakt denselben Codezustand', () => {
  // weder Tests noch Review
  let f = fluss({ review: null, tests: null, uebernehmen: false });
  let u = lauf.uebernehmen(f.repo);
  assert.equal(u.status, 'abgelehnt'); assert.equal(u.grund, 'freigabe');
  assert.equal(u.gruende.length, 2);
  // nur Tests
  f = fluss({ review: null, uebernehmen: false });
  assert.match(lauf.uebernehmen(f.repo).gruende.join(' | '), /Kein Codex-Review/);
  // nur Review
  f = fluss({ tests: null, uebernehmen: false });
  assert.match(lauf.uebernehmen(f.repo).gruende.join(' | '), /Keine Testmeldung/);
  // rote Tests
  f = fluss({ tests: { ...TESTS, fehlgeschlagen: 2, exit: 1 }, uebernehmen: false });
  assert.match(lauf.uebernehmen(f.repo).gruende.join(' | '), /nicht grün/);
  f = fluss({ tests: { ...TESTS, gruen: 0 }, uebernehmen: false });
  assert.match(lauf.uebernehmen(f.repo).gruende.join(' | '), /nicht grün/, 'null grüne Tests sind kein Beleg');
  // alles da: übernommen
  f = fluss();
  assert.equal(f.u.status, 'uebernommen');
  assert.equal(text(f.repo, 'src/a.js'), 'eins\nzwei geändert\n');
});

test('Gate: auch eine reine Dokumentationsänderung braucht das Codex-Review (Jonah, 31.10.2026), mit Review geht sie durch', () => {
  const nurDoku = (wt) => w(wt, 'docs/stand.md', '# Stand\nein Satz mehr\n');
  const ohne = fluss({ review: null, aendere: nurDoku, uebernehmen: false });
  assert.match(lauf.freigabeStatus(ohne.repo).gruende.join(' | '), /Kein Codex-Review/);
  const u = lauf.uebernehmen(ohne.repo);
  assert.equal(u.status, 'abgelehnt'); assert.equal(u.grund, 'freigabe');
  assert.equal(text(ohne.repo, 'docs/stand.md'), '# Stand\n', 'nichts übernommen');
  const mit = fluss({ aendere: nurDoku });
  assert.equal(mit.u.status, 'uebernommen');
  assert.equal(text(mit.repo, 'docs/stand.md'), '# Stand\nein Satz mehr\n');
});

test('Gate: eine neue Runde macht Tests und Review wirkungslos (anderer Codezustand)', () => {
  const f = fluss({ uebernehmen: false });
  assert.equal(lauf.freigabeStatus(f.repo).ok, true);
  w(f.wt, 'src/a.js', 'nach der Freigabe geändert\n');
  lauf.rundeEnde(f.repo, { worktree: f.wt });
  const s = lauf.freigabeStatus(f.repo);
  assert.equal(s.ok, false);
  assert.equal(s.gruende.length, 2, s.gruende.join(' | '));
  assert.equal(lauf.uebernehmen(f.repo).grund, 'freigabe');
});

test('Befund-Einstufung gilt nur für das Review des aktuellen Codezustands; tests-ausfuehren verlangt einen gesicherten Worktree', () => {
  const f = fluss({ review: AENDERUNG, befunde: [{ id: 'F1', schwere: 'major', kurz: 'a' }], uebernehmen: false });
  lauf.befundMelden(f.repo, { id: 'F1', einstufung: 'bestaetigt' });
  w(f.wt, 'src/a.js', 'ungesichert geändert\n');
  assert.throws(() => lauf.testsAusfuehren(f.repo, { worktree: f.wt }), /weicht vom gesicherten Stand ab/);
  lauf.rundeEnde(f.repo, { worktree: f.wt });
  assert.throws(() => lauf.befundMelden(f.repo, { id: 'F1', einstufung: 'widerlegt', beleg: 'x'.repeat(30) }), /noch kein gemeldetes Review/);
});

test('Gate: Befunde müssen eingestuft sein; bestätigte blockieren; Widerlegung braucht Beleg; echte Fehler gehen nicht als Hinweis durch', () => {
  const befunde = [{ id: 'F1', schwere: 'major', kurz: 'a' }, { id: 'F2', schwere: 'minor', kurz: 'b' }];
  let f = fluss({ review: AENDERUNG, befunde, uebernehmen: false });
  assert.match(lauf.freigabeStatus(f.repo).gruende.join(' | '), /F1 \(major\) ist nicht eingestuft/);
  assert.throws(() => lauf.befundMelden(f.repo, { id: 'F9', einstufung: 'widerlegt', beleg: 'x'.repeat(30) }), /gehört nicht zum Review/);
  assert.throws(() => lauf.befundMelden(f.repo, { id: 'F1', einstufung: 'egal', beleg: 'x'.repeat(30) }), /einstufung muss/);
  assert.throws(() => lauf.befundMelden(f.repo, { id: 'F1', einstufung: 'widerlegt', beleg: 'zu kurz' }), /braucht einen Beleg/);
  assert.throws(() => lauf.befundMelden(f.repo, { id: 'F1', einstufung: 'hinweis', beleg: 'x'.repeat(30) }), /kann nicht als bloßer Hinweis/);
  lauf.befundMelden(f.repo, { id: 'F1', einstufung: 'bestaetigt' });
  lauf.befundMelden(f.repo, { id: 'F2', einstufung: 'hinweis', beleg: 'Stilfrage, ändert kein Verhalten (Zeile 12)' });
  assert.match(lauf.freigabeStatus(f.repo).gruende.join(' | '), /F1 ist bestätigt und noch nicht behoben/);
  assert.equal(lauf.uebernehmen(f.repo).grund, 'freigabe');
  lauf.befundMelden(f.repo, { id: 'F1', einstufung: 'widerlegt', beleg: 'Zeile 7 prüft das schon, siehe Test „x“ in test/y.js' });
  assert.equal(lauf.freigabeStatus(f.repo).ok, true, 'die jüngste Einstufung gilt');
  assert.equal(lauf.uebernehmen(f.repo).status, 'uebernommen');
  // request_changes ohne gemeldeten Befund und reject
  f = fluss({ review: AENDERUNG, befunde: [], uebernehmen: false });
  assert.match(lauf.freigabeStatus(f.repo).gruende.join(' | '), /ohne gemeldete Befunde/);
  f = fluss({ review: { ...GUT, verdict: 'reject' }, uebernehmen: false });
  assert.match(lauf.freigabeStatus(f.repo).gruende.join(' | '), /reject/);
  // approve mit einem unbehandelten Hinweis-Befund
  f = fluss({ befunde: [{ id: 'H1', schwere: 'info' }], uebernehmen: false });
  assert.match(lauf.freigabeStatus(f.repo).gruende.join(' | '), /H1 \(info\) ist nicht eingestuft/);
});

test('Gate: kritische Befunde gibt der Koordinator nie frei (ungeklärt, bestätigt oder nur „widerlegt“); auch ein approve-Urteil ändert das nicht', () => {
  const kritisch = [{ id: 'K1', schwere: 'critical', kurz: 'Datenverlust' }];
  const beleg = 'Zeile 40 fängt den Fall ab, siehe Test „y“ in test/z.js';
  for (const verdict of ['approve', 'request_changes']) {
    const f = fluss({ review: { ...GUT, verdict }, befunde: kritisch, uebernehmen: false });
    assert.match(lauf.freigabeStatus(f.repo).gruende.join(' | '), /K1 \(critical\) ist nicht eingestuft/, `ungeklärt (${verdict})`);
    assert.equal(lauf.uebernehmen(f.repo).grund, 'freigabe');
    assert.throws(() => lauf.befundMelden(f.repo, { id: 'K1', einstufung: 'hinweis', beleg }), /kann nicht als bloßer Hinweis/);
    lauf.befundMelden(f.repo, { id: 'K1', einstufung: 'bestaetigt' });
    assert.match(lauf.freigabeStatus(f.repo).gruende.join(' | '), /K1 ist bestätigt/, `bestätigt (${verdict})`);
    lauf.befundMelden(f.repo, { id: 'K1', einstufung: 'widerlegt', beleg });
    const s = lauf.freigabeStatus(f.repo);
    assert.equal(s.ok, false, `widerlegt zählt bei critical nicht (${verdict})`);
    assert.match(s.gruende.join(' | '), /Kritischer Befund K1 .* Jonah/);
    const u = lauf.uebernehmen(f.repo);
    assert.equal(u.status, 'abgelehnt'); assert.equal(u.grund, 'freigabe');
  }
  // dagegen bleibt die Widerlegung eines „major“-Befunds mit Beleg möglich (nur critical ist ausgenommen)
  const f = fluss({ review: AENDERUNG, befunde: [{ id: 'M1', schwere: 'major', kurz: 'm' }], uebernehmen: false });
  lauf.befundMelden(f.repo, { id: 'M1', einstufung: 'widerlegt', beleg });
  assert.equal(lauf.freigabeStatus(f.repo).ok, true);
});

test('Kommandozeile: Gate gilt auch dort (es gibt keine Option, sie zu umgehen); unbekannte Optionen werden abgelehnt', () => {
  const f = fluss({ review: null, tests: null, uebernehmen: false });
  const u = fuehreAus(['uebernehmen'], f.repo);
  assert.equal(u.status, 'abgelehnt'); assert.equal(u.grund, 'freigabe');
  for (const argv of [['uebernehmen', '--freigabePruefen', 'false'], ['uebernehmen', '--ohneFreigabe'], ['abschluss', '--remote', 'x'], ['abschluss', '--gh', 'echo'], ['abschluss', '--praefix', 'x/'], ['tests-ausfuehren', '--force']]) {
    assert.throws(() => fuehreAus(argv, f.repo), /Unbekannte Option/, argv.join(' '));
  }
  assert.throws(() => fuehreAus(['merge'], f.repo), /Unbekannter Befehl/);
  assert.equal(lauf.lies(f.repo).uebernommen, null, 'nichts wurde übernommen');
});

test('Abschluss: Erfolg: eigener Branch, nur die übernommenen Dateien, Baum = geprüfter Zustand, Push nur dieses Branches, Draft-PR gegen main, main unberührt', () => {
  const f = fluss({ befunde: [{ id: 'F1', schwere: 'minor', kurz: 'k' }], uebernehmen: false });
  lauf.befundMelden(f.repo, { id: 'F1', einstufung: 'hinweis', beleg: 'reiner Stilhinweis, kein Verhalten betroffen' });
  assert.equal(lauf.uebernehmen(f.repo).status, 'uebernommen');
  const g = ghUmgebung(f.bare);
  const kopfVorher = git(f.repo, ['rev-parse', 'HEAD']).trim();
  const baum = lauf.baumVon(f.repo, lauf.lies(f.repo).basis);
  const r = abschliessen(f.repo, ABSCHLUSS, g.umgebung);
  assert.equal(r.status, 'fertig', JSON.stringify(r));
  assert.equal(r.branch, 'claude/karte-funktionen');
  assert.equal(r.pr, 'https://example.test/Thalrail/Blockwerk/pull/1');
  // lokal: Auftragsbranch ausgecheckt, ein Commit auf dem alten HEAD, exakt der geprüfte Baum, nur die übernommenen Dateien
  assert.equal(git(f.repo, ['symbolic-ref', '--short', 'HEAD']).trim(), 'claude/karte-funktionen');
  assert.equal(git(f.repo, ['rev-parse', 'HEAD~1']).trim(), kopfVorher);
  assert.equal(git(f.repo, ['rev-parse', 'HEAD^{tree}']).trim(), baum);
  assert.deepEqual(git(f.repo, ['diff', '--name-only', 'HEAD~1', 'HEAD']).trim().split('\n').sort(), ['src/a.js', 'src/neu.js']);
  const msg = git(f.repo, ['log', '-1', '--format=%B']);
  assert.match(msg, /^karte\.js: Aufrufer auf Funktionsebene/);
  assert.ok(msg.includes(TRAILER) && msg.includes('Lauf: '));
  assert.equal(git(f.repo, ['status', '--porcelain']).trim(), '', 'danach ist der Arbeitsbaum sauber');
  // main (lokal und im Remote) unverändert; der Remote hat genau den neuen Branch
  assert.equal(git(f.repo, ['rev-parse', 'main']).trim(), kopfVorher);
  const zweige = remoteZweige(f.bare);
  assert.deepEqual(zweige.map((z) => z.split(' ')[0]).sort(), ['claude/karte-funktionen', 'main']);
  assert.equal(zweige.find((z) => z.startsWith('main ')).split(' ')[1], kopfVorher);
  assert.equal(zweige.find((z) => z.startsWith('claude/')).split(' ')[1], r.commit);
  // genau ein gh-Aufruf: Draft, feste Basis und Kopf, festes Repository, nie etwas anderes
  const aufrufe = g.aufrufe();
  assert.equal(aufrufe.length, 1);
  const a = aufrufe[0].args;
  assert.deepEqual(a.slice(0, 3), ['pr', 'create', '--draft']);
  assert.equal(a[a.indexOf('--base') + 1], 'main'); assert.equal(a[a.indexOf('--head') + 1], 'claude/karte-funktionen'); assert.equal(a[a.indexOf('--repo') + 1], GITHUB_REPO);
  assert.ok(!a.some((x) => /merge|ready|--web|--force/.test(x)));
  const body = aufrufe[0].body;
  for (const teil of ['## Zusammenfassung', '## Änderungen', 'M src/a.js', 'A src/neu.js', '## Tests', '12 grün', '## Unabhängiges Review (Codex)', 'F1 (minor): hinweis', '## Bekannte Einschränkungen', 'Namensfunde ohne Scope', 'Draft-PR', 'über den Merge entscheidet Jonah']) assert.ok(body.includes(teil), teil);
  // Zustand und Wiederholung
  assert.equal(lauf.status(f.repo).abschluss.pr, r.pr);
  const nochmal = abschliessen(f.repo, ABSCHLUSS, g.umgebung);
  assert.equal(nochmal.status, 'fertig'); assert.equal(nochmal.bereitsErledigt, true);
  assert.equal(g.aufrufe().length, 1, 'kein zweiter PR');
  assert.equal(remoteZweige(f.bare).length, 2);
});

test('Abschluss: Staging-Prüfung (M25): nur exakt die übernommenen Dateien dürfen bereitgestellt sein, sonst gibt es keinen Commit', () => {
  // Die Prüfung ist eine zweite Schranke hinter der Vorprüfung des Arbeitsbaums und mit echtem Git nicht auslösbar (auch ein Glob-Dateiname wie `src/[x].js` wird wörtlich bereitgestellt); darum wird der Vergleich einzeln geprüft und seine Verwendung festgenagelt.
  assert.equal(stagingStimmt(['docs/a.md', 'src/a.js'], ['docs/a.md', 'src/a.js']), true);
  assert.equal(stagingStimmt(['src/a.js'], ['docs/a.md', 'src/a.js']), false, 'eine übernommene Datei fehlt');
  assert.equal(stagingStimmt(['docs/a.md', 'src/a.js', 'x.txt'], ['docs/a.md', 'src/a.js']), false, 'eine fremde Datei ist bereitgestellt');
  assert.equal(stagingStimmt([], ['src/a.js']), false);
  assert.equal(stagingStimmt([], []), true);
  const quelle = fs.readFileSync(new URL('../../tools/orchestrierung/abschluss.js', import.meta.url), 'utf8');
  const commitSchritt = quelle.slice(quelle.indexOf("if (!f.schritte.includes('commit'))"), quelle.indexOf("gitStatus(w, ['commit'"));
  assert.match(commitSchritt, /add\.status !== 0 \|\| !stagingStimmt\(gestaged, f\.dateien\)/, 'der Commit-Schritt prüft das Bereitgestellte vor dem Commit');
  assert.match(commitSchritt, /restore', '--staged'/, 'bei Abweichung wird die Bereitstellung zurückgenommen');
  assert.match(commitSchritt, /return blockiert\(w, a, f, 'commit', `Staging weicht ab/);
});

test('Abschluss: Trockenlauf prüft alles und ändert nichts', () => {
  const f = fluss();
  const g = ghUmgebung(f.bare);
  const r = abschliessen(f.repo, { ...ABSCHLUSS, trocken: true }, g.umgebung);
  assert.equal(r.status, 'bereit', JSON.stringify(r)); assert.equal(r.branch, 'claude/karte-funktionen');
  assert.deepEqual(r.dateien, ['src/a.js', 'src/neu.js']);
  assert.equal(git(f.repo, ['symbolic-ref', '--short', 'HEAD']).trim(), 'main');
  assert.equal(gitStatus(f.repo, ['show-ref', '--verify', '--quiet', 'refs/heads/claude/karte-funktionen']).status, 1, 'kein Branch angelegt');
  assert.equal(g.aufrufe().length, 0); assert.equal(remoteZweige(f.bare).length, 1);
  assert.equal(lauf.lies(f.repo).abschluss, null);
});

/** Nach einer Ablehnung darf nichts passiert sein: kein Branch, kein Commit, nichts im Remote, kein gh-Aufruf. */
function nichtsPassiert(f, g, kopf) {
  assert.equal(git(f.repo, ['rev-parse', 'HEAD']).trim(), kopf);
  assert.equal(git(f.repo, ['symbolic-ref', '--short', 'HEAD']).trim(), 'main');
  assert.equal(git(f.repo, ['for-each-ref', 'refs/heads', '--format=%(refname:short)']).trim(), 'main');
  assert.deepEqual(remoteZweige(f.bare).map((z) => z.split(' ')[0]), ['main']);
  assert.equal(g.aufrufe().length, 0);
  assert.equal(lauf.lies(f.repo).abschluss, null);
}

test('Abschluss: Ablehnungen ohne jede Änderung (kein autonomer Lauf, nicht übernommen, falsche Angaben, fremder Remote, Freigabe fehlt)', () => {
  const pruefe = (f, g, params, grund, umgebung = g.umgebung) => {
    const kopf = git(f.repo, ['rev-parse', 'HEAD']).trim();
    const r = abschliessen(f.repo, params, umgebung);
    assert.equal(r.status, 'abgelehnt', JSON.stringify(r)); assert.equal(r.grund, grund, JSON.stringify(r));
    nichtsPassiert(f, g, kopf);
    return r;
  };
  // kein autonomer Lauf
  let f = fluss({ autonom: false, review: null, tests: null, uebernehmen: false });
  lauf.uebernehmen(f.repo, { freigabePruefen: false });
  pruefe(f, ghUmgebung(f.bare), ABSCHLUSS, 'kein-autonomer-lauf');
  // nicht übernommen
  f = fluss({ uebernehmen: false });
  pruefe(f, ghUmgebung(f.bare), ABSCHLUSS, 'nicht-uebernommen');
  // falsche Angaben
  f = fluss(); let g = ghUmgebung(f.bare);
  for (const [p, grund] of [[{ ...ABSCHLUSS, kurzname: 'Main' }, 'kurzname'], [{ ...ABSCHLUSS, kurzname: 'ab' }, 'kurzname'], [{ ...ABSCHLUSS, kurzname: '../main' }, 'kurzname'], [{ ...ABSCHLUSS, kurzname: 'x y z' }, 'kurzname'],
    [{ ...ABSCHLUSS, titel: '' }, 'titel'], [{ ...ABSCHLUSS, titel: 'a\nb' }, 'titel'], [{ ...ABSCHLUSS, titel: 'x'.repeat(121) }, 'titel'],
    [{ ...ABSCHLUSS, einschraenkungen: '' }, 'einschraenkungen'], [{ ...ABSCHLUSS, basis: 'develop' }, 'basis-nicht-erlaubt'], [{ ...ABSCHLUSS, basis: 'claude/../main' }, 'basis-nicht-erlaubt']]) pruefe(f, g, p, grund);
  // Remote nicht auf der Erlaubnisliste (Standard: nur das GitHub-Repository von Jonah) und erst recht nicht ein anderer
  pruefe(f, g, ABSCHLUSS, 'remote-nicht-erlaubt', { ...g.umgebung, erlaubteRemotes: ['https://github.com/fremd/projekt.git'] });
  pruefe(f, g, ABSCHLUSS, 'remote-nicht-erlaubt', { gh: g.umgebung.gh });
  assert.ok(ERLAUBTE_REMOTES.every((x) => /thalrail\/blockwerk/.test(x)));
  // Freigabe nachträglich entwertet (neuer Codezustand ohne neue Meldungen)
  f = fluss({ uebernehmen: false }); g = ghUmgebung(f.bare);
  lauf.uebernehmen(f.repo);
  const a = lauf.lies(f.repo); a.basis = lauf.lies(f.repo).s0; lauf.speichere(f.repo, a);
  pruefe(f, g, ABSCHLUSS, 'freigabe');
});

test('Abschluss: Ablehnung, wenn der Hauptbaum nicht mehr der geprüfte Zustand ist, fremde Änderungen da sind oder sich HEAD bewegt hat', () => {
  const pruefe = (f, g, grund) => {
    const kopf = git(f.repo, ['rev-parse', 'HEAD']).trim();
    const r = abschliessen(f.repo, ABSCHLUSS, g.umgebung);
    assert.equal(r.status, 'abgelehnt', JSON.stringify(r)); assert.equal(r.grund, grund, JSON.stringify(r));
    assert.equal(git(f.repo, ['symbolic-ref', '--short', 'HEAD']).trim(), 'main'); assert.equal(g.aufrufe().length, 0); assert.equal(remoteZweige(f.bare).length, 1);
    return kopf;
  };
  // übernommene Datei nach der Übernahme noch verändert
  let f = fluss(); let g = ghUmgebung(f.bare);
  w(f.repo, 'src/a.js', 'heimlich geändert\n');
  pruefe(f, g, 'arbeitsbaum-weicht-ab');
  // fremde uncommittete Änderung nach der Übernahme (fremde Datei, nicht im Snapshot erklärt)
  f = fluss(); g = ghUmgebung(f.bare);
  w(f.repo, 'docs/stand.md', '# fremd\n');
  assert.ok(['arbeitsbaum-weicht-ab', 'fremde-aenderungen'].includes(abschliessen(f.repo, ABSCHLUSS, g.umgebung).grund));
  // neue fremde Datei
  f = fluss(); g = ghUmgebung(f.bare);
  w(f.repo, 'src/fremd.js', 'x\n');
  assert.ok(['arbeitsbaum-weicht-ab', 'fremde-aenderungen'].includes(abschliessen(f.repo, ABSCHLUSS, g.umgebung).grund));
  assert.equal(g.aufrufe().length, 0); assert.equal(remoteZweige(f.bare).length, 1);
  // HEAD bewegt
  f = fluss(); g = ghUmgebung(f.bare);
  git(f.repo, ['commit', '--allow-empty', '-q', '-m', 'dazwischen']);
  pruefe(f, g, 'head-veraendert');
  // Sicherheitsdatei in der Liste der übernommenen Dateien (wird von den Toren nie durchgelassen; hier als zweite Schranke)
  f = fluss(); g = ghUmgebung(f.bare);
  const a = lauf.lies(f.repo); a.uebernommen.dateien.push('.claude/settings.json'); lauf.speichere(f.repo, a);
  pruefe(f, g, 'sicherheitsdateien');
});

test('Abschluss: Branch existiert schon (lokal oder im Remote) → Ablehnung; PR-Basis unklar (Branch ist vor origin/main) → Ablehnung mit Zahl', () => {
  let f = fluss(); let g = ghUmgebung(f.bare);
  git(f.repo, ['branch', 'claude/karte-funktionen']);
  assert.equal(abschliessen(f.repo, ABSCHLUSS, g.umgebung).grund, 'branch-existiert-lokal');
  f = fluss(); g = ghUmgebung(f.bare);
  git(f.repo, ['push', '-q', 'origin', 'main:refs/heads/claude/karte-funktionen']);
  assert.equal(abschliessen(f.repo, ABSCHLUSS, g.umgebung).grund, 'branch-existiert-remote');
  assert.equal(g.aufrufe().length, 0);
  // der Branch hat einen eigenen, noch nicht im Remote liegenden Commit: die PR enthielte ihn mit
  f = fluss({ vorStart: (r) => { w(r, 'docs/vorab.md', 'vorab\n'); git(r, ['add', '-A']); git(r, ['commit', '-q', '-m', 'vorab']); } }); g = ghUmgebung(f.bare);
  const r = abschliessen(f.repo, ABSCHLUSS, g.umgebung);
  assert.equal(r.status, 'abgelehnt'); assert.equal(r.grund, 'pr-basis-unklar'); assert.equal(r.voraus, 1);
  assert.equal(git(f.repo, ['for-each-ref', 'refs/heads', '--format=%(refname:short)']).trim(), 'main');
  assert.deepEqual(remoteZweige(f.bare).map((z) => z.split(' ')[0]), ['main']);
  // gestapelte PR: Basis nur ein claude/-Branch, der im Remote genau auf dem aktuellen HEAD steht
  f = fluss({ vorStart: (rp) => { git(rp, ['switch', '-q', '-c', 'claude/erste']); w(rp, 'docs/erste.md', 'e\n'); git(rp, ['add', '-A']); git(rp, ['commit', '-q', '-m', 'erste']); git(rp, ['push', '-q', '-u', 'origin', 'claude/erste']); } }); g = ghUmgebung(f.bare);
  const stapel = abschliessen(f.repo, { ...ABSCHLUSS, basis: 'claude/erste', trocken: true }, g.umgebung);
  assert.equal(stapel.status, 'bereit', JSON.stringify(stapel)); assert.equal(stapel.basis, 'claude/erste');
  assert.equal(abschliessen(f.repo, { ...ABSCHLUSS, trocken: true }, g.umgebung).grund, 'pr-basis-unklar', 'gegen main wäre der Vorgänger-Commit mit in der PR');
  git(f.bare, ['update-ref', 'refs/heads/claude/erste', git(f.bare, ['rev-parse', 'main']).trim()]);
  assert.equal(abschliessen(f.repo, { ...ABSCHLUSS, basis: 'claude/erste', trocken: true }, g.umgebung).grund, 'pr-basis-unklar', 'Remote-Branch steht nicht auf HEAD');
});

test('Abschluss: scheitert gh, steht „blockiert“ (Branch, Commit und Push bleiben); erneuter Aufruf setzt nur den PR-Schritt fort, ohne zweiten Commit oder Push', () => {
  const f = fluss();
  let g = ghUmgebung(f.bare, { scheitern: true });
  const r = abschliessen(f.repo, ABSCHLUSS, g.umgebung);
  assert.equal(r.status, 'blockiert'); assert.equal(r.schritt, 'pr'); assert.deepEqual(r.fortschritt, ['branch', 'commit', 'push']);
  assert.match(r.grund, /gh: kaputt/);
  const commit = r.commit;
  assert.equal(remoteZweige(f.bare).find((z) => z.startsWith('claude/')).split(' ')[1], commit);
  g = ghUmgebung(f.bare);
  const wieder = abschliessen(f.repo, ABSCHLUSS, g.umgebung);
  assert.equal(wieder.status, 'fertig', JSON.stringify(wieder));
  assert.equal(wieder.commit, commit);
  assert.equal(git(f.repo, ['rev-list', '--count', 'main..HEAD']).trim(), '1', 'genau ein Commit');
  assert.equal(g.aufrufe().length, 1);
});

test('Abschluss: wird der Push abgelehnt, steht „blockiert“, es gibt keinen PR und keinen zweiten Versuch mit anderen Mitteln', () => {
  // Die Ablehnung kommt vom Remote ohne Hook (Hooks sind im gehärteten Modus aus): ein Zweig `claude` verhindert `claude/<name>` (Verzeichnis/Datei-Konflikt der Refs)
  const f = fluss({ vorStart: (r, bare) => { git(bare, ['update-ref', 'refs/heads/claude', git(bare, ['rev-parse', 'main']).trim()]); } });
  const g = ghUmgebung(f.bare);
  const r = abschliessen(f.repo, ABSCHLUSS, g.umgebung);
  assert.equal(r.status, 'blockiert', JSON.stringify(r)); assert.equal(r.schritt, 'push'); assert.deepEqual(r.fortschritt, ['branch', 'commit']);
  assert.equal(g.aufrufe().length, 0, 'ohne Push kein PR');
  assert.deepEqual(remoteZweige(f.bare).map((z) => z.split(' ')[0]).sort(), ['claude', 'main'], 'nur der vorbereitete Zweig `claude` und main, kein neuer Branch');
  assert.match(r.hinweis, /Jonah berichten/);
});

test('Abschluss ohne Freigabe: auch ein manipulierter Zustand (Review entfernt) führt nicht zum Commit', () => {
  const f = fluss();
  const a = lauf.lies(f.repo);
  fs.rmSync(path.join(lauf.laufDir(f.repo, a.id), 'reviews.jsonl'));
  const g = ghUmgebung(f.bare);
  const r = abschliessen(f.repo, ABSCHLUSS, g.umgebung);
  assert.equal(r.grund, 'freigabe');
  assert.equal(git(f.repo, ['symbolic-ref', '--short', 'HEAD']).trim(), 'main');
  assert.equal(remoteZweige(f.bare).length, 1);
});

test('Quelltext des Abschlusses: nur Draft, nur der eigene Branch, nie Merge, Force, ready, gh api, Löschen oder Shell-Text', () => {
  const quelle = fs.readFileSync(new URL('../../tools/orchestrierung/abschluss.js', import.meta.url), 'utf8');
  const code = quelle.split('\n').filter((z) => !z.trim().startsWith('//') && !z.trim().startsWith('*')).join('\n');
  assert.ok(code.includes("'--draft'"));
  assert.equal((code.match(/\['push'/g) ?? []).length, 1, 'genau ein Push-Aufruf');
  assert.ok(code.includes("['push', '-u', 'origin',"), 'Push immer mit Upstream auf origin');
  assert.ok(code.includes('`refs/heads/${f.branch}:refs/heads/${f.branch}`'), 'ausdrücklicher Refspec');
  for (const verboten of [/'merge'/, /pr merge/, /'ready'/, /'api'/, /--force/, /'-f'/, /--delete/, /--mirror/, /'--all'/, /'tag'/, /exec\(/, /shell:\s*true/, /'rebase'/, /'reset'/, /'stash'/, /'clean'/, /'filter-branch'/, /'--no-verify'/, /'--amend'/]) {
    assert.ok(!verboten.test(code), `abschluss.js enthält ${verboten}`);
  }
  assert.ok(/'merge-base'/.test(code), 'nur merge-base zum Prüfen der Basis');
});

test('Kommandozeile: aus einem Agenten-Worktree heraus bedient das Werkzeug nichts (nur status); zweite Schranke neben dem Wächter', () => {
  const f = fluss({ uebernehmen: false });
  for (const befehl of [['uebernehmen'], ['abschluss', '--kurzname', 'abc', '--titel', 't', '--einschraenkungen', 'Keine bekannten Einschränkungen'], ['ende'], ['tore'], ['paket']]) {
    assert.throws(() => fuehreAus(befehl, f.wt), /nur der Koordinator im Hauptverzeichnis/, befehl[0]);
  }
  assert.equal(fuehreAus(['status'], f.wt).aktiv, true, 'lesen darf jeder');
  assert.equal(lauf.lies(f.repo).uebernommen, null);
});

test('tests-ausfuehren: das Werkzeug startet die Tests selbst und liest das echte Ergebnis (grün, rot, Zähler nicht lesbar); Tests dürfen den Stand nicht verändern; Zahlen lassen sich nicht melden', () => {
  const lauf1 = (aendere) => {
    const { repo } = sauberesRepo();
    lauf.starten(repo, { auftrag: 'x', dateien: ['src/**', 'test/**'], autonom: true });
    const wt = lauf.worktreeAnlegen(repo, 'agent-t');
    aendere(wt);
    lauf.rundeEnde(repo, { worktree: wt });
    return { repo, wt };
  };
  // grün
  let f = lauf1((wt) => w(wt, 'src/a.js', 'neu\n'));
  const gruen = lauf.testsAusfuehren(f.repo, { worktree: f.wt });
  assert.equal(gruen.quelle, 'werkzeug'); assert.equal(gruen.suite, 'kurz'); assert.equal(gruen.bestanden, true); assert.equal(gruen.gruen, 1); assert.equal(gruen.exit, 0);
  // rot: ein fehlschlagender Test wird als rot protokolliert und blockiert die Freigabe
  f = lauf1((wt) => w(wt, 'test/rot.test.js', "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\ntest('rot', () => { assert.equal(1, 2); });\n"));
  const rot = lauf.testsAusfuehren(f.repo, { worktree: f.wt });
  assert.equal(rot.bestanden, false); assert.equal(rot.fehlgeschlagen, 1); assert.notEqual(rot.exit, 0);
  assert.match(lauf.freigabeStatus(f.repo).gruende.join(' | '), /„kurz“ nicht grün/);
  // Tests, die den Worktree verändern, gelten nicht
  f = lauf1((wt) => w(wt, 'test/schreibt.test.js', "import { test } from 'node:test';\nimport fs from 'node:fs';\ntest('schreibt', () => { fs.writeFileSync('src/a.js', 'durch den Test\\n'); });\n"));
  assert.throws(() => lauf.testsAusfuehren(f.repo, { worktree: f.wt }), /Tests haben den Worktree verändert/);
  assert.equal(lauf.freigabeStatus(f.repo).tests, null, 'nichts wurde protokolliert');
  // keine lesbare Ausgabe
  f = lauf1((wt) => w(wt, 'test/kaputt.test.js', 'syntax error hier\n'));
  const kaputt = lauf.testsAusfuehren(f.repo, { worktree: f.wt });
  assert.equal(kaputt.bestanden, false, 'ein nicht ladbarer Test ist nie grün');
  // Parameter
  assert.throws(() => lauf.testsAusfuehren(f.repo, { worktree: f.wt, suite: 'rm -rf' }), /Unbekannte Suite/);
  assert.throws(() => lauf.testsAusfuehren(f.repo, { worktree: f.repo }), /kein Worktree dieses Laufs/);
  // Kommandozeile: nur tests-ausfuehren (feste Suiten); Zahlen melden gibt es dort nicht
  assert.throws(() => fuehreAus(['tests-melden', '--worktree', f.wt, '--json', '{}'], f.repo), /Unbekannter Befehl/);
  assert.throws(() => fuehreAus(['tests-ausfuehren', '--worktree', f.wt, '--json', '{}'], f.repo), /Unbekannte Option/);
  assert.throws(() => fuehreAus(['tests-ausfuehren', '--worktree', f.wt, '--suite', 'x; rm'], f.repo), /Unbekannte Suite/);
  // die vollständige Suite ist Pflicht: nur „orchestrierung“ reicht nicht
  f = lauf1((wt) => w(wt, 'src/a.js', 'anders\n'));
  lauf.testsAusfuehren(f.repo, { worktree: f.wt, suite: 'orchestrierung' }).bestanden;
  assert.match(lauf.freigabeStatus(f.repo).gruende.join(' | '), /Suite „kurz“/);
});

// ---- Integritätsprüfung zwischen Testende, Übernahme und Abschluss (Git-Konfiguration, Hooks, Info, Nachweisdateien, Hauptbaum) ----

const gitDir = (repo) => path.join(repo, '.git');
/** Hook, der beim Ausführen eine Markierungsdatei schreibt (er darf nie laufen). */
function hook(repo, name, marker) {
  const datei = path.join(gitDir(repo), 'hooks', name);
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  fs.writeFileSync(datei, `#!/bin/sh\necho gelaufen > "${marker.replace(/\\/g, '/')}"\nexit 0\n`, { mode: 0o755 });
}
/** Wie ein Nachweis, der nach dem Testende am Werkzeug vorbei angehängt wird: die jüngste Testmeldung noch einmal (das Gate bliebe grün). */
function nachweisFaelschen(repo) {
  const a = lauf.lies(repo);
  const datei = path.join(lauf.laufDir(repo, a.id), 'tests.jsonl');
  const zeilen = fs.readFileSync(datei, 'utf8').split('\n').filter(Boolean);
  fs.appendFileSync(datei, `${zeilen.at(-1)}\n`);
}

const EINGRIFFE = [
  ['ein neuer Git-Hook', (repo, marker) => hook(repo, 'pre-commit', marker), /git:git\/hooks\/pre-commit/],
  ['ein Hook für Referenzänderungen', (repo, marker) => hook(repo, 'reference-transaction', marker), /git:git\/hooks\/reference-transaction/],
  ['eine geänderte Git-Konfiguration (fsmonitor)', (repo) => git(repo, ['config', '--local', 'core.fsmonitor', 'evil']), /git:git\/config/],
  ['ein umgeleitetes Push-Ziel (url.insteadOf)', (repo) => git(repo, ['config', '--local', 'url.https://evil.example/.insteadOf', 'https://github.com/']), /git:git\/config/],
  ['ein Credential-Helper mit Shell', (repo) => git(repo, ['config', '--local', 'credential.helper', '!evil']), /git:git\/config/],
  ['Filter-Attribute in .git/info', (repo) => { fs.mkdirSync(path.join(gitDir(repo), 'info'), { recursive: true }); fs.writeFileSync(path.join(gitDir(repo), 'info', 'attributes'), '*.js filter=evil\n'); }, /git:git\/info\/attributes/],
  ['ein nachträglich angehängter Testnachweis', (repo) => nachweisFaelschen(repo), /protokoll:tests\.jsonl/],
];

for (const [name, eingriff, erwartet] of EINGRIFFE) {
  test(`Integrität vor der Übernahme: ${name} zwischen Testende und uebernehmen sperrt den Lauf; nichts wird übernommen`, () => {
    const f = fluss({ uebernehmen: false });
    const marker = neuerName('marker') + '.txt';
    eingriff(f.repo, marker);
    const u = lauf.uebernehmen(f.repo);
    assert.equal(u.status, 'abgelehnt'); assert.equal(u.grund, 'integritaet', JSON.stringify(u));
    assert.match(u.verstoss.join(' | '), erwartet);
    assert.equal(text(f.repo, 'src/a.js'), 'eins\nzwei\n', 'nichts übernommen');
    assert.equal(fs.existsSync(marker), false, 'kein Hook ist gelaufen');
    assert.equal(lauf.lies(f.repo).uebernommen, null);
    // gesperrt: auch ohne jede Spur des Eingriffs bleibt es dabei
    assert.match(lauf.sperrGrund(f.repo, lauf.lies(f.repo)), /Integritätsverletzung vor der Übernahme/);
    assert.equal(lauf.freigabeStatus(f.repo).ok, false);
    assert.equal(lauf.uebernehmen(f.repo).grund, 'gesperrt');
  });
}

test('Integrität vor der Übernahme: eine Änderung im Hauptbaum zwischen Testende und uebernehmen sperrt einen autonomen Lauf', () => {
  const f = fluss({ uebernehmen: false });
  w(f.repo, 'docs/unerwartet.md', 'von jemand anderem\n');
  const u = lauf.uebernehmen(f.repo);
  assert.equal(u.grund, 'integritaet'); assert.match(u.verstoss.join(' | '), /haupt:datei:docs\/unerwartet\.md/);
  assert.equal(text(f.repo, 'src/a.js'), 'eins\nzwei\n');
  assert.notEqual(lauf.sperrGrund(f.repo, lauf.lies(f.repo)), null);
  // und HEAD bewegen
  const g = fluss({ uebernehmen: false });
  git(g.repo, ['commit', '--allow-empty', '-q', '-m', 'dazwischen']);
  const v = lauf.uebernehmen(g.repo);
  assert.equal(v.grund, 'integritaet'); assert.match(v.verstoss.join(' | '), /haupt:head/);
});

for (const [name, eingriff, erwartet] of EINGRIFFE) {
  test(`Integrität vor dem Abschluss: ${name} zwischen Übernahme und abschluss sperrt den Lauf; kein Branch, kein Commit, kein Push, keine PR, kein Hook`, () => {
    const f = fluss();
    assert.equal(f.u.status, 'uebernommen');
    const marker = neuerName('marker') + '.txt';
    eingriff(f.repo, marker);
    const kopf = git(f.repo, ['rev-parse', 'HEAD']).trim();
    const g = ghUmgebung(f.bare);
    const r = abschliessen(f.repo, ABSCHLUSS, g.umgebung);
    assert.equal(r.status, 'abgelehnt'); assert.equal(r.grund, 'integritaet', JSON.stringify(r));
    assert.match(r.verstoss.join(' | '), erwartet);
    assert.equal(git(f.repo, ['rev-parse', 'HEAD']).trim(), kopf, 'kein Commit');
    assert.equal(git(f.repo, ['symbolic-ref', '--short', 'HEAD']).trim(), 'main');
    assert.equal(gitStatus(f.repo, ['show-ref', '--verify', '--quiet', 'refs/heads/claude/karte-funktionen']).status, 1, 'kein Branch');
    assert.deepEqual(remoteZweige(f.bare).map((z) => z.split(' ')[0]), ['main'], 'kein Push');
    assert.equal(g.aufrufe().length, 0, 'keine PR');
    assert.equal(fs.existsSync(marker), false, 'kein Hook ist gelaufen');
    // gesperrt, keine automatische Wiederfreigabe
    assert.notEqual(lauf.sperrGrund(f.repo, lauf.lies(f.repo)), null);
    assert.equal(abschliessen(f.repo, ABSCHLUSS, g.umgebung).grund, 'freigabe');
    assert.equal(abschliessen(f.repo, { ...ABSCHLUSS, trocken: true }, g.umgebung).grund, 'freigabe');
    assert.equal(g.aufrufe().length, 0);
  });
}

test('Integrität zwischen den Schritten: scheitert gh und wird danach ein Hook angelegt, setzt der erneute Aufruf nicht fort, sondern sperrt den Lauf', () => {
  const f = fluss();
  const marker = neuerName('marker') + '.txt';
  const schlecht = ghUmgebung(f.bare, { scheitern: true });
  const r1 = abschliessen(f.repo, ABSCHLUSS, schlecht.umgebung);
  assert.equal(r1.status, 'blockiert'); assert.equal(r1.schritt, 'pr');
  assert.deepEqual(r1.fortschritt, ['branch', 'commit', 'push']);
  assert.deepEqual(lauf.integritaetPruefen(f.repo, lauf.lies(f.repo)), [], 'nach dem eigenen push -u ist die Basislinie neu festgelegt');
  const gut = ghUmgebung(f.bare);
  hook(f.repo, 'post-commit', marker);
  const r2 = abschliessen(f.repo, ABSCHLUSS, gut.umgebung);
  assert.equal(r2.status, 'abgelehnt'); assert.equal(r2.grund, 'integritaet'); assert.match(r2.verstoss.join(' | '), /git:git\/hooks\/post-commit/);
  assert.equal(gut.aufrufe().length, 0, 'gh wird nicht mehr aufgerufen');
  assert.equal(fs.existsSync(marker), false);
  assert.equal(abschliessen(f.repo, ABSCHLUSS, gut.umgebung).grund, 'freigabe', 'auch der nächste Aufruf bleibt abgelehnt');
});

test('Abschluss: vorhandene Hooks oder gefährliche Git-Konfiguration schon beim Start des Laufs → Ablehnung (kein Commit, kein Push), auch im Trockenlauf', () => {
  const marker = neuerName('marker') + '.txt';
  let f = fluss({ vorStart: (r) => hook(r, 'pre-commit', marker) });
  let g = ghUmgebung(f.bare);
  let r = abschliessen(f.repo, { ...ABSCHLUSS, trocken: true }, g.umgebung);
  assert.equal(r.status, 'abgelehnt'); assert.equal(r.grund, 'git-hooks'); assert.deepEqual(r.hooks, ['pre-commit']);
  assert.equal(abschliessen(f.repo, ABSCHLUSS, g.umgebung).grund, 'git-hooks');
  assert.equal(fs.existsSync(marker), false); assert.equal(remoteZweige(f.bare).length, 1); assert.equal(g.aufrufe().length, 0);

  for (const [k, v] of [['url.https://evil.example/.insteadOf', 'https://github.com/'], ['credential.helper', '!evil'], ['core.hooksPath', '/x'], ['filter.x.clean', 'evil'], ['remote.origin.pushurl', 'https://evil.example/x.git']]) {
    f = fluss({ vorStart: (rp) => git(rp, ['config', '--local', k, v]) });
    g = ghUmgebung(f.bare);
    r = abschliessen(f.repo, ABSCHLUSS, g.umgebung);
    assert.equal(r.status, 'abgelehnt'); assert.equal(r.grund, 'git-konfiguration', `${k}: ${JSON.stringify(r)}`);
    assert.match(r.probleme.join(' | '), new RegExp(k.split('.').slice(0, 2).join('\\.'), 'i'));
    assert.equal(remoteZweige(f.bare).length, 1, 'kein Push'); assert.equal(g.aufrufe().length, 0, 'keine PR');
    assert.equal(gitStatus(f.repo, ['show-ref', '--verify', '--quiet', 'refs/heads/claude/karte-funktionen']).status, 1);
  }
});

test('Abschluss: der Weg über den Git Credential Manager bleibt nutzbar – die gehärtete Umgebung behält das Benutzerprofil, die Konfiguration mit dem Helper „manager“ wird akzeptiert und der Erfolgsweg läuft durch', () => {
  const f = fluss({ vorStart: (r) => git(r, ['config', '--local', 'credential.helper', 'manager']), uebernehmen: true });
  const g = ghUmgebung(f.bare);
  const r = abschliessen(f.repo, ABSCHLUSS, g.umgebung);
  assert.equal(r.status, 'fertig', JSON.stringify(r));
  assert.deepEqual(lauf.integritaetPruefen(f.repo, lauf.lies(f.repo)), [], 'die Basislinie wurde nach push -u neu festgelegt');
  // und die Umgebung, die Git im Abschluss bekommt, enthält die Variablen, die der Credential Manager braucht
  const e = haerteUmgebung({ USERPROFILE: 'C:\\Users\\j', APPDATA: 'C:\\a', LOCALAPPDATA: 'C:\\l', ProgramData: 'C:\\p', Path: 'x', SystemRoot: 'C:\\Windows', GIT_ASKPASS: 'evil' });
  for (const k of ['USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ProgramData', 'Path', 'SystemRoot']) assert.ok(e[k], k);
  assert.equal(e.GIT_ASKPASS, undefined);
});

test('Abschluss: gh läuft mit gesäuberter Umgebung (keine GIT_*-, Proxy-, Askpass-, Claude-/Anthropic-Variablen), aber mit Git-Einstellungen für die Git-Aufrufe, die gh selbst startet', () => {
  const gesetzt = { GIT_ASKPASS: 'evil', GIT_SSH_COMMAND: 'evil', GIT_EXEC_PATH: 'evil', HTTPS_PROXY: 'http://evil', SSH_ASKPASS: 'evil', ANTHROPIC_API_KEY: 'geheim', CLAUDE_CODE_MESSAGING_TOKEN: 'geheim', GH_PAGER: 'evil', PAGER: 'evil' };
  const alt = {};
  for (const [k, v] of Object.entries(gesetzt)) { alt[k] = process.env[k]; process.env[k] = v; }
  try {
    const f = fluss();
    const g = ghUmgebung(f.bare);
    assert.equal(abschliessen(f.repo, ABSCHLUSS, g.umgebung).status, 'fertig');
    const [aufruf] = g.aufrufe();
    for (const k of Object.keys(gesetzt)) assert.ok(!aufruf.env.includes(k), `${k} erreicht gh nicht`);
    assert.ok(aufruf.env.includes('GIT_CONFIG_COUNT') && Number(aufruf.configAnzahl) >= 5, 'Git-Einstellungen (Hooks aus, fsmonitor aus, …) gelten auch für Git-Aufrufe von gh');
    assert.ok(aufruf.env.some((k) => /^path$/i.test(k)), 'PATH bleibt');
    assert.ok(aufruf.env.includes('GH_PROMPT_DISABLED'));
  } finally {
    for (const [k, v] of Object.entries(alt)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

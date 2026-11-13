// Orchestrierung: Veröffentlichung vorbereiteter claude/*-Branches (Vorprüfung, Freigabe-Hash, Push, PR, Ready, Checks, Wiederaufnahme).
// Alles in Wegwerf-Repositories mit einem lokalen Bare-Repository als Test-Remote; `gh` ist eine zustandsbehaftete Attrappe (PRs, Checks, Regeln aus einer Datei).
// Es geht nie etwas ins Netz und nie in das echte Blockwerk-Repository.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { git } from '../../tools/orchestrierung/git.js';
import * as lauf from '../../tools/orchestrierung/lauf.js';
import * as v from '../../tools/orchestrierung/veroeffentlichen.js';
import { fuehreAus } from '../../tools/orchestrierung/cli.js';
import { neuerName, WURZEL, w } from './hilfe.js';

const GUT = { review_mode: 'single', failover_occurred: false, provider: 'codex', verdict: 'approve', session_id: 's-gut', models: [{ provider: 'codex' }] };
const TITEL = 'Karte: Aufrufer auf Funktionsebene';
const EINSCHR = 'Namensfunde ohne Scope; unklare Treffer sind gekennzeichnet.';
const PASS = (name = 'test', workflow = 'Tests') => ({ name, workflow, bucket: 'pass', state: 'SUCCESS', link: `https://example.test/run/${name}` });

// gh-Attrappe: Zustand in GH_STATE (PRs, Checks, Regeln), Aufrufprotokoll in GH_LOG, Kopf-Commit der PR aus dem Test-Remote (GH_BARE)
const GH_SKRIPT = path.join(WURZEL, 'gh-veroeffentlichen.mjs');
fs.writeFileSync(GH_SKRIPT, `import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const st = JSON.parse(fs.readFileSync(process.env.GH_STATE, 'utf8'));
const speichere = () => fs.writeFileSync(process.env.GH_STATE, JSON.stringify(st));
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
fs.appendFileSync(process.env.GH_LOG, JSON.stringify({ args }) + '\\n');
const sha = (b) => { const r = spawnSync('git', ['--git-dir', process.env.GH_BARE, 'rev-parse', 'refs/heads/' + b], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };
const felder = (o) => Object.fromEntries((opt('--json') || '').split(',').map((k) => [k, o[k]]));
const nummer = () => Number(args[2]);
const finde = () => st.prs.find((p) => p.number === nummer());
const mitKopf = (p) => ({ ...p, headRefOid: p.headFest ?? p.headOverride ?? sha(p.headBranch) });
const aus = (x) => console.log(JSON.stringify(x));
const sub = args[1];
if (sub === 'list') {
  if (st.listFail) { console.error('gh: nicht angemeldet'); process.exit(1); }
  aus(st.prs.filter((p) => p.headBranch === opt('--head') && p.state === 'OPEN').map(mitKopf));
} else if (sub === 'create') {
  if (st.createFail) { console.error('gh: GraphQL: kaputt'); process.exit(1); }
  const n = st.next++;
  st.prs.push({ number: n, url: 'https://example.test/Thalrail/Blockwerk/pull/' + n, isDraft: false, baseRefName: opt('--base'), headBranch: opt('--head'), isCrossRepository: false, state: 'OPEN',
    mergeStateStatus: st.mergeStateStatus === undefined ? 'CLEAN' : st.mergeStateStatus, mergeable: st.mergeable === undefined ? 'MERGEABLE' : st.mergeable, reviewDecision: '', body: fs.readFileSync(opt('--body-file'), 'utf8'), title: opt('--title') });
  speichere(); console.log('https://example.test/Thalrail/Blockwerk/pull/' + n);
} else if (sub === 'view') {
  const p = finde(); if (st.headLag > 0) { st.headLag--; p.headOverride = 'alt0000'; } else if (p.headOverride === 'alt0000') delete p.headOverride; speichere();
  aus(felder(mitKopf(p)));
} else if (sub === 'ready') {
  if (st.readyFail) { console.error('gh: kann nicht auf ready setzen'); process.exit(1); }
  finde().isDraft = false; speichere();
} else if (sub === 'checks') {
  if (args.includes('--required') && st.requiredLeerMitFehler) { console.log('[]'); console.error('HTTP 401: Bad credentials'); process.exit(4); }
  if (args.includes('--required') ? st.requiredError : st.checksError) { console.error('HTTP 401: Bad credentials'); process.exit(4); }
  const l = args.includes('--required') ? st.required : st.checks;
  if (args.includes('--required') && st.noRequired) { console.error('no required checks reported'); process.exit(1); }
  aus(l); process.exit(l.some((c) => c.bucket === 'fail') ? 1 : l.some((c) => c.bucket === 'pending') ? 8 : 0);
} else { console.error('unbekannt ' + sub); process.exit(2); }
`);

function ghAttrappe(bare, zustand = {}) {
  const log = neuerName('gh-log'); const datei = neuerName('gh-zustand');
  const st = { prs: [], next: 1, checks: [PASS()], required: [], ...zustand };
  fs.writeFileSync(datei, JSON.stringify(st));
  return {
    umgebung: { erlaubteRemotes: [bare], gh: [process.execPath, GH_SKRIPT], ghEnv: { GH_LOG: log, GH_STATE: datei, GH_BARE: bare }, intervallMs: 0, timeoutMs: 60, testTimeoutMs: 120000 },
    aufrufe: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z).args) : []),
    unterbefehle: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z).args[1]) : []),
    zustand: () => JSON.parse(fs.readFileSync(datei, 'utf8')),
    setze: (f) => { const s = JSON.parse(fs.readFileSync(datei, 'utf8')); f(s); fs.writeFileSync(datei, JSON.stringify(s)); },
  };
}

/** Repository mit Test-Remote und dem lokal vorbereiteten, committeten Branch claude/feature-x. */
function vorbereitet({ aendere } = {}) {
  const bare = neuerName('remote'); fs.mkdirSync(bare, { recursive: true });
  git(bare, ['init', '-q', '--bare', '-b', 'main']);
  const repo = neuerName('arbeit'); fs.mkdirSync(repo, { recursive: true });
  const g = (...a) => git(repo, a);
  g('init', '-q', '-b', 'main'); g('config', 'user.name', 'Test'); g('config', 'user.email', 't@t'); g('config', 'core.autocrlf', 'false');
  w(repo, '.gitignore', '.claude/worktrees/\n.claude/orchestrierung/\n');
  w(repo, 'package.json', `${JSON.stringify({ name: 'x', type: 'module' }, null, 2)}\n`);
  w(repo, 'src/a.js', 'eins\nzwei\n'); w(repo, 'docs/stand.md', '# Stand\n');
  w(repo, 'test/ok.test.js', "import { test } from 'node:test';\ntest('läuft', () => {});\n");
  g('add', '-A'); g('commit', '-q', '-m', 'basis');
  g('remote', 'add', 'origin', bare); g('push', '-q', '-u', 'origin', 'main');
  g('switch', '-q', '-c', 'claude/feature-x');
  if (aendere) aendere(repo); else { w(repo, 'src/a.js', 'eins\nzwei geändert\n'); w(repo, 'src/neu.js', 'export const n = 1;\n'); }
  g('add', '-A'); g('commit', '-q', '-m', 'Änderung');
  return { repo, bare };
}
/** Paket, Review und (optional) Befunde für den Stand von HEAD. */
function nachweise(repo, { review = GUT, befunde = [], einstufungen = [] } = {}) {
  const iso = neuerName('review'); fs.mkdirSync(iso, { recursive: true });
  v.nachweisPaket(repo, { wurzel: iso, hinweise: 't' });
  v.nachweisReview(repo, review, befunde);
  for (const e of einstufungen) v.nachweisBefund(repo, e);
}
const remoteZweige = (bare) => git(bare, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']).trim().split('\n').filter(Boolean).sort();
const kopf = (repo) => git(repo, ['rev-parse', 'HEAD']).trim();
const bereit = (repo, g) => { const r = v.vorpruefung(repo, { titel: TITEL, einschraenkungen: EINSCHR }, g.umgebung); assert.equal(r.status, 'bereit', JSON.stringify(r)); return r; };
const frei = (repo, g, r) => v.veroeffentlichen(repo, { branch: 'claude/feature-x', bestaetigt: r.freigabeHash }, g.umgebung);

test('Vorprüfung zeigt Repository, Branch, Ziel, Commit, Diff, Tests und Review, fragt GitHub nur lesend ab und ändert Repository und Remote nicht', () => {
  const { repo, bare } = vorbereitet(); nachweise(repo);
  const g = ghAttrappe(bare);
  const vorher = { kopf: kopf(repo), zweige: remoteZweige(bare) };
  const r = bereit(repo, g);
  assert.equal(r.repository, 'Thalrail/Blockwerk'); assert.equal(r.branch, 'claude/feature-x'); assert.equal(r.ziel, 'main');
  assert.equal(r.commit, kopf(repo)); assert.equal(r.basis, git(repo, ['rev-parse', 'origin/main']).trim());
  assert.equal(r.voraus, 1); assert.equal(r.hinterher, 0); assert.deepEqual(r.diff.dateien, 2); assert.match(r.diff.sha256, /^[0-9a-f]{64}$/);
  assert.equal(r.tests.suite, 'kurz'); assert.ok(r.tests.gruen > 0); assert.equal(r.tests.fehlgeschlagen, 0);
  assert.equal(r.review.verdict, 'approve'); assert.deepEqual(r.remote, { branch: null, push: 'neu' }); assert.match(r.pr, /keine offene PR/);
  assert.match(r.freigabeHash, /^[0-9a-f]{16}$/);
  assert.equal(r.aufruf, `node tools/orchestrierung/cli.js veroeffentlichen --branch claude/feature-x --bestaetigt ${r.freigabeHash}`);
  assert.equal(kopf(repo), vorher.kopf); assert.deepEqual(remoteZweige(bare), vorher.zweige, 'nichts gepusht');
  assert.deepEqual(g.unterbefehle(), ['list'], 'nur lesend gefragt'); assert.equal(git(repo, ['status', '--porcelain']).trim(), '');
  assert.equal(v.vorpruefung(repo, { titel: TITEL, einschraenkungen: EINSCHR }, g.umgebung).freigabeHash, r.freigabeHash, 'derselbe Stand, derselbe Hash');
});

test('Vorprüfung lehnt ab: main, unsauberer Baum, aktiver Lauf, fehlende oder schlechte Nachweise, Sicherheitsdateien, Geheimnis, fremder Remote, abweichender Remote-Branch, GitHub nicht abfragbar', () => {
  const abl = (f, grund, ger = {}) => { const { repo, bare } = f; const g = ghAttrappe(bare, ger); const r = v.vorpruefung(repo, { titel: TITEL, einschraenkungen: EINSCHR }, g.umgebung); assert.equal(r.status, 'abgelehnt', JSON.stringify(r)); assert.equal(r.grund, grund, JSON.stringify(r)); return { r, g }; };
  // main
  { const f = vorbereitet(); nachweise(f.repo); git(f.repo, ['switch', '-q', 'main']); abl(f, 'branch'); }
  // unsauber
  { const f = vorbereitet(); nachweise(f.repo); w(f.repo, 'src/a.js', 'unversioniert geändert\n'); abl(f, 'arbeitsbaum-unsauber'); }
  // aktiver Lauf
  { const f = vorbereitet(); nachweise(f.repo); lauf.starten(f.repo, { auftrag: 'x', dateien: ['src/**'] }); abl(f, 'lauf-aktiv'); }
  // keine Nachweise: Review fehlt
  { const f = vorbereitet(); const x = abl(f, 'freigabe'); assert.ok(x.r.gruende.some((s) => /Kein Codex-Review/.test(s))); }
  // Review mit Failover, reject, nicht eingestuft
  { const f = vorbereitet(); nachweise(f.repo, { review: { ...GUT, failover_occurred: true, provider: 'gemini' } }); abl(f, 'freigabe'); }
  { const f = vorbereitet(); nachweise(f.repo, { review: { ...GUT, verdict: 'reject' } }); abl(f, 'freigabe'); }
  { const f = vorbereitet(); nachweise(f.repo, { review: { ...GUT, verdict: 'request_changes' }, befunde: [{ id: 'F1', schwere: 'major', kurz: 'x' }] }); const x = abl(f, 'freigabe'); assert.ok(x.r.gruende.some((s) => /nicht eingestuft/.test(s))); }
  // bestätigter Befund blockiert; eingestuft als widerlegt mit Beleg geht
  { const f = vorbereitet(); nachweise(f.repo, { review: { ...GUT, verdict: 'request_changes' }, befunde: [{ id: 'F1', schwere: 'major', kurz: 'x' }], einstufungen: [{ id: 'F1', einstufung: 'bestaetigt' }] }); abl(f, 'freigabe'); }
  { const f = vorbereitet(); nachweise(f.repo, { review: { ...GUT, verdict: 'request_changes' }, befunde: [{ id: 'F1', schwere: 'major', kurz: 'x' }], einstufungen: [{ id: 'F1', einstufung: 'widerlegt', beleg: 'abschluss.js Zeile 5 prüft das bereits ausdrücklich' }] });
    bereit(f.repo, ghAttrappe(f.bare)); }
  // Sicherheitsdateien und Geheimnis
  for (const pfad of ['.claude/settings.json', '.github/workflows/x.yml', 'tools/orchestrierung/lauf.js', '.gitignore']) {
    const f = vorbereitet({ aendere: (r) => { w(r, 'src/a.js', 'x\n'); w(r, pfad, pfad === '.gitignore' ? '.claude/worktrees/\n.claude/orchestrierung/\nextra\n' : 'x\n'); } }); nachweise(f.repo); const x = abl(f, 'sicherheitsdateien'); assert.deepEqual(x.r.dateien, [pfad]);
  }
  { const f = vorbereitet({ aendere: (r) => w(r, 'data/schluessel.pem', '-----BEGIN PRIVATE KEY-----\nabc\n') }); abl(f, 'geheimnis'); }
  // fremder Remote
  { const f = vorbereitet(); nachweise(f.repo); const g = ghAttrappe(f.bare); const r = v.vorpruefung(f.repo, { titel: TITEL, einschraenkungen: EINSCHR }, { ...g.umgebung, erlaubteRemotes: ['https://github.com/thalrail/blockwerk.git'] }); assert.equal(r.grund, 'remote-nicht-erlaubt'); }
  // Remote-Branch weicht ab (andere Historie): nie Force
  { const f = vorbereitet(); nachweise(f.repo);
    const anders = neuerName('anders'); fs.mkdirSync(anders); git(anders, ['init', '-q', '-b', 'x']); git(anders, ['config', 'user.name', 'A']); git(anders, ['config', 'user.email', 'a@a']); w(anders, 'f.txt', 'fremd\n'); git(anders, ['add', '-A']); git(anders, ['commit', '-q', '-m', 'fremd']); git(anders, ['push', '-q', f.bare, 'x:refs/heads/claude/feature-x']);
    abl(f, 'remote-weicht-ab'); }
  // GitHub nicht abfragbar
  { const f = vorbereitet(); nachweise(f.repo); abl(f, 'gh-fehler', { listFail: true }); }
  // Titel und Einschränkungen
  { const { repo, bare } = vorbereitet(); nachweise(repo); const g = ghAttrappe(bare);
    assert.equal(v.vorpruefung(repo, { titel: 'zwei\nZeilen', einschraenkungen: EINSCHR }, g.umgebung).grund, 'titel');
    assert.equal(v.vorpruefung(repo, { titel: TITEL, einschraenkungen: 'x' }, g.umgebung).grund, 'einschraenkungen'); }
});

test('Veröffentlichung mit neuer PR: genau der freigegebene Branch wird gepusht, die PR entsteht gegen main (nicht Draft), der Job test wird abgewartet, das Ergebnis ist die PR-Adresse', () => {
  const { repo, bare } = vorbereitet(); nachweise(repo);
  const g = ghAttrappe(bare);
  const r = bereit(repo, g);
  const e = frei(repo, g, r);
  assert.equal(e.status, 'fertig', JSON.stringify(e)); assert.equal(e.pr, 'https://example.test/Thalrail/Blockwerk/pull/1'); assert.equal(e.commit, kopf(repo));
  assert.deepEqual(remoteZweige(bare), ['claude/feature-x', 'main']); assert.equal(git(bare, ['rev-parse', 'refs/heads/claude/feature-x']).trim(), kopf(repo));
  const create = g.aufrufe().find((a) => a[1] === 'create');
  assert.deepEqual(create.slice(0, 2), ['pr', 'create']); assert.ok(!create.includes('--draft'));
  assert.equal(create[create.indexOf('--repo') + 1], 'Thalrail/Blockwerk'); assert.equal(create[create.indexOf('--base') + 1], 'main'); assert.equal(create[create.indexOf('--head') + 1], 'claude/feature-x');
  assert.match(g.zustand().prs[0].body, new RegExp(`Freigabe-Hash ${r.freigabeHash}`)); assert.match(g.zustand().prs[0].body, /## Unabhängiges Review \(Codex\)/);
  assert.ok(g.aufrufe().some((a) => a[1] === 'checks' && a.includes('--required')), 'Pflichtchecks abgefragt');
  assert.ok(g.aufrufe().every((a) => a[0] === 'pr' && ['list', 'create', 'view', 'ready', 'checks'].includes(a[1])), 'nur erlaubte gh-Unterbefehle');
  assert.ok(g.aufrufe().flat().every((x) => !['merge', '--force', 'api', '--admin', '--delete', '--auto', '--squash'].includes(x)), 'nie Merge, Force, api, Löschen');
  assert.equal(git(repo, ['status', '--porcelain']).trim(), '');
  assert.equal(frei(repo, g, r).status, 'fertig', 'erneuter Aufruf: dieselbe PR, kein zweites create');
  assert.equal(g.aufrufe().filter((a) => a[1] === 'create').length, 1);
});

test('Bestehende offene PR wird verwendet; ein Draft wird auf „Ready for review“ gesetzt; der PR-Head muss der freigegebene Commit sein (GitHub braucht kurz)', () => {
  const { repo, bare } = vorbereitet(); nachweise(repo);
  const pr = { number: 7, url: 'https://example.test/Thalrail/Blockwerk/pull/7', isDraft: true, baseRefName: 'main', headBranch: 'claude/feature-x', isCrossRepository: false, state: 'OPEN', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE', reviewDecision: '' };
  const g = ghAttrappe(bare, { prs: [pr], next: 8, headLag: 2 });
  git(repo, ['push', '-q', 'origin', 'claude/feature-x']); // Branch liegt schon im Remote, die PR ist ein Draft
  const r = bereit(repo, g); assert.equal(r.remote.push, 'aktuell'); assert.deepEqual(r.pr, { nummer: 7, headRefOid: kopf(repo), isDraft: true, basis: 'main' });
  const e = frei(repo, g, r);
  assert.equal(e.status, 'fertig', JSON.stringify(e)); assert.equal(e.pr, pr.url);
  assert.ok(!g.unterbefehle().includes('create'), 'keine zweite PR'); assert.ok(g.unterbefehle().includes('ready')); assert.equal(g.zustand().prs[0].isDraft, false);
});

test('Freigabe gilt nur für den gezeigten Stand: neuer Commit, bewegter main, falscher Hash, fehlende Vorprüfung, geänderter Remote oder geänderte PR halten vor dem Push an', () => {
  const nichtGepusht = (f) => assert.ok(!remoteZweige(f.bare).includes('claude/feature-x'), 'nichts gepusht');
  // falscher Hash, fehlende Vorprüfung, falscher Branch
  { const f = vorbereitet(); nachweise(f.repo); const g = ghAttrappe(f.bare);
    assert.equal(v.veroeffentlichen(f.repo, { branch: 'claude/feature-x', bestaetigt: '0123456789abcdef' }, g.umgebung).grund, 'keine-vorpruefung');
    const r = bereit(f.repo, g);
    assert.equal(v.veroeffentlichen(f.repo, { branch: 'claude/feature-x', bestaetigt: '0123456789abcdef' }, g.umgebung).grund, 'freigabe-passt-nicht');
    assert.equal(v.veroeffentlichen(f.repo, { branch: 'claude/anderer', bestaetigt: r.freigabeHash }, g.umgebung).grund, 'branch-weicht-ab');
    assert.equal(v.veroeffentlichen(f.repo, { branch: 'main', bestaetigt: r.freigabeHash }, g.umgebung).grund, 'branch');
    assert.equal(v.veroeffentlichen(f.repo, { branch: 'claude/feature-x', bestaetigt: 'xyz' }, g.umgebung).grund, 'freigabe-hash');
    nichtGepusht(f); }
  // neuer Commit nach der Vorprüfung
  { const f = vorbereitet(); nachweise(f.repo); const g = ghAttrappe(f.bare); const r = bereit(f.repo, g);
    w(f.repo, 'src/a.js', 'noch ein Commit\n'); git(f.repo, ['add', '-A']); git(f.repo, ['commit', '-q', '-m', 'nachträglich']);
    const e = frei(f.repo, g, r); assert.equal(e.status, 'abgelehnt'); assert.ok(['freigabe'].includes(e.grund), JSON.stringify(e)); nichtGepusht(f); assert.deepEqual(g.unterbefehle(), ['list'], 'auch kein create'); }
  // main bewegt sich (Basis ändert sich)
  { const f = vorbereitet(); nachweise(f.repo); const g = ghAttrappe(f.bare); const r = bereit(f.repo, g);
    const anders = neuerName('anders'); git(f.repo, ['clone', '-q', f.bare, anders]); git(anders, ['config', 'user.name', 'A']); git(anders, ['config', 'user.email', 'a@a']); w(anders, 'docs/neu.md', 'x\n'); git(anders, ['add', '-A']); git(anders, ['commit', '-q', '-m', 'main bewegt']); git(anders, ['push', '-q', 'origin', 'main']);
    const e = frei(f.repo, g, r); assert.equal(e.grund, 'freigabe-veraltet', JSON.stringify(e)); assert.ok(e.geaendert.includes('basis')); nichtGepusht(f); }
  // Remote-Branch erscheint nach der Vorprüfung
  { const f = vorbereitet(); nachweise(f.repo); const g = ghAttrappe(f.bare); const r = bereit(f.repo, g);
    git(f.repo, ['push', '-q', 'origin', 'main~0:refs/heads/claude/feature-x']);
    const e = frei(f.repo, g, r); assert.equal(e.grund, 'remote-veraendert', JSON.stringify(e)); }
  // PR taucht nach der Vorprüfung auf
  { const f = vorbereitet(); nachweise(f.repo); const g = ghAttrappe(f.bare); const r = bereit(f.repo, g);
    g.setze((s) => s.prs.push({ number: 3, url: 'https://example.test/Thalrail/Blockwerk/pull/3', isDraft: false, baseRefName: 'main', headBranch: 'claude/feature-x', isCrossRepository: false, state: 'OPEN' }));
    const e = frei(f.repo, g, r); assert.equal(e.grund, 'pr-veraendert', JSON.stringify(e)); assert.ok(!g.unterbefehle().includes('create')); }
  // geändertes Review (neues, schlechteres Review für denselben Stand) macht die Freigabe ungültig
  { const f = vorbereitet(); nachweise(f.repo); const g = ghAttrappe(f.bare); const r = bereit(f.repo, g);
    v.nachweisReview(f.repo, { ...GUT, verdict: 'reject', session_id: 's-neu' });
    const e = frei(f.repo, g, r); assert.equal(e.status, 'abgelehnt'); nichtGepusht(f); }
});

test('Teilfehler und Wiederaufnahme: abgelehnter Push, gescheiterte PR-Erstellung (Push wird nicht wiederholt, PR wird danach erstellt), gescheitertes ready', () => {
  // Push abgelehnt: ein Zweig `claude` im Remote verhindert `claude/feature-x`
  { const f = vorbereitet(); nachweise(f.repo); git(f.bare, ['update-ref', 'refs/heads/claude', git(f.bare, ['rev-parse', 'main']).trim()]);
    const g = ghAttrappe(f.bare); const r = bereit(f.repo, g); const e = frei(f.repo, g, r);
    assert.equal(e.status, 'blockiert', JSON.stringify(e)); assert.equal(e.schritt, 'push'); assert.ok(g.unterbefehle().every((u) => u === 'list'), 'ohne Push keine PR (nur lesende Abfragen)'); assert.match(e.hinweis, /Jonah/); }
  // PR-Erstellung scheitert
  { const f = vorbereitet(); nachweise(f.repo); const g = ghAttrappe(f.bare, { createFail: true }); const r = bereit(f.repo, g);
    const e = frei(f.repo, g, r); assert.equal(e.status, 'blockiert'); assert.equal(e.schritt, 'pr'); assert.deepEqual(e.fortschritt.push, kopf(f.repo)); assert.equal(e.pr, null);
    assert.ok(remoteZweige(f.bare).includes('claude/feature-x'), 'der Push ist erfolgt');
    g.setze((s) => { s.createFail = false; });
    const zweite = frei(f.repo, g, r); assert.equal(zweite.status, 'fertig', JSON.stringify(zweite));
    assert.equal(g.aufrufe().filter((a) => a[1] === 'create').length, 2, 'ein gescheitertes und ein erfolgreiches create'); assert.equal(g.zustand().prs.length, 1); }
  // ready scheitert, dann Wiederaufnahme mit derselben PR
  { const f = vorbereitet(); nachweise(f.repo); const g = ghAttrappe(f.bare, { readyFail: true });
    g.setze((s) => { s.prs.push({ number: 4, url: 'https://example.test/Thalrail/Blockwerk/pull/4', isDraft: true, baseRefName: 'main', headBranch: 'claude/feature-x', isCrossRepository: false, state: 'OPEN', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE', reviewDecision: '' }); s.next = 5; });
    git(f.repo, ['push', '-q', 'origin', 'claude/feature-x']);
    const r = bereit(f.repo, g); const e = frei(f.repo, g, r); assert.equal(e.status, 'blockiert'); assert.equal(e.schritt, 'ready'); assert.equal(e.pr, 'https://example.test/Thalrail/Blockwerk/pull/4');
    g.setze((s) => { s.readyFail = false; }); assert.equal(frei(f.repo, g, r).status, 'fertig'); assert.ok(!g.unterbefehle().includes('create')); }
  // Basis der bestehenden PR ist nicht main; Kopf der PR ist ein anderer Commit
  { const f = vorbereitet(); nachweise(f.repo); const g = ghAttrappe(f.bare);
    g.setze((s) => s.prs.push({ number: 2, url: 'https://example.test/Thalrail/Blockwerk/pull/2', isDraft: false, baseRefName: 'claude/anderer', headBranch: 'claude/feature-x', isCrossRepository: false, state: 'OPEN' }));
    const r = v.vorpruefung(f.repo, { titel: TITEL, einschraenkungen: EINSCHR }, g.umgebung);
    assert.equal(r.status, 'abgelehnt', JSON.stringify(r)); assert.equal(r.grund, 'pr-basis'); assert.equal(r.basis, 'claude/anderer'); assert.ok(!remoteZweige(f.bare).includes('claude/feature-x'), 'nichts gepusht'); }
  { const f = vorbereitet(); nachweise(f.repo); const g = ghAttrappe(f.bare);
    g.setze((s) => s.prs.push({ number: 2, url: 'https://example.test/Thalrail/Blockwerk/pull/2', isDraft: false, baseRefName: 'main', headBranch: 'claude/feature-x', isCrossRepository: false, state: 'OPEN', headFest: 'alt0000' }));
    git(f.repo, ['push', '-q', 'origin', 'claude/feature-x']);
    const r = v.vorpruefung(f.repo, { titel: TITEL, einschraenkungen: EINSCHR }, g.umgebung); assert.equal(r.status, 'bereit');
    const e = frei(f.repo, g, r); assert.equal(e.status, 'blockiert'); assert.equal(e.schritt, 'pr-head'); }
});

test('Checks: rot, fehlender Job test, ausstehend, Pflichtcheck plus test und GitHub-Regeln nennen den konkreten Grund und die PR-Adresse', () => {
  const lauf1 = (zustand, erwartet) => {
    const { repo, bare } = vorbereitet(); nachweise(repo); const g = ghAttrappe(bare, zustand); const r = bereit(repo, g); const e = frei(repo, g, r);
    assert.equal(e.status, erwartet.status, JSON.stringify(e)); if (erwartet.schritt) assert.equal(e.schritt, erwartet.schritt); if (erwartet.grund) assert.match(e.grund ?? '', erwartet.grund);
    if (erwartet.status === 'blockiert') assert.match(e.pr, /^https:\/\/example\.test\/Thalrail\/Blockwerk\/pull\/\d+$/, 'der direkte PR-Link ist dabei'); return { e, g };
  };
  const ROT = { name: 'test', workflow: 'Tests', bucket: 'fail', state: 'FAILURE', link: 'https://example.test/run/rot' };
  const x = lauf1({ checks: [ROT] }, { status: 'blockiert', schritt: 'checks', grund: /Check fehlgeschlagen: Tests\/test \(fail\)/ }); assert.equal(x.e.checks[0].link, 'https://example.test/run/rot');
  lauf1({ checks: [PASS('lint', 'Lint')] }, { status: 'blockiert', schritt: 'checks', grund: /Job „test“ aus test.yml wurde auf GitHub nicht gemeldet/ });
  lauf1({ checks: [{ ...PASS(), bucket: 'pending', state: 'IN_PROGRESS' }] }, { status: 'blockiert', schritt: 'checks', grund: /noch nicht abgeschlossen: Tests\/test/ });
  // Pflichtcheck „Lint“ grün, aber der Job test (nicht als Pflichtcheck geführt) ist rot: trotzdem blockiert
  lauf1({ checks: [PASS('lint', 'Lint'), ROT], required: [PASS('lint', 'Lint')] }, { status: 'blockiert', schritt: 'checks', grund: /Tests\/test/ });
  // Pflichtcheck rot, test grün
  lauf1({ checks: [PASS(), { ...PASS('lint', 'Lint'), bucket: 'fail' }], required: [{ ...PASS('lint', 'Lint'), bucket: 'fail' }] }, { status: 'blockiert', schritt: 'checks', grund: /Lint\/lint \(fail\)/ });
  // alles grün, keine Pflichtchecks konfiguriert: test aus test.yml genügt
  const ok = lauf1({ checks: [PASS()], noRequired: true }, { status: 'fertig' }); assert.equal(ok.e.checks.length, 1);
  // GitHub-Regel blockiert (z. B. Review Pflicht), Konflikte
  lauf1({ mergeStateStatus: 'BLOCKED' }, { status: 'blockiert', schritt: 'github-regel', grund: /BLOCKED/ });
  lauf1({ mergeStateStatus: 'DIRTY' }, { status: 'blockiert', schritt: 'github-regel', grund: /DIRTY/ });
  lauf1({ mergeStateStatus: 'UNSTABLE' }, { status: 'fertig' });
  // GitHub kann die Mergebarkeit nicht bestimmen: keine stille Fertigmeldung
  lauf1({ mergeStateStatus: 'UNKNOWN' }, { status: 'blockiert', schritt: 'github-regel', grund: /UNKNOWN/ });
  // ein übersprungener Pflichtcheck gilt nicht als bestanden
  const SKIP = { ...PASS('lint', 'Lint'), bucket: 'skipping' };
  lauf1({ checks: [PASS(), SKIP], required: [SKIP] }, { status: 'blockiert', schritt: 'checks', grund: /Lint\/lint \(skipping\)/ });
  // ein Fehler beim Abfragen der Checks (Anmeldung, API) ist keine leere Pflichtcheck-Liste
  lauf1({ requiredError: true }, { status: 'blockiert', schritt: 'checks', grund: /nicht abfragbar: HTTP 401/ });
  lauf1({ checksError: true }, { status: 'blockiert', schritt: 'checks', grund: /nicht abfragbar: HTTP 401/ });
  // parsebares JSON bei einem Fehler-Exit (hier `[]` mit Exit 4) ist keine leere Pflichtcheck-Liste
  lauf1({ requiredLeerMitFehler: true }, { status: 'blockiert', schritt: 'checks', grund: /nicht abfragbar/ });
  // Mergebarkeit unbekannt oder nicht bestimmt: keine Fertigmeldung
  lauf1({ mergeable: 'UNKNOWN' }, { status: 'blockiert', schritt: 'github-regel', grund: /mergeable UNKNOWN/ });
  lauf1({ mergeable: null }, { status: 'blockiert', schritt: 'github-regel' });
  lauf1({ mergeStateStatus: null }, { status: 'blockiert', schritt: 'github-regel' });
  lauf1({ mergeable: 'CONFLICTING' }, { status: 'blockiert', schritt: 'github-regel', grund: /CONFLICTING/ });
});

test('Der Freigabe-Hash bindet Titel, Einschränkungen, Origin-URL und das Review mit Befunden und Einstufungen; eine geänderte PR hält vor dem Push an', () => {
  // Titel und Einschränkungen
  { const { repo, bare } = vorbereitet(); nachweise(repo); const g = ghAttrappe(bare);
    const a = bereit(repo, g).freigabeHash;
    const b = v.vorpruefung(repo, { titel: `${TITEL} 2`, einschraenkungen: EINSCHR }, g.umgebung).freigabeHash;
    const c = v.vorpruefung(repo, { titel: TITEL, einschraenkungen: `${EINSCHR} Mehr.` }, g.umgebung).freigabeHash;
    assert.equal(new Set([a, b, c]).size, 3); }
  // Origin-URL: ein anderer, ebenfalls erlaubter Remote ändert den Hash, es wird nichts gepusht
  { const { repo, bare } = vorbereitet(); nachweise(repo); const g = ghAttrappe(bare); const r = bereit(repo, g);
    const bare2 = neuerName('remote2'); git(repo, ['clone', '-q', '--bare', bare, bare2]);
    git(repo, ['remote', 'set-url', 'origin', bare2]);
    const e = v.veroeffentlichen(repo, { branch: 'claude/feature-x', bestaetigt: r.freigabeHash }, { ...g.umgebung, erlaubteRemotes: [bare, bare2] });
    assert.equal(e.grund, 'freigabe-veraltet', JSON.stringify(e)); assert.ok(e.geaendert.includes('ursprung'));
    assert.ok(!remoteZweige(bare2).includes('claude/feature-x') && !remoteZweige(bare).includes('claude/feature-x'), 'nirgends gepusht'); }
  // Einstufung eines Befunds ändert sich nach der Vorprüfung
  { const { repo, bare } = vorbereitet();
    nachweise(repo, { review: { ...GUT, verdict: 'request_changes' }, befunde: [{ id: 'G1', schwere: 'minor', kurz: 'x' }], einstufungen: [{ id: 'G1', einstufung: 'widerlegt', beleg: 'Der Code prüft das in Zeile 12 ausdrücklich.' }] });
    const g = ghAttrappe(bare); const r = bereit(repo, g);
    v.nachweisBefund(repo, { id: 'G1', einstufung: 'hinweis', beleg: 'Nur ein Hinweis, kein Fehler im Code.' });
    const e = frei(repo, g, r); assert.equal(e.grund, 'freigabe-veraltet', JSON.stringify(e)); assert.ok(e.geaendert.includes('review')); assert.ok(!remoteZweige(bare).includes('claude/feature-x')); }
  // die Schwere eines Befunds (neues Review derselben Sitzung für denselben Stand) ändert den Hash
  { const { repo, bare } = vorbereitet();
    nachweise(repo, { review: { ...GUT, verdict: 'request_changes' }, befunde: [{ id: 'G1', schwere: 'minor', kurz: 'x' }], einstufungen: [{ id: 'G1', einstufung: 'widerlegt', beleg: 'Der Code prüft das in Zeile 12 ausdrücklich.' }] });
    const g = ghAttrappe(bare); const r = bereit(repo, g);
    v.nachweisReview(repo, { ...GUT, verdict: 'request_changes' }, [{ id: 'G1', schwere: 'info', kurz: 'x' }]);
    const e = frei(repo, g, r); assert.equal(e.grund, 'freigabe-veraltet', JSON.stringify(e)); assert.ok(e.geaendert.includes('review')); assert.ok(!remoteZweige(bare).includes('claude/feature-x')); }
  // eine schon vorhandene PR ändert sich nach der Vorprüfung (Draft → Ready von Hand): vor dem Push angehalten
  { const { repo, bare } = vorbereitet(); nachweise(repo);
    const g = ghAttrappe(bare, { prs: [{ number: 5, url: 'https://example.test/Thalrail/Blockwerk/pull/5', isDraft: true, baseRefName: 'main', headBranch: 'claude/feature-x', isCrossRepository: false, state: 'OPEN' }], next: 6 });
    const r = bereit(repo, g);
    g.setze((s) => { s.prs[0].isDraft = false; });
    const e = frei(repo, g, r); assert.equal(e.grund, 'pr-veraendert', JSON.stringify(e)); assert.ok(!remoteZweige(bare).includes('claude/feature-x'), 'vor dem Push angehalten'); }
});

test('bewerteChecks: Pflichtchecks plus der Job test; übersprungener Job test zählt nicht als bestanden', () => {
  const { bewerteChecks } = v;
  assert.equal(bewerteChecks([PASS()], []).status, 'ok');
  assert.equal(bewerteChecks([], []).grund, 'test-check-fehlt');
  assert.equal(bewerteChecks([{ ...PASS(), bucket: 'skipping' }], []).status, 'fehler');
  assert.equal(bewerteChecks([PASS(), { ...PASS('x', 'Y'), bucket: 'skipping' }], [{ ...PASS('x', 'Y'), bucket: 'skipping' }]).status, 'fehler', 'auch ein übersprungener Pflichtcheck');
  assert.equal(bewerteChecks([PASS(), { ...PASS('x', 'Y'), bucket: 'cancel' }], [{ ...PASS('x', 'Y'), bucket: 'cancel' }]).status, 'fehler');
  assert.equal(bewerteChecks([PASS(), { ...PASS('x', 'Y'), bucket: 'fail' }], []).status, 'ok', 'ein nicht verlangter, roter Zusatzcheck blockiert nicht');
  assert.equal(bewerteChecks([PASS(), { ...PASS('x', 'Y'), bucket: 'pending' }], [{ ...PASS('x', 'Y'), bucket: 'pending' }]).status, 'wartet');
});

test('Nachweise eines beendeten Laufs für denselben Baum zählen; ein gesperrter Lauf zählt nicht; Tests laufen dann nicht erneut', () => {
  const { repo, bare } = vorbereitet();
  const baum = git(repo, ['rev-parse', 'HEAD^{tree}']).trim();
  const dir = path.join(repo, '.claude', 'orchestrierung', 'laeufe', 'L-test');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'lauf.json'), JSON.stringify({ status: 'beendet', uebernommen: { dateien: ['src/a.js'] } }));
  fs.writeFileSync(path.join(dir, 'tests.jsonl'), `${JSON.stringify({ baum, suite: 'kurz', gruen: 99, fehlgeschlagen: 0, uebersprungen: 0, exit: 0, quelle: 'werkzeug' })}\n`);
  fs.writeFileSync(path.join(dir, 'reviews.jsonl'), `${JSON.stringify({ baum, gueltig: true, gruende: [], verdict: 'approve', session_id: 's-lauf', befunde: [] })}\n`);
  const g = ghAttrappe(bare);
  const r = bereit(repo, g);
  assert.equal(r.tests.quelle, 'lauf L-test'); assert.equal(r.tests.gruen, 99, 'die Tests des Laufs, nicht neu gestartet'); assert.equal(r.review.session_id, 's-lauf');
  assert.ok(!fs.existsSync(path.join(repo, '.claude', 'orchestrierung', 'veroeffentlichung', 'feature-x', 'tests.jsonl')), 'kein eigener Testlauf');
  fs.writeFileSync(path.join(dir, 'gesperrt.json'), '{"grund":"x"}');
  const nach = v.vorpruefung(repo, { titel: TITEL, einschraenkungen: EINSCHR }, g.umgebung);
  assert.equal(nach.status, 'abgelehnt', 'ohne die Nachweise des gesperrten Laufs fehlt das Review'); assert.equal(nach.grund, 'freigabe');
});

test('Kommandozeile: unbekannte Optionen werden abgelehnt, Remote, gh-Programm und Basis lassen sich nicht umbiegen; die Befehle sind bekannt', () => {
  const { repo } = vorbereitet();
  for (const argv of [['veroeffentlichen', '--remote', 'x'], ['veroeffentlichen', '--gh', 'echo'], ['veroeffentlichen', '--basis', 'x', '--branch', 'claude/feature-x'], ['veroeffentlichen', '--force'], ['veroeffentlichen-vorpruefung', '--basis', 'x'], ['veroeffentlichen-paket', '--wurzel', 'x']]) {
    assert.throws(() => fuehreAus(argv, repo), /Unbekannte Option/, argv.join(' '));
  }
  assert.equal(fuehreAus(['veroeffentlichen', '--branch', 'claude/feature-x', '--bestaetigt', '0123456789abcdef'], repo).grund, 'keine-vorpruefung');
  assert.throws(() => fuehreAus(['merge'], repo), /Unbekannter Befehl[\s\S]*veroeffentlichen/);
});

test('Quelltext der Veröffentlichung: nur Push mit ausdrücklichem Refspec auf den eigenen Branch, nur fünf gh-Unterbefehle, nie Merge, Force, api, Löschen oder Shell-Text', () => {
  const code = fs.readFileSync(path.resolve(import.meta.dirname, '../../tools/orchestrierung/veroeffentlichen.js'), 'utf8');
  const ohneKommentare = code.split('\n').filter((z) => !/^\s*\/\//.test(z)).join('\n');
  for (const verboten of [/--force/, /--force-with-lease/, /'-f'/, /--delete/, /--mirror/, /'--all'/, /pr merge/, /'merge'/, /'api'/, /--admin/, /'close'/, /'edit'/, /'tag'/, /exec\(/, /shell:\s*true/, /'rebase'/, /'reset'/, /'clean'/, /'stash'/, /'commit'/, /'branch'\s*,\s*'-D'/]) {
    assert.ok(!verboten.test(ohneKommentare), `nicht erlaubt: ${verboten}`);
  }
  assert.match(code, /const GH_ERLAUBT = Object\.freeze\(\['list', 'create', 'view', 'ready', 'checks'\]\)/);
  const pushs = ohneKommentare.match(/\['push'[^\]]*\]/g) ?? [];
  assert.deepEqual(pushs, ["['push', '-u', 'origin', `refs/heads/${branch}:refs/heads/${branch}`]"], 'genau ein Push, ausdrücklicher Refspec ohne +');
  assert.ok(!/gh\(w, umgebung, \[(?!'pr')/.test(ohneKommentare), 'gh nur mit pr');
  const abschluss = fs.readFileSync(path.resolve(import.meta.dirname, '../../tools/orchestrierung/abschluss.js'), 'utf8');
  assert.ok(!/'ready'/.test(abschluss), 'der Abschluss bleibt bei Draft-PRs ohne ready');
});

test('Einstellungen: der Veröffentlichungsaufruf fragt im normalen Sitzungsmodus nach (ask), die Vorprüfung nicht, kein Allow-Muster trifft den Aufruf, deny bleibt', () => {
  const e = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../.claude/settings.json'), 'utf8'));
  // Claude-Code-Muster: Bash(<Präfix> *) trifft den Befehl, wenn er das Präfix gefolgt von einem Leerzeichen und beliebigem Rest hat (oder genau das Präfix ist)
  const trifft = (muster, befehl) => { const m = /^Bash\((.*)\)$/.exec(muster); if (!m) return false; const p = m[1].endsWith(' *') ? m[1].slice(0, -2) : null; return p === null ? m[1] === befehl : (befehl === p || befehl.startsWith(`${p} `)); };
  const echt = 'node tools/orchestrierung/cli.js veroeffentlichen --branch claude/feature-x --bestaetigt 0123456789abcdef';
  const vor = 'node tools/orchestrierung/cli.js veroeffentlichen-vorpruefung --titel "x" --einschraenkungen "yyyyyyyyyyy"';
  assert.ok(e.permissions.ask.some((m) => trifft(m, echt)), 'der echte Aufruf steht in ask');
  assert.ok(!e.permissions.allow.some((m) => trifft(m, echt)), 'kein Allow-Muster trifft den echten Aufruf');
  assert.ok(!e.permissions.deny.some((m) => trifft(m, echt)), 'er ist auch nicht gesperrt: er soll nachfragen, nicht scheitern');
  assert.ok(!e.permissions.ask.some((m) => trifft(m, vor)) && e.permissions.allow.some((m) => trifft(m, vor)), 'die Vorprüfung fragt nicht nach');
  for (const nein of ['git push origin claude/feature-x', 'gh pr create --draft', 'gh pr ready 1', 'git push --force origin main']) assert.ok(e.permissions.deny.some((m) => trifft(m, nein)) || /force|ready/.test(nein) && e.permissions.deny.some((m) => trifft(m, nein.replace(/ --force/, ''))), `weiter gesperrt: ${nein}`);
  assert.ok(e.permissions.deny.includes('Bash(git push *)') && e.permissions.deny.includes('Bash(gh pr *)'));
});

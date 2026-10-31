// Orchestrierung: Review-Paket (eigenes Repository außerhalb, exakter Diff) und Prüfung des Codex-Einzelmodus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { git } from '../../tools/orchestrierung/git.js';
import { schnappschuss, seed, GeheimnisFehler } from '../../tools/orchestrierung/schnappschuss.js';
import { reviewPaket } from '../../tools/orchestrierung/review-paket.js';
import { pruefeReviewErgebnis } from '../../tools/orchestrierung/review-pruefung.js';
import { neuesRepo, neuerName, w } from './hilfe.js';

function arbeit() {
  const repo = neuesRepo();
  const s0 = schnappschuss(repo, { id: 'a' });
  const wt = seed(repo, s0.commit, neuerName('wt'));
  w(wt, 'src/neu/dir/y.js', "import { b } from '../../b.js';\nexport default b + 1;\n");
  w(wt, 'docs/agent.md', 'vom agenten\n');
  w(wt, 'data/data.bin', Buffer.from([0, 1, 2, 3, 255]));
  fs.rmSync(path.join(wt, 'docs/keep.md'));
  const s1 = schnappschuss(wt, { id: 'agent', eltern: s0.commit });
  return { repo, wt, s0, s1 };
}

test('Review-Paket: eigenes Repository außerhalb, Blobs und Diff identisch zur Quelle, Kontext aus Importen', () => {
  const { repo, s0, s1 } = arbeit();
  const iso = neuerName('codex-review');
  const p = reviewPaket(repo, s0.commit, s1.commit, iso, { id: 'e1', kontext: ['docs/stand.md'], hinweise: 'Prüfe die Änderung.' });
  assert.deepEqual(p.abweichungen, [], 'alle Blob-Hashes wie in der Quelle');
  assert.equal(p.diffIdentisch, true, 'git diff vorher..nachher im Paket = git diff S0..S1 der Quelle');
  assert.ok(p.dir.startsWith(iso) && !p.dir.startsWith(repo));
  assert.ok(p.kontext.includes('src/b.js'), 'Import von y.js (unverändert) ist Kontext');
  assert.ok(p.kontext.includes('docs/stand.md'));
  assert.equal(git(p.dir, ['rev-list', '--count', 'HEAD']).trim(), '2');
  assert.ok(fs.existsSync(path.join(p.dir, 'src/b.js')) && !fs.existsSync(path.join(p.dir, '.env')), 'nur Paketinhalt');
  const normal = git(p.dir, ['diff', p.base, p.head]);
  assert.ok(normal.includes('+vom agenten') && normal.includes('-bleibt') && normal.includes('Binary files'));
  assert.ok(p.tokenSchaetzung > 0 && p.zuGross === false);
  assert.deepEqual(p.aufruf, { tool: 'review_code', cwd: p.dir, base: p.base, head: p.head, tier: 'balanced', auto_diff: false });
  assert.match(fs.readFileSync(path.join(p.dir, 'REVIEW-HINWEISE.md'), 'utf8'), /Prüfe die Änderung[\s\S]*M src\/neu\/dir\/y\.js/);
  // wiederholbar nur mit neuer Kennung, nie in das Quell-Repository
  assert.throws(() => reviewPaket(repo, s0.commit, s1.commit, iso, { id: 'e1' }), /gibt es schon/);
  assert.throws(() => reviewPaket(repo, s0.commit, s1.commit, path.join(repo, 'review'), { id: 'x' }), /außerhalb des Quell-Repositories/);
  assert.throws(() => reviewPaket(repo, s0.commit, s0.commit, iso, { id: 'leer' }), /nichts zu prüfen/);
});

test('Review-Paket: ein Geheimnis im Diff bricht ab und hinterlässt kein Paket', () => {
  const repo = neuesRepo();
  const s0 = schnappschuss(repo, { id: 'a' });
  const wt = seed(repo, s0.commit, neuerName('wt'));
  w(wt, 'src/neu/leck.js', `const x = 1; // ${'ghp_' + 'B'.repeat(36)}\n`);
  assert.throws(() => schnappschuss(wt, { id: 'l', eltern: s0.commit }), GeheimnisFehler, 'schon der Snapshot verweigert es');
});

const GUT = () => ({ review_mode: 'single', failover_occurred: false, provider: 'codex', verdict: 'approve', session_id: 'abc', models: [{ provider: 'codex', role: 'review', resolved: 'gpt-5.6-sol' }] });

test('Codex-Einzelmodus: nur ein Einzel-Review ohne Failover und ohne zweiten Anbieter gilt', () => {
  assert.deepEqual(pruefeReviewErgebnis(GUT()), { gueltig: true, gruende: [] });
  const ungueltig = {
    'Failover aufgetreten': { ...GUT(), failover_occurred: true, failover: { failed_provider: 'codex' }, provider: 'gemini', models: [{ provider: 'gemini' }] },
    'Failover-Flag fehlt': (() => { const x = GUT(); delete x.failover_occurred; return x; })(),
    'Modus deliberate': { ...GUT(), review_mode: 'deliberate' },
    'Modus failover (konfiguriert)': { ...GUT(), review_mode: 'failover' },
    'Beratung vorhanden': { ...GUT(), deliberation: { agreed: [] } },
    'anderer Anbieter': { ...GUT(), provider: 'gemini', models: [{ provider: 'gemini' }] },
    'zwei Modelle': { ...GUT(), models: [{ provider: 'codex' }, { provider: 'gemini' }] },
    'unbekanntes Urteil': { ...GUT(), verdict: 'vielleicht' },
    'ohne session_id': { ...GUT(), session_id: '' },
    'kein Objekt': null,
  };
  for (const [n, e] of Object.entries(ungueltig)) { const x = pruefeReviewErgebnis(e); assert.equal(x.gueltig, false, n); assert.ok(x.gruende.length >= 1, n); }
  for (const v of ['approve', 'request_changes', 'reject']) assert.equal(pruefeReviewErgebnis({ ...GUT(), verdict: v }).gueltig, true, v);
});

// Orchestrierung: sichere Übernahme (Konflikte, Löschungen, unversionierte und Binärdateien, Fehler und Absturz mit Wiederherstellung).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zustand } from '../../tools/orchestrierung/git.js';
import { schnappschuss, seed } from '../../tools/orchestrierung/schnappschuss.js';
import { planen, anwenden, wiederherstellen, offeneJournale, KonfliktFehler } from '../../tools/orchestrierung/uebernehmen.js';
import { neuesRepo, neuerName, WURZEL, w, r, text } from './hilfe.js';

const MODUL = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../tools/orchestrierung/uebernehmen.js')).href;
const AUSSER = ['.claude/worktrees'];

/** Arbeit des Agenten im Worktree: ändern, anlegen (auch in neuem Ordner), Binärdatei, löschen. */
function agentenArbeit(wt) {
  w(wt, 'src/a.js', 'eins\nZWEI\ndrei\nVIER\nfünf\n');
  w(wt, 'src/neu/dir/y.js', "import { b } from '../../b.js';\nexport default b + 1;\n");
  w(wt, 'docs/agent.md', 'vom agenten\n');
  w(wt, 'data/data.bin', Buffer.from([0, 1, 2, 3, 255, 254, 0, 10, 13, 10, 7]));
  w(wt, 'src/neu/ordner2/z.bin', Buffer.from([1, 0, 1]));
  fs.rmSync(path.join(wt, 'docs/keep.md'));
}
function lauf(hauptAenderung = () => {}) {
  const repo = neuesRepo();
  const s0 = schnappschuss(repo, { id: 'a' });
  const wt = seed(repo, s0.commit, path.join(repo, '.claude', 'worktrees', 'agent-1'));
  agentenArbeit(wt);
  const s1 = schnappschuss(wt, { id: 'agent', eltern: s0.commit });
  hauptAenderung(repo);
  return { repo, wt, s0, s1, sicherung: neuerName('sicherung') };
}
const zust = (repo) => zustand(repo, { ausser: AUSSER });

test('Übernahme, Hauptbaum unverändert: Ergebnis = Snapshot des Agenten; HEAD, Index und Stash unberührt', () => {
  const { repo, s0, s1, sicherung } = lauf();
  const vorher = zust(repo);
  const akt = planen(repo, s0.commit, s1.commit);
  assert.deepEqual(zust(repo), vorher, 'Planen verändert nichts');
  anwenden(repo, akt, sicherung);
  assert.equal(schnappschuss(repo, { id: 'danach', eltern: s0.commit }).tree, s1.tree, 'Hauptbaum entspricht dem Agenten-Stand');
  const nachher = zust(repo);
  for (const k of ['head', 'zweig', 'stash', 'refs', 'index']) assert.equal(nachher[k], vorher[k], k);
  assert.ok(vorher.stash.length > 0, 'der Stash-Eintrag existiert und bleibt');
});

test('Übernahme in einen weiter geänderten Hauptbaum: fremde Änderungen bleiben, Texte werden zusammengeführt', () => {
  const { repo, s0, s1, sicherung } = lauf((h) => { w(h, 'docs/crlf.md', 'lokal\r\n'); w(h, 'src/a.js', 'EINS\nZWEI\ndrei\nvier\nfünf\n'); w(h, 'src/lokal-neu.js', 'meins\n'); });
  anwenden(repo, planen(repo, s0.commit, s1.commit), sicherung);
  assert.equal(text(repo, 'src/a.js'), 'EINS\nZWEI\ndrei\nVIER\nfünf\n', 'beide Änderungen');
  assert.equal(text(repo, 'docs/crlf.md'), 'lokal\r\n');
  assert.equal(text(repo, 'src/lokal-neu.js'), 'meins\n');
  assert.equal(text(repo, 'docs/agent.md'), 'vom agenten\n');
  assert.ok(!fs.existsSync(path.join(repo, 'docs/keep.md')), 'Löschung des Agenten übernommen');
  assert.deepEqual([...r(repo, 'data/data.bin')], [0, 1, 2, 3, 255, 254, 0, 10, 13, 10, 7], 'Binärdatei bytegenau');
  assert.ok(fs.existsSync(path.join(repo, 'src/neu/ordner2/z.bin')), 'Datei in neuem Ordner');
});

test('Konflikte lehnen ab, ohne etwas zu verändern', () => {
  const faelle = {
    'gleiche Zeile': (h) => w(h, 'src/a.js', 'eins\nZWEI\ndrei\nANDERS\nfünf\n'),
    'Löschung gegen lokale Änderung': (h) => w(h, 'docs/keep.md', 'lokal geändert\n'),
    'binär beidseitig': (h) => w(h, 'data/data.bin', Buffer.from([5, 5, 5, 0])),
    'Neuanlage gegen lokale Datei': (h) => w(h, 'docs/agent.md', 'lokal anders\n'),
    'lokal gelöscht, Delta ändert': (h) => fs.rmSync(path.join(h, 'src/neu/dir/y.js')),
  };
  for (const [name, aend] of Object.entries(faelle)) {
    const { repo, s0, s1 } = lauf(aend);
    const vorher = zust(repo);
    assert.throws(() => planen(repo, s0.commit, s1.commit), KonfliktFehler, name);
    assert.deepEqual(zust(repo), vorher, `${name}: nichts verändert`);
  }
  const { repo, s0, s1, sicherung } = lauf((h) => w(h, 'docs/agent.md', 'vom agenten\n'));
  anwenden(repo, planen(repo, s0.commit, s1.commit), sicherung);
  assert.equal(text(repo, 'docs/agent.md'), 'vom agenten\n', 'gleiche Neuanlage ist kein Konflikt');
});

test('Zeilenenden: ein Delta, das LF in eine CRLF-Datei bringt, wird abgelehnt', () => {
  const repo = neuesRepo();
  const s0 = schnappschuss(repo, { id: 'a' });
  const wt = seed(repo, s0.commit, neuerName('wt'));
  w(wt, 'docs/crlf.md', 'x\ny\nz\n');
  const s1 = schnappschuss(wt, { id: 'eol', eltern: s0.commit });
  assert.throws(() => planen(repo, s0.commit, s1.commit), /Zeilenenden crlf → lf/);
});

test('Fehler während der Übernahme: nach jedem Schritt k vollständig zurückgesetzt, danach geht es normal', () => {
  const { repo, s0, s1 } = lauf();
  const akt = planen(repo, s0.commit, s1.commit);
  assert.ok(akt.length >= 5);
  const vorher = zust(repo);
  for (let k = 0; k < akt.length; k++) {
    const sich = neuerName('fehler');
    assert.throws(() => anwenden(repo, akt, sich, { vorSchritt: (i) => { if (i === k) throw new Error('Einspeisung'); } }), /Einspeisung/);
    assert.deepEqual(zust(repo), vorher, `Fehler vor Schritt ${k}: Zustand identisch`);
    assert.ok(!Object.keys(zust(repo).dateien).some((p) => /\.bw-(tmp|rest)$/.test(p)), 'keine Reste');
    assert.ok(!fs.existsSync(path.join(repo, 'src/neu/ordner2')), 'neu angelegte Ordner entfernt');
    assert.equal(JSON.parse(fs.readFileSync(path.join(sich, 'journal.json'), 'utf8')).phase, 'zurueckgesetzt');
  }
  anwenden(repo, akt, neuerName('ok'));
  assert.equal(schnappschuss(repo, { id: 'ok', eltern: s0.commit }).tree, s1.tree);
});

test('Echter Betriebssystemfehler mitten in der Übernahme (Ordnername von einer Datei belegt)', () => {
  const repo = neuesRepo();
  const s0 = schnappschuss(repo, { id: 'a' });
  const wt = seed(repo, s0.commit, neuerName('wt'));
  w(wt, 'docs/crlf.md', 'x\r\ny\r\nz\r\n'); w(wt, 'src/neu/blocker/z.js', 'x\n'); w(wt, 'src/zzz.js', 'letzte\n');
  const s1 = schnappschuss(wt, { id: 'os', eltern: s0.commit });
  w(repo, 'src/neu/blocker', 'ich bin eine Datei\n');
  const vorher = zust(repo);
  const akt = planen(repo, s0.commit, s1.commit);
  assert.throws(() => anwenden(repo, akt, neuerName('os')));
  assert.deepEqual(zust(repo), vorher, 'die vorher geänderte Datei ist wieder zurückgesetzt');
});

test('Hauptbaum ändert sich zwischen Planen und Anwenden: nichts wird angefasst', () => {
  const { repo, s0, s1 } = lauf();
  const akt = planen(repo, s0.commit, s1.commit);
  w(repo, 'src/a.js', 'jemand anderes war schneller\n');
  const vorher = zust(repo);
  assert.throws(() => anwenden(repo, akt, neuerName('race')), /seit dem Planen verändert/);
  assert.deepEqual(zust(repo), vorher);
});

test('Absturz mitten im Anwenden: Wiederherstellen setzt zurück (wiederholbar), offene Journale werden gefunden', () => {
  const { repo, s0, s1 } = lauf();
  const vorher = zust(repo);
  const sichWurzel = neuerName('sichwurzel');
  const sich = path.join(sichWurzel, 'lauf1');
  const skript = path.join(WURZEL, `crash-${path.basename(sichWurzel)}.mjs`);
  fs.writeFileSync(skript, `import { planen, anwenden } from ${JSON.stringify(MODUL)};\nconst akt = planen(${JSON.stringify(repo)}, ${JSON.stringify(s0.commit)}, ${JSON.stringify(s1.commit)});\nanwenden(${JSON.stringify(repo)}, akt, ${JSON.stringify(sich)}, { vorSchritt: (k) => { if (k === 3) process.exit(137); } });\n`);
  const res = spawnSync(process.execPath, [skript], { encoding: 'utf8' });
  assert.equal(res.status, 137, res.stderr);
  assert.notEqual(zust(repo).baum, vorher.baum, 'der Absturz hat einen halben Zustand hinterlassen');
  assert.deepEqual(offeneJournale(sichWurzel), [sich]);
  assert.equal(wiederherstellen(sich), 'zurueckgesetzt');
  assert.deepEqual(zust(repo), vorher, 'exakt der Zustand von vorher');
  assert.equal(wiederherstellen(sich), 'zurueckgesetzt', 'wiederholbar');
  assert.deepEqual(offeneJournale(sichWurzel), []);
});

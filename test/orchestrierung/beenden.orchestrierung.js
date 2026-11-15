// Orchestrierung: `ende` bei gesperrten Worktree-Verzeichnissen (Windows: EPERM/EBUSY, Arbeitsordner einer Shell oder ein noch laufender Agent im Verzeichnis).
// Statt eines rohen Fehlers mitten im Aufräumen gibt es ein klares Teilergebnis; der Lauf bleibt aktiv, ein zweiter Aufruf setzt fort, nichts wird gewaltsam gelöscht.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { git } from '../../tools/orchestrierung/git.js';
import * as lauf from '../../tools/orchestrierung/lauf.js';
import { neuesRepo, w } from './hilfe.js';

const sperre = (code) => () => { throw Object.assign(new Error(`${code}: simuliert`), { code }); };
/** Lauf mit zwei Worktrees (beide mit Arbeit, damit `ende` ohne --verwerfen verweigert und mit --verwerfen läuft). */
function laufMitWorktrees() {
  const repo = neuesRepo();
  lauf.starten(repo, { auftrag: 'Beenden', dateien: ['src/**'] });
  const a = lauf.worktreeAnlegen(repo, 'agent-a');
  const b = lauf.worktreeAnlegen(repo, 'agent-b');
  return { repo, a, b };
}
const aktiv = (repo) => fs.existsSync(path.join(repo, '.claude', 'orchestrierung', 'aktiv.json'));

test('Gesperrtes Verzeichnis (simuliertes EPERM): Teilergebnis mit Pfad und Grund, der andere Worktree ist weg, der Lauf bleibt aktiv; nach dem Lösen genügt ein zweiter Aufruf', () => {
  const { repo, a, b } = laufMitWorktrees();
  git(repo, ['worktree', 'lock', a]); // git worktree remove --force scheitert dann, der Rückgriff auf das Löschen des Verzeichnisses greift
  const r1 = lauf.beenden(repo, { verwerfen: true, entferne: sperre('EPERM') });
  assert.equal(r1.status, 'teilweise');
  assert.equal(r1.verbleibend.length, 1);
  assert.equal(r1.verbleibend[0].pfad, a.replace(/\\/g, '/'));
  assert.match(r1.verbleibend[0].grund, /EPERM.*hält das Verzeichnis/);
  assert.deepEqual(r1.entfernteWorktrees, [b.replace(/\\/g, '/')]);
  assert.match(r1.hinweis, /erneut/);
  assert.ok(fs.existsSync(a) && !fs.existsSync(b));
  assert.ok(aktiv(repo), 'der Lauf ist nicht als beendet markiert');
  assert.equal(lauf.status(repo).aktiv, true);
  // Sperre gelöst: der zweite Aufruf setzt fort (der schon entfernte Worktree wird übersprungen)
  git(repo, ['worktree', 'unlock', a]);
  const r2 = lauf.beenden(repo, { verwerfen: true });
  assert.equal(r2.uebernommen, false);
  assert.deepEqual(r2.entfernteWorktrees, [a.replace(/\\/g, '/')]);
  assert.ok(!fs.existsSync(a) && !aktiv(repo));
});

test('Der Arbeitsordner dieses Prozesses im Worktree wird erkannt (klare Meldung, nichts gelöscht); nach dem Wechsel zurück läuft es durch', () => {
  const { repo, a } = laufMitWorktrees();
  const hier = process.cwd();
  let r;
  process.chdir(a);
  try { r = lauf.beenden(repo, { verwerfen: true }); } finally { process.chdir(hier); }
  assert.equal(r.status, 'teilweise');
  assert.match(r.verbleibend[0].grund, /Arbeitsordner dieses Prozesses/);
  assert.ok(fs.existsSync(a), 'nichts wurde gelöscht');
  assert.ok(aktiv(repo));
  assert.equal(lauf.beenden(repo, { verwerfen: true }).uebernommen, false);
  assert.ok(!fs.existsSync(a) && !aktiv(repo));
});

test('Negativ: andere Fehler als Sperren bleiben Fehler (kein stilles Verschlucken); ohne --verwerfen und ohne Übernahme bleibt das Beenden verweigert', () => {
  const { repo, a } = laufMitWorktrees();
  git(repo, ['worktree', 'lock', a]);
  assert.throws(() => lauf.beenden(repo, { verwerfen: true, entferne: sperre('EIO') }), /EIO/);
  assert.ok(aktiv(repo));
  git(repo, ['worktree', 'unlock', a]);
  // Arbeit vorhanden, nicht übernommen: weiter verweigert (unverändert)
  w(a, 'src/neu.js', 'x\n');
  lauf.rundeEnde(repo, { worktree: a });
  assert.throws(() => lauf.beenden(repo), /nicht übernommene Arbeit/);
  assert.ok(aktiv(repo));
});

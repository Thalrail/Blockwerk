// Ausnahme für `.claude/scheduled_tasks.lock` (Jonah, 12.11.2026): Claude Code legt diese Sperrdatei kurzlebig an und löscht sie wieder.
// Nur dieser exakte Pfad ist vom Dateivergleich des Hauptbaums ausgenommen; alles andere unter `.claude/` bleibt überwacht.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as lauf from '../../tools/orchestrierung/lauf.js';
import { neuesRepo, w } from './hilfe.js';

const SPERRE = '.claude/scheduled_tasks.lock';
const start = (repo) => lauf.starten(repo, { auftrag: 'Sperrdatei', dateien: ['src/**'], kontext: [] });

test('Lock-Datei: Anlegen, Ändern und Löschen sperrt weder Hauptkontrolle noch Lauf', () => {
  const repo = neuesRepo();
  start(repo);
  assert.equal(lauf.hauptKontrolle(repo).unveraendert, true);
  w(repo, SPERRE, '{"pid":1}\n'); // entsteht nach dem Start
  assert.equal(lauf.hauptKontrolle(repo).unveraendert, true);
  w(repo, SPERRE, '{"pid":2}\n'); // ändert sich
  assert.equal(lauf.hauptKontrolle(repo).unveraendert, true);
  assert.ok(!lauf.fremdeAenderungen(repo).includes(SPERRE), 'zählt nicht als fremde Änderung');
  fs.rmSync(path.join(repo, SPERRE)); // verschwindet
  assert.equal(lauf.hauptKontrolle(repo).unveraendert, true);
  assert.equal(lauf.integritaetPruefen(repo, lauf.lies(repo)).length, 0);
});

test('Lock-Datei, die schon beim Start liegt und später verschwindet (der Fall aus dem echten Lauf)', () => {
  const repo = neuesRepo();
  w(repo, SPERRE, '{"pid":1}\n');
  start(repo);
  fs.rmSync(path.join(repo, SPERRE));
  assert.equal(lauf.hauptKontrolle(repo).unveraendert, true);
});

test('Nur der exakte Pfad ist ausgenommen: scheduled_tasks.json, settings.json und ähnliche Namen werden weiter erkannt', () => {
  const repo = neuesRepo();
  const grundlage = { '.claude/settings.json': '{"a":1}\n', '.claude/scheduled_tasks.json': '{"tasks":[]}\n' };
  for (const [p, inhalt] of Object.entries(grundlage)) w(repo, p, inhalt);
  start(repo);
  for (const [pfad, inhalt] of [
    ['.claude/settings.json', '{"a":2}\n'], // geändert
    ['.claude/scheduled_tasks.json', '{"tasks":[{"prompt":"x"}]}\n'], // geändert
    ['.claude/scheduled_tasks.lock.bak', 'x\n'], // ähnlicher Name
    ['.claude/unter/scheduled_tasks.lock', 'x\n'], // gleicher Name, anderer Ort
    ['scheduled_tasks.lock', 'x\n'], // gleicher Name im Hauptverzeichnis
    ['.claude/hooks/neu.js', 'x\n'], // fremde Datei unter .claude
  ]) {
    w(repo, pfad, inhalt);
    const k = lauf.hauptKontrolle(repo);
    assert.equal(k.unveraendert, false, `${pfad} muss erkannt werden`);
    assert.ok(k.unerwarteteDateien.includes(pfad), `${pfad} fehlt in ${JSON.stringify(k.unerwarteteDateien)}`);
    if (pfad in grundlage) w(repo, pfad, grundlage[pfad]); else fs.rmSync(path.join(repo, pfad));
  }
  assert.equal(lauf.hauptKontrolle(repo).unveraendert, true, 'nach dem Zurücksetzen wieder unverändert');
  // gelöschte überwachte Datei wird ebenfalls erkannt
  fs.rmSync(path.join(repo, '.claude/scheduled_tasks.json'));
  assert.ok(lauf.hauptKontrolle(repo).unerwarteteDateien.includes('.claude/scheduled_tasks.json'));
});

test('Die Ausnahme steht als genau ein Pfad ohne Muster in AUSSER', () => {
  assert.ok(lauf.AUSSER.includes(SPERRE));
  assert.deepEqual(lauf.AUSSER.filter((p) => p !== '.claude/worktrees' && p !== '.claude/orchestrierung'), [SPERRE]);
  assert.ok(lauf.AUSSER.every((p) => !/[*?[\]{}]/.test(p)), 'keine Muster');
});

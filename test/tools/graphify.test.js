import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { programm, status } from '../../tools/graphify.js';

test('Graphify: Programm wird über GRAPHIFY_EXE gefunden, ein falscher Pfad zählt nicht', () => {
  assert.equal(programm({ GRAPHIFY_EXE: process.execPath }), process.execPath);
  const fehlt = programm({ GRAPHIFY_EXE: path.join('gibt', 'es', 'nicht') });
  assert.ok(fehlt === null || /graphify/.test(fehlt), 'nur der Standardort .werkzeuge darf einspringen');
});

test('Graphify: fehlt das Programm, sagt der Befehl es und verweist auf die Karte (Code 3)', (t) => {
  if (programm({})) return t.skip('Graphify ist hier eingerichtet');
  const r = spawnSync(process.execPath, ['tools/graphify.js', 'status'], { encoding: 'utf8', env: { PATH: process.env.PATH, Path: process.env.Path } });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /tools\/karte\.js/);
  assert.equal(status({}).verfuegbar, false);
});

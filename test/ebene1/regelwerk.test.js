import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ebene1 } from '../hilfe.js';
import { Regelwerk } from '../../src/ebene1/regelwerk.js';
import { ladeRegeldateien } from '../../src/ebene1/daten-node.js';

const e1 = ebene1();
const gueltig = () => ({ id: 'takt.beispiel', titel: 'Beispiel', regel: 'Text', parameter: {}, quelle: 'https://minecraft.wiki/w/Tick', status: 'entworfen', ungeprueft: false });
const datei = (...regeln) => ({ bereich: 'takt', regeln });

test('Jede Regel hat Quelle (Link), gültigen Status und Pflichtfelder', () => {
  const alle = e1.regelwerk.alle();
  assert.ok(alle.length >= 25);
  for (const r of alle) {
    assert.match(r.quelle, /https:\/\//, r.id);
    assert.ok(['entworfen', 'simuliert', 'geprüft'].includes(r.status), r.id);
    assert.equal(typeof r.ungeprueft, 'boolean', r.id);
    if (r.ungeprueft) assert.ok(r.testanleitung.length > 20, `${r.id}: Testanleitung`);
  }
});

test('Status „simuliert“ verweist auf einen Test, der wirklich existiert', () => {
  for (const r of e1.regelwerk.nachStatus('simuliert')) {
    const [datei, name] = r.simulationstest.split('::');
    const text = readFileSync(new URL(`../../${datei}`, import.meta.url), 'utf8');
    assert.ok(text.includes(`test('${name}'`), `${r.id}: Test "${name}" fehlt in ${datei}`);
  }
});

test('Niemand setzt Regeln auf „geprüft“ außer Jonah: nur Regeln mit seiner dokumentierten Beobachtung', () => {
  // Wird erst geändert, wenn Jonah im Spiel bestätigt hat (Datum + Beobachtung sind dann Pflicht).
  const geprueft = e1.regelwerk.nachStatus('geprüft');
  assert.deepEqual(geprueft.map((r) => r.id), ['schiene.t-stelle', 'schiene.zustandswerte']);
  for (const r of geprueft) {
    assert.match(r.beobachtung, /^Jonah/, r.id);
    assert.match(r.geprueftAm, /^2026-10-2[01]$/, r.id);
  }
});

test('Parameter lesen, offene Tests auflisten', () => {
  assert.equal(e1.regelwerk.parameter('takt.geplante-ticks-grenze', 'maxProChunkUndTick'), 100);
  assert.equal(e1.regelwerk.parameter('takt.zufallsticks', 'randomTickSpeed'), 1);
  assert.equal(e1.regelwerk.parameter('takt.spieltick', 'ticksProTag'), 24000);
  assert.throws(() => e1.regelwerk.parameter('takt.spieltick', 'gibtesnicht'), /keinen Parameter/);
  assert.throws(() => e1.regelwerk.regel('takt.gibtesnicht'), /Unbekannte Regel/);
  const offen = e1.regelwerk.offeneTests();
  assert.ok(offen.length >= 8);
  assert.ok(offen.every((o) => o.testanleitung));
});

test('Regelwerk lehnt unvollständige Regeln ab', () => {
  const ok = gueltig();
  assert.doesNotThrow(() => new Regelwerk([datei(ok)]));
  assert.throws(() => new Regelwerk([datei({ ...ok, quelle: 'Wiki' })]), /Link/);
  assert.throws(() => new Regelwerk([datei({ ...ok, quelle: '' })]), /quelle/);
  assert.throws(() => new Regelwerk([datei({ ...ok, status: 'fertig' })]), /Status/);
  assert.throws(() => new Regelwerk([datei({ ...ok, ungeprueft: true })]), /Testanleitung/);
  assert.throws(() => new Regelwerk([datei({ ...ok, status: 'simuliert' })]), /simulationstest/);
  assert.throws(() => new Regelwerk([datei({ ...ok, status: 'geprüft' })]), /geprueftAm/);
  assert.throws(() => new Regelwerk([datei({ ...ok, status: 'geprüft', geprueftAm: '2026-10-20' })]), /Beobachtung/);
  assert.throws(() => new Regelwerk([datei(ok, ok)]), /doppelt/);
  assert.throws(() => new Regelwerk([{ bereich: 'wasser', regeln: [ok] }]), /gehört nicht/);
  assert.throws(() => new Regelwerk([datei({ ...ok, id: 'ohnepunkt' })]), /Form bereich.name/);
  assert.throws(() => new Regelwerk([datei({ ...ok, parameter: null })]), /parameter/);
  const geprueft = { ...ok, status: 'geprüft', geprueftAm: '2026-10-20', beobachtung: 'Jonah hat es im Spiel bestätigt' };
  assert.doesNotThrow(() => new Regelwerk([datei(geprueft)]));
  assert.throws(() => new Regelwerk([datei({ ...geprueft, ungeprueft: true, testanleitung: 'x'.repeat(30) })]), /nicht zugleich/);
});

test('Regeldateien: jede Datei hat Bereich und Datenstand, alle IDs eindeutig', () => {
  const dateien = ladeRegeldateien();
  assert.ok(dateien.length >= 2);
  const ids = dateien.flatMap((d) => d.regeln.map((r) => r.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const d of dateien) assert.match(d.datenstand, /^1\.26\.50/);
});

test('Taktgeber-Regeln stimmen mit den Konstanten im Code überein', async () => {
  const { TICKS_PRO_SEKUNDE, TICKS_PRO_TAG } = await import('../../src/ebene1/weltzeit.js');
  const { MAX_GEPLANTE_TICKS_PRO_CHUNK } = await import('../../src/ebene1/geplante-ticks.js');
  assert.equal(e1.regelwerk.parameter('takt.spieltick', 'ticksProSekunde'), TICKS_PRO_SEKUNDE);
  assert.equal(e1.regelwerk.parameter('takt.spieltick', 'ticksProTag'), TICKS_PRO_TAG);
  assert.equal(e1.regelwerk.parameter('takt.geplante-ticks-grenze', 'maxProChunkUndTick'), MAX_GEPLANTE_TICKS_PRO_CHUNK);
});

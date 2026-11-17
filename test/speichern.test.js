// Prüft web/speichern.js: Dialog in der Windows-Anwendung, Download im Browser (mit Fakes, ohne Fenster).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sichereDatei, dateiname, meldung } from '../web/speichern.js';

const browser = () => {
  const protokoll = [];
  const doc = { createElement: () => { const a = { click: () => protokoll.push(['klick', a.href, a.download]) }; return a; } };
  const urlApi = { createObjectURL: () => 'blob:x', revokeObjectURL: (u) => protokoll.push(['frei', u]) };
  return { doc, urlApi, protokoll };
};

test('Dateiname: Projektname bereinigt, Standard blockwerk', () => {
  assert.equal(dateiname('Zitadelle (klein)'), 'Zitadelle-klein-.blockwerk.json');
  assert.equal(dateiname(''), 'blockwerk.blockwerk.json');
  assert.equal(dateiname(undefined), 'blockwerk.blockwerk.json');
  assert.equal(dateiname('a/../b\\c'), 'a-b-c.blockwerk.json');
});

test('Browser (kein Tauri): Download wie bisher, keine Meldung', async () => {
  const { doc, urlApi, protokoll } = browser();
  const erg = await sichereDatei({ text: '{}', projektName: 'Haus', tauri: undefined, doc, urlApi });
  assert.deepEqual(erg, { status: 'download' });
  assert.deepEqual(protokoll[0], ['klick', 'blob:x', 'Haus.blockwerk.json']);
  assert.equal(meldung(erg), null);
});

test('Tauri: ruft speichere_datei mit Vorschlag und Text, meldet den Pfad', async () => {
  const aufrufe = [];
  const tauri = { core: { invoke: async (befehl, args) => { aufrufe.push([befehl, args]); return 'C:\\Projekte\\Haus.blockwerk.json'; } } };
  const { doc, urlApi, protokoll } = browser();
  const erg = await sichereDatei({ text: '{"a":1}', projektName: 'Haus', tauri, doc, urlApi });
  assert.deepEqual(aufrufe, [['speichere_datei', { vorschlag: 'Haus.blockwerk.json', text: '{"a":1}' }]]);
  assert.deepEqual(erg, { status: 'gespeichert', pfad: 'C:\\Projekte\\Haus.blockwerk.json' });
  assert.equal(meldung(erg), 'Gespeichert: C:\\Projekte\\Haus.blockwerk.json');
  assert.equal(protokoll.length, 0, 'kein Download zusätzlich');
});

test('Tauri: Abbruch im Dialog schreibt nichts und meldet es', async () => {
  const tauri = { core: { invoke: async () => null } };
  const { doc, urlApi, protokoll } = browser();
  const erg = await sichereDatei({ text: '{}', projektName: 'Haus', tauri, doc, urlApi });
  assert.deepEqual(erg, { status: 'abgebrochen' });
  assert.match(meldung(erg), /abgebrochen/);
  assert.equal(protokoll.length, 0);
});

test('Tauri: Fehler wird gemeldet und fällt nicht still auf Download zurück', async () => {
  const tauri = { core: { invoke: async () => { throw 'Zugriff verweigert'; } } };
  const { doc, urlApi, protokoll } = browser();
  const erg = await sichereDatei({ text: '{}', projektName: 'Haus', tauri, doc, urlApi });
  assert.deepEqual(erg, { status: 'fehler', meldung: 'Zugriff verweigert' });
  assert.match(meldung(erg), /fehlgeschlagen: Zugriff verweigert/);
  assert.equal(protokoll.length, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { datei, suche, abhaengig, uebersicht, dateien, sicherFunktion } from '../../tools/karte.js';

test('Karte: Datei nennt Importe und Exporte mit Zeilennummer', () => {
  const t = datei('src/ebene3/materialisiere.js');
  assert.match(t, /^src\/ebene3\/materialisiere\.js: \d+ Zeilen/);
  assert.match(t, /\n {2}\d+: import /);
  assert.match(t, /\n {2}\d+: export /);
});

test('Karte: Suche begrenzt die Treffer und sagt, wie viele fehlen', () => {
  const t = suche('import', 5);
  assert.equal(t.split('\n').length, 6);
  assert.match(t, /und \d+ weitere/);
  assert.equal(suche(['kein', 'Treffer', 'hier'].join('-')), 'keine Treffer');
});

test('Karte: abhängig findet Importeure über relative Pfade und Ordner-Index', () => {
  assert.match(abhaengig('src/ebene0/richtungen.js'), /src\/ebene0\/(index|welt)\.js/);
  assert.match(abhaengig('src/ebene3/index.js'), /\.js:\d+/);
});

test('Karte: abhängig ohne Funktionsoption bleibt unverändert', () => {
  const t = abhaengig('tools/orchestrierung/tore.js');
  assert.match(t, /^test\/orchestrierung\/tore\.orchestrierung\.js:7\ntools\/orchestrierung\/lauf\.js:13$/);
  assert.doesNotMatch(t, /Aufrufer auf Funktionsebene/);
});

test('Karte: abhängig mit funktionen nennt die umschließende Funktion mit Zeile', () => {
  const t = abhaengig('tools/orchestrierung/tore.js', true);
  assert.match(t, /Aufrufer auf Funktionsebene:/);
  assert.match(t, /tools\/orchestrierung\/lauf\.js:rundeEnde:\d+\b/);
  assert.match(t, /tools\/orchestrierung\/lauf\.js:uebernehmen:\d+\b/);
});

test('Karte: abhängig mit funktionen markiert Aufrufe aus Testcallbacks als (unklar)', () => {
  const t = abhaengig('tools/orchestrierung/tore.js', true);
  assert.match(t, /test\/orchestrierung\/tore\.orchestrierung\.js:\(unklar\):\d+/);
  assert.match(t, /test\/orchestrierung\/tore\.orchestrierung\.js:funde:\d+\b/);
});

test('Karte: sicherFunktion erkennt Top-Level-Funktion, Callback und Methode richtig', () => {
  assert.equal(sicherFunktion(['function f(a) {', '  const x = treffer;'], 1), 'f');
  assert.equal(sicherFunktion(['function f() {', '  const g = (x) => {', '    treffer;', '  };'], 2), null);
  assert.equal(sicherFunktion(['function f() {', '  function g() {', '    treffer;', '  }', '}'], 2), null);
  assert.equal(sicherFunktion(['function f() {', '  m() {', '    treffer;', '  }', '}'], 2), null);
  assert.equal(sicherFunktion(['function f() {', '  async m(a) {', '    treffer;', '  }', '}'], 2), null);
  assert.equal(sicherFunktion(['function f() {', '  if (x) {', '    treffer;', '  }', '}'], 2), 'f');
  assert.equal(sicherFunktion(['function f() {', '  } else if (x) {', '    treffer;', '  }', '}'], 2), 'f');
});

test('Karte: sicherFunktion erkennt get, static, berechnete Namen und Zeilenende-Kommentar als Block', () => {
  assert.equal(sicherFunktion(['function f() {', '  get m() {', '    treffer;', '  }', '}'], 2), null);
  assert.equal(sicherFunktion(['function f() {', '  static m() {', '    treffer;', '  }', '}'], 2), null);
  assert.equal(sicherFunktion(['function f() {', '  [k]() {', '    treffer;', '  }', '}'], 2), null);
  assert.equal(sicherFunktion(['function f() {', '  m() { // x', '    treffer;', '  }', '}'], 2), null);
});

test('Karte: sicherFunktion bleibt konservativ bei // in Strings, Regex und Templates', () => {
  const f = (kopf) => sicherFunktion(['function f() {', kopf, '      treffer;', '  }', '}'], 2);
  assert.equal(f("    m(u = 'http://a') {"), null);
  assert.equal(f('    m(r = /a\\/\\//) {'), null);
  assert.equal(f('    m() { // http://x'), null);
  assert.equal(f("  run('http://a', (e) => {"), null);
  assert.equal(f("  run('http://a', function (e) {"), null);
  assert.equal(f("  if (u.startsWith('http://')) {"), 'f');
  assert.equal(f('  } else if (x) {'), 'f');
  assert.equal(sicherFunktion(['function f() {', '  const s = `http://x`;', '  treffer;', '}'], 2), 'f');
});

test('Karte: sicherFunktion erkennt Blockköpfe mit Kommentar, Generatoren und Objektliterale als unklar', () => {
  const f = (kopf) => sicherFunktion(['function f() {', kopf, '    treffer;', '  }', '}'], 2);
  for (const kopf of ['  x => { // c', '  (x) => { /* c */', '  m() { /* c */', '  *m() {', '  async *m() {', '  const o = {']) {
    assert.equal(f(kopf), null, kopf);
  }
  for (const kopf of ['  if (x) {', '  } else {', '  try {']) assert.equal(f(kopf), 'f', kopf);
});

test('Karte: sicherFunktion behandelt offene Blockkommentare und Code hinter Kommentaren konservativ', () => {
  const f = (kopf) => sicherFunktion(['function f() {', kopf, '    treffer;', '  }', '}'], 2);
  for (const kopf of ['  m() { /* c', '  x => { /* c', '  /* c */ run(() => {', '  * (() => {']) assert.equal(f(kopf), null, kopf);
  // echte Kommentarzeilen werden weiter übersprungen
  const g = (kommentar) => sicherFunktion(['function f() {', '  if (x) {', kommentar, '    treffer;', '  }', '}'], 3);
  for (const k of ['  // Text {', '   * Text', '   */', '   *', '  /** Text */', '  /* Text']) assert.equal(g(k), 'f', k);
});

test('Karte: abhängig ohne funktionen liefert nur Datei:Zeile', () => {
  const zeilen = abhaengig('src/ebene0/richtungen.js').split('\n');
  assert.ok(zeilen.length > 0 && !zeilen.some((z) => z.includes('Aufrufer auf Funktionsebene')));
  for (const z of zeilen) assert.match(z, /^\S+\.m?js:\d+$/);
});

test('Karte: abhängig mit funktionen meldet Namespace-Importe als (unklar) statt zu schweigen', () => {
  const t = abhaengig('src/ebene5/kamera.js', true);
  assert.match(t, /web\/ansicht3d\.js:3\n/);
  assert.match(t, /web\/ansicht3d\.js:\(unklar\):3\b/);
  assert.doesNotMatch(t, /keine Treffer/);
});

test('Karte: Übersicht und Dateiliste ignorieren Texturen, Git und Knoten', () => {
  assert.ok(dateien().every((d) => !/^(node_modules|\.git|\.claude)\//.test(d) && !d.startsWith('data/texturen/')));
  assert.match(uebersicht(), /src\/ebene0: \d+ Dateien/);
});

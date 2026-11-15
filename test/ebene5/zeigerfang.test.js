// Maus fangen: Fehlerarten, Listener-Aufräumen, Hinweistexte (web/zeigerfang.js, mit Fakes für canvas und document).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fangeMaus, erzeugeVersuche, hinweisFuerFehler } from '../../web/zeigerfang.js';

function fakeDoc() {
  const l = new Map();
  return {
    addEventListener: (n, f) => { l.set(n, [...(l.get(n) ?? []), f]); },
    removeEventListener: (n, f) => { l.set(n, (l.get(n) ?? []).filter((x) => x !== f)); },
    ausloesen: (n) => { for (const f of [...(l.get(n) ?? [])]) f({ type: n }); },
    anzahl: () => [...l.values()].reduce((s, a) => s + a.length, 0),
  };
}
const dom = (name, nachricht = 'x') => Object.assign(new Error(nachricht), { name });
const mitCanvas = (requestPointerLock) => ({ requestPointerLock });

test('Erfolg: Promise erfüllt, ein Ergebnis, keine Listener übrig', async () => {
  const doc = fakeDoc(); const erg = [];
  const r = await fangeMaus(mitCanvas(() => Promise.resolve()), doc, (e) => erg.push(e));
  assert.deepEqual(r, { status: 'angefordert' });
  assert.deepEqual(erg, [{ status: 'angefordert' }]);
  assert.equal(doc.anzahl(), 0);
});

test('fehlende API: nicht-unterstuetzt', async () => {
  const doc = fakeDoc();
  const r = await fangeMaus({}, doc);
  assert.equal(r.status, 'fehler'); assert.equal(r.art, 'nicht-unterstuetzt');
  assert.equal(doc.anzahl(), 0);
});

test('synchrone Ausnahme: unbekannter Name = ausnahme, bekannter Name wird eingeordnet', async () => {
  const doc = fakeDoc();
  const a = await fangeMaus(mitCanvas(() => { throw dom('Error', 'kaputt'); }), doc);
  assert.deepEqual(a, { status: 'fehler', art: 'ausnahme', name: 'Error', nachricht: 'kaputt' });
  const b = await fangeMaus(mitCanvas(() => { throw dom('WrongDocumentError'); }), doc);
  assert.equal(b.art, 'umgebung');
  assert.equal(doc.anzahl(), 0);
});

test('Promise-Rejektion: WrongDocumentError/NotSupportedError = umgebung, NotAllowedError/SecurityError/InvalidStateError = abgelehnt', async () => {
  for (const [name, art] of [['WrongDocumentError', 'umgebung'], ['NotSupportedError', 'umgebung'], ['NotAllowedError', 'abgelehnt'], ['SecurityError', 'abgelehnt'], ['InvalidStateError', 'abgelehnt'], ['Unbekannt', 'abgelehnt']]) {
    const doc = fakeDoc();
    const r = await fangeMaus(mitCanvas(() => Promise.reject(dom(name, 'm'))), doc);
    assert.equal(r.status, 'fehler'); assert.equal(r.art, art, name); assert.equal(r.name, name); assert.equal(r.nachricht, 'm');
    assert.equal(doc.anzahl(), 0, 'Listener entfernt');
  }
});

test('ohne Promise (ältere Browser): pointerlockerror = abgelehnt, pointerlockchange = Erfolg, nur einmal gemeldet', async () => {
  let doc = fakeDoc(); let n = 0;
  let p = fangeMaus(mitCanvas(() => undefined), doc, () => n++);
  assert.equal(doc.anzahl(), 2);
  doc.ausloesen('pointerlockerror'); doc.ausloesen('pointerlockerror'); doc.ausloesen('pointerlockchange');
  let r = await p;
  assert.equal(r.art, 'abgelehnt'); assert.equal(r.name, 'pointerlockerror');
  assert.equal(n, 1); assert.equal(doc.anzahl(), 0);
  doc = fakeDoc();
  p = fangeMaus(mitCanvas(() => undefined), doc);
  doc.ausloesen('pointerlockchange');
  r = await p;
  assert.deepEqual(r, { status: 'angefordert' }); assert.equal(doc.anzahl(), 0);
});

test('mit Promise zählt das Promise (Fehlername), das Ereignis zusätzlich ändert nichts und es bleibt kein Listener', async () => {
  const doc = fakeDoc(); let n = 0;
  const p = fangeMaus(mitCanvas(() => { const q = Promise.reject(dom('NotAllowedError')); doc.ausloesen('pointerlockerror'); return q; }), doc, () => n++);
  const r = await p;
  assert.equal(r.name, 'NotAllowedError'); assert.equal(n, 1); assert.equal(doc.anzahl(), 0);
});

test('hinweisFuerFehler: deutscher Text, Name und Nachricht stehen in der Kurzform', () => {
  const u = hinweisFuerFehler({ status: 'fehler', art: 'umgebung', name: 'WrongDocumentError', nachricht: 'root' });
  assert.match(u, /Chrome oder Edge/); assert.match(u, /\(WrongDocumentError: root\)$/);
  const n = hinweisFuerFehler({ status: 'fehler', art: 'nicht-unterstuetzt', name: 'NotSupportedError', nachricht: 'fehlt' });
  assert.match(n, /Chrome oder Edge/);
  for (const name of ['NotAllowedError', 'SecurityError', 'InvalidStateError']) {
    const a = hinweisFuerFehler({ status: 'fehler', art: 'abgelehnt', name, nachricht: 'zu früh' });
    assert.match(a, new RegExp(`abgelehnt \\(${name}\\)`)); assert.match(a, new RegExp(`\\(${name}: zu früh\\)$`)); assert.match(a, /Klick noch einmal/);
  }
});

// Versuchsverwalter: ein Versuch zugleich, späte Ergebnisse nach Invalidierung wirkungslos
function steuerbar() {
  const doc = fakeDoc(); const offen = [];
  const canvas = { requestPointerLock: () => { doc.aufrufe = (doc.aufrufe ?? 0) + 1; return new Promise((ok, nein) => offen.push({ ok, nein })); } };
  return { doc, canvas, offen };
}
const tick = () => new Promise((r) => setImmediate(r));

test('Versuche: zweiter Aufruf während eines laufenden Versuchs startet keinen zweiten', async () => {
  const { doc, canvas, offen } = steuerbar(); const v = erzeugeVersuche(canvas, doc); const erg = [];
  assert.equal(v.starte((e) => erg.push(e)), true);
  assert.equal(v.laeuft(), true);
  assert.equal(v.starte((e) => erg.push(e)), false);
  assert.equal(doc.aufrufe, 1);
  offen[0].ok(); await tick();
  assert.deepEqual(erg, [{ status: 'angefordert' }]);
});

test('Versuche: nach Erfolg und nach Fehler ist ein neuer Versuch wieder möglich', async () => {
  const { doc, canvas, offen } = steuerbar(); const v = erzeugeVersuche(canvas, doc);
  v.starte(() => {}); offen[0].nein(dom('NotAllowedError')); await tick();
  assert.equal(v.laeuft(), false);
  assert.equal(v.starte(() => {}), true); offen[1].ok(); await tick();
  assert.equal(v.starte(() => {}), true);
  assert.equal(doc.aufrufe, 3);
});

test('Versuche: verspätetes Ergebnis nach invalidiere() wirkt nicht, ein neuerer Versuch schon', async () => {
  const { doc, canvas, offen } = steuerbar(); const v = erzeugeVersuche(canvas, doc); const erg = [];
  v.starte((e) => erg.push(['alt', e.status]));
  v.invalidiere();
  assert.equal(v.laeuft(), false);
  assert.equal(v.starte((e) => erg.push(['neu', e.status])), true);
  offen[0].nein(dom('NotAllowedError')); await tick(); // spät: wirkt weder auf das Ergebnis noch auf laeuft()
  assert.deepEqual(erg, []); assert.equal(v.laeuft(), true);
  offen[1].ok(); await tick();
  assert.deepEqual(erg, [['neu', 'angefordert']]);
});

test('Versuche: Fehler bei bereits gefangener Maus erzeugt keinen Fehler; bei gefangener Maus startet kein Versuch', async () => {
  const { doc, canvas, offen } = steuerbar(); const v = erzeugeVersuche(canvas, doc); const erg = [];
  v.starte((e) => erg.push(e));
  doc.pointerLockElement = canvas; // der erste Versuch hatte den Lock schon
  offen[0].nein(dom('InvalidStateError')); await tick();
  assert.deepEqual(erg, [{ status: 'angefordert' }]);
  assert.equal(v.starte(() => erg.push('x')), false);
  assert.equal(doc.aufrufe, 1);
});

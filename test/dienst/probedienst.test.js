import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteProbedienst } from '../../tools/live-lokal.js';
import { kodiere, FrameLeser, OP, handshakeSchluessel } from '../../tools/ws-mini.js';
import { live as L, fortschritt as F } from '../../src/ebene5/index.js';

const RAUM = 'testraum-0123456789abcdef';
const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Echter WebSocket-Client (in Node 22 eingebaut) mit Posteingang. */
function verbinde(port, raum = RAUM) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/raum/${raum}`);
  const c = { ws, post: [], zu: null, offen: new Promise((ok, nein) => { ws.onopen = ok; ws.onerror = () => nein(new Error('Verbindung abgelehnt')); }) };
  ws.onmessage = (e) => c.post.push(JSON.parse(e.data));
  ws.onclose = (e) => { c.zu = e.code; };
  c.sende = (m) => ws.send(typeof m === 'string' ? m : JSON.stringify(m));
  c.warteAuf = async (f, was = 'Nachricht') => { for (let i = 0; i < 100; i++) { const t = c.post.find(f); if (t) return t; await warte(10); } throw new Error(`${was} kam nicht`); };
  return c;
}

test('WebSocket-Bausteine: Frames hin und zurück, alle Längenstufen, maskiert und unmaskiert, Stückelung der Eingabe, Größengrenze', () => {
  for (const n of [0, 1, 125, 126, 127, 65535, 65536, 70000]) {
    const text = 'a'.repeat(n);
    for (const maskiert of [false, true]) {
      const frame = kodiere(OP.TEXT, text, maskiert);
      const leser = new FrameLeser(100000);
      const hälfte = Math.floor(frame.length / 2);
      assert.deepEqual(leser.fuettere(frame.subarray(0, hälfte)), []);
      const r = leser.fuettere(frame.subarray(hälfte));
      assert.equal(r.length, 1);
      assert.equal(r[0].opcode, OP.TEXT);
      assert.equal(r[0].nutzlast.toString(), text);
    }
  }
  const zwei = Buffer.concat([kodiere(OP.TEXT, 'eins', true), kodiere(OP.PING, 'x', true)]);
  assert.deepEqual(new FrameLeser(100).fuettere(zwei).map((f) => f.opcode), [OP.TEXT, OP.PING]);
  assert.throws(() => new FrameLeser(10).fuettere(kodiere(OP.TEXT, 'a'.repeat(11), true)), /zu groß/);
  assert.throws(() => new FrameLeser(10).fuettere(Buffer.from([0x01, 0x01, 0x61])), /zerstückelt/);
  assert.equal(handshakeSchluessel('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=', 'Beispiel aus RFC 6455');
});

test('Probedienst mit echten Sockets: anmelden, abhaken, Planversion, Wegfall – und der Stand bleibt im Raum für den Nächsten', async () => {
  const { server, port, raeume } = await starteProbedienst({ port: 0, ursprung: '*' });
  try {
    const a = verbinde(port), b = verbinde(port);
    await a.offen; await b.offen;
    a.sende({ typ: 'hallo', name: 'Anna' });
    await a.warteAuf((m) => m.typ === 'zustand', 'Zustand');
    b.sende({ typ: 'hallo', name: 'Ben' });
    await a.warteAuf((m) => m.typ === 'spieler' && m.neu === 'Ben', 'Spielermeldung');
    const f = F.haken(F.leer(), ['x|1|aa'], true, 'Anna');
    a.sende({ typ: 'haken', eintraege: f.eintraege });
    const e = await b.warteAuf((m) => m.typ === 'eintraege', 'Haken');
    assert.equal(e.von, 'Anna');
    assert.equal(e.eintraege['x|1|aa'].wert, true);
    assert.equal(a.post.filter((m) => m.typ === 'eintraege').length, 0, 'nicht zurück an den Absender');
    a.sende('kein json');
    assert.equal((await a.warteAuf((m) => m.typ === 'abgelehnt', 'Ablehnung')).grund, 'form');
    b.ws.close();
    await a.warteAuf((m) => m.typ === 'spieler' && m.weg === 'Ben', 'Wegfall');
    // ein Nachzügler im selben Raum bekommt den Stand
    const c = verbinde(port); await c.offen;
    c.sende({ typ: 'hallo', name: 'Cleo' });
    const z = await c.warteAuf((m) => m.typ === 'zustand', 'Zustand für Cleo');
    assert.equal(z.fortschritt.eintraege['x|1|aa'].wert, true);
    assert.deepEqual(z.spieler, ['Anna', 'Cleo']);
    // anderer Raum = anderer Stand
    const d = verbinde(port, 'anderer-raum-0123456789'); await d.offen;
    d.sende({ typ: 'hallo', name: 'Dora' });
    assert.deepEqual((await d.warteAuf((m) => m.typ === 'zustand', 'Zustand Raum 2')).fortschritt, F.leer());
    assert.equal(raeume.size, 2);
    for (const x of [a, c, d]) x.ws.close();
  } finally { server.close(); server.closeAllConnections?.(); }
});

test('Probedienst: zu große Nachricht beendet die Verbindung, falsche Adresse und falscher Ursprung werden abgewiesen', async () => {
  const { server, port } = await starteProbedienst({ port: 0, ursprung: 'https://thalrail.github.io' });
  const { server: offen, port: offenerPort } = await starteProbedienst({ port: 0, ursprung: '*' });
  try {
    await assert.rejects(verbinde(port).offen, /abgelehnt/, 'ohne erlaubten Ursprung');
    await assert.rejects(verbinde(offenerPort, 'kurz').offen, /abgelehnt/, 'Raum-Nummer zu kurz');
    await assert.rejects(verbinde(offenerPort, 'mit leerzeichen und mehr zeichen').offen);
    const c = verbinde(offenerPort); await c.offen;
    c.sende({ typ: 'hallo', name: 'Anna' });
    await c.warteAuf((m) => m.typ === 'zustand');
    c.sende(JSON.stringify({ typ: 'ping', x: 'a'.repeat(L.GRENZEN.nachricht + 10) }));
    for (let i = 0; i < 100 && c.zu === null; i++) await warte(10);
    assert.ok([1009, 1006].includes(c.zu), `Verbindung beendet (1009, oder 1006 wenn der Rest der großen Nachricht noch unterwegs war), war ${c.zu}`);
  } finally { server.close(); offen.close(); server.closeAllConnections?.(); offen.closeAllConnections?.(); }
});

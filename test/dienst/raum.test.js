import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RaumHuelle, ursprungErlaubt, RATE, TAG_MS } from '../../dienst/raum.js';
import { live as L, fortschritt as F } from '../../src/ebene5/index.js';
import { abdruck } from '../../src/ebene4/spezifikation.js';
import { holeJson } from '../ebene5/hilfe5.js';

class FakeWs {
  constructor() { this.gesendet = []; this.geschlossen = null; this.att = null; }
  send(t) { this.gesendet.push(JSON.parse(t)); }
  close(code, grund) { this.geschlossen = { code, grund }; }
  serializeAttachment(a) { this.att = structuredClone(a); }
  deserializeAttachment() { return this.att ? structuredClone(this.att) : null; }
}
/** Attrappe für ctx (Speicher, Sockets, Alarm); `speicher` kann zwischen Instanzen weitergegeben werden (Ruhezustand). */
function fakeCtx(speicher = new Map(), sockets = []) {
  const ctx = {
    puts: 0, alarm: null, geloescht: false, sockets,
    storage: { get: async (k) => speicher.get(k), put: async (k, v) => { ctx.puts++; speicher.set(k, structuredClone(v)); }, setAlarm: async (t) => { ctx.alarm = t; }, deleteAll: async () => { speicher.clear(); ctx.geloescht = true; } },
    getWebSockets: () => sockets, acceptWebSocket: (ws) => sockets.push(ws),
    blockConcurrencyWhile: (f) => { ctx.bereit = f(); return ctx.bereit; },
  };
  return ctx;
}
const UMGEBUNG = (jetzt) => ({ jetzt: () => jetzt.t, neuesPaar: () => [new FakeWs(), new FakeWs()], antwort: (status, ws, text) => ({ status, ws, text }) });
const anfrage = (kopf) => ({ headers: { get: (n) => kopf[n] ?? null } });
const ENV = { ERLAUBTE_URSPRUENGE: 'https://thalrail.github.io' };

async function neueHuelle({ speicher, sockets, jetzt = { t: 1_000_000 }, env = ENV } = {}) {
  const ctx = fakeCtx(speicher, sockets), h = new RaumHuelle(ctx, env, UMGEBUNG(jetzt));
  await ctx.bereit;
  return { h, ctx, jetzt };
}
/** Verbindung öffnen wie der Dienst: Upgrade-Anfrage, der Server-Socket wird angenommen. */
function verbinde(h, ctx) {
  const antwort = h.fetch(anfrage({ Origin: 'https://thalrail.github.io', Upgrade: 'websocket' }));
  assert.equal(antwort.status, 101);
  return ctx.sockets.at(-1);
}
const senden = (h, ws, m) => h.webSocketMessage(ws, typeof m === 'string' || ArrayBuffer.isView(m) ? m : JSON.stringify(m));
const spezV = async (version) => { const s = await holeJson('data/beispiele/zitadelle-klein.json'); delete s.freigabe; s.version = version; s.freigabe = { von: 'jonah', version, abdruck: abdruck(s) }; return s; };

test('Ursprung: nur die eingetragenen Seiten, „*“ nur ausdrücklich, ohne Liste niemand', () => {
  assert.equal(ursprungErlaubt('https://thalrail.github.io', 'https://thalrail.github.io'), true);
  assert.equal(ursprungErlaubt('https://thalrail.github.io', ' http://localhost:8080 , https://thalrail.github.io '), true);
  assert.equal(ursprungErlaubt('https://boese.example', 'https://thalrail.github.io'), false);
  assert.equal(ursprungErlaubt('https://thalrail.github.io.boese.example', 'https://thalrail.github.io'), false);
  assert.equal(ursprungErlaubt(null, 'https://thalrail.github.io'), false);
  assert.equal(ursprungErlaubt('https://x', '*'), true);
  assert.equal(ursprungErlaubt('https://x', ''), false);
  assert.equal(ursprungErlaubt('https://x', undefined), false);
});

test('Verbindung: falscher Ursprung 403, kein WebSocket 426, sonst wird sie angenommen', async () => {
  const { h, ctx } = await neueHuelle();
  assert.equal(h.fetch(anfrage({ Origin: 'https://boese.example', Upgrade: 'websocket' })).status, 403);
  assert.equal(h.fetch(anfrage({ Upgrade: 'websocket' })).status, 403);
  assert.equal(h.fetch(anfrage({ Origin: 'https://thalrail.github.io' })).status, 426);
  assert.equal(ctx.sockets.length, 0, 'abgewiesene Anfragen nehmen nichts an');
  const ws = verbinde(h, ctx);
  assert.ok(ws.att.id && ws.att.name === null);
  assert.notEqual(verbinde(h, ctx).att.id, ws.att.id, 'jede Verbindung hat eine eigene Kennung');
});

test('Nachrichten: anmelden, abhaken, Planversion – Zustellung wie in live.js, Fehler als „abgelehnt“, Text und Bytes', async () => {
  const { h, ctx } = await neueHuelle();
  const a = verbinde(h, ctx), b = verbinde(h, ctx), c = verbinde(h, ctx);
  await senden(h, a, { typ: 'hallo', name: 'Anna' });
  await senden(h, b, { typ: 'hallo', name: 'Ben' });
  assert.equal(a.gesendet[0].typ, 'zustand');
  assert.deepEqual(a.gesendet.at(-1), { typ: 'spieler', spieler: ['Anna', 'Ben'], neu: 'Ben' });
  assert.equal(c.gesendet.length, 0, 'wer nicht angemeldet ist, bekommt keine Rundsendung');
  const f = F.haken(F.leer(), ['x|1|aa'], true, 'Anna');
  await senden(h, a, { typ: 'haken', eintraege: f.eintraege });
  assert.equal(b.gesendet.at(-1).typ, 'eintraege');
  assert.equal(a.gesendet.at(-1).typ, 'spieler', 'nichts zurück an den Absender');
  const v1 = await spezV(1);
  await senden(h, b, new TextEncoder().encode(JSON.stringify({ typ: 'plan', basis: 0, spezifikation: v1 })));
  assert.equal(b.gesendet.at(-1).typ, 'plan-angenommen');
  assert.equal(a.gesendet.at(-1).typ, 'plan');
  await senden(h, a, 'kein json');
  assert.equal(a.gesendet.at(-1).typ, 'abgelehnt');
  assert.equal(a.gesendet.at(-1).grund, 'form');
  await senden(h, a, { typ: 'plan', basis: 0, spezifikation: v1 });
  assert.equal(a.gesendet.at(-1).grund, 'veraltet');
  await senden(h, a, `{"typ":"ping","x":"${'a'.repeat(L.GRENZEN.nachricht)}"}`);
  assert.equal(a.gesendet.at(-1).grund, 'zu-gross');
});

test('Speichern: nur bei Änderung, Ablehnungen schreiben nichts; nach dem Ruhezustand ist alles wieder da (Spieler aus den Sockets)', async () => {
  const speicher = new Map(), jetzt = { t: 5_000_000 };
  const { h, ctx } = await neueHuelle({ speicher, jetzt });
  const a = verbinde(h, ctx), b = verbinde(h, ctx), roh = verbinde(h, ctx);
  await senden(h, a, { typ: 'hallo', name: 'Anna' }); await senden(h, b, { typ: 'hallo', name: 'Ben' });
  assert.equal(ctx.puts, 0, 'Anmelden verändert den gespeicherten Raum nicht');
  await senden(h, a, { typ: 'haken', eintraege: F.haken(F.leer(), ['x|1|aa'], true, 'Anna').eintraege });
  await senden(h, b, { typ: 'plan', basis: 0, spezifikation: await spezV(2) });
  assert.equal(ctx.puts, 2);
  await senden(h, a, { typ: 'plan', basis: 0, spezifikation: await spezV(3) });
  await senden(h, a, { typ: 'haken', eintraege: { k: { wert: 'x' } } });
  assert.equal(ctx.puts, 2, 'Ablehnungen speichern nichts');
  assert.deepEqual(Object.keys(speicher.get('raum')).sort(), ['fortschritt', 'spezifikation'], 'Verbindungen werden nicht gespeichert');
  // Ruhezustand: neue Instanz, gleiche Sockets (mit Anhang), gleicher Speicher
  const { h: h2 } = await neueHuelle({ speicher, sockets: [a, b, roh], jetzt });
  assert.equal(h2.raum.spezifikation.version, 2);
  assert.equal(F.istAbgehakt(h2.raum.fortschritt, 'x|1|aa'), true);
  assert.deepEqual(L.spielerListe(h2.raum), ['Anna', 'Ben'], 'wer sich nie angemeldet hat, zählt nicht');
});

test('Verbindung beendet: die anderen erfahren es, Unangemeldete verschwinden still', async () => {
  const { h, ctx } = await neueHuelle();
  const a = verbinde(h, ctx), b = verbinde(h, ctx), roh = verbinde(h, ctx);
  await senden(h, a, { typ: 'hallo', name: 'Anna' }); await senden(h, b, { typ: 'hallo', name: 'Ben' });
  await h.webSocketClose(b);
  assert.deepEqual(a.gesendet.at(-1), { typ: 'spieler', spieler: ['Anna'], weg: 'Ben' });
  const n = a.gesendet.length;
  await h.webSocketClose(roh); await h.webSocketError(roh);
  assert.equal(a.gesendet.length, n);
});

test('Ratenbegrenzung: zu viele Nachrichten in kurzer Zeit schließen die Verbindung, später geht es wieder', async () => {
  const { h, ctx, jetzt } = await neueHuelle();
  const a = verbinde(h, ctx);
  await senden(h, a, { typ: 'hallo', name: 'Anna' });
  for (let i = 0; i < RATE.nachrichten - 1; i++) await senden(h, a, { typ: 'ping' });
  assert.equal(a.geschlossen, null);
  await senden(h, a, { typ: 'ping' });
  assert.deepEqual(a.geschlossen, { code: 1008, grund: 'zu viele Nachrichten' });
  const b = verbinde(h, ctx);
  await senden(h, b, { typ: 'hallo', name: 'Ben' });
  for (let i = 0; i < RATE.nachrichten - 2; i++) await senden(h, b, { typ: 'ping' });
  jetzt.t += RATE.fensterMs + 1; // das Fenster ist vorbei
  for (let i = 0; i < 10; i++) await senden(h, b, { typ: 'ping' });
  assert.equal(b.geschlossen, null);
});

test('Alarm: Raum verfällt nach 30 Tagen ohne Nutzung, mit Verbindung bleibt er', async () => {
  const speicher = new Map(), jetzt = { t: 9_000_000 };
  const { h, ctx } = await neueHuelle({ speicher, jetzt });
  const a = verbinde(h, ctx);
  await senden(h, a, { typ: 'hallo', name: 'Anna' });
  await senden(h, a, { typ: 'plan', basis: 0, spezifikation: await spezV(1) });
  assert.equal(ctx.alarm, jetzt.t + L.GRENZEN.verfallTage * TAG_MS);
  assert.equal(L.GRENZEN.verfallTage, 30);
  jetzt.t += 31 * TAG_MS;
  await h.alarm();
  assert.equal(ctx.geloescht, false, 'mit Verbindung bleibt der Raum');
  assert.equal(ctx.alarm, jetzt.t + 30 * TAG_MS);
  ctx.sockets.length = 0;
  await h.alarm();
  assert.equal(ctx.geloescht, true);
  assert.equal(speicher.size, 0);
  assert.equal(h.raum.spezifikation, null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { live as L, fortschritt as F } from '../../src/ebene5/index.js';
import { abdruck } from '../../src/ebene4/spezifikation.js';
import { holeJson, zufall } from './hilfe5.js';

const spezV = async (version = 1, name = 'Zitadelle') => {
  const s = await holeJson('data/beispiele/zitadelle-klein.json');
  delete s.freigabe;
  s.version = version; s.projekt.name = name;
  s.freigabe = { von: 'jonah', version, abdruck: abdruck(s) };
  return s;
};

/** Dienst-Attrappe: ein Raum, Verbindungen mit Posteingang; dieselbe Logik wie der echte Dienst (liesNachricht → verarbeite → verteilen). */
class Dienst {
  constructor() { this.raum = L.neuerRaum(); this.verbindungen = new Map(); this.nr = 0; }
  verbinde() { const id = `v${++this.nr}`; const c = { id, post: [] }; this.verbindungen.set(id, c); return c; }
  trenne(c) { this.verbindungen.delete(c.id); this.verteile(L.austritt(this.raum, c.id), c.id); }
  empfange(c, text) {
    let m;
    try { m = L.liesNachricht(text); } catch (f) { c.post.push({ typ: 'abgelehnt', grund: f.grund, text: f.message }); return; }
    this.verteile(L.verarbeite(this.raum, m, c.id), c.id);
  }
  verteile(r, absender) {
    this.raum = r.raum;
    for (const z of L.zustellungen(r.raum, r.senden, absender)) this.verbindungen.get(z.an)?.post.push(JSON.parse(JSON.stringify(z.nachricht)));
  }
}
/** Ein Mitspieler: Klient-Logik der Seite + Verbindung zur Attrappe. */
class Spieler {
  constructor(dienst, name, fortschritt) { this.dienst = dienst; this.name = name; this.k = L.erzeugeKlient({ name, fortschritt }); this.meldungen = []; this.verbinden(); }
  verbinden() { this.c = this.dienst.verbinde(); this.sende(this.k.verbunden()); }
  sende(msgs) { for (const m of msgs) this.dienst.empfange(this.c, JSON.stringify(m)); }
  /** Posteingang abarbeiten, bis nichts mehr kommt (Antworten können neue Nachrichten auslösen). */
  pump() { while (this.c.post.length) { const r = this.k.beiNachricht(this.c.post.shift()); this.meldungen.push(...r.meldungen); this.sende(r.senden); } }
  haken(schluessel, wert, f = this.k.zustand.fortschritt) { const neu = F.haken(f, schluessel, wert, this.name); this.sende(this.k.lokalGeaendert(neu)); return neu; }
  get stand() { return this.k.zustand.fortschritt; }
}
const alleGleich = (...ps) => { for (const p of ps) p.pump(); for (const p of ps) p.pump(); for (let i = 1; i < ps.length; i++) assert.deepEqual(ps[i].stand, ps[0].stand); };

test('Nachrichten lesen: Größe, JSON, Form und Art werden vor allem anderen geprüft', () => {
  assert.equal(L.liesNachricht('{"typ":"ping"}').typ, 'ping');
  const fehler = (t, grund) => assert.throws(() => L.liesNachricht(t), (f) => f instanceof L.LiveFehler && f.grund === grund, String(t).slice(0, 30));
  fehler(5, 'form'); fehler('nicht json', 'form'); fehler('[1]', 'unbekannt'); fehler('{"typ":"fremd"}', 'unbekannt'); fehler('{}', 'unbekannt');
  fehler(`{"typ":"ping","x":"${'a'.repeat(L.GRENZEN.nachricht)}"}`, 'zu-gross');
  L.liesNachricht(`{"typ":"ping","x":"${'a'.repeat(L.GRENZEN.nachricht - 30)}"}`);
});

test('Anmelden: Zustand für den Neuen, Meldung an die anderen, Namen und Raumgröße begrenzt, Wiederanmelden zählt nicht doppelt', () => {
  const d = new Dienst();
  const a = d.verbinde(), b = d.verbinde();
  d.empfange(a, '{"typ":"hallo","name":"Anna"}');
  assert.deepEqual(a.post[0], { typ: 'zustand', spezifikation: null, fortschritt: F.leer(), spieler: ['Anna'] });
  d.empfange(b, '{"typ":"hallo","name":"  Ben "}');
  assert.deepEqual(a.post[1], { typ: 'spieler', spieler: ['Anna', 'Ben'], neu: 'Ben' });
  assert.equal(b.post.length, 1, 'der Neue bekommt nur den Zustand');
  const vorher = JSON.stringify(d.raum);
  for (const name of ['', '   ', 'x'.repeat(L.GRENZEN.name + 1), 5, null]) { d.empfange(b, JSON.stringify({ typ: 'hallo', name })); assert.equal(b.post.at(-1).grund, 'name'); }
  assert.equal(JSON.stringify(d.raum), vorher, 'Raum unverändert nach Ablehnung');
  d.empfange(b, '{"typ":"hallo","name":"Ben"}'); // dieselbe Verbindung nochmal
  assert.deepEqual(L.spielerListe(d.raum), ['Anna', 'Ben']);
  const voll = new Dienst();
  for (let i = 0; i < L.GRENZEN.spieler; i++) voll.empfange(voll.verbinde(), JSON.stringify({ typ: 'hallo', name: `S${i}` }));
  const zu = voll.verbinde(); voll.empfange(zu, '{"typ":"hallo","name":"Zuviel"}');
  assert.equal(zu.post[0].grund, 'voll');
  assert.equal(L.spielerListe(voll.raum).length, L.GRENZEN.spieler);
  d.empfange(b, '{"typ":"haken","eintraege":{}}'); d.trenne(b);
  assert.deepEqual(a.post.at(-1), { typ: 'spieler', spieler: ['Anna'], weg: 'Ben' });
});

test('Ohne Anmeldung geht nichts (außer Ping)', () => {
  const d = new Dienst(), c = d.verbinde();
  d.empfange(c, '{"typ":"haken","eintraege":{}}'); assert.equal(c.post.at(-1).grund, 'hallo');
  d.empfange(c, '{"typ":"plan","basis":0,"spezifikation":{}}'); assert.equal(c.post.at(-1).grund, 'hallo');
  d.empfange(c, '{"typ":"ping"}'); assert.equal(c.post.at(-1).typ, 'pong');
});

test('Haken: gemischt, an die anderen gesendet (nicht zurück), der Raum sagt dem Absender, wenn er Neueres kennt; Unbrauchbares ändert nichts', () => {
  const d = new Dienst(), a = new Spieler(d, 'Anna'), b = new Spieler(d, 'Ben');
  a.pump(); b.pump();
  a.haken(['x|1|aa'], true);
  assert.equal(a.c.post.length, 0, 'keine Rückmeldung an den Absender');
  assert.equal(b.c.post.length, 1);
  b.pump();
  assert.equal(F.istAbgehakt(b.stand, 'x|1|aa'), true);
  assert.equal(b.meldungen.at(-1).art, 'haken');
  assert.equal(b.meldungen.at(-1).von, 'Anna');
  // Ben nimmt den Haken zurück (neuere Uhr), Anna hakt mit älterer Uhr etwas anderes: der Raum behält Bens Neueres
  b.haken(['x|1|aa'], false);
  a.pump();
  assert.equal(F.istAbgehakt(a.stand, 'x|1|aa'), false);
  // ein veralteter Eintrag wird dem Absender korrigiert
  d.empfange(a.c, JSON.stringify({ typ: 'haken', eintraege: { 'x|1|aa': { wert: true, uhr: 1, von: 'Anna' } } }));
  assert.deepEqual(a.c.post.at(-1).eintraege['x|1|aa'].wert, false);
  assert.equal(b.c.post.length, 0, 'nichts Neues für die anderen');
  // Unbrauchbares
  const vorher = JSON.stringify(d.raum);
  for (const m of [{ typ: 'haken' }, { typ: 'haken', eintraege: [] }, { typ: 'haken', eintraege: { k: { wert: 'ja', uhr: 1, von: 'A' } } }, { typ: 'haken', eintraege: { k: { wert: true, uhr: 0, von: 'A' } } }, { typ: 'haken', eintraege: { k: { wert: true, uhr: 1.5, von: 'A' } } }, { typ: 'haken', eintraege: { k: { wert: true, uhr: 1 } } }]) {
    d.empfange(a.c, JSON.stringify(m)); assert.equal(a.c.post.at(-1).typ, 'abgelehnt', JSON.stringify(m));
  }
  assert.equal(JSON.stringify(d.raum), vorher);
  // Grenzen
  const viele = Object.fromEntries(Array.from({ length: L.GRENZEN.eintraege + 1 }, (_, i) => [`a|${i}|ab`, { wert: true, uhr: 1, von: 'A' }]));
  d.empfange(a.c, JSON.stringify({ typ: 'haken', eintraege: viele })); assert.equal(a.c.post.at(-1).grund, 'zu-gross');
  assert.equal(JSON.stringify(d.raum), vorher);
});

test('Haken: Der Raum summiert höchstens 5000 Einträge', () => {
  const d = new Dienst(), a = d.verbinde();
  d.empfange(a, '{"typ":"hallo","name":"A"}');
  const block = (von, n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`a|${von + i}|ab`, { wert: true, uhr: 1, von: 'A' }]));
  d.empfange(a, JSON.stringify({ typ: 'haken', eintraege: block(0, L.GRENZEN.eintraege) }));
  assert.equal(Object.keys(d.raum.fortschritt.eintraege).length, L.GRENZEN.eintraege);
  const vorher = JSON.stringify(d.raum);
  d.empfange(a, JSON.stringify({ typ: 'haken', eintraege: block(L.GRENZEN.eintraege, 1) }));
  assert.equal(a.post.at(-1).grund, 'zu-gross');
  assert.equal(JSON.stringify(d.raum), vorher);
  d.empfange(a, JSON.stringify({ typ: 'haken', eintraege: { 'a|0|ab': { wert: false, uhr: 2, von: 'A' } } })); // bestehende Schlüssel gehen weiter
  assert.equal(d.raum.fortschritt.eintraege['a|0|ab'].wert, false);
});

test('Zufall: drei Spieler haken in beliebiger Reihenfolge, auch offline gesammelt – am Ende haben alle (und der Raum) denselben Stand', () => {
  const SCHL = Array.from({ length: 10 }, (_, i) => `a|${i}|ff${i}`);
  for (let lauf = 1; lauf <= 40; lauf++) {
    const rnd = zufall(lauf * 104729);
    const d = new Dienst(), s = ['Anna', 'Ben', 'Cleo'].map((n) => new Spieler(d, n));
    for (const p of s) p.pump();
    for (let i = 0; i < 40; i++) {
      const p = s[Math.floor(rnd() * 3)], r = rnd();
      if (r < 0.15) { p.dienst.trenne(p.c); p.offline = true; } // Verbindung weg: weiter lokal abhaken
      else if (r < 0.3 && p.offline) { p.offline = false; p.verbinden(); }
      else if (r < 0.75) { const neu = F.haken(p.stand, [SCHL[Math.floor(rnd() * SCHL.length)]], rnd() < 0.6, p.name); if (p.offline) p.k.zustand.fortschritt = neu; else p.sende(p.k.lokalGeaendert(neu)); }
      else p.pump();
    }
    for (const p of s) if (p.offline) { p.offline = false; p.verbinden(); }
    for (let r = 0; r < 4; r++) for (const p of s) p.pump();
    for (const p of s) assert.deepEqual(p.stand, d.raum.fortschritt, `Lauf ${lauf} ${p.name}`);
  }
});

test('Offline gehakt, später verbunden: der lokale Stand geht in den Raum, Fremdes kommt zurück', () => {
  const d = new Dienst(), a = new Spieler(d, 'Anna'), b = new Spieler(d, 'Ben');
  a.pump(); b.pump();
  a.dienst.trenne(a.c);
  const offline = F.haken(F.haken(a.stand, ['k|1|aa'], true, 'Anna'), ['k|2|bb'], true, 'Anna');
  a.k.zustand.fortschritt = offline;
  b.haken(['k|3|cc'], true);
  a.verbinden(); alleGleich(a, b);
  assert.deepEqual(Object.keys(d.raum.fortschritt.eintraege).sort(), ['k|1|aa', 'k|2|bb', 'k|3|cc']);
  assert.equal(L.spielerListe(d.raum).length, 2);
});

test('Klient: sendet nur Geändertes, nach dem Wiederverbinden alles, nichts doppelt', () => {
  const k = L.erzeugeKlient({ name: 'Anna' });
  assert.deepEqual(k.verbunden(), [{ typ: 'hallo', name: 'Anna' }]);
  let f = F.haken(F.leer(), ['a'], true, 'Anna');
  assert.deepEqual(Object.keys(k.lokalGeaendert(f)[0].eintraege), ['a']);
  assert.deepEqual(k.lokalGeaendert(f), []);
  f = F.haken(f, ['b'], true, 'Anna');
  assert.deepEqual(Object.keys(k.lokalGeaendert(f)[0].eintraege), ['b']);
  k.verbunden();
  assert.deepEqual(Object.keys(k.lokalGeaendert(f)[0].eintraege).sort(), ['a', 'b']);
});

// ---------- Planversionen ----------
test('Plan: eine freigegebene neue Version geht in den Raum, die anderen bekommen einen Vorschlag (nie automatisch übernommen)', async () => {
  const d = new Dienst(), a = new Spieler(d, 'Anna'), b = new Spieler(d, 'Ben');
  a.pump(); b.pump();
  const v1 = await spezV(1);
  a.sende(a.k.planVeroeffentlichen(v1)); a.pump(); b.pump();
  assert.equal(d.raum.spezifikation.version, 1);
  assert.equal(a.meldungen.at(-1).art, 'plan-angenommen');
  assert.deepEqual(b.meldungen.at(-1), { art: 'vorschlag', von: 'Anna', version: 1, spezifikation: v1 });
  assert.equal(b.k.zustand.vorschlag.von, 'Anna');
  b.k.vorschlagErledigt(); assert.equal(b.k.zustand.vorschlag, null);
  const v3 = await spezV(3, 'Zitadelle 3');
  b.sende(b.k.planVeroeffentlichen(v3)); a.pump(); b.pump();
  assert.equal(d.raum.spezifikation.version, 3, 'Sprünge in der Versionsnummer sind erlaubt');
  assert.equal(a.meldungen.at(-1).version, 3);
  // wer neu dazukommt, bekommt den Stand im Zustand
  const c = new Spieler(d, 'Cleo'); c.pump();
  assert.equal(c.meldungen[0].spezifikation.version, 3);
});

test('Plan: Ablehnungen lassen den Raum unverändert (veraltet, falsche Freigabe, Version nicht größer, zu groß, kaputt)', async () => {
  const d = new Dienst(), a = new Spieler(d, 'Anna');
  a.pump();
  const v2 = await spezV(2);
  a.sende(a.k.planVeroeffentlichen(v2)); a.pump();
  const vorher = JSON.stringify(d.raum);
  const senden = (m) => { d.empfange(a.c, JSON.stringify(m)); return a.c.post.pop(); };
  // veraltet: der Absender kennt Version 2 nicht
  let r = senden({ typ: 'plan', basis: 0, spezifikation: await spezV(3) });
  assert.equal(r.grund, 'veraltet'); assert.equal(r.version, 2); assert.equal(r.spezifikation.version, 2, 'er bekommt den aktuellen Stand');
  // Freigabe passt nicht zum Inhalt
  const manipuliert = await spezV(3); manipuliert.projekt.name = 'Anders';
  assert.equal(senden({ typ: 'plan', basis: 2, spezifikation: manipuliert }).grund, 'freigabe');
  const ohne = await spezV(3); delete ohne.freigabe;
  assert.equal(senden({ typ: 'plan', basis: 2, spezifikation: ohne }).grund, 'freigabe');
  const falscheVersion = await spezV(3); falscheVersion.freigabe.version = 2;
  assert.equal(senden({ typ: 'plan', basis: 2, spezifikation: falscheVersion }).grund, 'freigabe');
  // nicht größer
  assert.equal(senden({ typ: 'plan', basis: 2, spezifikation: await spezV(2, 'Anders') }).grund, 'version');
  assert.equal(senden({ typ: 'plan', basis: 2, spezifikation: await spezV(1, 'Alt') }).grund, 'version');
  // zu groß und kaputt
  const gross = await spezV(3); gross.notizen = 'x'.repeat(L.GRENZEN.spezifikation); gross.freigabe.abdruck = abdruck(gross);
  assert.equal(senden({ typ: 'plan', basis: 2, spezifikation: gross }).grund, 'zu-gross');
  for (const m of [{ typ: 'plan', basis: 'x', spezifikation: v2 }, { typ: 'plan', basis: -1, spezifikation: v2 }, { typ: 'plan', basis: 2 }, { typ: 'plan', basis: 2, spezifikation: [] }, { typ: 'plan', basis: 2, spezifikation: { version: 'x', freigabe: {} } }]) {
    assert.equal(senden(m).typ, 'abgelehnt', JSON.stringify(m).slice(0, 60));
  }
  assert.equal(JSON.stringify(d.raum), vorher);
});

test('Plan: Zwei gleichzeitige Versionen – die zuerst angenommene gilt, die andere wird abgelehnt und der Absender bekommt den Stand', async () => {
  const d = new Dienst(), a = new Spieler(d, 'Anna'), b = new Spieler(d, 'Ben');
  a.pump(); b.pump();
  a.sende(a.k.planVeroeffentlichen(await spezV(1))); a.pump(); b.pump();
  // beide kennen Version 1 und veröffentlichen Version 2
  const msgA = a.k.planVeroeffentlichen(await spezV(2, 'von Anna')), msgB = b.k.planVeroeffentlichen(await spezV(2, 'von Ben'));
  a.sende(msgA); b.sende(msgB);
  a.pump(); b.pump();
  assert.equal(d.raum.spezifikation.projekt.name, 'von Anna');
  const abl = b.meldungen.filter((m) => m.art === 'abgelehnt').at(-1);
  assert.equal(abl.grund, 'veraltet');
  assert.equal(abl.spezifikation.projekt.name, 'von Anna');
  assert.equal(b.k.zustand.raumVersion, 2);
  // Ben kann jetzt auf Basis 2 weitermachen
  b.sende(b.k.planVeroeffentlichen(await spezV(3, 'von Ben'))); a.pump(); b.pump();
  assert.equal(d.raum.spezifikation.version, 3);
});

test('Plan: Haken bleiben beim Planwechsel im Raum (alte Schlüssel gelten dank Abdruck von selbst nicht mehr)', async () => {
  const d = new Dienst(), a = new Spieler(d, 'Anna'), b = new Spieler(d, 'Ben');
  a.pump(); b.pump();
  a.haken(['abschnitt|0|abc'], true);
  a.sende(a.k.planVeroeffentlichen(await spezV(1))); a.pump(); b.pump();
  assert.equal(F.istAbgehakt(d.raum.fortschritt, 'abschnitt|0|abc'), true);
  b.pump();
  assert.equal(F.istAbgehakt(b.stand, 'abschnitt|0|abc'), true);
});

test('Der Klient nimmt keine kaputten Dienstnachrichten an, ohne den Stand zu beschädigen', () => {
  const k = L.erzeugeKlient({ name: 'Anna', fortschritt: F.haken(F.leer(), ['a'], true, 'Anna') });
  const vorher = JSON.stringify(k.zustand.fortschritt);
  assert.throws(() => k.beiNachricht({ typ: 'eintraege', eintraege: { x: { wert: 1 } } }));
  assert.throws(() => k.beiNachricht({ typ: 'zustand', spezifikation: null, fortschritt: { eintraege: 5, uhr: 0 }, spieler: [] }));
  assert.equal(JSON.stringify(k.zustand.fortschritt), vorher);
  assert.deepEqual(k.beiNachricht({ typ: 'pong' }), { meldungen: [], senden: [] });
});

test('Zustellung: Rundsendungen gehen nur an angemeldete Spieler, nie an den Absender; „absender“ nur an ihn', () => {
  let raum = L.neuerRaum();
  for (const [id, name] of [['v1', 'Anna'], ['v2', 'Ben'], ['v3', 'Cleo']]) raum = L.verarbeite(raum, { typ: 'hallo', name }, id).raum;
  const n = { typ: 'x' };
  const an = (senden, absender) => L.zustellungen(raum, senden, absender).map((z) => z.an).sort();
  assert.deepEqual(an([{ an: 'andere', nachricht: n }], 'v1'), ['v2', 'v3']);
  assert.deepEqual(an([{ an: 'alle', nachricht: n }], 'v1'), ['v1', 'v2', 'v3']);
  assert.deepEqual(an([{ an: 'absender', nachricht: n }], 'v2'), ['v2']);
  assert.deepEqual(an([{ an: 'andere', nachricht: n }], 'unbekannt'), ['v1', 'v2', 'v3'], 'ein Unangemeldeter löst Rundsendungen an alle Angemeldeten aus, bekommt selbst aber nichts');
  assert.deepEqual(an([], 'v1'), []);
});

test('Haken: Müllschlüssel, unmögliche Uhren und lange Namen werden abgelehnt, ohne den Raum oder die Uhr zu verändern', () => {
  const d = new Dienst(), a = d.verbinde();
  d.empfange(a, '{"typ":"hallo","name":"Anna"}');
  d.empfange(a, JSON.stringify({ typ: 'haken', eintraege: F.haken(F.leer(), ['x|1|aa'], true, 'Anna').eintraege }));
  const vorher = JSON.stringify(d.raum);
  const e = (k, uhr, von = 'Mallory') => ({ typ: 'haken', eintraege: { [k]: { wert: true, uhr, von } } });
  const fall = [
    ['x|1|aa', Number.MAX_SAFE_INTEGER, 'uhr'], ['x|1|aa', L.GRENZEN.uhrMax + 1, 'uhr'], ['x|1|aa', 1 + L.GRENZEN.uhrSprung + 1, 'uhr'],
    ['müll', 5, 'schluessel'], ['a|b|c', 5, 'schluessel'], ['a|1|XYZ', 5, 'schluessel'], ['|1|aa', 5, 'schluessel'], [`${'a'.repeat(65)}|1|aa`, 5, 'schluessel'], ['a|1|aaaaaaaaaaaaaaaaa', 5, 'schluessel'], ['a b|1|aa', 5, 'schluessel'],
  ];
  for (const [k, uhr, grund] of fall) { d.empfange(a, JSON.stringify(e(k, uhr))); assert.equal(a.post.at(-1).grund, grund, `${k} ${uhr}`); }
  d.empfange(a, JSON.stringify(e('x|1|aa', 5, 'M'.repeat(L.GRENZEN.name + 1)))); assert.equal(a.post.at(-1).grund, 'form');
  assert.equal(JSON.stringify(d.raum), vorher);
  // ein gültiger Sprung bis zur Grenze geht, die Uhr bleibt eine ganze Zahl; ein Schlüssel mit negativer Höhe (Keller) ist gültig
  d.empfange(a, JSON.stringify(e('keller|-13|ab12cd34', 1 + L.GRENZEN.uhrSprung, 'Anna')));
  assert.equal(d.raum.fortschritt.eintraege['keller|-13|ab12cd34'].uhr, 1 + L.GRENZEN.uhrSprung);
  assert.equal(d.raum.fortschritt.uhr, 1 + L.GRENZEN.uhrSprung);
});

test('Alle echten Haken-Schlüssel des Beispielprojekts bestehen die Schlüsselprüfung des Raums', async () => {
  const { beispiel } = await import('./hilfe5.js');
  const b = await beispiel();
  const d = new Dienst(), a = d.verbinde();
  d.empfange(a, '{"typ":"hallo","name":"Anna"}');
  let f = F.leer(), n = 0;
  for (const ab of b.plan.abschnitte) for (const s of ab.schichten) { f = F.haken(f, [F.schluessel(ab.id, s)], true, 'Anna'); n++; }
  d.empfange(a, JSON.stringify({ typ: 'haken', eintraege: f.eintraege }));
  assert.equal(a.post.length, 1, 'nur der Zustand, keine Ablehnung');
  assert.equal(Object.keys(d.raum.fortschritt.eintraege).length, n);
});

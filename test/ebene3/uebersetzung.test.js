import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene3 } from '../hilfe.js';

const e3 = ebene3();
const U = e3.uebersetzung;
const NP = { x: 10, y: 5, z: 20 };
const PLATZ = { breite: 200, hoehe: 60, tiefe: 200 };
const zyl = (breite, tiefe, hoehe) => ({ baustein: 'form.zylinder', groesse: { breite, tiefe, hoehe } });
const teil = (id, lage, form = zyl(10, 10, 8), extra = {}) => ({ id, name: id.toUpperCase(), art: 'turm', wichtigkeit: 'muss', form, lage, ...extra });
const spec = (teile, extra = {}) => ({ schema: 1, version: 1, projekt: { name: 'Probe', bauplatz: { ...PLATZ }, nullpunkt: { ...NP }, ...extra }, teile });
const huelle = (v, id) => v.abschnitte.find((a) => a.id === id).huelle;
const box = (x0, y0, z0, x1, y1, z1) => ({ von: { x: x0, y: y0, z: z0 }, bis: { x: x1, y: y1, z: z1 } });
const A = teil('a', { bezug: 'projekt', relation: 'mitte' }); // Hülle 18 × 18 × 8 (10 + 2 × 4 Rand)

test('Übersetzung: Lage und Hüllen', () => {
  // ---- auf dem Bauplatz ----
  const v = (t) => { const r = U.uebersetze(spec([t])); assert.deepEqual(r.rueckfragen, [], t.lage.relation); return r.vorgabe; };
  assert.deepEqual(huelle(v(A), 'a'), box(101, 5, 111, 118, 12, 128), 'mitte: (200 − 18) ÷ 2 = 91 vom Nullpunkt');
  const ecke = (relation, abstand = 3) => huelle(v(teil('a', { bezug: 'projekt', relation, abstand })), 'a');
  assert.deepEqual(ecke('ecke-nordwest'), box(13, 5, 23, 30, 12, 40));
  assert.deepEqual(ecke('ecke-nordost'), box(189, 5, 23, 206, 12, 40));
  assert.deepEqual(ecke('ecke-suedwest'), box(13, 5, 199, 30, 12, 216));
  assert.deepEqual(ecke('ecke-suedost'), box(189, 5, 199, 206, 12, 216));
  assert.deepEqual(ecke('ecke-nordwest', 0), box(10, 5, 20, 27, 12, 37), 'ohne Abstand direkt an der Ecke des Bauplatzes');
  // gerade Maße ohne schiefe Seite: 11 breit → Hülle 19 → (200 − 19) ÷ 2 = 90 (abgerundet)
  assert.equal(huelle(v(teil('a', { bezug: 'projekt', relation: 'mitte' }, zyl(11, 11, 8))), 'a').von.x, 100);

  // ---- bei einem Teil (A in der Mitte, B 6 × 6 × 4 → Hülle 14 × 14 × 4) ----
  const B = (relation, abstand) => teil('b', { bezug: 'a', relation, ...(abstand !== undefined ? { abstand } : {}) }, zyl(6, 6, 4));
  const bei = (relation, abstand) => { const r = U.uebersetze(spec([A, B(relation, abstand)])); assert.deepEqual(r.rueckfragen, [], relation); return r.vorgabe; };
  const erwartet = {
    'neben-osten': box(127, 5, 113, 140, 8, 126), 'neben-westen': box(79, 5, 113, 92, 8, 126),
    'neben-norden': box(103, 5, 89, 116, 8, 102), 'neben-sueden': box(103, 5, 137, 116, 8, 150),
    'ecke-nordost': box(127, 5, 89, 140, 8, 102), 'ecke-nordwest': box(79, 5, 89, 92, 8, 102),
    'ecke-suedost': box(127, 5, 137, 140, 8, 150), 'ecke-suedwest': box(79, 5, 137, 92, 8, 150),
    ueber: box(103, 13, 113, 116, 16, 126), unter: box(103, 1, 113, 116, 4, 126),
  };
  for (const [relation, soll] of Object.entries(erwartet)) {
    const vg = bei(relation);
    assert.deepEqual(huelle(vg, 'b'), soll, relation);
    assert.deepEqual(huelle(vg, 'a'), box(101, 5, 111, 118, 12, 128), 'A bleibt wo es ist');
  }
  assert.deepEqual(huelle(bei('neben-osten', 3), 'b'), box(122, 5, 113, 135, 8, 126), 'Abstand statt der Lücke von 8');
  assert.deepEqual(huelle(bei('ueber', 2), 'b'), box(103, 15, 113, 116, 18, 126));
  assert.deepEqual(huelle(bei('unter', 2), 'b'), box(103, -1, 113, 116, 2, 126));

  // ---- Reihenfolge: Bezug zuerst, der Keller („unter“) vor dem Bezug ----
  const nach = (relation) => Object.fromEntries(bei(relation).abschnitte.map((a) => [a.id, a.nach]));
  assert.deepEqual(nach('neben-osten'), { a: [], b: ['a'] });
  assert.deepEqual(nach('ecke-suedwest'), { a: [], b: ['a'] });
  assert.deepEqual(nach('ueber'), { a: [], b: ['a'] });
  assert.deepEqual(nach('unter'), { a: ['b'], b: [] });
  // die Reihenfolge der Teile in der Spezifikation spielt keine Rolle
  const vor = U.uebersetze(spec([A, B('neben-osten')])).vorgabe, rueck = U.uebersetze(spec([B('neben-osten'), A])).vorgabe;
  assert.deepEqual(huelle(vor, 'b'), huelle(rueck, 'b'));
  assert.deepEqual(JSON.stringify(vor.abschnitte.find((a) => a.id === 'b')), JSON.stringify(rueck.abschnitte.find((a) => a.id === 'b')));

  // ---- alle Hüllen überschneiden sich nie, alle liegen im Bauplatz ----
  const viele = spec([A, B('neben-osten'), { ...B('neben-westen'), id: 'c', name: 'C' }, { ...B('ecke-nordost'), id: 'd', name: 'D' }, { ...B('ueber'), id: 'e', name: 'E' }, { ...B('unter'), id: 'f', name: 'F' }]);
  const vg = U.uebersetze(viele).vorgabe;
  for (const x of vg.abschnitte) {
    assert.ok(x.huelle.von.x >= NP.x && x.huelle.bis.x <= NP.x + PLATZ.breite - 1 && x.huelle.von.z >= NP.z && x.huelle.bis.z <= NP.z + PLATZ.tiefe - 1);
    for (const y of vg.abschnitte.filter((z) => z.id < x.id)) {
      const gleich = ['x', 'y', 'z'].every((k) => x.huelle.von[k] <= y.huelle.bis[k] && y.huelle.von[k] <= x.huelle.bis[k]);
      assert.equal(gleich, false, `${x.id} und ${y.id}`);
    }
  }
  // Nullpunkt fehlt: ab (0, 0, 0)
  const ohne = spec([A]);
  delete ohne.projekt.nullpunkt;
  assert.deepEqual(huelle(U.uebersetze(ohne).vorgabe, 'a'), box(91, 0, 91, 108, 7, 108));

  // ---- Rückfragen statt Raten ----
  const frage = (s) => { const r = U.uebersetze(s); assert.equal(r.vorgabe, null); return r.rueckfragen; };
  const e1 = frage(spec([A, { ...A, id: 'b', name: 'B' }]));
  assert.equal(e1.length, 1);
  assert.deepEqual([e1[0].id, e1[0].pfad, e1[0].regel], ['U1', 'teile[1].lage.relation', 'leser.uebersetzung']);
  assert.match(e1[0].frage, /B läge mit seiner Hülle im selben Raum wie „A“/);
  const gross = frage(spec([teil('a', { bezug: 'projekt', relation: 'mitte' }, zyl(300, 20, 8)), teil('b', { bezug: 'projekt', relation: 'ecke-nordwest' })]));
  assert.match(gross[0].frage, /A braucht mit Rand und Technik 308 × 28 × 8 Blöcke und läge bei \(-44, 5, 106\) bis \(263, 12, 133\); das passt nicht auf den Bauplatz \(200 × 60 × 200\)/);
  assert.ok(gross[0].optionen.length >= 3);
  assert.match(frage(spec([teil('a', { bezug: 'projekt', relation: 'ueber' })]))[0].frage, /„ueber“ passt nicht zum Bauplatz\. Auf dem Bauplatz sind nur mitte, ecke-nordwest/);
  assert.match(frage(spec([teil('a', { bezug: 'projekt', relation: 'neben-osten' })]))[0].frage, /passt nicht zum Bauplatz/);
  for (const rel of ['mitte', 'innen']) {
    const f = frage(spec([A, teil('b', { bezug: 'a', relation: rel }, zyl(4, 4, 3))]));
    assert.match(f[0].frage, new RegExp(`B: „${rel}“ lässt sich bei „A“ nicht übersetzen`));
    assert.ok(f[0].optionen.some((o) => o.wert === 'neben-osten'));
  }
  const rand = frage(spec([teil('a', { bezug: 'projekt', relation: 'ecke-nordost', abstand: 0 }), teil('b', { bezug: 'a', relation: 'neben-osten' })]));
  assert.match(rand[0].frage, /B braucht mit Rand und Technik 18 × 18 × 8 .* passt nicht auf den Bauplatz/);
  assert.match(frage({ schema: 1, version: 1, projekt: { name: 'x' }, teile: [] })[0].frage, /kein Projekt mit Bauplatz/);
  assert.match(frage(spec([teil('a', { bezug: 'projekt', relation: 'mitte' }, { baustein: 'form.gibtsnicht', groesse: {} })]))[0].frage, /den Baustein „form\.gibtsnicht“ gibt es nicht/);
  assert.match(frage(spec([teil('a', { bezug: 'projekt', relation: 'mitte' }, { baustein: 'form.zylinder', groesse: { breite: 9999 } })]))[0].pfad, /form\.groesse/);
  // Bezug im Kreis
  assert.match(frage(spec([teil('a', { bezug: 'b', relation: 'neben-osten' }), teil('b', { bezug: 'a', relation: 'neben-osten' })]))[0].frage, /führen nicht auf den Bauplatz zurück/);

  // ---- Proportion und Größe ----
  const prop = (form) => U.uebersetze(spec([teil('a', { bezug: 'projekt', relation: 'mitte' }, form)]));
  const abgeleitet = prop({ baustein: 'form.zylinder', groesse: { breite: 10, tiefe: 10 }, proportionen: { hoehe_zu_breite: 2.5 } });
  assert.deepEqual(abgeleitet.vorgabe.abschnitte[0].formen[0].parameter, { breite: 10, tiefe: 10, hoehe: 25 }, 'die Höhe folgt aus Breite × Proportion');
  assert.deepEqual(abgeleitet.vorgabe.abschnitte[0].formen[0].soll, { symmetrie: ['x', 'z'], verhaeltnis: { hoehe_zu_breite: 2.5, toleranz: 3.75 } }); // 15 % der Höhe
  assert.equal(huelle(abgeleitet.vorgabe, 'a').bis.y - huelle(abgeleitet.vorgabe, 'a').von.y + 1, 25);
  assert.deepEqual(prop({ baustein: 'form.zylinder', groesse: { breite: 10, tiefe: 10, hoehe: 27 }, proportionen: { hoehe_zu_breite: 2.5 } }).rueckfragen, [], 'innerhalb von 15 % gilt die Angabe');
  const widerspruch = prop({ baustein: 'form.zylinder', groesse: { breite: 10, tiefe: 10, hoehe: 40 }, proportionen: { hoehe_zu_breite: 2.5 } }).rueckfragen;
  assert.match(widerspruch[0].frage, /Höhe 40 bei Breite 10 widerspricht der Proportion Höhe zu Breite 2,5 \(ergäbe 25\)/);
  assert.equal(widerspruch[0].optionen[1].wert, 25);
  assert.match(prop({ baustein: 'form.zylinder', groesse: { breite: 10, tiefe: 10 }, proportionen: { hoehe_zu_breite: 99 } }).rueckfragen[0].frage, /ergibt bei Breite 10 die Höhe 990; möglich sind 1 bis 512/);
  assert.equal(prop({ baustein: 'form.satteldach', groesse: { breite: 11, laenge: 11 } }).vorgabe.abschnitte[0].formen[0].soll, undefined, 'eckige Formen ohne Symmetrie-Vorgabe');
  assert.deepEqual(prop({ baustein: 'form.kuppel', groesse: { breite: 11, tiefe: 11 } }).vorgabe.abschnitte[0].formen[0].soll, { symmetrie: ['x', 'z'] });

  // ---- Funktionen, Technikstreifen, Stil ----
  const mind = e3.techniker.mindestmass([{ id: 'x', art: 'handelsnischen', anzahl: 3 }]);
  assert.deepEqual(mind, { breite: 7, tiefe: 5, hoehe: 5 });
  const mitTechnik = (extra = {}) => U.uebersetze(spec([teil('a', { bezug: 'projekt', relation: 'mitte' }, zyl(10, 10, 8), { funktionen: [{ art: 'handelsnischen', menge: 3, beruf: 2 }, { art: 'bruteranlage' }], stil: { stimmung: 'glanz' }, ...extra })]));
  const t = mitTechnik();
  assert.deepEqual(t.rueckfragen, []);
  const ab = t.vorgabe.abschnitte[0];
  assert.equal(ab.huelle.bis.x - ab.huelle.von.x + 1, 26, 'Form 10 + Technik 7 + Rand 8 + Reserve 1');
  assert.deepEqual([ab.huelle.bis.z - ab.huelle.von.z + 1, ab.huelle.bis.y - ab.huelle.von.y + 1], [18, 8]);
  assert.deepEqual(ab.zonen, [{ funktion: 'technik', anteil: 27 }, { funktion: 'optik', anteil: 73 }]);
  assert.deepEqual(ab.bedarf, [{ art: 'handelsnischen', anzahl: 3, beruf: 2 }, { art: 'bruteranlage' }]);
  assert.equal(ab.stimmung, 'glanz');
  assert.equal(t.vorgabe.stimmung, 'glanz');
  assert.deepEqual(U.uebersetze(spec([teil('a', { bezug: 'projekt', relation: 'mitte' }, zyl(10, 10, 8), { funktionen: [{ art: 'lager', sorten: ['minecraft:dirt', 'minecraft:stone'] }] })])).vorgabe.abschnitte[0].bedarf, [{ art: 'lager', sorten: ['minecraft:dirt', 'minecraft:stone'] }]);
  // der Technikstreifen liegt auf der Seite, an der keine Verbindung abgeht
  const mitGang = U.uebersetze(spec([
    teil('a', { bezug: 'projekt', relation: 'mitte' }, zyl(10, 10, 8), { funktionen: [{ art: 'handelsnischen', menge: 3 }] }),
    teil('b', { bezug: 'a', relation: 'neben-westen' }, zyl(6, 6, 4)),
  ].map((x, i) => (i === 0 ? { ...x, verbindungen: [{ mit: 'b', art: 'gang' }] } : x)))).vorgabe;
  assert.deepEqual(mitGang.abschnitte.find((x) => x.id === 'a').zonen.map((z) => z.funktion), ['optik', 'technik'], 'die Verbindung geht nach Westen, also steht die Technik im Osten');
  // Gesamtstimmung: die häufigste, bei Gleichstand die alphabetisch erste
  const st = (a, b) => U.uebersetze(spec([teil('a', { bezug: 'projekt', relation: 'mitte' }, zyl(4, 4, 3), { stil: { stimmung: a } }), teil('b', { bezug: 'a', relation: 'neben-osten' }, zyl(4, 4, 3), { stil: { stimmung: b } })])).vorgabe.stimmung;
  assert.equal(st('glanz', 'hell-nordisch'), 'glanz');
  assert.equal(st('hell-nordisch', 'hell-nordisch'), 'hell-nordisch');
  assert.equal(U.uebersetze(spec([A])).vorgabe.stimmung, undefined);

  // ---- Verbindungen ----
  const verb = (lage, extra = {}) => U.uebersetze(spec([{ ...A, verbindungen: [{ mit: 'b', art: 'gang' }] }, teil('b', lage, zyl(6, 6, 4), extra)]));
  assert.deepEqual(verb({ bezug: 'a', relation: 'neben-osten' }).vorgabe.abschnitte.find((x) => x.id === 'a').verbindungen, [{ von: { x: 118, y: 5, z: 119 }, nach: { x: 127, y: 5, z: 119 }, art: 'gang' }]);
  assert.deepEqual(verb({ bezug: 'a', relation: 'neben-norden' }).vorgabe.abschnitte.find((x) => x.id === 'a').verbindungen, [{ von: { x: 109, y: 5, z: 111 }, nach: { x: 109, y: 5, z: 102 }, art: 'gang' }]);
  assert.match(verb({ bezug: 'a', relation: 'ecke-nordost' }).rueckfragen[0].frage, /liegen nicht auf einer Linie/);
  assert.match(verb({ bezug: 'a', relation: 'ueber' }).rueckfragen[0].frage, /stehen auf verschiedener Höhe \(5 und 13\)/);
  assert.match(verb({ bezug: 'a', relation: 'unter' }).rueckfragen[0].frage, /verschiedener Höhe/);
  // beide Teile nennen dieselbe Verbindung: sie wird nur einmal gelegt
  const doppelt = U.uebersetze(spec([{ ...A, verbindungen: [{ mit: 'b', art: 'gang' }] }, { ...B('neben-osten'), verbindungen: [{ mit: 'a', art: 'gang' }] }])).vorgabe;
  assert.equal(doppelt.abschnitte.flatMap((x) => x.verbindungen ?? []).length, 1);
  // Schienenwege genauso
  assert.equal(U.uebersetze(spec([{ ...A, verbindungen: [{ mit: 'b', art: 'schiene' }] }, B('neben-osten')])).vorgabe.abschnitte[0].verbindungen[0].art, 'schiene');

  // ---- deterministisch ----
  assert.equal(JSON.stringify(U.uebersetze(viele)), JSON.stringify(U.uebersetze(structuredClone(viele))));
  assert.equal(U.uebersetze(viele).hinweise.length, 6);
});

test('Übersetzung: Vergleich zweier Fassungen', () => {
  const B = (relation) => teil('b', { bezug: 'a', relation }, zyl(6, 6, 4));
  const C = teil('c', { bezug: 'b', relation: 'neben-sueden' }, zyl(4, 4, 3));
  const alt = U.uebersetze(spec([A, B('neben-osten'), C])).vorgabe;
  const gleich = U.vergleicheVorgaben(alt, U.uebersetze(spec([A, B('neben-osten'), C])).vorgabe);
  assert.deepEqual(gleich, { neu: [], entfernt: [], geaendert: [], betroffen: [] });
  // B ändert die Lage: B ist geändert, C hängt von B ab und ist deshalb betroffen (und weil es mitwandert, auch geändert)
  const lage = U.vergleicheVorgaben(alt, U.uebersetze(spec([A, B('neben-westen'), C])).vorgabe);
  assert.deepEqual(lage.geaendert, ['b', 'c']);
  assert.deepEqual(lage.betroffen, ['b', 'c']);
  // A bekommt eine andere Höhe: A ist geändert, B und C hängen ab → betroffen, ihre Hüllen bleiben aber gleich
  const hoch = U.vergleicheVorgaben(alt, U.uebersetze(spec([teil('a', { bezug: 'projekt', relation: 'mitte' }, zyl(10, 10, 9)), B('neben-osten'), C])).vorgabe);
  assert.deepEqual(hoch.geaendert, ['a']);
  assert.deepEqual(hoch.betroffen, ['a', 'b', 'c']);
  // neu und entfernt
  const D = teil('d', { bezug: 'a', relation: 'neben-sueden' }, zyl(4, 4, 3));
  const neu = U.vergleicheVorgaben(alt, U.uebersetze(spec([A, B('neben-osten'), C, D])).vorgabe);
  assert.deepEqual([neu.neu, neu.betroffen, neu.entfernt], [['d'], ['d'], []]);
  const weg = U.vergleicheVorgaben(alt, U.uebersetze(spec([A, B('neben-osten')])).vorgabe);
  assert.deepEqual([weg.entfernt, weg.geaendert], [['c'], []]);
});

test('Übersetzung: strahlenförmige Lage (acht Richtungen, mittig auf dem Strahl, Lücke eingehalten)', () => {
  const B = (relation, abstand) => teil('b', { bezug: 'a', relation, ...(abstand !== undefined ? { abstand } : {}) }, zyl(6, 6, 4)); // Hülle 14 × 14 × 4
  const strahl = (richtung, abstand) => { const r = U.uebersetze(spec([A, B(`strahl-${richtung}`, abstand)])); assert.deepEqual(r.rueckfragen, [], richtung); return huelle(r.vorgabe, 'b'); };
  const a = huelle(U.uebersetze(spec([A])).vorgabe, 'a'); // 101..118, 111..128
  const frei = (h, g) => Math.max(h.von.x - a.bis.x - 1, a.von.x - h.bis.x - 1, h.von.z - a.bis.z - 1, a.von.z - h.bis.z - 1) >= g;
  const mitten = (h) => [(h.von.x + h.bis.x) / 2, (h.von.z + h.bis.z) / 2];
  const am = mitten(a), richtungen = { norden: [0, -1], nordost: [1, -1], osten: [1, 0], suedost: [1, 1], sueden: [0, 1], suedwest: [-1, 1], westen: [-1, 0], nordwest: [-1, -1] };
  // gerade Richtungen = „neben“ (gleiche Lücke, mittig)
  for (const [s, n] of [['norden', 'neben-norden'], ['osten', 'neben-osten'], ['sueden', 'neben-sueden'], ['westen', 'neben-westen']]) {
    assert.deepEqual(strahl(s), huelle(U.uebersetze(spec([A, B(n)])).vorgabe, 'b'), `${s} wie ${n}`);
  }
  for (const g of [8, 3, 0]) {
    const h = {};
    for (const [r, [dx, dz]] of Object.entries(richtungen)) {
      h[r] = strahl(r, g);
      assert.ok(frei(h[r], g), `${r}: Lücke ${g} frei`);
      assert.equal(h[r].von.y, a.von.y, 'gleiche Bodenhöhe');
      // Mitte liegt auf dem Strahl (höchstens ein halber Block daneben durch die Rundung)
      const [mx, mz] = mitten(h[r]), vx = mx - am[0], vz = mz - am[1], n = Math.hypot(dx, dz);
      const quer = Math.abs(vx * (dz / n) - vz * (dx / n));
      assert.ok(quer <= 1, `${r}: ${quer} neben dem Strahl`);
      assert.ok(vx * dx + vz * dz > 0, `${r}: in der richtigen Richtung`);
    }
    // Gegenrichtungen spiegeln sich an der Mitte des Bezugs (bis auf Rundung)
    for (const [r1, r2] of [['norden', 'sueden'], ['osten', 'westen'], ['nordost', 'suedwest'], ['nordwest', 'suedost']]) {
      const m1 = mitten(h[r1]), m2 = mitten(h[r2]);
      assert.ok(Math.abs(m1[0] + m2[0] - 2 * am[0]) <= 1 && Math.abs(m1[1] + m2[1] - 2 * am[1]) <= 1, `${r1}/${r2} symmetrisch`);
    }
    // so nah wie möglich: ein Block weiter innen wäre nicht mehr frei (Strahlenabstand um 1 verkleinert)
    for (const r of Object.keys(richtungen)) {
      const [dx, dz] = richtungen[r], n = Math.hypot(dx, dz), [mx, mz] = mitten(h[r]);
      const s = Math.hypot(mx - am[0], mz - am[1]);
      const px = Math.round(am[0] + (dx / n) * (s - 1) - 6.5), pz = Math.round(am[1] + (dz / n) * (s - 1) - 6.5);
      assert.ok(!frei({ von: { x: px, z: pz }, bis: { x: px + 13, z: pz + 13 } }, g), `${r} g=${g}: nicht näher möglich`);
    }
  }
  // Rückfrage statt Raten: auf dem Bauplatz gibt es keinen Strahl; unbekannte Richtung wird von Prüfer/Übersetzung abgelehnt
  const r = U.uebersetze(spec([teil('a', { bezug: 'projekt', relation: 'strahl-norden' })]));
  assert.equal(r.rueckfragen.length, 1);
  assert.match(r.rueckfragen[0].frage, /passt nicht zum Bauplatz/);
  const x = U.uebersetze(spec([A, B('strahl-oben')]));
  assert.equal(x.rueckfragen.length, 1);
  // deterministisch
  assert.deepEqual(strahl('suedost', 5), strahl('suedost', 5));
});

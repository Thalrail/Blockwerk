// U3: Einzelblockänderungen bearbeiten – Aktion → Operation → Planfassung → Plan (src/ebene5/bearbeiten.js), mit der echten Engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './hilfe5.js';
import { VARIANTEN, hausSpezifikation } from '../../tools/haus-sonde.js';
import { bauePlan } from '../../src/ebene5/bauen.js';
import * as PF from '../../src/ebene5/planfassung.js';
import * as B from '../../src/ebene5/bearbeiten.js';
import { bloeckeInWelt } from '../../src/ebene2/zellen.js';

const spez = (mit = { treppe: 1, tuerInWand: 1, fensterTeil: 1 }, v = 0) => hausSpezifikation(Object.values(VARIANTEN)[v], mit);
const OSTEN = (r) => ({ 'minecraft:cardinal_direction': r });

test('spielerName: nie leer, höchstens 24 Zeichen, keine Steuerzeichen (sonst verwirft pruefeForm die ganze Planfassung beim Laden)', () => {
  assert.equal(B.spielerName(''), 'Spieler');
  assert.equal(B.spielerName(undefined), 'Spieler');
  assert.equal(B.spielerName('   \n\t '), 'Spieler');
  assert.equal(B.spielerName('  Jonah  '), 'Jonah');
  assert.equal(B.spielerName('a'.repeat(40)).length, 24);
  assert.equal(B.spielerName('x'.repeat(23) + ' y'), 'x'.repeat(23), 'abgeschnittenes Leerzeichen am Ende entfällt');
  assert.equal(B.spielerName('Jo\u0000na\nh'), 'Jo na h');
  for (const n of ['', 'a'.repeat(99), '\u0007', 'Jonah']) { // jede erzeugte Form besteht die Prüfung der Planfassung
    const r = B.anwenden(PF.leer(), { teil: 'x', zelle: { x: 0, y: 0, z: 0 }, erwartet: null, neu: { op: 'leere' } }, n);
    assert.doesNotThrow(() => PF.pruefeForm(JSON.parse(JSON.stringify(r.planfassung))));
  }
});

test('Blocksuche und Zustände: nur Registerblöcke, Luft nie, Richtungszustände sind Pflicht', async () => {
  const e = await engine();
  const s = B.blockSuche(e.ebene0, 'glass');
  assert.ok(s.length > 1 && s.every((x) => x.id.includes('glass')));
  assert.equal(s[0].name.startsWith('glass'), true, 'Anfang des Namens zuerst');
  assert.deepEqual(B.blockSuche(e.ebene0, ''), []);
  assert.equal(B.blockSuche(e.ebene0, 'air', 1000).some((x) => x.id === 'minecraft:air'), false, 'Luft ist nicht wählbar (auch wenn der Suchtext darin vorkommt)');
  assert.deepEqual(B.blockSuche(e.ebene0, 'gibtsnicht'), []);
  assert.ok(B.blockSuche(e.ebene0, ' Oak Stairs ').some((x) => x.id === 'minecraft:oak_stairs'));
  assert.ok(B.blockSuche(e.ebene0, 'stone', 5).length <= 5);
  const glas = B.blockInfo(e.ebene0, 'minecraft:glass');
  assert.deepEqual(glas.zustaende, []);
  const ofen = B.blockInfo(e.ebene0, 'minecraft:furnace');
  assert.deepEqual(ofen.zustaende.map((z) => [z.name, z.pflicht]), [['minecraft:cardinal_direction', true]]);
  assert.ok(ofen.zustaende[0].werte.includes(ofen.zustaende[0].vorschlag));
  const treppe = B.blockInfo(e.ebene0, 'minecraft:oak_stairs');
  assert.equal(treppe.zustaende.find((z) => z.name === 'weirdo_direction').pflicht, true);
  assert.equal(treppe.zustaende.find((z) => z.name === 'upside_down_bit').pflicht, false);
  assert.throws(() => B.blockInfo(e.ebene0, 'minecraft:air'), B.BearbeitenFehler);
  assert.throws(() => B.blockInfo(e.ebene0, 'minecraft:gibtsnicht'), B.BearbeitenFehler);
});

test('Block prüfen: unbekannt, Luft, ungültiger Wert und fehlender Richtungszustand werden mit klarer Meldung abgelehnt', async () => {
  const e = await engine();
  assert.throws(() => B.blockImRahmen(e.ebene0, { id: 'minecraft:gibtsnicht' }, 0), /kein Block/);
  assert.throws(() => B.blockImRahmen(e.ebene0, { id: 'minecraft:air' }, 0), /Block entfernen/);
  assert.throws(() => B.blockImRahmen(e.ebene0, undefined, 0), B.BearbeitenFehler);
  assert.throws(() => B.blockImRahmen(e.ebene0, { id: 'minecraft:furnace', zustand: OSTEN('oben') }, 0), /nicht erlaubt/);
  assert.throws(() => B.blockImRahmen(e.ebene0, { id: 'minecraft:glass', zustand: { unsinn: 1 } }, 0), /keinen Zustand/);
  for (const d of [0, 1, 2, 3]) assert.throws(() => B.blockImRahmen(e.ebene0, { id: 'minecraft:furnace' }, d), /cardinal_direction/, `fehlende Richtung gilt unabhängig von der Drehung des Teils (${d})`);
  assert.deepEqual(B.blockImRahmen(e.ebene0, { id: 'minecraft:glass' }, 3), { id: 'minecraft:glass' });
});

test('Drehung: die Richtung, die die Benutzerin in der Welt wählt, kommt nach dem Zusammenbau in jeder Teildrehung genau so in der Welt an (Rahmen ↔ Welt)', async () => {
  const e = await engine();
  const faelle = [
    ['minecraft:furnace', 'minecraft:cardinal_direction', ['north', 'east', 'south', 'west']],
    ['minecraft:oak_stairs', 'weirdo_direction', [0, 1, 2, 3]],
    ['minecraft:oak_log', 'pillar_axis', ['x', 'z', 'y']],
  ];
  for (const [id, art, werte] of faelle) for (let d = 0; d < 4; d++) for (const w of werte) {
    const zustand = { [art]: w };
    const rahmen = B.blockImRahmen(e.ebene0, { id, zustand }, d);
    const [welt] = bloeckeInWelt(e.ebene0, [{ id: rahmen.id, zustand: rahmen.zustand ?? {}, x: 0, y: 0, z: 0 }], { x: 5, y: 7, z: -3, drehung: d });
    assert.deepEqual(welt.zustand[art], w, `${id} ${art}=${w} bei Drehung ${d}`);
  }
});

test('Ring über den Plan (alle Varianten, alle Teildrehungen): ändern, entfernen, zurücknehmen wirken genau an der angeklickten Weltzelle, mit der gewählten Richtung', async () => {
  const e = await engine();
  const gesehen = new Set();
  let blockZellen = 0;
  const faelle = [[0, { treppe: 1, tuerInWand: 1, fensterTeil: 1 }, null, null], [1, { tuer: 1, fenster: 1, treppe: 1 }, null, null]];
  for (const o of ['osten', 'sueden', 'westen']) faelle.push([0, { treppe: 1 }, o, 'treppe']); // die Treppe ausdrücklich gedreht: Teildrehung 1, 2 und 3
  for (const [v, mit, ausrichtung, nurTeil] of faelle) {
    const sp = spez(mit, v);
    if (ausrichtung) sp.teile.find((t) => t.id === 'treppe').lage.ausrichtung = ausrichtung;
    const frei = e.ebene4.freigeben(sp, 'test');
    const r = bauePlan(e, frei);
    assert.equal(r.status, 'fertig');
    const plan = e.e5.bauplan(r.entwurf), mat = e.ebene3.materialisiere(r.entwurf);
    const proTeil = new Map();
    for (const a of plan.abschnitte) for (const s of a.schichten) for (let i = 0; i < s.n; i++) {
      const t = a.teile[s.p[i]].ref; if (!proTeil.has(t)) proTeil.set(t, []); proTeil.get(t).push({ x: s.x[i], y: s.y, z: s.z[i] });
    }
    for (const [ref, zellen] of proTeil) if (!nurTeil || ref === nurTeil) for (const welt of [zellen[0], zellen[zellen.length >> 1], zellen[zellen.length - 1]]) {
      const wahl = e.ebene3.zellenwahl.waehle(r.entwurf, welt, { mat });
      const auswahl = B.auswahlAus(wahl, PF.leer());
      assert.equal(auswahl.waehlbar, true);
      assert.equal(auswahl.teil, ref);
      gesehen.add(auswahl.drehung);
      assert.deepEqual(B.moeglicheAktionen(auswahl), ['aendern', 'entfernen']);
      // ändern: Ofen mit gewählter Richtung
      for (const richtung of ['north', 'south', 'west']) {
        const op = B.operation(e.ebene0, auswahl, 'aendern', { id: 'minecraft:furnace', zustand: OSTEN(richtung) });
        const a1 = B.anwenden(PF.leer(), op, 'Jonah');
        assert.equal(a1.geaendert, true);
        const r2 = bauePlan(e, frei, [], a1.planfassung), m2 = e.ebene3.materialisiere(r2.entwurf);
        assert.equal(e.e5.bauplan(r2.entwurf).aenderungen[0].status, 'angewandt', `${ref} ${JSON.stringify(welt)}`);
        const b = m2.welt.leseBlock(welt.x, welt.y, welt.z);
        assert.equal(b.id, 'minecraft:furnace');
        assert.equal(b.zustand['minecraft:cardinal_direction'], richtung, `Richtung in der Welt (Teildrehung ${auswahl.drehung})`);
        blockZellen++;
        // zurücknehmen: danach ist der Plan wieder wie vorher (Zelle zeigt den alten Block)
        const sel2 = B.auswahlAus(e.ebene3.zellenwahl.waehle(r2.entwurf, welt, { mat: m2 }), a1.planfassung);
        assert.deepEqual(B.moeglicheAktionen(sel2).includes('zuruecknehmen'), true);
        const a2 = B.anwenden(a1.planfassung, B.operation(e.ebene0, sel2, 'zuruecknehmen'), 'Jonah');
        assert.deepEqual(a2.planfassung.eintraege, {});
        const r3 = bauePlan(e, frei, [], a2.planfassung), m3 = e.ebene3.materialisiere(r3.entwurf);
        assert.deepEqual(m3.welt.leseBlock(welt.x, welt.y, welt.z), mat.welt.leseBlock(welt.x, welt.y, welt.z));
      }
      // entfernen
      const aus = B.anwenden(PF.leer(), B.operation(e.ebene0, auswahl, 'entfernen'), 'Jonah');
      const r4 = bauePlan(e, frei, [], aus.planfassung), m4 = e.ebene3.materialisiere(r4.entwurf);
      assert.equal(m4.welt.istLuft(welt.x, welt.y, welt.z), true);
      assert.equal(e.e5.bauplan(r4.entwurf).aenderungen[0].status, 'angewandt');
    }
  }
  assert.deepEqual([...gesehen].sort(), [0, 1, 2, 3], 'alle vier Teildrehungen kamen vor');
  assert.ok(blockZellen > 30);
});

test('Erwartung stammt aus dem Stand der Auswahl: hat jemand die Zelle inzwischen geändert, ist es ein Konflikt, und nichts wird überschrieben', async () => {
  const e = await engine();
  const frei = e.ebene4.freigeben(spez(), 'test');
  const r = bauePlan(e, frei), mat = e.ebene3.materialisiere(r.entwurf);
  const plan = e.e5.bauplan(r.entwurf), s = plan.abschnitte[0].schichten[0];
  const welt = { x: s.x[0], y: s.y, z: s.z[0] };
  const auswahl = B.auswahlAus(e.ebene3.zellenwahl.waehle(r.entwurf, welt, { mat }), PF.leer());
  assert.equal(auswahl.erwartet, null);
  // Mitspielerin Anna ändert dieselbe Zelle, bevor Jonah klickt
  const anna = B.anwenden(PF.leer(), B.operation(e.ebene0, auswahl, 'aendern', { id: 'minecraft:glass' }), 'Anna').planfassung;
  const jonah = B.operation(e.ebene0, auswahl, 'aendern', { id: 'minecraft:stone' }); // erwartet noch null
  assert.equal(jonah.erwartet, null);
  const k = B.anwenden(anna, jonah, 'Jonah');
  assert.equal(k.geaendert, false);
  assert.deepEqual(k.planfassung, anna, 'Annas Stand bleibt unverändert');
  assert.equal(k.konflikt.aktuell.block.id, 'minecraft:glass');
  assert.equal(k.konflikt.aktuell.von, 'Anna');
  assert.deepEqual(k.konflikt.vorschlag.block, { id: 'minecraft:stone' });
  // eine zweite Auswahl mit dem neuen Stand erwartet Annas Eintrag und überschreibt ihn bewusst
  const neu = B.auswahlAus(e.ebene3.zellenwahl.waehle(bauePlan(e, frei, [], anna).entwurf, welt), anna);
  assert.deepEqual(neu.erwartet, { op: 'setze', block: { id: 'minecraft:glass' } });
  assert.equal(B.anwenden(anna, B.operation(e.ebene0, neu, 'aendern', { id: 'minecraft:stone' }), 'Jonah').geaendert, true);
  // Wiederholung derselben Operation schadet nie
  const doppelt = B.anwenden(anna, B.operation(e.ebene0, neu, 'zuruecknehmen'), 'Jonah');
  assert.deepEqual(doppelt.planfassung.eintraege, {});
});

test('Aktionen: was nicht geht, wird mit Meldung abgelehnt (keine Änderung zum Zurücknehmen, kein Block zum Entfernen, kein Teil)', async () => {
  const e = await engine();
  const frei = e.ebene4.freigeben(spez(), 'test');
  const r = bauePlan(e, frei), mat = e.ebene3.materialisiere(r.entwurf);
  const huelle = r.entwurf.abschnitte.find((a) => a.id === 'erdgeschoss').huelle;
  const innen = { x: Math.floor((huelle.von.x + huelle.bis.x) / 2), y: huelle.von.y + 1, z: Math.floor((huelle.von.z + huelle.bis.z) / 2) };
  const leereZelle = B.auswahlAus(e.ebene3.zellenwahl.waehle(r.entwurf, innen, { mat }), PF.leer());
  assert.equal(leereZelle.waehlbar, true);
  assert.equal(leereZelle.besitzt, false);
  assert.deepEqual(B.moeglicheAktionen(leereZelle), ['aendern'], 'in der leeren Zelle gibt es nur „Block setzen“');
  assert.throws(() => B.operation(e.ebene0, leereZelle, 'entfernen'), /kein Block/);
  assert.throws(() => B.operation(e.ebene0, leereZelle, 'zuruecknehmen'), /keine Änderung/);
  assert.throws(() => B.operation(e.ebene0, leereZelle, 'aendern', undefined), B.BearbeitenFehler);
  assert.throws(() => B.operation(e.ebene0, leereZelle, 'zerstoeren'), /Unbekannte Aktion/);
  // setze in die leere Zelle ist eine gültige Änderung des gewählten Teils
  const a = B.anwenden(PF.leer(), B.operation(e.ebene0, leereZelle, 'aendern', { id: 'minecraft:glowstone' }), 'Jonah');
  const m2 = e.ebene3.materialisiere(bauePlan(e, frei, [], a.planfassung).entwurf);
  assert.equal(m2.welt.leseBlock(innen.x, innen.y, innen.z).id, 'minecraft:glowstone');
  // außerhalb jedes Teils
  const draussen = B.auswahlAus(e.ebene3.zellenwahl.waehle(r.entwurf, { x: 9999, y: 1, z: 9999 }, { mat }), PF.leer());
  assert.equal(draussen.waehlbar, false);
  assert.match(draussen.hinweis, /keinem Teil/);
  assert.deepEqual(B.moeglicheAktionen(draussen), []);
  assert.throws(() => B.operation(e.ebene0, draussen, 'aendern', { id: 'minecraft:glass' }), /keinem Teil/);
  assert.equal(B.auswahlAus(null, PF.leer()).waehlbar, false);
});

test('Schon entfernter Block: „entfernen“ ist nicht noch einmal möglich, „zurücknehmen“ schon', async () => {
  const e = await engine();
  const frei = e.ebene4.freigeben(spez(), 'test');
  const r = bauePlan(e, frei), mat = e.ebene3.materialisiere(r.entwurf), s = e.e5.bauplan(r.entwurf).abschnitte[0].schichten[0];
  const welt = { x: s.x[0], y: s.y, z: s.z[0] };
  const sel = B.auswahlAus(e.ebene3.zellenwahl.waehle(r.entwurf, welt, { mat }), PF.leer());
  const pf = B.anwenden(PF.leer(), B.operation(e.ebene0, sel, 'entfernen'), 'Jonah').planfassung;
  const r2 = bauePlan(e, frei, [], pf);
  const sel2 = B.auswahlAus(e.ebene3.zellenwahl.waehle(r2.entwurf, welt), pf);
  assert.deepEqual(sel2.erwartet, { op: 'leere' });
  assert.equal(sel2.aenderung.status, 'angewandt');
  assert.deepEqual(B.moeglicheAktionen(sel2).includes('entfernen'), false);
  assert.throws(() => B.operation(e.ebene0, sel2, 'entfernen'), /schon entfernt|kein Block/);
  assert.deepEqual(B.operation(e.ebene0, sel2, 'zuruecknehmen').neu, null);
  // Absicherung: auch wenn die Auswahl widersprüchlich wäre (Block noch da, Änderung schon „entfernt“), wird nichts doppelt entfernt
  const widerspruch = { ...sel2, besitzt: true, block: { id: 'minecraft:stone', zustand: {} } };
  assert.equal(B.moeglicheAktionen(widerspruch).includes('entfernen'), false);
  assert.throws(() => B.operation(e.ebene0, widerspruch, 'entfernen'), /schon entfernt/);
});

test('Hilfen: Beschreibung und Vergleich der Einträge (die Versionsnummer allein zählt nicht)', () => {
  const a = PF.wende(PF.leer(), [{ teil: 't', zelle: { x: 1, y: 2, z: 3 }, erwartet: null, neu: { op: 'leere' } }], 'A').planfassung;
  const zurueck = PF.wende(a, [{ teil: 't', zelle: { x: 1, y: 2, z: 3 }, erwartet: { op: 'leere' }, neu: null }], 'A').planfassung;
  assert.equal(B.beschreibung(PF.leer()), '0 Änderungen, Fassung 0');
  assert.equal(B.beschreibung(a), '1 Änderung, Fassung 1');
  assert.equal(B.gleicheEintraege(zurueck, PF.leer()), true, 'Fassung 2, aber derselbe Inhalt wie leer');
  assert.equal(B.gleicheEintraege(a, PF.leer()), false);
  assert.equal(B.gleicheEintraege(null, PF.leer()), true);
});

test('Probleme nach einer Änderung: eine nicht anwendbare Änderung wird erkannt (die Oberfläche nimmt sie zurück), eine gute und schon vorhandene Probleme nicht', async () => {
  const e = await engine();
  const frei = e.ebene4.freigeben(spez(), 'test');
  const daten = (pf) => { const r = bauePlan(e, frei, [], pf); return { plan: e.e5.bauplan(r.entwurf), rueckfragenOffen: r.rueckfragen, status: r.status }; };
  const gut = daten(null);
  assert.deepEqual(B.offeneAenderungen(gut), []);
  const verwaist = PF.wende(PF.leer(), [{ teil: 'gibtsnicht', zelle: { x: 1, y: 1, z: 1 }, erwartet: null, neu: { op: 'leere' } }], 'T').planfassung;
  const schlecht = daten(verwaist);
  assert.equal(schlecht.status, 'wartet', 'der Plan wartet auf eine Entscheidung (Regel plan.aenderung), er ist trotzdem vollständig');
  assert.equal(B.offeneAenderungen(schlecht).length, 1);
  assert.match(B.neueProbleme(schlecht, gut), /das Teil gibt es nicht mehr/);
  assert.equal(B.neueProbleme(gut, gut), null);
  assert.equal(B.neueProbleme(schlecht, schlecht), null, 'ein schon vorhandenes Problem ist keine Folge der letzten Änderung');
});

test('Lokale Änderungen in einen leeren Raum übertragen: operationenAus gibt für jeden Eintrag eine Operation, die auf der leeren Planfassung genau denselben Inhalt ergibt', () => {
  let pf = PF.leer();
  const zellen = [['a', 1, 2, 3, { op: 'leere' }], ['b', 0, 0, 0, { op: 'setze', block: { id: 'minecraft:stone' } }], ['a', 9, 9, 9, { op: 'setze', block: { id: 'minecraft:furnace', zustand: { 'minecraft:cardinal_direction': 'north' } } }]];
  for (const [teil, x, y, z, neu] of zellen) pf = PF.wende(pf, [{ teil, zelle: { x, y, z }, erwartet: null, neu }], 'Anna').planfassung;
  const ops = B.operationenAus(pf);
  assert.equal(ops.length, 3);
  assert.ok(ops.every((o) => o.erwartet === null));
  const neu = PF.wende(PF.leer(), ops, 'Anna');
  assert.deepEqual(neu.konflikte, []);
  assert.deepEqual(neu.planfassung.eintraege, pf.eintraege);
  assert.deepEqual(B.operationenAus(PF.leer()), []);
});

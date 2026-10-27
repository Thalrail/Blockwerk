import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const PA = e1.passagiere;
const B = e1.bewegung;
const STEIN = 'minecraft:stone';
const LORE = 'minecraft:minecart';
const DORF = 'minecraft:villager_v2';
const AKT = 'minecraft:activator_rail';
const YAW = { south: 0, west: 90, north: 180, east: 270 };
const FALLTUER = (offen) => ({ open_bit: offen, upside_down_bit: false, direction: 0 });

/** Steinboden bei y = 0 von −6 bis 6. */
function boden(r = 6) {
  const w = e0.neueWelt();
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) w.setzeBlock(x, 0, z, STEIN);
  return w;
}
/** Aktivierungsschiene bei (0, 1, 0) mit Lore (Fahrtrichtung `r`) und Dorfbewohner als Passagier. */
function aufbau(r = 'east', { aktiv = true, baby = false } = {}) {
  const w = boden();
  w.setzeBlock(0, 1, 0, AKT, { rail_direction: r === 'east' || r === 'west' ? 1 : 0, rail_data_bit: aktiv });
  const lore = w.fuegeWesenHinzu({ id: LORE, x: 0.5, y: 1, z: 0.5, yaw: YAW[r] });
  const dorf = w.fuegeWesenHinzu({ id: DORF, x: 0.5, y: 1, z: 0.5, ...(baby ? { baby: true } : {}), sitztIn: lore });
  return { w, lore, dorf };
}
const sperre = (w, x, z) => { w.setzeBlock(x, 1, z, STEIN); }; // Vollblock in Fußhöhe: kein Platz
const RECHTS = { east: [0, 1], south: [-1, 0], west: [0, -1], north: [1, 0] };
const LINKS = { east: [0, -1], south: [1, 0], west: [0, 1], north: [-1, 0] };
const VORN = { east: [1, 0], south: [0, 1], west: [-1, 0], north: [0, -1] };

test('Passagiere: Auswurf in der Reihenfolge der Austrittszellen', () => {
  assert.deepEqual(PA.reihenfolge, ['rechts', 'links', 'hinten-rechts', 'hinten-links', 'vorn-rechts', 'vorn-links', 'hinten', 'vorn', 'oben', 'unten']);
  for (const r of ['north', 'east', 'south', 'west']) {
    const { w, lore } = aufbau(r);
    const [rx, rz] = RECHTS[r], [lx, lz] = LINKS[r], [vx, vz] = VORN[r];
    const zelle = (kandidat) => ({
      rechts: [rx, rz], links: [lx, lz], 'hinten-rechts': [rx - vx, rz - vz], 'hinten-links': [lx - vx, lz - vz],
      'vorn-rechts': [rx + vx, rz + vz], 'vorn-links': [lx + vx, lz + vz], hinten: [-vx, -vz], vorn: [vx, vz],
    })[kandidat];
    const gesperrt = [];
    for (const kandidat of PA.reihenfolge.slice(0, 8)) {
      const z = PA.auswurfZiel(w, lore, r);
      assert.equal(z.ok, true, `${r}: ${kandidat}`);
      assert.equal(z.kandidat, kandidat, `${r}: nach ${gesperrt.join(', ') || 'nichts'} gesperrt`);
      const [dx, dz] = zelle(kandidat).map((v) => v + 0); // kein -0
      assert.deepEqual([z.ziel.x, z.ziel.y, z.ziel.z], [dx, 1, dz], `${r} ${kandidat}`);
      assert.equal(z.verworfen.length, gesperrt.length);
      sperre(w, dx, dz); gesperrt.push(kandidat);
    }
    // alle acht gesperrt: „oben“ hätte keinen Boden, „unten“ ist Stein: keine Zelle, der Passagier bleibt sitzen
    const z = PA.auswurfZiel(w, lore, r);
    assert.equal(z.ok, false);
    assert.equal(z.verworfen.length, 10);
    assert.equal(PA.wirfAus(w, lore, r).ok, false);
    assert.ok(w.passagier(lore), 'bleibt sitzen');
  }
  for (const r of ['north', 'east', 'south', 'west']) assert.equal(PA.richtungAusYaw(YAW[r]), r);
  assert.equal(PA.richtungAusYaw(-90), 'east');
  assert.equal(PA.richtungAusYaw(450), 'west');
  assert.throws(() => PA.richtungAusYaw(45), /nicht bestimmen/);
  const { w, lore } = aufbau('south');
  assert.equal(PA.auswurfZiel(w, lore).kandidat, 'rechts');
  assert.deepEqual(PA.auswurfZiel(w, lore).ziel, { x: -1, y: 1, z: 0 }, 'bei Fahrt nach Süden ist rechts Westen');
  assert.throws(() => PA.auswurfZiel(w, 999), /Kein Wesen/);
  const dorf = w.wesen().find((x) => x.id === DORF).nr;
  assert.throws(() => PA.auswurfZiel(w, dorf), /keine Lore/);
  w.steigeAus(dorf);
  assert.equal(PA.auswurfZiel(w, lore).ok, false);
});

test('Passagiere: Austrittszelle braucht Platz und (Regel) Boden', () => {
  assert.equal(PA.bodenNoetig, true);
  // Platz: ein Block auf Kopfhöhe sperrt einen Erwachsenen (2 Blöcke hoch), ein Baby (1 Block) passt noch
  for (const [baby, erwartet] of [[false, 'links'], [true, 'rechts']]) {
    const { w, lore } = aufbau('east', { baby });
    w.setzeBlock(0, 2, 1, STEIN);
    assert.equal(PA.auswurfZiel(w, lore).kandidat, erwartet, baby ? 'Baby' : 'Erwachsener');
  }
  // Boden: rechts ein Loch → übersprungen; geschlossene Falltür trägt, offene nicht; Wasser trägt; Lava nie
  const { w, lore } = aufbau('east');
  w.loescheBlock(0, 0, 1);
  let z = PA.auswurfZiel(w, lore);
  assert.equal(z.kandidat, 'links');
  assert.deepEqual(z.verworfen, [{ kandidat: 'rechts', grund: 'kein Boden darunter' }]);
  w.setzeBlock(0, 1, 1, 'minecraft:trapdoor', FALLTUER(false));
  z = PA.auswurfZiel(w, lore);
  assert.equal(z.kandidat, 'rechts', 'die geschlossene Falltür trägt');
  assert.equal(z.ohneBoden, false);
  w.setzeBlock(0, 1, 1, 'minecraft:trapdoor', FALLTUER(true));
  assert.equal(PA.auswurfZiel(w, lore).kandidat, 'links', 'offen: kein Boden mehr');
  w.setzeBlock(0, 1, 1, 'minecraft:water', { liquid_depth: 0 });
  assert.equal(PA.auswurfZiel(w, lore).kandidat, 'rechts');
  w.setzeBlock(0, 1, 1, 'minecraft:lava', { liquid_depth: 0 });
  assert.equal(PA.auswurfZiel(w, lore).kandidat, 'links');
  assert.match(PA.auswurfZiel(w, lore).verworfen[0].grund, /Lava/);
});

test('Passagiere: Landung nach dem Fall (Fallhöhe, Schaden, Wasser, Falltür)', () => {
  const faellt = (w, y) => B.faellt(w, { x: 0, y, z: 0 }, 'dorfbewohner');
  for (let h = 1; h <= 6; h++) {
    const f = faellt(boden(), 1 + h);
    assert.equal(f.ok, true);
    assert.equal(f.hoehe, h, `Höhe ${h}`);
    assert.deepEqual(f.ziel, { x: 0, y: 1, z: 0 });
    assert.equal(f.schaden, Math.max(0, h - 3), `Schaden bei ${h} Blöcken (frei bis 3)`);
    assert.equal(f.art, 'boden');
  }
  const w = boden(); w.setzeBlock(0, 1, 0, 'minecraft:water', { liquid_depth: 0 });
  const f = faellt(w, 6);
  assert.equal(f.art, 'wasser'); assert.equal(f.schaden, 0); assert.equal(f.hoehe, 0);
  const t = boden();
  t.setzeBlock(0, 4, 0, 'minecraft:trapdoor', FALLTUER(false));
  assert.equal(faellt(t, 4).hoehe, 0, 'steht auf der geschlossenen Falltür');
  t.setzeBlock(0, 4, 0, 'minecraft:trapdoor', FALLTUER(true));
  assert.equal(faellt(t, 4).hoehe, 3);
  const l = boden(); l.setzeBlock(0, 1, 0, 'minecraft:lava', { liquid_depth: 0 });
  assert.equal(faellt(l, 3).ok, false);
  assert.match(faellt(l, 3).grund, /Lava/);
  assert.equal(faellt(e0.neueWelt(), 3).ok, false);
  assert.equal(B.faellt(boden(), { x: 0, y: 3, z: 0 }, 'baby').hoehe, 2);
  assert.equal(B.faellt(boden(), { x: 0, y: 3, z: 0 }, 'spieler').hoehe, 2);
});

test('Passagiere: Auswurf, Fall und Landung zusammen (Wesen versetzt, Beziehung gelöst)', () => {
  const { w, lore, dorf } = aufbau('east');
  w.loescheBlock(0, 0, 1);
  w.setzeBlock(0, 1, 1, 'minecraft:trapdoor', FALLTUER(false));
  const r = PA.wirfAus(w, lore);
  assert.equal(r.ok, true);
  assert.equal(r.kandidat, 'rechts');
  assert.equal(w.passagier(lore), null, 'ausgestiegen');
  const d = w.wesen().find((x) => x.nr === dorf);
  assert.deepEqual([d.x, d.y, d.z], [0.5, 1, 1.5], 'steht auf der Falltür');
  assert.equal(d.sitztIn, undefined);
  assert.equal(r.fall.hoehe, 0);
  w.setzeBlock(0, -1, 1, STEIN);
  w.setzeBlock(0, 1, 1, 'minecraft:trapdoor', FALLTUER(true));
  const f = B.faellt(w, { x: 0, y: 1, z: 1 }, 'dorfbewohner');
  assert.equal(f.ok, true);
  assert.equal(f.hoehe, 1);
  assert.equal(f.schaden, 0);
});

test('Passagiere: Mechanik wirft nur im C-Tick aus (und nur auf einer eingeschalteten Aktivierungsschiene)', () => {
  const lauf = (w, ticks) => {
    const sk = e1.neuerSandkasten(w);
    const t = e1.neuerTaktgeber(sk, { aufzeichnen: true });
    const m = PA.mechanik();
    t.registriere(m);
    t.laufe(ticks);
    return { sk, t, m };
  };
  const { w, lore, dorf } = aufbau('east');
  const sk = e1.neuerSandkasten(w);
  const t = e1.neuerTaktgeber(sk, { aufzeichnen: true });
  const m = PA.mechanik();
  t.registriere(m);
  t.schritt(); // Tick 1 (P)
  assert.ok(sk.welt.passagier(lore), 'P-Tick: noch kein Auswurf');
  t.schritt(); // Tick 2 (C)
  assert.equal(sk.welt.passagier(lore), null);
  assert.equal(m.ereignisse.length, 1);
  assert.deepEqual([m.ereignisse[0].tick, m.ereignisse[0].lore, m.ereignisse[0].passagier, m.ereignisse[0].kandidat], [2, lore, dorf, 'rechts']);
  assert.deepEqual(t.protokoll.filter((p) => p.id === 'passagiere').map((p) => p.phase), ['C']);
  t.laufe(4);
  assert.equal(m.ereignisse.length, 1, 'nur einmal');
  assert.equal(lauf(aufbau('east', { aktiv: false }).w, 6).m.ereignisse.length, 0, 'Schiene aus');
  const n = aufbau('east').w;
  n.setzeBlock(0, 1, 0, 'minecraft:rail', { rail_direction: 1 });
  assert.equal(lauf(n, 6).m.ereignisse.length, 0, 'normale Schiene');
  const leer = aufbau('east').w; leer.steigeAus(leer.wesen().find((x) => x.id === DORF).nr);
  assert.equal(lauf(leer, 6).m.ereignisse.length, 0, 'Lore ohne Passagier');
  const a = lauf(aufbau('west').w, 6), b = lauf(aufbau('west').w, 6);
  assert.equal(JSON.stringify(a.m.ereignisse), JSON.stringify(b.m.ereignisse), 'deterministisch');
});

test('Passagiere: die Quelle bleibt unverändert, der Sandkasten rechnet in einer Kopie', () => {
  const { w, lore } = aufbau('east');
  const vorher = JSON.stringify(w.wesen());
  const sk = e1.neuerSandkasten(w);
  const t = e1.neuerTaktgeber(sk);
  t.registriere(PA.mechanik());
  t.laufe(4);
  assert.equal(JSON.stringify(w.wesen()), vorher);
  assert.ok(w.passagier(lore));
});

test('Prüfer: Passagiere an Aktivierungsschienen (kein Platz, Fall zu hoch, Boden) und Wesen im Wasser', () => {
  const pruefe = (w, extra = {}) => e1.pruefe(w, { passagiere: PA, stroemung: e1.stroemung, ...extra }).filter((m) => /passagiere|stroemung/.test(m.regel));
  // alles in Ordnung: rechts frei, Boden da
  const { w, lore } = aufbau('east');
  assert.deepEqual(pruefe(w), []);
  // keine Austrittszelle: Verstoß mit Koordinate der Lore
  const zu = aufbau('east').w;
  for (const [x, z] of [[0, 1], [0, -1], [-1, 1], [-1, -1], [1, 1], [1, -1], [-1, 0], [1, 0]]) sperre(zu, x, z);
  const m = pruefe(zu);
  assert.equal(m.length, 1);
  assert.deepEqual([m[0].regel, m[0].schwere, m[0].ort], ['pruefer.passagiere', 'verstoss', { x: 0, y: 1, z: 0 }]);
  assert.match(m[0].meldung, /nirgends aussteigen/);
  // Fall zu hoch: rechts eine Falltür in Schienenhöhe, darunter ein Schacht von 5 Blöcken, dann offene Falltür
  const hoch = aufbau('east').w;
  hoch.loescheBlock(0, 0, 1);
  hoch.setzeBlock(0, 1, 1, 'minecraft:trapdoor', FALLTUER(false));
  assert.deepEqual(pruefe(hoch), [], 'geschlossene Falltür trägt: kein Fall');
  // Platz für einen Sturz: Austritt in einer Zelle ohne Falltür, aber mit Wasser darunter? Boden fehlt → Regel verlangt Boden → andere Seite
  const links = aufbau('east').w;
  links.loescheBlock(0, 0, 1);
  assert.deepEqual(pruefe(links), [], 'rechts ohne Boden wird übersprungen, links ist in Ordnung');
  // Wesen im Wasser: Hinweis mit Ziel und Zeit; auf einer Quelle keine Meldung
  const wasser = e0.neueWelt();
  for (let x = -1; x <= 8; x++) { wasser.setzeBlock(x, 0, 0, STEIN); wasser.setzeBlock(x, 1, -1, STEIN); wasser.setzeBlock(x, 1, 1, STEIN); }
  wasser.setzeBlock(-1, 1, 0, STEIN); wasser.setzeBlock(8, 1, 0, STEIN);
  wasser.setzeBlock(0, 1, 0, 'minecraft:water', { liquid_depth: 0 });
  const sim = e1.fluessigkeit.simuliere(wasser).welt;
  sim.fuegeWesenHinzu({ id: DORF, x: 2.5, y: 1, z: 0.5 });
  const s = pruefe(sim);
  assert.equal(s.length, 1);
  assert.equal(s[0].regel, 'pruefer.stroemung');
  assert.equal(s[0].schwere, 'hinweis');
  assert.match(s[0].meldung, /wird nach \(7, 1, 0\) getrieben \(5 Zellen, 3\.6 s; Ende: ende\)/);
  const q = e1.fluessigkeit.simuliere(wasser).welt;
  q.fuegeWesenHinzu({ id: DORF, x: 0.5, y: 1, z: 0.5 });
  assert.deepEqual(pruefe(q), []);
  // der Prüfer der Passagiere läuft in `e1.pruefe` standardmäßig mit
  assert.equal(e1.pruefe(zu).filter((x) => x.regel === 'pruefer.passagiere').length, 1);
  void lore;
});

test('Prüfer: ohne Bodenpflicht (Bedrock-Fall) fällt der Passagier ins Loch: Hinweis, ab 4 Blöcken Verstoß', async () => {
  const { Regelwerk } = await import('../../src/ebene1/regelwerk.js');
  const { ladeRegeldateien } = await import('../../src/ebene1/daten-node.js');
  const regeln = structuredClone(ladeRegeldateien());
  for (const d of regeln) for (const r of d.regeln) if (r.id === 'passagiere.auswurf-ort') r.parameter.bodenNoetig = false;
  const offen = (await import('../../src/ebene1/passagiere.js')).erzeugePassagiere({ regelwerk: new Regelwerk(regeln), register: e0.register, bewegung: B, aktivierung: e1.aktivierung });
  assert.equal(offen.bodenNoetig, false);
  for (const [tiefe, erwartet] of [[3, 'hinweis'], [5, 'verstoss']]) {
    const { w } = aufbau('east');
    // Schacht rechts: Boden erst tief unten
    for (let y = 0; y > -tiefe; y--) w.loescheBlock(0, y, 1);
    w.setzeBlock(0, -tiefe, 1, STEIN);
    const m = e1.pruefe(w, { passagiere: offen }).filter((x) => x.regel === 'pruefer.passagiere');
    const fall = m.find((x) => x.schwere === 'verstoss');
    assert.equal(!!fall, erwartet === 'verstoss', `Schacht ${tiefe}`);
    if (fall) assert.match(fall.meldung, new RegExp(`${tiefe} Blöcke tief`));
    assert.ok(m.some((x) => x.schwere === 'hinweis' && /keinen Boden/.test(x.meldung)), 'Hinweis ohne Boden');
  }
});

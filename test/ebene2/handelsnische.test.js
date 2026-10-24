import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2 } from '../hilfe.js';
import { TESTPALETTE } from '../../src/ebene2/index.js';

const e2 = ebene2();
const e1 = e2.ebene1;
const e0 = e2.ebene0;
const D = e1.dorf;
const BETT = 'minecraft:bed';
const STEIN = 'minecraft:stone';
const ARTEN = ['spieler', 'dorfbewohner', 'baby'];
const WEITER_IM_UHRZEIGER = { south: 'west', west: 'north', north: 'east', east: 'south' };
const VEKTOR = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
const verstoesse = (w) => e1.pruefe(w, { schienen: null, dorf: D, dorfPruefen: true }).filter((x) => x.schwere === 'verstoss');
const meldungen = (w) => e1.pruefe(w, { schienen: null, dorf: D, dorfPruefen: true }).filter((x) => x.regel === 'pruefer.dorf');

function reihe(n, beruf) {
  const p = e2.baue('tech.handelsnischen', beruf === undefined ? { anzahl: n } : { anzahl: n, beruf });
  const w = e0.neueWelt();
  e2.platziere(w, p, TESTPALETTE);
  return { p, w };
}
const berufName = (id) => e0.register.bloecke.block(id).eigenschaften.beruf;

test('Handelsnischen: Dorfbewohner, Bett und Beruf mit Ebene 1', () => {
  assert.equal(e1.regelwerk.parameter('tech.nische', 'innenhoehe'), 3);
  for (const n of [1, 2, 5, 24, 192]) {
    const { p, w } = reihe(n);
    assert.equal(p.wesen.length, n);
    assert.equal(w.wesen().length, n);
    const betten = D.betten(w);
    assert.equal(betten.length, n, `n=${n}: Betten`);
    assert.ok(betten.every((b) => b.gueltig), `n=${n}: alle Betten gültig`);
    const zu = D.zuordnung(w);
    assert.equal(zu.length, n);
    zu.forEach((z, i) => {
      assert.ok(z.bett, `n=${n} Nische ${i}: Bett`);
      assert.equal(z.beruf?.beruf, 'librarian', `n=${n} Nische ${i}: Beruf`);
      assert.equal(z.beruf.erreichbar, true);
      assert.deepEqual([z.beruf.x, z.beruf.y, z.beruf.z], [2 * i, 0, 0], `n=${n} Nische ${i}: eigener Berufsblock`);
      assert.deepEqual(z.bett, { x: 2 * i, y: 0, z: -2 }, `n=${n} Nische ${i}: eigenes Bett`);
      assert.deepEqual(z.hinweise, []);
    });
    const dorf = D.dorf(w);
    assert.deepEqual([dorf.dorfbewohner, dorf.betten, dorf.hoechstbevoelkerung], [n, n, n]);
    assert.equal(dorf.golem, n >= 20 ? 'ja' : 'nein', `n=${n}: Iron Golem`);
    assert.deepEqual(verstoesse(w), [], `n=${n}: Prüfer`);
    assert.equal(meldungen(w).some((m) => /Iron Golems können/.test(m.meldung)), n >= 20);
  }
  // alle 13 Berufe
  const berufe = e2.technik.berufe;
  assert.equal(berufe.length, 13);
  berufe.forEach((id, i) => {
    const { w } = reihe(2, i);
    const zu = D.zuordnung(w);
    assert.deepEqual(zu.map((z) => z.beruf?.beruf), [berufName(id), berufName(id)], id);
    assert.ok(zu.every((z) => z.beruf.erreichbar && z.bett));
    assert.deepEqual(verstoesse(w), [], id);
  });
  assert.throws(() => e2.baue('tech.handelsnischen', { beruf: 13 }), /außerhalb/);
  assert.throws(() => e2.baue('tech.handelsnischen', { anzahl: 0 }), /außerhalb/);
  // Standard ist der Bibliothekar (Lesepult); Berufsblock nach Süden gedreht, wo Zustände eine Richtung haben
  const lesepult = reihe(1).p.bloecke.find((b) => b.id === 'minecraft:lectern');
  assert.equal(lesepult.zustand['minecraft:cardinal_direction'], 'south');
});

test('Handelsnischen: Reihenfolge der Berufsblock-Liste (bekannte Grenze des Modells)', () => {
  // Bedrock: ein Dorfbewohner beansprucht den ERSTEN Berufsblock der gemeinsamen Liste, egal wie weit oder erreichbar (Wiki „Villager“).
  // Blockwerk nimmt als Liste die Reihenfolge y, z, x. Setzt man die Dorfbewohner in umgekehrter Reihenfolge ein, greifen sie fremde Blöcke
  // und der Prüfer meldet unerreichbare Berufsblöcke. Das ist eine Folge der Bedrock-Regel, kein Fehler der Nische: Berufsblöcke und
  // Dorfbewohner müssen in derselben Reihenfolge entstehen (steht in den Spieltests).
  const { p } = reihe(4);
  const w = e0.neueWelt();
  e2.platziere(w, { ...p, wesen: [] }, TESTPALETTE);
  for (const v of [...p.wesen].reverse()) w.fuegeWesenHinzu(v);
  const zu = D.zuordnung(w);
  assert.ok(zu.some((z) => z.beruf && !z.beruf.erreichbar), 'umgekehrte Reihenfolge: fremder Berufsblock');
  assert.ok(verstoesse(w).some((v) => /erreicht ihn aber nicht/.test(v.meldung)));
  // in Bauanleitungs-Reihenfolge ist alles gut
  const gut = e0.neueWelt();
  e2.platziere(gut, p, TESTPALETTE);
  assert.ok(D.zuordnung(gut).every((z) => z.beruf?.erreichbar));
  assert.deepEqual(verstoesse(gut), []);
});

test('Handelsnischen: dicht, Technik skaliert über Anzahl, Drehen', () => {
  const n = 4;
  const { w, p } = reihe(n);
  // Zelle ist dicht: der Dorfbewohner (Erwachsener und Baby) erreicht nur seine eigene Zelle
  for (let i = 0; i < n; i++) for (const art of ['dorfbewohner', 'baby']) {
    const erg = e1.bewegung.erreichbar(w, { x: 2 * i, y: 0, z: -1 }, art);
    const zellen = new Set([...erg.zustaende.values()].map((s) => `${s.x},${s.z}`));
    assert.deepEqual([...zellen], [`${2 * i},-1`], `Nische ${i} ${art}`);
  }
  // der Spieler kommt von vorn nicht hinein
  for (let x = -1; x <= 2 * n + 1; x++) for (let z = 1; z <= 4; z++) w.setzeBlock(x, -1, z, STEIN);
  for (const art of ARTEN) assert.equal(e1.bewegung.weg(w, { x: 0, y: 0, z: 2 }, { x: 0, y: 0, z: -1 }, art).ok, false, `von vorn: ${art}`);
  // Technik skaliert über Anzahl: je Nische gleich viele Blöcke, Platzbedarf wächst nur in x
  const anz = (k) => e2.baue('tech.handelsnischen', { anzahl: k }).bloecke.length;
  assert.equal(anz(3) - anz(2), anz(10) - anz(9));
  assert.equal(anz(100) - anz(99), anz(2) - anz(1));
  const h = (k) => e2.baue('tech.handelsnischen', { anzahl: k }).platzbedarf.huelle;
  assert.deepEqual([h(5).von.y, h(5).bis.y, h(5).von.z, h(5).bis.z], [h(1).von.y, h(1).bis.y, h(1).von.z, h(1).bis.z]);
  assert.equal(h(5).bis.x - h(1).bis.x, 2 * 4);
  assert.deepEqual(e2.baue('tech.handelsnischen', { anzahl: 4 }), p, 'deterministisch');

  // Drehen über den Vermesser: Zuordnung, Beruf und Bettrichtung bleiben richtig
  const nr = reihe(6).w;
  for (let k = 1; k <= 3; k++) {
    const gedreht = e0.vermesser.drehe(nr.ausschnitt({ x: -10, y: -2, z: -10 }, { x: 40, y: 6, z: 10 }), k);
    // Dorfbewohner werden in der Reihenfolge der Berufsblöcke eingesetzt (y, z, x), wie es die Bauanleitung vorgibt
    gedreht.wesen.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
    const g = e0.neueWelt();
    g.fuegeBauteilEin(gedreht);
    const zu = D.zuordnung(g);
    assert.equal(zu.length, 6, `k=${k}`);
    assert.ok(zu.every((z) => z.bett && z.beruf?.beruf === 'librarian' && z.beruf.erreichbar), `k=${k}: Beruf und Bett`);
    assert.ok(D.betten(g).every((b) => b.gueltig), `k=${k}: Betten gültig`);
    // Bett: der Kopf zeigt (von Fuß zu Kopf) in die gedrehte Richtung
    let soll = 'south';
    for (let i = 0; i < k; i++) soll = WEITER_IM_UHRZEIGER[soll];
    for (const b of g.alleBloecke().filter((x) => x.id === BETT && x.zustand.head_piece_bit === true)) {
      assert.equal(e0.vermesser.richtungVon('direction', b.zustand.direction, BETT), soll, `k=${k}: Blickrichtung des Betts`);
      const fuss = g.leseBlock(b.x - VEKTOR[soll][0], b.y, b.z - VEKTOR[soll][1]);
      assert.deepEqual([fuss.id, fuss.zustand.head_piece_bit], [BETT, false], `k=${k}: Fuß liegt hinter dem Kopf`);
    }
    assert.deepEqual(verstoesse(g), [], `k=${k}`);
  }
});

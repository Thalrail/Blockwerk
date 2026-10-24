// Ebene 1 – Mechanik „Fallende Blöcke“ (Sand, Kies, Betonpulver, Amboss, Drachenei …)
// Regeln: data/regeln/fallen.json (Quelle und Status je Regel; Bedrock nennt kaum Zahlen → Java-Platzhalter, `ungeprüft`).
// Modell (diskret, ohne Entität): Ein Block mit der Ebene-0-Eigenschaft `faellt`, unter dem nichts trägt, beginnt nach `startVerzoegerung`
// Ticks zu fallen und rückt alle `fallTicks` Ticks eine Zelle nach unten. Er fällt durch Luft, Wasser, Lava und Feuer, durch eine Fackel nur,
// wenn darunter Luft ist (die Fackel bleibt), wird in Fackel/Schiene/Staub oder auf Halbstufe/Seelensand zum Gegenstand, bleibt auf einem
// festen Vollblock liegen und gibt bei unbekannten Blöcken „unklar“ zurück. Betonpulver wird bei Wasserkontakt zu Beton.
// Stapel fallen zusammen, weil alle Blöcke einer Säule im selben Tick, von unten nach oben, geplant werden.
// Die Welt wird nur über Ebene 0 gelesen und geschrieben.
import { VEKTOR } from '../ebene0/richtungen.js';
import { Sandkasten } from './sandkasten.js';
import { Taktgeber } from './taktgeber.js';

const key = (p) => `${p.x},${p.y},${p.z}`;
const plus = (p, r) => ({ x: p.x + VEKTOR[r].x, y: p.y + VEKTOR[r].y, z: p.z + VEKTOR[r].z });
const RICHTUNGEN6 = ['north', 'east', 'south', 'west', 'up', 'down'];
const WASSER = new Set(['minecraft:water', 'minecraft:flowing_water']);
const LAVA = new Set(['minecraft:lava', 'minecraft:flowing_lava']);

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, register: {bloecke: import('../ebene0/blockregister.js').Blockregister}}} quellen
 */
export function erzeugeFallen({ regelwerk, register }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  const fallTicks = P('fallen.tempo', 'fallTicks');
  const start = P('fallen.start', 'startVerzoegerung');
  const ausgenommen = new Set(P('fallen.welche', 'ausgenommen'));
  const fackel = new RegExp(P('fallen.durch-fackel', 'muster'));
  const gegenstandMuster = new RegExp(P('fallen.landen-gegenstand', 'muster'));
  const teilMuster = P('fallen.landen-gegenstand', 'teilbloecke').map((m) => new RegExp(m));
  const teilAusser = new RegExp(P('fallen.landen-gegenstand', 'teilbloeckeAusser'));
  const pulver = new RegExp(P('fallen.betonpulver', 'muster'));
  const pulverNach = P('fallen.betonpulver', 'ersatz');
  const eigenschaft = (id) => register.bloecke.block(id).eigenschaften;
  const faelltBlock = (id) => !ausgenommen.has(id) && eigenschaft(id).faellt === true;

  /**
   * Was ist an der Zelle unter einem fallenden Block?
   * 'frei' (Luft, Flüssigkeit, Feuer) | 'fackel' | 'gegenstand' (Schiene, Staub, Teilblock) | 'fest' | 'unklar'
   */
  function art(welt, p) {
    const b = welt.leseBlock(p.x, p.y, p.z);
    const id = b.id;
    if (id === 'minecraft:air' || WASSER.has(id) || LAVA.has(id) || id === 'minecraft:fire') return 'frei';
    if (fackel.test(id)) return 'fackel';
    if (gegenstandMuster.test(id)) return 'gegenstand';
    if (teilMuster.some((m) => m.test(id)) && !teilAusser.test(id)) return 'gegenstand';
    if (eigenschaft(id).vollblock === true) return 'fest';
    return 'unklar';
  }

  function mechanik() {
    const ereignisse = [];
    const wartend = new Map();
    const id = 'fallen';

    function plane(ktx, p, verzoegerung) {
      const k = key(p);
      const ab = ktx.tick + verzoegerung;
      if (wartend.has(k) && wartend.get(k) <= ab) return;
      wartend.set(k, ab);
      ktx.plane({ x: p.x, z: p.z, ab, mechanik: id, daten: { y: p.y } });
    }
    const merke = (ktx, was, pos, block, nach = null, grund = null) => ereignisse.push({ tick: ktx.tick, was, pos: { ...pos }, block, nach, grund });

    /** Betonpulver an p: Wasser berührt es (Zelle selbst oder ein Nachbar) → Beton. */
    function pulverZuBeton(ktx, p) {
      const welt = ktx.welt;
      const b = welt.leseBlock(p.x, p.y, p.z);
      const m = pulver.exec(b.id);
      if (!m) return false;
      if (!RICHTUNGEN6.some((r) => { const n = plus(p, r); return WASSER.has(welt.leseBlock(n.x, n.y, n.z).id); })) return false;
      const beton = b.id.replace(pulver, pulverNach);
      welt.setzeBlock(p.x, p.y, p.z, beton);
      merke(ktx, 'zu-beton', p, b.id, beton);
      return true;
    }

    function verarbeite(ktx, p) {
      const welt = ktx.welt;
      const b = welt.leseBlock(p.x, p.y, p.z);
      if (!faelltBlock(b.id)) return;
      const darunter = plus(p, 'down');
      const unten = art(welt, darunter);
      // Wasser neben liegendem Betonpulver
      if (pulverZuBeton(ktx, p)) return;
      if (unten === 'fest') { merke(ktx, 'gelandet', p, b.id); return; }
      if (unten === 'unklar') { merke(ktx, 'unklar', p, b.id, null, welt.leseBlock(darunter.x, darunter.y, darunter.z).id); return; }
      if (unten === 'gegenstand') {
        welt.setzeBlock(p.x, p.y, p.z, 'minecraft:air');
        merke(ktx, 'zu-gegenstand', p, b.id, null, welt.leseBlock(darunter.x, darunter.y, darunter.z).id);
        plane(ktx, plus(p, 'up'), start);
        return;
      }
      let ziel = darunter;
      if (unten === 'fackel') {
        // Durch die Fackel nur, wenn darunter Luft ist; sonst landet der Block in der Fackelzelle → Gegenstand
        const noch = plus(darunter, 'down');
        if (art(welt, noch) !== 'frei') {
          welt.setzeBlock(p.x, p.y, p.z, 'minecraft:air');
          merke(ktx, 'zu-gegenstand', p, b.id, null, welt.leseBlock(darunter.x, darunter.y, darunter.z).id);
          plane(ktx, plus(p, 'up'), start);
          return;
        }
        ziel = noch;
      }
      welt.setzeBlock(p.x, p.y, p.z, 'minecraft:air');
      welt.setzeBlock(ziel.x, ziel.y, ziel.z, b.id, b.zustand);
      merke(ktx, 'faellt', p, b.id, ziel);
      plane(ktx, plus(p, 'up'), start);
      if (!pulverZuBeton(ktx, ziel)) plane(ktx, ziel, fallTicks * (ziel === darunter ? 1 : 2));
    }

    return {
      id,
      tickart: 'spieltick',
      ereignisse,
      schritt() {},
      geplanterTick(ktx, e) {
        wartend.delete(`${e.x},${e.daten.y},${e.z}`);
        verarbeite(ktx, { x: e.x, y: e.daten.y, z: e.z });
      },
      /** Plant alle fallenden Blöcke der Welt (von unten nach oben, damit Stapel zusammen fallen). */
      anstossen(taktgeber) {
        const ktx = { tick: taktgeber.tick, plane: (x) => taktgeber.geplant.plane(x), welt: taktgeber.sandkasten.welt };
        for (const b of ktx.welt.alleBloecke()) {
          if (!faelltBlock(b.id)) continue;
          const pos = { x: b.x, y: b.y, z: b.z };
          // liegt der Block schon fest, ist nichts zu tun (außer Betonpulver neben Wasser)
          if (art(ktx.welt, plus(pos, 'down')) !== 'fest' || pulver.test(b.id)) plane(ktx, pos, start);
        }
      },
      /** Meldet eine Änderung von außen bei p (z. B. Stütze entfernt) und plant den Block darüber. */
      aenderung(taktgeber, p) {
        const ktx = { tick: taktgeber.tick, plane: (x) => taktgeber.geplant.plane(x), welt: taktgeber.sandkasten.welt };
        for (const q of [p, plus(p, 'up')]) if (faelltBlock(ktx.welt.leseBlock(q.x, q.y, q.z).id)) plane(ktx, q, start);
      },
    };
  }

  /**
   * Läuft in einer Kopie der Welt, bis nichts mehr geplant ist (oder maxTicks erreicht sind).
   * @returns {{welt: import('../ebene0/welt.js').Welt, ereignisse: object[], ticks: number, stabil: boolean}}
   */
  function simuliere(welt, { maxTicks = 3000, seed = 1 } = {}) {
    const sk = new Sandkasten(welt);
    const t = new Taktgeber(sk, { seed });
    const m = mechanik();
    t.registriere(m);
    m.anstossen(t);
    while (t.geplant.anzahl() > 0 && t.tick < maxTicks) t.schritt();
    return { welt: sk.welt, ereignisse: m.ereignisse, ticks: t.tick, stabil: t.geplant.anzahl() === 0 };
  }

  const enthaeltFallende = (welt) => welt.alleBloecke().some((b) => faelltBlock(b.id));

  return { mechanik, simuliere, enthaeltFallende, faelltBlock };
}

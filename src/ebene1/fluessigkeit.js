// Ebene 1 – Mechanik „Wasser und Lava“
// Regeln: data/regeln/fluessigkeit.json (Quelle und Status je Regel; vieles ist im Wiki nicht als Bedrock gekennzeichnet → ungeprüft).
// Darstellung (Bedrock): `water`/`lava` mit liquid_depth 0 = Quelle, `flowing_water`/`flowing_lava` mit Stufe 1–7,
// Stufe ab 8 = fallend. Die Ausbreitung läuft über geplante Ticks des Taktgebers (Wasser alle 5 Ticks, Lava 30 bzw. 10).
// Hinweis: Bedrock dokumentiert die Fließ-Logik nicht. Verfahren: die Grundlogik der Java-Implementierung (von Jonah aus Erfahrung bestätigt), angepasst an Jonahs Spieltests vom
// 24.10.2026: Ausbreitung als Quadrat (8 Nachbarn, Stufe = größter Abstand), Gefälle über Wegkosten (gerade 2, diagonal 3, Grenze 10 → gerade bis zum 5. Block, diagonal bis (3,3)),
// unten frei → fallen (seitlich nur bei 3 Quellen-Nachbarn), Fließblöcke ohne Nachschub rücken stufenweise ab, bis sie verschwinden.
// Die Welt wird nur über Ebene 0 gelesen und geschrieben.
import { VEKTOR } from '../ebene0/richtungen.js';
import { Sandkasten } from './sandkasten.js';
import { Taktgeber } from './taktgeber.js';

const SEITEN = ['north', 'east', 'south', 'west'];
// Alle waagerechten Schritte: gerade und diagonal (Jonah, 24.10.2026: Wasser und Lava breiten sich als Quadrat aus)
const SCHRITTE8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
const diagonal = (d) => d[0] !== 0 && d[1] !== 0;
const key = (p) => `${p.x},${p.y},${p.z}`;
const plus = (p, r) => ({ x: p.x + VEKTOR[r].x, y: p.y + VEKTOR[r].y, z: p.z + VEKTOR[r].z });
const plusD = (p, d) => ({ x: p.x + d[0], y: p.y, z: p.z + d[1] });
const FALLEND = 8;

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, register: {bloecke: import('../ebene0/blockregister.js').Blockregister}}} quellen
 */
export function erzeugeFluessigkeit({ regelwerk, register }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  const arten = {
    wasser: { quelle: 'minecraft:water', fluss: 'minecraft:flowing_water', ...regelwerk.regel('fluessigkeit.wasser').parameter },
    lava: { quelle: 'minecraft:lava', fluss: 'minecraft:flowing_lava' },
  };
  const lavaWerte = { oberwelt: regelwerk.regel('fluessigkeit.lava-oberwelt').parameter, nether: regelwerk.regel('fluessigkeit.lava-nether').parameter };
  const kostenGrenze = P('fluessigkeit.gefaelle', 'kostenGrenze');
  const kostenGerade = P('fluessigkeit.gefaelle', 'kostenGerade');
  const kostenDiagonal = P('fluessigkeit.gefaelle', 'kostenDiagonal');
  const stromIds = new Map([[arten.wasser.quelle, 'wasser'], [arten.wasser.fluss, 'wasser'], [arten.lava.quelle, 'lava'], [arten.lava.fluss, 'lava']]);
  const artVon = (id) => stromIds.get(id) ?? null;
  const eigenschaft = (id) => register.bloecke.block(id).eigenschaften.fluessigkeit;

  /** Werte (Schritt, Höchststufe, Verzögerung) einer Flüssigkeit in der gewählten Dimension. */
  function werte(art, dimension) {
    if (art === 'wasser') return { schritt: arten.wasser.schritt, max: arten.wasser.maxStufe, verzoegerung: arten.wasser.verzoegerung };
    const l = lavaWerte[dimension];
    return { schritt: l.schritt, max: l.maxStufe, verzoegerung: l.verzoegerung };
  }

  /**
   * @param {{dimension?: 'oberwelt'|'nether'}} [optionen]
   * @returns Mechanik für den Taktgeber (tickart 'spieltick' mit geplanten Ticks) samt Protokoll `ereignisse`
   */
  function mechanik({ dimension = 'oberwelt' } = {}) {
    if (!lavaWerte[dimension]) throw new Error(`Unbekannte Dimension: ${dimension}`);
    const ereignisse = [];
    const wartend = new Map();
    const id = 'fluessigkeit';

    const lese = (welt, p) => {
      // außerhalb des Weltbereichs (unter dem Boden, über der Decke) zählt wie fester Fels
      const b = p.y < -64 || p.y > 319 ? { id: 'minecraft:bedrock', zustand: {} } : welt.leseBlock(p.x, p.y, p.z);
      const art = artVon(b.id);
      if (!art) return { art: null, block: b };
      const tiefe = b.zustand.liquid_depth ?? 0;
      const quelle = b.id === arten[art].quelle && tiefe === 0;
      const fallend = tiefe >= FALLEND;
      return { art, block: b, quelle, fallend, tiefe, stufe: quelle || fallend ? 0 : tiefe };
    };
    /** 'offen' | 'wegspuelbar' | 'fest' für Nicht-Flüssigkeiten (unbekannt zählt als fest). */
    const verhalten = (z) => (z.art ? 'fluessigkeit' : eigenschaft(z.block.id) === 'offen' || eigenschaft(z.block.id) === 'wegspuelbar' ? eigenschaft(z.block.id) : 'fest');
    const frei = (z) => z.art === null && (verhalten(z) === 'offen' || verhalten(z) === 'wegspuelbar');

    function plane(ktx, art, p, verzoegerung) {
      const k = `${art}:${key(p)}`;
      const ab = ktx.tick + verzoegerung;
      if (wartend.has(k) && wartend.get(k) <= ab) return;
      wartend.set(k, ab);
      ktx.plane({ x: p.x, z: p.z, ab, mechanik: id, daten: { y: p.y, art } });
    }
    const planeNachbarn = (ktx, art, p, w) => {
      plane(ktx, art, p, w.verzoegerung);
      const nachbarn = [...SEITEN.map((r) => plus(p, r)), ...SCHRITTE8.filter(diagonal).map((d) => plusD(p, d)), plus(p, 'down'), plus(p, 'up')];
      for (const n of nachbarn) {
        if (n.y < -64 || n.y > 319) continue;
        if (artVon(ktx.welt.leseBlock(n.x, n.y, n.z).id) === art) plane(ktx, art, n, w.verzoegerung);
      }
    };
    const merke = (ktx, art, was, pos, von, nach) => ereignisse.push({ tick: ktx.tick, art, was, pos: { ...pos }, von, nach });

    const setzeFluss = (welt, art, p, tiefe) => welt.setzeBlock(p.x, p.y, p.z, arten[art].fluss, { liquid_depth: tiefe });

    /** Lava mit Wasser über oder neben sich wird zu Obsidian (Quelle) bzw. Bruchstein (Fluss). Wasser darunter zählt nicht. */
    function lavaMitWasser(ktx, p) {
      const z = lese(ktx.welt, p);
      if (z.art !== 'lava') return false;
      const nass = [...SEITEN, 'up'].some((r) => lese(ktx.welt, plus(p, r)).art === 'wasser');
      if (!nass) return false;
      const neu = z.quelle ? 'minecraft:obsidian' : 'minecraft:cobblestone';
      ktx.welt.setzeBlock(p.x, p.y, p.z, neu);
      merke(ktx, 'lava', 'gemischt', p, z.block.id, neu);
      return true;
    }
    /** Nach dem Setzen von Wasser bei p: angrenzende Lava (außer der darunter liegenden) prüfen. */
    function wasserGesetzt(ktx, p) {
      for (const r of [...SEITEN, 'down']) lavaMitWasser(ktx, plus(p, r));
    }

    /** Fluss versucht, in Zelle p zu fließen. Gibt zurück, ob dort jetzt (mehr) Flüssigkeit ist. */
    function fliesseEin(ktx, art, p, tiefe, w, nachUnten) {
      const welt = ktx.welt;
      const z = lese(welt, p);
      if (z.art === null) {
        if (!frei(z)) return false;
        if (verhalten(z) === 'wegspuelbar') merke(ktx, art, 'weggespuelt', p, z.block.id, null);
        setzeFluss(welt, art, p, tiefe);
        if (art === 'wasser') wasserGesetzt(ktx, p);
        else if (lavaMitWasser(ktx, p)) return false;
        planeNachbarn(ktx, art, p, w);
        return true;
      }
      if (z.art === art) {
        if (z.quelle) return false;
        const besser = tiefe >= FALLEND ? !z.fallend : !z.fallend && tiefe < z.tiefe;
        if (!besser) return false;
        setzeFluss(welt, art, p, tiefe);
        planeNachbarn(ktx, art, p, w);
        return true;
      }
      // andere Flüssigkeit: Lava, die nach unten auf Wasser fällt, macht Stein; Wasser in Lava wird über lavaMitWasser gelöst
      if (art === 'lava' && z.art === 'wasser' && nachUnten) {
        welt.setzeBlock(p.x, p.y, p.z, 'minecraft:stone');
        merke(ktx, 'lava', 'gemischt', p, z.block.id, 'minecraft:stone');
        return true;
      }
      return false;
    }

    /** Kann die Flüssigkeit `art` in diese Zelle fließen (frei oder dieselbe Flüssigkeit, keine Quelle)? */
    const durchlaessig = (welt, art, n) => { const z = lese(welt, n); return frei(z) || (z.art === art && !z.quelle); };
    /** Liegt unter n ein Gefälle (freie Zelle oder Fließblock derselben Art)? */
    const hatGefaelle = (welt, art, n) => durchlaessig(welt, art, plus(n, 'down'));
    /** Darf von p aus ein Schritt d getan werden? Diagonal nur, wenn beide angrenzenden geraden Zellen durchlässig sind (kein Durchschneiden von Ecken, Annahme). */
    function schrittMoeglich(welt, art, p, d) {
      if (!durchlaessig(welt, art, plusD(p, d))) return false;
      if (!diagonal(d)) return true;
      return durchlaessig(welt, art, plusD(p, [d[0], 0])) && durchlaessig(welt, art, plusD(p, [0, d[1]]));
    }
    /**
     * Kosten bis zum nächsten Gefälle für den ersten Schritt d (Gewichte: gerade 2, diagonal 3, Grenze 10 – damit ein gerades Loch bis zum
     * 5. Block und ein diagonales bis (3,3) gefunden wird, Jonah 24.10.2026). 1000 = keins in Reichweite.
     */
    function gefaelleKosten(welt, art, p, d) {
      const kosten = (schritt) => (diagonal(schritt) ? kostenDiagonal : kostenGerade);
      const erster = plusD(p, d);
      const start = kosten(d);
      if (!schrittMoeglich(welt, art, p, d)) return null;
      const beste = new Map([[key(erster), start]]);
      const offen = [{ pos: erster, k: start }];
      let best = 1000;
      while (offen.length) {
        offen.sort((x, y) => x.k - y.k);
        const { pos, k } = offen.shift();
        if (k > beste.get(key(pos))) continue;
        if (hatGefaelle(welt, art, pos)) { best = k; break; }
        for (const schritt of SCHRITTE8) {
          const n = plusD(pos, schritt);
          const nk = k + kosten(schritt);
          if (nk > kostenGrenze || (n.x === p.x && n.z === p.z)) continue;
          if (!schrittMoeglich(welt, art, pos, schritt)) continue;
          if (nk < (beste.get(key(n)) ?? Infinity)) { beste.set(key(n), nk); offen.push({ pos: n, k: nk }); }
        }
      }
      return best;
    }
    /** Richtungen, in die sich die Flüssigkeit von p aus seitlich ausbreitet: die mit dem nächsten Gefälle, sonst alle möglichen (Quadrat). */
    function richtungen(welt, art, p) {
      const kandidaten = [];
      let min = 1000;
      for (const d of SCHRITTE8) {
        const kosten = gefaelleKosten(welt, art, p, d);
        if (kosten === null) continue;
        if (kosten < min) { min = kosten; kandidaten.length = 0; }
        if (kosten === min) kandidaten.push(d);
      }
      return kandidaten;
    }

    /** Zelle, durch die Flüssigkeit diagonal hindurchfließen kann (Flüssigkeit, frei oder wegspülbar). */
    const versorgt = (welt, n) => { const z = lese(welt, n); return z.art !== null || frei(z); };

    function verarbeite(ktx, art, p) {
      const welt = ktx.welt;
      const w = werte(art, dimension);
      let z = lese(welt, p);
      if (z.art !== art) return;
      if (art === 'lava' && lavaMitWasser(ktx, p)) return;

      // 1. Fließblock: neue Stufe aus der Versorgung, Quellenbildung oder Abklingen
      if (!z.quelle) {
        const darueber = lese(welt, plus(p, 'up'));
        let neu = null;
        if (darueber.art === art) neu = FALLEND;
        else {
          let best = Infinity;
          for (const d of SCHRITTE8) {
            const nz = lese(welt, plusD(p, d));
            if (nz.art !== art) continue;
            if (diagonal(d) && !(versorgt(welt, plusD(p, [d[0], 0])) && versorgt(welt, plusD(p, [0, d[1]])))) continue;
            best = Math.min(best, nz.stufe + w.schritt);
          }
          if (best <= w.max) neu = best;
        }
        if (neu === null) {
          welt.setzeBlock(p.x, p.y, p.z, 'minecraft:air');
          merke(ktx, art, 'verschwunden', p, z.block.id, null);
          planeNachbarn(ktx, art, p, w);
          return;
        }
        if (art === 'wasser' && neu !== FALLEND) {
          const quellen = SEITEN.filter((r) => lese(welt, plus(p, r)).quelle && lese(welt, plus(p, r)).art === 'wasser').length;
          const unten = lese(welt, plus(p, 'down'));
          if (quellen >= P('fluessigkeit.quellenbildung', 'quellenNoetig') && (unten.art === null ? verhalten(unten) === 'fest' : unten.quelle)) {
            welt.setzeBlock(p.x, p.y, p.z, arten.wasser.quelle, { liquid_depth: 0 });
            merke(ktx, art, 'neue-quelle', p, z.block.id, arten.wasser.quelle);
            planeNachbarn(ktx, art, p, w);
            z = lese(welt, p);
          }
        }
        if (!z.quelle && neu !== z.tiefe) {
          setzeFluss(welt, art, p, neu);
          planeNachbarn(ktx, art, p, w);
          z = lese(welt, p);
        }
      }

      // 2. Ausbreitung: erst nach unten, seitlich nur ohne Weg nach unten (oder bei 3 Quellen-Nachbarn)
      const untenPos = plus(p, 'down');
      const unten = lese(welt, untenPos);
      // Nach unten fließt nur in freie Zellen (oder Lava auf Wasser). Liegt darunter schon dieselbe Flüssigkeit, ist das ein „Loch“:
      // dann breitet sich nur eine Quelle seitlich aus.
      const kannUnten = frei(unten) || (art === 'lava' && unten.art === 'wasser');
      let seitlich;
      if (kannUnten) {
        fliesseEin(ktx, art, untenPos, FALLEND, w, true);
        const quellenNachbarn = SEITEN.filter((r) => { const q = lese(welt, plus(p, r)); return q.art === art && q.quelle; }).length;
        seitlich = quellenNachbarn >= P('fluessigkeit.unten-vor-seitlich', 'quellenNachbarn');
      } else {
        seitlich = z.quelle || unten.art !== art;
      }
      if (seitlich) {
        const kind = z.stufe + w.schritt;
        if (kind <= w.max) for (const d of richtungen(welt, art, p)) fliesseEin(ktx, art, plusD(p, d), kind, w, false);
      }
    }

    return {
      id,
      tickart: 'spieltick',
      ereignisse,
      schritt() {},
      geplanterTick(ktx, e) {
        wartend.delete(`${e.daten.art}:${e.x},${e.daten.y},${e.z}`);
        verarbeite(ktx, e.daten.art, { x: e.x, y: e.daten.y, z: e.z });
      },
      /** Plant für alle vorhandenen Flüssigkeitsblöcke einen ersten Tick (nach dem Aufbau oder nach einer Änderung von außen). */
      anstossen(taktgeber) {
        const ktx = { tick: taktgeber.tick, plane: (x) => taktgeber.geplant.plane(x), welt: taktgeber.sandkasten.welt };
        for (const b of ktx.welt.alleBloecke()) {
          const art = artVon(b.id);
          if (art) plane(ktx, art, { x: b.x, y: b.y, z: b.z }, werte(art, dimension).verzoegerung);
        }
      },
      /** Meldet eine Änderung von außen bei p (z. B. Quelle entfernt) und plant die betroffenen Nachbarn. */
      aenderung(taktgeber, p) {
        const ktx = { tick: taktgeber.tick, plane: (x) => taktgeber.geplant.plane(x), welt: taktgeber.sandkasten.welt };
        const umgebung = [p, ...SEITEN.map((r) => plus(p, r)), ...SCHRITTE8.filter(diagonal).map((d) => plusD(p, d)), plus(p, 'down'), plus(p, 'up')];
        for (const n of umgebung) {
          const art = artVon(ktx.welt.leseBlock(n.x, n.y, n.z).id);
          if (art) plane(ktx, art, n, werte(art, dimension).verzoegerung);
        }
      },
    };
  }

  /**
   * Läuft in einer Kopie der Welt, bis nichts mehr geplant ist (oder maxTicks erreicht sind).
   * @returns {{welt: import('../ebene0/welt.js').Welt, ereignisse: object[], ticks: number, stabil: boolean}}
   */
  function simuliere(welt, { dimension = 'oberwelt', maxTicks = 400, seed = 1 } = {}) {
    const sk = new Sandkasten(welt);
    const t = new Taktgeber(sk, { seed });
    const m = mechanik({ dimension });
    t.registriere(m);
    m.anstossen(t);
    while (t.geplant.anzahl() > 0 && t.tick < maxTicks) t.schritt();
    return { welt: sk.welt, ereignisse: m.ereignisse, ticks: t.tick, stabil: t.geplant.anzahl() === 0 };
  }

  const enthaeltFluessigkeit = (welt) => welt.alleBloecke().some((b) => artVon(b.id));

  return { mechanik, simuliere, enthaeltFluessigkeit, artVon, werte };
}

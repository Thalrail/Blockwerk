// Ebene 1 – Mechanik „Licht“ (Blocklicht und Himmelslicht)
// Regeln: data/regeln/licht.json (Quelle und Status je Regel).
//   - Blocklicht: Lichtquellen (Ebene-0-Eigenschaft `licht`), Flutfüllung, Abnahme je Block: Obergrenze max(1, Filter), Untergrenze 1 + Filter
//     (das Wiki nennt für Bedrock Filterwerte und zugleich „−1 zusätzlich zur normalen Abnahme“; beide Lesarten sind in den Schranken enthalten).
//   - Himmelslicht: 15 an freien Blöcken; die Spalte darunter geht laut Wiki ungeschwächt hindurch. Für bereits seitlich verteiltes Licht
//     (unter 15) ist das nicht belegt: Obergrenze = auch ungeschwächt senkrecht, Untergrenze = wie seitlich (mindestens 1 je Block).
//   - Treppen und Halbstufen (Java-Kategorie, Jonah 24.10.2026): Filter 0, aber die vollen Flächen sperren das Licht beim Übergang zwischen zwei Zellen
//     (untere Halbstufe/Treppe: Unterseite, obere/kopfstehende: Oberseite, Treppe zusätzlich die Rückseite). Halb gefüllte Seiten lassen Licht durch (Annahme: zwei halbe Flächen, die sich ergänzen, würden in Java sperren).
//   - Unbekannte Lichtfilter (null in Ebene 0, z. B. Glas, Treppen, Zäune) werden NICHT geraten: es wird zweimal gerechnet,
//     mit „Unbekanntes blockiert“ (Minimum) und „Unbekanntes lässt durch“ (Maximum). Dasselbe gilt für Lichtquellen mit
//     zustandsabhängiger Stärke (licht = null: Minimum 0, Maximum 15). Wo Minimum und Maximum auseinanderliegen, ist das Ergebnis „unklar“.
// Die Welt wird nur über Ebene 0 gelesen. Es wird nur ein begrenzter Bereich berechnet (Bereich ± 15), nicht die ganze Welt.
import { HOEHE_MAX, HOEHE_MIN } from '../ebene0/richtungen.js';

const RAND = 15;
const NACHBARN = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]; // Ost, West, Süd, Nord, oben, unten (Gegenstück = Index xor 1)
const RICHTUNG_BIT = { east: 0, west: 1, south: 2, north: 3, up: 4, down: 5 };
const STUFE_RICHTUNG = ['east', 'west', 'south', 'north']; // weirdo_direction 0–3: Seite des Vollblocks (Rückseite der Treppe), von Jonah geprüft

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, register: {bloecke: import('../ebene0/blockregister.js').Blockregister}}} quellen
 */
export function erzeugeLicht({ regelwerk, register }) {
  const himmelsWerte = regelwerk.parameter('licht.himmel-innen', 'werte');
  const abnahme = regelwerk.parameter('licht.blocklicht', 'abnahme');

  /**
   * Berechnet Block- und Himmelslicht für einen Bereich.
   * @param {import('../ebene0/welt.js').Welt} welt
   * @param {{von:{x:number,y:number,z:number}, bis:{x:number,y:number,z:number}}} bereich Ecken inklusive
   * @param {{himmel?: 'tag'|'regen'|'gewitter'|'nacht'}} [optionen]
   */
  function lichtkarte(welt, bereich, { himmel = 'nacht' } = {}) {
    if (!Object.hasOwn(himmelsWerte, himmel)) throw new Error(`Unbekannter Himmelszustand: ${himmel}`);
    const lo = { x: Math.min(bereich.von.x, bereich.bis.x), y: Math.min(bereich.von.y, bereich.bis.y), z: Math.min(bereich.von.z, bereich.bis.z) };
    const hi = { x: Math.max(bereich.von.x, bereich.bis.x), y: Math.max(bereich.von.y, bereich.bis.y), z: Math.max(bereich.von.z, bereich.bis.z) };
    if (lo.y < HOEHE_MIN || hi.y > HOEHE_MAX) throw new Error(`Bereich außerhalb der Welthöhe ${HOEHE_MIN}…${HOEHE_MAX}`);
    const alle = welt.alleBloecke();
    const inhaltOben = alle.reduce((m, b) => Math.max(m, b.y), HOEHE_MIN);
    const x0 = lo.x - RAND, z0 = lo.z - RAND, y0 = Math.max(HOEHE_MIN, lo.y - RAND);
    const y1 = Math.min(HOEHE_MAX, Math.max(hi.y + RAND, inhaltOben + 1));
    const dx = hi.x + RAND - x0 + 1, dz = hi.z + RAND - z0 + 1, dy = y1 - y0 + 1;
    const n = dx * dy * dz;
    const idx = (x, y, z) => ((y - y0) * dz + (z - z0)) * dx + (x - x0);
    const innen = (x, y, z) => x >= x0 && x < x0 + dx && y >= y0 && y <= y1 && z >= z0 && z < z0 + dz;

    // Filter und Quellen je Zelle für beide Schranken (Luft: Filter 0, keine Quelle)
    const filterMin = new Uint8Array(n), filterMax = new Uint8Array(n); // Lichtfilter je Schranke (Min: 15 = blockiert)
    const schrittMin = new Uint8Array(n).fill(abnahme), schrittMax = new Uint8Array(n).fill(abnahme); // Abnahme beim Betreten waagerecht/aufwärts
    const quelleMin = new Uint8Array(n), quelleMax = new Uint8Array(n);
    const sperre = new Uint8Array(n); // Bit je Richtung (NACHBARN-Index): diese Fläche der Zelle ist voll
    for (const b of alle) {
      if (!innen(b.x, b.y, b.z)) continue;
      const e = register.bloecke.block(b.id).eigenschaften;
      const i = idx(b.x, b.y, b.z);
      if (e.lichtfilter === null) { filterMin[i] = 15; filterMax[i] = 0; } else { filterMin[i] = e.lichtfilter; filterMax[i] = e.lichtfilter; }
      schrittMax[i] = Math.max(abnahme, filterMax[i]);
      schrittMin[i] = filterMin[i] >= 15 ? 16 : Math.max(abnahme, abnahme + filterMin[i]);
      if (e.lichtform) sperre[i] = sperrflaechen(e.lichtform, b.zustand);
      if (e.licht === null) { quelleMin[i] = 0; quelleMax[i] = 15; } else { quelleMin[i] = e.licht; quelleMax[i] = e.licht; }
    }

    /** Flutfüllung: `start` enthält die Anfangswerte; Schritt = max(1, Filter), Himmelslicht senkrecht nach unten nur der Filter. */
    function flut(start, schritt, filter, himmelslicht, untere) {
      const stufe = start;
      const eimer = Array.from({ length: 16 }, () => []);
      for (let i = 0; i < n; i++) if (stufe[i] > 0) eimer[stufe[i]].push(i);
      for (let l = 15; l >= 1; l--) {
        const liste = eimer[l];
        for (let k = 0; k < liste.length; k++) {
          const i = liste[k];
          if (stufe[i] !== l) continue;
          const yy = Math.floor(i / (dz * dx)) + y0;
          const zz = Math.floor((i % (dz * dx)) / dx) + z0;
          const xx = (i % dx) + x0;
          for (let k = 0; k < 6; k++) {
            const [ax, ay, az] = NACHBARN[k];
            const nx = xx + ax, ny = yy + ay, nz = zz + az;
            if (!innen(nx, ny, nz)) continue;
            const j = idx(nx, ny, nz);
            // senkrecht nach unten: Obergrenze nur der Filter; Untergrenze nur bei vollem Himmelslicht (15), sonst wie seitlich
            if (sperre[i] & (1 << k) || sperre[j] & (1 << (k ^ 1))) continue; // volle Fläche der Zelle oder der Nachbarzelle sperrt
            const abzug = himmelslicht && ay === -1 && (!untere || l === 15) ? filter[j] : schritt[j];
            const neu = l - abzug;
            if (neu > stufe[j]) { stufe[j] = neu; eimer[neu].push(j); }
          }
        }
      }
      return stufe;
    }

    const blockMin = flut(Uint8Array.from(quelleMin), schrittMin, filterMin, false, true);
    const blockMax = flut(Uint8Array.from(quelleMax), schrittMax, filterMax, false, false);

    /** Himmelslicht: Spalten von oben, dann seitlich auffüllen. */
    function himmelAnfang(filter, untere) {
      const start = new Uint8Array(n);
      for (let z = z0; z < z0 + dz; z++) {
        for (let x = x0; x < x0 + dx; x++) {
          let s = 15;
          for (let y = y1; y >= y0 && s > 0; y--) {
            const i = idx(x, y, z);
            if (sperre[i] & (1 << RICHTUNG_BIT.up)) s = 0;
            s = Math.max(0, s - (untere && filter[i] > 0 && filter[i] < 15 ? abnahme + filter[i] : filter[i]));
            start[i] = s;
            if (sperre[i] & (1 << RICHTUNG_BIT.down)) s = 0;
          }
        }
      }
      return start;
    }
    const himmelMin = flut(himmelAnfang(filterMin, true), schrittMin, filterMin, true, true);
    const himmelMax = flut(himmelAnfang(filterMax, false), schrittMax, filterMax, true, false);

    const pruefe = (x, y, z) => {
      if (x < lo.x || x > hi.x || y < lo.y || y > hi.y || z < lo.z || z > hi.z) throw new Error(`(${x}, ${y}, ${z}) liegt außerhalb des berechneten Bereichs`);
      return idx(x, y, z);
    };
    const abzug = 15 - himmelsWerte[himmel];
    return {
      bereich: { von: lo, bis: hi },
      himmel,
      /** Blocklicht {min, max} am Feld */
      block: (x, y, z) => { const i = pruefe(x, y, z); return { min: blockMin[i], max: blockMax[i] }; },
      /** Himmelslicht (Rohwert 0–15) {min, max} */
      himmelRoh: (x, y, z) => { const i = pruefe(x, y, z); return { min: himmelMin[i], max: himmelMax[i] }; },
      /** „Inneres“ Himmelslicht für Spawnregeln: Rohwert abzüglich (15 − Wert bei Rohlicht 15) – Annahme, siehe Regel licht.himmel-innen */
      himmelInnen: (x, y, z) => { const i = pruefe(x, y, z); return { min: Math.max(0, himmelMin[i] - abzug), max: Math.max(0, himmelMax[i] - abzug) }; },
      /** Ist das Feld sicher hell (Blocklicht ≥ 1), sicher dunkel (Blocklicht 0) oder unklar? */
      blocklicht: (x, y, z) => { const i = pruefe(x, y, z); return blockMin[i] >= 1 ? 'hell' : blockMax[i] === 0 ? 'dunkel' : 'unklar'; },
    };
  }

  return { lichtkarte, himmelsWerte };
}

/** Volle Flächen (Bitmaske nach NACHBARN-Index) einer Treppe oder Halbstufe aus ihren Zuständen. */
function sperrflaechen(form, zustand) {
  if (form === 'halbstufe') return 1 << (zustand['minecraft:vertical_half'] === 'top' ? RICHTUNG_BIT.up : RICHTUNG_BIT.down);
  if (form === 'treppe') {
    const rueck = STUFE_RICHTUNG[zustand.weirdo_direction];
    if (rueck === undefined) throw new Error(`Treppe ohne gültige Richtung: ${zustand.weirdo_direction}`);
    return (1 << (zustand.upside_down_bit ? RICHTUNG_BIT.up : RICHTUNG_BIT.down)) | (1 << RICHTUNG_BIT[rueck]);
  }
  return 0;
}

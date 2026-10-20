// Ebene 1 – Mechanik „Licht“ (Blocklicht und Himmelslicht)
// Regeln: data/regeln/licht.json (Quelle und Status je Regel).
//   - Blocklicht: Lichtquellen (Ebene-0-Eigenschaft `licht`), Flutfüllung, Abnahme je Block = max(1, Lichtfilter des betretenen Blocks).
//   - Himmelslicht: 15 an freien Blöcken; senkrecht nach unten nur um den Lichtfilter, seitlich und aufwärts wie Blocklicht.
//   - Unbekannte Lichtfilter (null in Ebene 0, z. B. Glas, Treppen, Zäune) werden NICHT geraten: es wird zweimal gerechnet,
//     mit „Unbekanntes blockiert“ (Minimum) und „Unbekanntes lässt durch“ (Maximum). Dasselbe gilt für Lichtquellen mit
//     zustandsabhängiger Stärke (licht = null: Minimum 0, Maximum 15). Wo Minimum und Maximum auseinanderliegen, ist das Ergebnis „unklar“.
// Die Welt wird nur über Ebene 0 gelesen. Es wird nur ein begrenzter Bereich berechnet (Bereich ± 15), nicht die ganze Welt.
import { HOEHE_MAX, HOEHE_MIN } from '../ebene0/richtungen.js';

const RAND = 15;
const NACHBARN = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]];

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, register: {bloecke: import('../ebene0/blockregister.js').Blockregister}}} quellen
 */
export function erzeugeLicht({ regelwerk, register }) {
  const himmelsWerte = regelwerk.parameter('licht.himmel-innen', 'werte');

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
    const filterMin = new Uint8Array(n), filterMax = new Uint8Array(n);
    const quelleMin = new Uint8Array(n), quelleMax = new Uint8Array(n);
    for (const b of alle) {
      if (!innen(b.x, b.y, b.z)) continue;
      const e = register.bloecke.block(b.id).eigenschaften;
      const i = idx(b.x, b.y, b.z);
      if (e.lichtfilter === null) { filterMin[i] = 15; filterMax[i] = 0; } else { filterMin[i] = e.lichtfilter; filterMax[i] = e.lichtfilter; }
      if (e.licht === null) { quelleMin[i] = 0; quelleMax[i] = 15; } else { quelleMin[i] = e.licht; quelleMax[i] = e.licht; }
    }

    /** Flutfüllung: `start` enthält die Anfangswerte; Schritt = max(1, Filter), Himmelslicht senkrecht nach unten nur der Filter. */
    function flut(start, filter, himmelslicht) {
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
          for (const [ax, ay, az] of NACHBARN) {
            const nx = xx + ax, ny = yy + ay, nz = zz + az;
            if (!innen(nx, ny, nz)) continue;
            const j = idx(nx, ny, nz);
            const schritt = himmelslicht && ay === -1 ? filter[j] : Math.max(1, filter[j]);
            const neu = l - schritt;
            if (neu > stufe[j]) { stufe[j] = neu; eimer[neu].push(j); }
          }
        }
      }
      return stufe;
    }

    const blockMin = flut(Uint8Array.from(quelleMin), filterMin, false);
    const blockMax = flut(Uint8Array.from(quelleMax), filterMax, false);

    /** Himmelslicht: Spalten von oben, dann seitlich auffüllen. */
    function himmelAnfang(filter) {
      const start = new Uint8Array(n);
      for (let z = z0; z < z0 + dz; z++) {
        for (let x = x0; x < x0 + dx; x++) {
          let s = 15;
          for (let y = y1; y >= y0 && s > 0; y--) {
            const i = idx(x, y, z);
            s = Math.max(0, s - filter[i]);
            start[i] = s;
          }
        }
      }
      return start;
    }
    const himmelMin = flut(himmelAnfang(filterMin), filterMin, true);
    const himmelMax = flut(himmelAnfang(filterMax), filterMax, true);

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

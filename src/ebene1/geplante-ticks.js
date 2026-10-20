// Ebene 1 – Geplante Ticks (Wasser, verzögerte Bauteile …)
// Regel `takt.geplante-ticks-grenze`: Bedrock führt höchstens 100 geplante Ticks je Chunk und Spieltick aus.
// Regel `takt.geplante-ticks-ueberlauf` (UNGEPRÜFT): was darüber liegt, bleibt in der Warteschlange und kommt
// im nächsten Spieltick zuerst wieder dran (feste Reihenfolge: fällig seit, dann Einreihreihenfolge).
import { chunkVon } from '../ebene0/richtungen.js';

export const MAX_GEPLANTE_TICKS_PRO_CHUNK = 100;

export class GeplanteTicks {
  constructor({ max = MAX_GEPLANTE_TICKS_PRO_CHUNK } = {}) {
    this.max = max;
    this._eintraege = [];
    this._nr = 1;
  }

  /**
   * @param {{x:number, z:number, ab:number, mechanik:string, daten?:any}} e Blockposition, erster Tick, Ziel-Mechanik
   * @returns {number} laufende Nummer
   */
  plane({ x, z, ab, mechanik, daten = null }) {
    if (!Number.isInteger(x) || !Number.isInteger(z)) throw new Error('x und z müssen ganze Zahlen sein');
    if (!Number.isInteger(ab) || ab < 0) throw new Error('„ab“ muss ein Spieltick >= 0 sein');
    if (typeof mechanik !== 'string' || !mechanik) throw new Error('mechanik fehlt');
    const { cx, cz } = chunkVon(x, z);
    const nr = this._nr++;
    this._eintraege.push({ nr, x, z, cx, cz, ab, mechanik, daten });
    return nr;
  }

  anzahl() {
    return this._eintraege.length;
  }

  /**
   * Entnimmt alle fälligen Einträge dieses Ticks (höchstens `max` je Chunk), sortiert nach (ab, nr).
   * @param {number} tick aktueller Spieltick
   * @param {(cx:number, cz:number) => boolean} [tickt] nur Chunks, die ticken (andere warten weiter)
   */
  faellige(tick, tickt = () => true) {
    const faellig = this._eintraege
      .filter((e) => e.ab <= tick && tickt(e.cx, e.cz))
      .sort((a, b) => a.ab - b.ab || a.nr - b.nr);
    const proChunk = new Map();
    const genommen = [];
    for (const e of faellig) {
      const k = `${e.cx},${e.cz}`;
      const n = proChunk.get(k) ?? 0;
      if (n >= this.max) continue;
      proChunk.set(k, n + 1);
      genommen.push(e);
    }
    const weg = new Set(genommen);
    this._eintraege = this._eintraege.filter((e) => !weg.has(e));
    return genommen;
  }
}

// Ebene 1 – Tickbereich: welche Chunks ticken überhaupt?
// Regel `takt.tickbereich`: Bedrock tickt alle Chunks innerhalb der Simulationsdistanz um Spieler
// (oder in einer Tickingarea). Form der Distanz (hier: Quadrat) und Standardwert sind ungeprüft,
// darum gibt es keinen Standardwert: die Distanz muss angegeben werden.
import { chunkVon } from '../ebene0/richtungen.js';

export class Tickbereich {
  /**
   * @param {{spieler?: {x:number, z:number}[], distanz?: number, tickingAreas?: {von:{x:number,z:number}, bis:{x:number,z:number}}[]}} optionen
   *   spieler: Blockposition; distanz: Chunks (ganze Zahl >= 0); tickingAreas: Blockrechtecke (Ecken inklusive)
   */
  constructor({ spieler = [], distanz, tickingAreas = [] } = {}) {
    if (spieler.length && !(Number.isInteger(distanz) && distanz >= 0)) {
      throw new Error('Mit Spielern braucht der Tickbereich eine Simulationsdistanz in Chunks (ganze Zahl >= 0)');
    }
    this._tickend = new Set();
    for (const s of spieler) {
      const { cx, cz } = chunkVon(Math.floor(s.x), Math.floor(s.z));
      for (let dx = -distanz; dx <= distanz; dx++) for (let dz = -distanz; dz <= distanz; dz++) this._tickend.add(`${cx + dx},${cz + dz}`);
    }
    for (const a of tickingAreas) {
      const c1 = chunkVon(Math.floor(Math.min(a.von.x, a.bis.x)), Math.floor(Math.min(a.von.z, a.bis.z)));
      const c2 = chunkVon(Math.floor(Math.max(a.von.x, a.bis.x)), Math.floor(Math.max(a.von.z, a.bis.z)));
      for (let cx = c1.cx; cx <= c2.cx; cx++) for (let cz = c1.cz; cz <= c2.cz; cz++) this._tickend.add(`${cx},${cz}`);
    }
  }

  tickt(cx, cz) {
    return this._tickend.has(`${cx},${cz}`);
  }

  ticktBlock(x, z) {
    const { cx, cz } = chunkVon(Math.floor(x), Math.floor(z));
    return this.tickt(cx, cz);
  }

  /** Alle tickenden Chunks, sortiert nach (cx, cz). */
  chunks() {
    return [...this._tickend]
      .map((k) => k.split(',').map(Number))
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .map(([cx, cz]) => ({ cx, cz }));
  }
}

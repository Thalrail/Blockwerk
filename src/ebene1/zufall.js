// Ebene 1 – Deterministischer Zufall: gleicher Startwert = gleiche Folge. Die Engine nutzt nie Math.random.
// Dazu eine Erwartungswert-Rechnung („reif nach ca. X Minuten“), damit Aussagen nicht vom Zufall abhängen.
import { ticksZuSekunden } from './weltzeit.js';

/** mulberry32: klein, schnell, für Simulationen ausreichend (keine Kryptografie). */
export class Zufall {
  /** @param {number} seed ganze Zahl */
  constructor(seed) {
    if (!Number.isInteger(seed)) throw new Error('Startwert (seed) muss eine ganze Zahl sein');
    this.seed = seed;
    this._zustand = seed >>> 0;
  }

  /** Nächste Zahl in [0, 1). */
  naechste() {
    this._zustand = (this._zustand + 0x6d2b79f5) >>> 0;
    let t = this._zustand;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Ganze Zahl in [0, n). */
  ganzzahl(n) {
    if (!Number.isInteger(n) || n < 1) throw new Error('n muss eine ganze Zahl >= 1 sein');
    return Math.floor(this.naechste() * n);
  }

  /** true mit Wahrscheinlichkeit p. */
  ereignis(p) {
    if (!(p >= 0 && p <= 1)) throw new Error('Wahrscheinlichkeit muss zwischen 0 und 1 liegen');
    return this.naechste() < p;
  }

  kopie() {
    const k = new Zufall(this.seed);
    k._zustand = this._zustand;
    return k;
  }
}

/** Erwartete Ticks bis zum ersten Ereignis, wenn es je Tick mit Wahrscheinlichkeit p eintritt (geometrisch: 1/p). */
export function erwarteteTicks(pProTick) {
  if (!(pProTick > 0 && pProTick <= 1)) throw new Error('Wahrscheinlichkeit muss in (0, 1] liegen');
  return 1 / pProTick;
}

export function erwarteteMinuten(pProTick) {
  return ticksZuSekunden(Math.round(erwarteteTicks(pProTick))) / 60;
}

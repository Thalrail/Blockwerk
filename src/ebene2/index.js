// Ebene 2 – Bausteine („Die Bibliothek“). Einstiegspunkt.
// Dieser Stand liefert das Baustein-Paket und die Formen. Bauelemente und Technikmodule kommen schrittweise dazu.
import { erzeugeFormen } from './formen.js';
import { erzeugeBogen } from './bogen.js';
import { erzeugeDach } from './dach.js';
import { erzeugeBauelemente } from './bauelemente.js';
import { erzeugeTechnik } from './technik.js';
import { erzeugeLager } from './lager.js';
import { erzeugeSchienen } from '../ebene1/schienen.js';
import { platziere as platziereRoh } from './baustein.js';

export { GROESSENARTEN, ROLLEN, FORMEN, RICHTUNGEN, TESTPALETTE, definiere, param, listeParam, platziere, pruefePaket, huelleVon } from './baustein.js';
export { erzeugeFormen } from './formen.js';
export { erzeugeBogen } from './bogen.js';
export { erzeugeDach } from './dach.js';
export { erzeugeBauelemente, ring } from './bauelemente.js';
export { erzeugeTechnik } from './technik.js';
export { erzeugeLager } from './lager.js';

/**
 * @param {{ebene0: ReturnType<typeof import('../ebene0/index.js').erzeugeEbene0>, regelwerk: import('../ebene1/regelwerk.js').Regelwerk}} quellen
 */
export function erzeugeEbene2({ ebene0, regelwerk }) {
  const formen = erzeugeFormen({ regelwerk });
  const bogen = erzeugeBogen({ regelwerk });
  const dach = erzeugeDach({ regelwerk });
  const bauelemente = erzeugeBauelemente({ regelwerk, formen });
  const schienen = erzeugeSchienen({ regelwerk, register: ebene0.register });
  const technik = erzeugeTechnik({ regelwerk, schienen, ebene0 });
  const lager = erzeugeLager({ regelwerk, ebene0 });
  const bausteine = new Map([...formen.alle, ...bogen.alle, ...dach.alle, ...bauelemente.alle, ...technik.alle, ...lager.alle].map((b) => [b.id, b]));
  return {
    ebene0,
    formen,
    bogen,
    dach,
    bauelemente,
    technik,
    lager,
    bausteine,
    /** Setzt ein Paket in eine Welt; formgebundene Blöcke (Treppe, Tür) bekommen ihre Zustände aus den Drehregeln von Ebene 0. */
    platziere: (welt, paket, palette, versatz) => platziereRoh(welt, paket, palette, versatz, ebene0),
    /** Baut einen Baustein nach Namen. */
    baue(id, werte) {
      const b = bausteine.get(id);
      if (!b) throw new Error(`Unbekannter Baustein: ${id}`);
      return b.erzeuge(werte);
    },
  };
}

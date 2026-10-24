// Ebene 2 – Bausteine („Die Bibliothek“). Einstiegspunkt.
// Dieser Stand liefert das Baustein-Paket und die Formen. Bauelemente und Technikmodule kommen schrittweise dazu.
import { erzeugeFormen } from './formen.js';
import { erzeugeBogen } from './bogen.js';
import { erzeugeDach } from './dach.js';

export { GROESSENARTEN, ROLLEN, TESTPALETTE, definiere, param, platziere, pruefePaket, huelleVon } from './baustein.js';
export { erzeugeFormen } from './formen.js';
export { erzeugeBogen } from './bogen.js';
export { erzeugeDach } from './dach.js';

/**
 * @param {{ebene0: ReturnType<typeof import('../ebene0/index.js').erzeugeEbene0>, regelwerk: import('../ebene1/regelwerk.js').Regelwerk}} quellen
 */
export function erzeugeEbene2({ ebene0, regelwerk }) {
  const formen = erzeugeFormen({ regelwerk });
  const bogen = erzeugeBogen({ regelwerk });
  const dach = erzeugeDach({ regelwerk });
  const bausteine = new Map([...formen.alle, ...bogen.alle, ...dach.alle].map((b) => [b.id, b]));
  return {
    ebene0,
    formen,
    bogen,
    dach,
    bausteine,
    /** Baut einen Baustein nach Namen. */
    baue(id, werte) {
      const b = bausteine.get(id);
      if (!b) throw new Error(`Unbekannter Baustein: ${id}`);
      return b.erzeuge(werte);
    },
  };
}

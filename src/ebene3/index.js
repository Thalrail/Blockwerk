// Ebene 3 – Planung („Die Fachleute“). Einstiegspunkt.
// Dieser Stand liefert das Gerüst: Planentwurf, Besitz und Rangfolge, Einwand-Protokoll mit Bauleiter, Baubericht und die Brücke zu Ebene 0–2.
// Die Fachleute selbst (Konstrukteur, Techniker, Architekt, Designer, Grobdesigner) folgen schrittweise.
import { erzeugeFachleute } from './fachleute.js';
import { erzeugeMaterialisierung } from './materialisiere.js';
import { erzeugeEinwaende } from './einwand.js';
import { erzeugeKonstrukteur } from './konstrukteur.js';

export { VERSION, neuerEntwurf, kopie, pruefeForm, entwurfZuJson, entwurfAusJson } from './entwurf.js';
export { haengeAn, berichtAlsText } from './bericht.js';
export { RechtFehler, erzeugeFachleute } from './fachleute.js';
export { rueckfrage } from './bauleiter.js';
export { erzeugeMaterialisierung } from './materialisiere.js';
export { erzeugeEinwaende } from './einwand.js';
export { erzeugeKonstrukteur, GliederungFehler } from './konstrukteur.js';

/**
 * @param {{ebene0: object, ebene1: object, ebene2: object, regelwerk: import('../ebene1/regelwerk.js').Regelwerk}} quellen
 */
export function erzeugeEbene3({ ebene0, ebene1, ebene2, regelwerk }) {
  const fachleute = erzeugeFachleute({ regelwerk });
  const materialisierung = erzeugeMaterialisierung({ regelwerk, ebene0, ebene1, ebene2 });
  const konstrukteur = erzeugeKonstrukteur({ regelwerk, fachleute, ebene2 });
  const einwaende = erzeugeEinwaende({ regelwerk, fachleute, materialisierung, naehte: konstrukteur.naehte });
  return {
    fachleute,
    konstrukteur,
    aendere: fachleute.aendere,
    fixiere: fachleute.fixiere,
    materialisiere: materialisierung.materialisiere,
    pruefeEntwurf: materialisierung.pruefeEntwurf,
    einwaende,
    laufe: einwaende.laufe,
  };
}

// Ebene 3 – Planung („Die Fachleute“). Einstiegspunkt.
// Dieser Stand liefert das Gerüst: Planentwurf, Besitz und Rangfolge, Einwand-Protokoll mit Bauleiter, Baubericht und die Brücke zu Ebene 0–2.
// Die Fachleute: Konstrukteur, Techniker, Grobdesigner, Architekt, Designer (Rückgriff und Abschlussprüfung folgen).
import { erzeugeFachleute } from './fachleute.js';
import { erzeugeMaterialisierung } from './materialisiere.js';
import { erzeugeEinwaende } from './einwand.js';
import { erzeugeKonstrukteur } from './konstrukteur.js';
import { erzeugeTechniker } from './techniker.js';
import { erzeugeGrobdesigner } from './grobdesigner.js';
import { erzeugeArchitekt } from './architekt.js';
import { erzeugeDesigner, erzeugePaletten } from './designer.js';

export { VERSION, neuerEntwurf, kopie, pruefeForm, entwurfZuJson, entwurfAusJson } from './entwurf.js';
export { haengeAn, berichtAlsText } from './bericht.js';
export { RechtFehler, erzeugeFachleute } from './fachleute.js';
export { rueckfrage, stelleFrage } from './bauleiter.js';
export { erzeugeMaterialisierung } from './materialisiere.js';
export { erzeugeEinwaende } from './einwand.js';
export { erzeugeKonstrukteur, GliederungFehler } from './konstrukteur.js';
export { erzeugeTechniker, BedarfFehler } from './techniker.js';
export { erzeugeGrobdesigner, ZonenFehler } from './grobdesigner.js';
export { erzeugeArchitekt, FormFehler } from './architekt.js';
export { erzeugeDesigner, erzeugePaletten, GestaltungsFehler } from './designer.js';

/**
 * @param {{ebene0: object, ebene1: object, ebene2: object, regelwerk: import('../ebene1/regelwerk.js').Regelwerk}} quellen
 */
export function erzeugeEbene3({ ebene0, ebene1, ebene2, regelwerk }) {
  const paletten = erzeugePaletten({ regelwerk, ebene0 });
  const fachleute = erzeugeFachleute({ regelwerk, pruefePalette: paletten.pruefe });
  const materialisierung = erzeugeMaterialisierung({ regelwerk, ebene0, ebene1, ebene2 });
  const konstrukteur = erzeugeKonstrukteur({ regelwerk, fachleute, ebene2 });
  const techniker = erzeugeTechniker({ regelwerk, fachleute, ebene1, ebene2, materialisierung });
  const grobdesigner = erzeugeGrobdesigner({ regelwerk, fachleute, techniker });
  const architekt = erzeugeArchitekt({ regelwerk, fachleute, ebene2, materialisierung });
  const designer = erzeugeDesigner({ fachleute, paletten });
  const einwaende = erzeugeEinwaende({ regelwerk, fachleute, materialisierung, naehte: konstrukteur.naehte, zusaetze: (e) => [...techniker.einwaende(e), ...architekt.einwaende(e)] });
  return {
    fachleute,
    konstrukteur,
    techniker,
    grobdesigner,
    architekt,
    designer,
    paletten,
    aendere: fachleute.aendere,
    fixiere: fachleute.fixiere,
    materialisiere: materialisierung.materialisiere,
    pruefeEntwurf: materialisierung.pruefeEntwurf,
    einwaende,
    laufe: einwaende.laufe,
  };
}

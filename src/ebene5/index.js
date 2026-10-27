// Ebene 5 – Ausgabe & Oberfläche (Logik ohne Oberfläche). Die Oberfläche selbst (DOM, Canvas, Worker) liegt in `index.html` und `web/`.
// Diese Ebene rechnet nichts Neues aus und ändert nie direkt Welt oder Plan; sie ordnet an, zeigt, rechnet Mengen um und verwaltet den Fortschritt.
import { erzeugeDarstellung } from './darstellung.js';
import { erzeugeBauplan } from './bauplan.js';
import { erzeugeMaterial } from './material.js';

export { ladeEngine } from './daten-browser.js';
export { erzeugeDarstellung } from './darstellung.js';
export { erzeugeBauplan, RICHTUNGEN, ARTEN, fnv } from './bauplan.js';
export { baueNetz } from './netz.js';
export * as kamera from './kamera.js';
export * as matrix from './matrix.js';
export { erzeugeMaterial, umrechnen, umrechnungsText, KISTE } from './material.js';
export * as fortschritt from './fortschritt.js';
export * as teilen from './teilen.js';
export { erzeugeAtlas, WEISS } from './atlas.js';
export { benoetigteBloecke, erzeugeIndex, loeseAuf } from './texturen.js';
export * as eingabe from './eingabe.js';
export * as live from './live.js';

/**
 * @param {{ebene0: object, ebene3: object, darstellungsdaten: {farben: object[], namen: object}, texturen?: object | null}} quellen
 */
export function erzeugeEbene5({ ebene0, ebene3, darstellungsdaten, texturen = null }) {
  const darstellung = erzeugeDarstellung(darstellungsdaten, texturen);
  const { bauplan } = erzeugeBauplan({ ebene0, ebene3, darstellung });
  const material = erzeugeMaterial({ register: ebene0.register, darstellung });
  return { darstellung, bauplan, material: material.material, materialListe: material.liste };
}

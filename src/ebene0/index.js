// Ebene 0 – Fundament („Welt und Wahrheit“). Einstiegspunkt.
// Eine Kopie von Minecraft Bedrock ohne Simulation und ohne Weltgenerator.
import { Blockregister } from './blockregister.js';
import { Wesenregister } from './wesenregister.js';
import { Welt } from './welt.js';
import { erzeugeVermesser } from './vermesser.js';
import { weltAusJson, weltAusObjekt, weltZuJson, weltZuObjekt } from './speichern.js';

export * from './richtungen.js';
export { Blockregister, LUFT } from './blockregister.js';
export { Wesenregister, SPIELER, ITEM, DORFBEWOHNER } from './wesenregister.js';
export { Welt, MAX_STAPEL } from './welt.js';
export { erzeugeVermesser, ungedeckteRichtungszustaende } from './vermesser.js';
export { weltAusJson, weltAusObjekt, weltZuJson, weltZuObjekt } from './speichern.js';

/**
 * Baut aus den Datendateien alles, was Ebene 0 anbietet.
 * @param {{bloecke:object, wesen:object, gegenstaende:{gegenstaende:string[]}, drehregeln:object}} daten
 */
export function erzeugeEbene0(daten) {
  const bloecke = new Blockregister(daten.bloecke);
  const wesen = new Wesenregister(daten.wesen);
  const register = { bloecke, wesen, gegenstaende: daten.gegenstaende.gegenstaende };
  const vermesser = erzeugeVermesser({ regeln: daten.drehregeln, register: bloecke });
  return {
    register,
    drehregeln: daten.drehregeln,
    vermesser,
    neueWelt: () => new Welt(register),
    ladeWelt: (text) => weltAusJson(text, register),
    ladeWeltObjekt: (obj) => weltAusObjekt(obj, register),
    speichereWelt: weltZuJson,
    weltAlsObjekt: weltZuObjekt,
  };
}

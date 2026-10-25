// Ebene 5 – Daten laden per fetch (Browser, Worker; unter Node mit einer Attrappe testbar) und die ganze Engine (Ebene 0–4) zusammensetzen.
// Die Engine selbst liest keine Dateien: `holeJson(pfad)` liefert das geparste JSON relativ zur Wurzel des Projekts (z. B. 'data/bloecke.json').
import { erzeugeEbene0 } from '../ebene0/index.js';
import { erzeugeEbene1 } from '../ebene1/index.js';
import { erzeugeEbene2 } from '../ebene2/index.js';
import { erzeugeEbene3 } from '../ebene3/index.js';
import { erzeugeEbene4 } from '../ebene4/index.js';

/**
 * @param {(pfad: string) => Promise<any>} holeJson
 * @returns {Promise<{ebene0: object, ebene1: object, ebene2: object, ebene3: object, ebene4: object}>}
 */
export async function ladeEngine(holeJson) {
  const [bloecke, wesen, gegenstaende, drehregeln, regeldateien] = await Promise.all(
    ['bloecke', 'wesen', 'gegenstaende', 'drehregeln'].map((n) => holeJson(`data/${n}.json`)).concat([holeJson('data/regeldateien.json')]),
  );
  const regeln = await Promise.all(regeldateien.map((n) => holeJson(`data/regeln/${n}`)));
  const ebene0 = erzeugeEbene0({ bloecke, wesen, gegenstaende, drehregeln });
  const ebene1 = { ebene0, ...erzeugeEbene1({ ebene0, regeln }) };
  const regelwerk = ebene1.regelwerk;
  const ebene2 = { ebene1, ...erzeugeEbene2({ ebene0, regelwerk }) };
  const ebene3 = { ebene2, ebene1, ebene0, ...erzeugeEbene3({ ebene0, ebene1, ebene2, regelwerk }) };
  const ebene4 = { ebene3, ebene2, ebene1, ebene0, ...erzeugeEbene4({ ebene0, ebene2, ebene3, regelwerk }) };
  return { ebene0, ebene1, ebene2, ebene3, ebene4 };
}

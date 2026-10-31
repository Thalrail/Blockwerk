// Zählt die Regeln des Regelwerks nach Status für den Prüfbericht.
// Der Status im Regelwerk heißt „geprüft“ (mit Umlaut); der Zähler führt ihn unter dem Schlüssel `geprueft`.
import { STATI } from '../src/ebene1/regelwerk.js';

/** @param {Array<{status: string, ungeprueft?: boolean}>} regeln @returns {{simuliert: number, entworfen: number, geprueft: number, ungeprueft: number, gesamt: number}} */
export function zaehleStatus(regeln) {
  const zaehl = { simuliert: 0, entworfen: 0, geprueft: 0, ungeprueft: 0, gesamt: 0 };
  for (const x of regeln) {
    zaehl.gesamt++;
    if (!STATI.includes(x.status)) throw new Error(`Unbekannter Regelstatus „${x.status}“`);
    zaehl[x.status === 'geprüft' ? 'geprueft' : x.status]++;
    if (x.ungeprueft) zaehl.ungeprueft++;
  }
  return zaehl;
}

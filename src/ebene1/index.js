// Ebene 1 – Uhrwerk & Mechanik. Einstiegspunkt.
// Dieser Stand liefert den Unterbau: Taktgeber, geplante Ticks, Tickbereich, Sandkasten, Regelwerk (Daten), Prüfer.
// Konkrete Mechaniken (Schienen, Wasser, Redstone …) kommen schrittweise dazu und melden sich beim Taktgeber an.
import { Regelwerk } from './regelwerk.js';
import { Sandkasten } from './sandkasten.js';
import { Taktgeber, STANDARD_REIHENFOLGE } from './taktgeber.js';
import { pruefe } from './pruefer.js';
import { erzeugeSchienen } from './schienen.js';

export * from './weltzeit.js';
export { Zufall, erwarteteTicks, erwarteteMinuten } from './zufall.js';
export { Tickbereich } from './tickbereich.js';
export { GeplanteTicks, MAX_GEPLANTE_TICKS_PRO_CHUNK } from './geplante-ticks.js';
export { Sandkasten } from './sandkasten.js';
export { Taktgeber, TICKARTEN, STANDARD_REIHENFOLGE, phaseVon } from './taktgeber.js';
export { Regelwerk, STATI } from './regelwerk.js';
export { pruefe } from './pruefer.js';
export { erzeugeSchienen } from './schienen.js';

/**
 * @param {{ebene0: ReturnType<typeof import('../ebene0/index.js').erzeugeEbene0>, regeln: object[]}} quellen
 *   regeln = Inhalte der Dateien aus data/regeln/*.json
 */
export function erzeugeEbene1({ ebene0, regeln }) {
  const regelwerk = new Regelwerk(regeln);
  const reihenfolge = regelwerk.parameter('takt.arbeitsreihenfolge', 'reihenfolge') ?? [...STANDARD_REIHENFOLGE];
  const schienen = erzeugeSchienen({ regelwerk, register: ebene0.register });
  return {
    regelwerk,
    schienen,
    neuerSandkasten: (welt) => new Sandkasten(welt),
    neuerTaktgeber: (sandkasten, optionen = {}) => new Taktgeber(sandkasten, { reihenfolge, ...optionen }),
    pruefe: (welt, optionen = {}) => pruefe(welt, { register: ebene0.register, richtungVon: ebene0.vermesser.richtungVon, schienen, ...optionen }),
  };
}

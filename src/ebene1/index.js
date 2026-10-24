// Ebene 1 – Uhrwerk & Mechanik. Einstiegspunkt.
// Dieser Stand liefert den Unterbau: Taktgeber, geplante Ticks, Tickbereich, Sandkasten, Regelwerk (Daten), Prüfer.
// Konkrete Mechaniken (Schienen, Wasser, Redstone …) kommen schrittweise dazu und melden sich beim Taktgeber an.
import { Regelwerk } from './regelwerk.js';
import { Sandkasten } from './sandkasten.js';
import { Taktgeber, STANDARD_REIHENFOLGE } from './taktgeber.js';
import { pruefe } from './pruefer.js';
import { erzeugeSchienen } from './schienen.js';
import { erzeugeAntrieb } from './antrieb.js';
import { erzeugeFluessigkeit } from './fluessigkeit.js';
import { erzeugeLicht } from './licht.js';
import { erzeugeSpawn } from './spawn.js';

export * from './weltzeit.js';
export { Zufall, erwarteteTicks, erwarteteMinuten } from './zufall.js';
export { Tickbereich } from './tickbereich.js';
export { GeplanteTicks, MAX_GEPLANTE_TICKS_PRO_CHUNK } from './geplante-ticks.js';
export { Sandkasten } from './sandkasten.js';
export { Taktgeber, TICKARTEN, STANDARD_REIHENFOLGE, phaseVon } from './taktgeber.js';
export { Regelwerk, STATI } from './regelwerk.js';
export { pruefe } from './pruefer.js';
export { erzeugeSchienen } from './schienen.js';
export { erzeugeAntrieb } from './antrieb.js';
export { erzeugeFluessigkeit } from './fluessigkeit.js';
export { erzeugeLicht } from './licht.js';
export { erzeugeSpawn } from './spawn.js';

/**
 * @param {{ebene0: ReturnType<typeof import('../ebene0/index.js').erzeugeEbene0>, regeln: object[]}} quellen
 *   regeln = Inhalte der Dateien aus data/regeln/*.json
 */
export function erzeugeEbene1({ ebene0, regeln }) {
  const regelwerk = new Regelwerk(regeln);
  const reihenfolge = regelwerk.parameter('takt.arbeitsreihenfolge', 'reihenfolge') ?? [...STANDARD_REIHENFOLGE];
  const schienen = erzeugeSchienen({ regelwerk, register: ebene0.register });
  const antrieb = erzeugeAntrieb({ regelwerk, schienen });
  const fluessigkeit = erzeugeFluessigkeit({ regelwerk, register: ebene0.register });
  const licht = erzeugeLicht({ regelwerk, register: ebene0.register });
  const spawn = erzeugeSpawn({ regelwerk, register: ebene0.register, licht });
  return {
    regelwerk,
    schienen,
    antrieb,
    fluessigkeit,
    licht,
    spawn,
    neuerSandkasten: (welt) => new Sandkasten(welt),
    neuerTaktgeber: (sandkasten, optionen = {}) => new Taktgeber(sandkasten, { reihenfolge, ...optionen }),
    pruefe: (welt, optionen = {}) => pruefe(welt, { register: ebene0.register, richtungVon: ebene0.vermesser.richtungVon, schienen, antrieb, fluessigkeit, spawn, ...optionen }),
  };
}

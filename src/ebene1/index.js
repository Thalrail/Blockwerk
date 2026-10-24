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
import { erzeugeLore } from './lore.js';
import { erzeugeFallen } from './fallen.js';
import { erzeugeTrichter } from './trichter.js';
import { erzeugeRedstone } from './redstone.js';
import { erzeugeRedstoneZeit } from './redstone-zeit.js';
import { erzeugeKolben } from './kolben.js';
import { erzeugeBewegung } from './bewegung.js';
import { erzeugeDorf } from './dorf.js';

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
export { erzeugeLore } from './lore.js';
export { erzeugeFallen } from './fallen.js';
export { erzeugeTrichter } from './trichter.js';
export { erzeugeRedstone } from './redstone.js';
export { erzeugeRedstoneZeit } from './redstone-zeit.js';
export { erzeugeKolben } from './kolben.js';
export { erzeugeBewegung } from './bewegung.js';
export { erzeugeDorf } from './dorf.js';

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
  const lore = erzeugeLore({ regelwerk, schienen, antrieb });
  const fallen = erzeugeFallen({ regelwerk, register: ebene0.register });
  const redstone = erzeugeRedstone({ regelwerk, register: ebene0.register, richtungVon: ebene0.vermesser.richtungVon });
  const aktivierung = erzeugeAntrieb({ regelwerk, schienen, ids: regelwerk.parameter('redstone.aktivierungsschiene', 'ids') });
  const trichter = erzeugeTrichter({ regelwerk, register: ebene0.register, richtungVon: ebene0.vermesser.richtungVon });
  const kolben = erzeugeKolben({ regelwerk, register: ebene0.register, richtungVon: ebene0.vermesser.richtungVon });
  const bewegung = erzeugeBewegung({ regelwerk, register: ebene0.register });
  const dorf = erzeugeDorf({ regelwerk, register: ebene0.register, bewegung });
  const redstoneZeit = erzeugeRedstoneZeit({ regelwerk, register: ebene0.register, richtungVon: ebene0.vermesser.richtungVon, redstone, trichter, licht, kolben });
  return {
    regelwerk,
    schienen,
    antrieb,
    fluessigkeit,
    licht,
    spawn,
    lore,
    fallen,
    trichter,
    redstone,
    redstoneZeit,
    kolben,
    bewegung,
    dorf,
    aktivierung,
    neuerSandkasten: (welt) => new Sandkasten(welt),
    neuerTaktgeber: (sandkasten, optionen = {}) => new Taktgeber(sandkasten, { reihenfolge, ...optionen }),
    pruefe: (welt, optionen = {}) => pruefe(welt, { register: ebene0.register, richtungVon: ebene0.vermesser.richtungVon, schienen, antrieb, fluessigkeit, spawn, lore, fallen, trichter, redstone, redstoneZeit, kolben, bewegung, dorf, ...optionen }),
  };
}

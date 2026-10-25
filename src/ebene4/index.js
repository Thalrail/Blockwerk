// Ebene 4 – Leser („Der Übersetzer“). Einstiegspunkt.
// Die einzige KI-Stelle liegt außerhalb des Programms: Jonah gibt den Briefing-Prompt mit den Bildern im Claude-Chat ein und kopiert das JSON zurück.
// Hier steckt alles Deterministische drumherum: Schema und Vokabular, Prüfer mit Rückfragen, Briefing-Prompt, lesbare Zusammenfassung, Freigabe und Versionen.
import { erzeugeVokabular } from './vokabular.js';
import { erzeugePruefer } from './pruefer.js';
import { erzeugeBriefing } from './briefing.js';
import { erzeugeZusammenfassung } from './zusammenfassung.js';
import { erzeugeVersionen } from './version.js';
import { erzeugeMessung } from './messung.js';
import { erzeugeAbgleich } from './abgleich.js';

export { SpezifikationFehler, liesJson, zuJson, abdruck, kopie } from './spezifikation.js';
export { FreigabeFehler } from './version.js';
export { BildFehler } from './bild.js';
export { erzeugeVokabular, erzeugePruefer, erzeugeBriefing, erzeugeZusammenfassung, erzeugeVersionen, erzeugeMessung, erzeugeAbgleich };

/**
 * @param {{ebene0: object, ebene2: object, regelwerk: import('../ebene1/regelwerk.js').Regelwerk}} quellen
 */
export function erzeugeEbene4({ ebene0, ebene2, regelwerk }) {
  const vokabular = erzeugeVokabular({ regelwerk, ebene0, ebene2 });
  const pruefer = erzeugePruefer({ regelwerk, vokabular });
  const briefing = erzeugeBriefing({ vokabular });
  const { zusammenfassung } = erzeugeZusammenfassung({ vokabular });
  const messung = erzeugeMessung({ regelwerk });
  const abgleich = erzeugeAbgleich({ regelwerk, vokabular });
  const versionen = erzeugeVersionen({ pruefer, abgleich });
  return {
    vokabular,
    pruefe: pruefer.pruefe,
    briefing: briefing.prompt,
    beispiel: briefing.beispiel,
    zusammenfassung,
    messung,
    abgleich: abgleich.abgleich,
    ...versionen,
  };
}

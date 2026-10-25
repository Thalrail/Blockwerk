// Ebene 3 – Designer: macht aus Rollen echte Blöcke (Gesamtpalette im Vorlauf, Abschnittspaletten je Abschnitt).
// Ändert nur verkleidbare Flächen (Rollen): Technikblöcke setzt Ebene 2 fest. Arbeitsblöcke als Material sind verboten (Sperre des Technikers).
// Regeln als Daten: data/regeln/planung.json (plan.palette). Fester Algorithmus: gleiche Eingabe = gleiches Ergebnis.
import { RechtFehler } from './fachleute.js';

const FACHMANN = 'designer';

/** Fehler der Gestaltung: unbekannte Stimmung u. Ä. (kein Raten). */
export class GestaltungsFehler extends Error {
  constructor(nachricht) { super(`Gestaltung: ${nachricht}`); this.name = 'GestaltungsFehler'; }
}

/**
 * Prüfung einer Palette gegen Blockregister und Regeln; wirft RechtFehler('ungueltig'). Wird von `fachleute.aendere` bei jeder Palette aufgerufen.
 * @param {{regelwerk: object, ebene0: object}} quellen
 */
export function erzeugePaletten({ regelwerk, ebene0 }) {
  const rollen = regelwerk.parameter('plan.palette', 'rollen');
  const formen = regelwerk.parameter('plan.palette', 'formen');
  const stimmungen = regelwerk.parameter('plan.palette', 'stimmungen');
  const bloecke = ebene0.register.bloecke;
  const ungueltig = (m) => { throw new RechtFehler('ungueltig', `Palette: ${m}`); };

  /** Einträge einer Rolle als Liste [form, id]. */
  function eintraege(rolle, wert) {
    if (typeof wert === 'string') return [['voll', wert]];
    if (wert && typeof wert === 'object' && 'id' in wert) return [['voll', wert.id]];
    if (wert && typeof wert === 'object') return Object.entries(wert).map(([form, w]) => [form, typeof w === 'string' ? w : w?.id]);
    return ungueltig(`Rolle ${rolle} braucht einen Block`);
  }

  /** Prüft einen (auch unvollständigen) Palettenteil. */
  function pruefe(palette) {
    if (!palette || typeof palette !== 'object' || Array.isArray(palette)) ungueltig('keine Zuordnung von Rollen zu Blöcken');
    for (const [rolle, wert] of Object.entries(palette)) {
      if (!rollen.includes(rolle)) ungueltig(`Rolle „${rolle}“ unbekannt (${rollen.join(', ')})`);
      for (const [form, id] of eintraege(rolle, wert)) {
        if (!(form in formen)) ungueltig(`Rolle ${rolle}: Form „${form}“ unbekannt (${Object.keys(formen).join(', ')})`);
        if (typeof id !== 'string' || !bloecke.hat(id)) ungueltig(`Rolle ${rolle}: ${String(id)} steht nicht im Blockregister`);
        const eig = bloecke.block(id).eigenschaften;
        if (eig.arbeitsblock === true) ungueltig(`Rolle ${rolle}: ${id} ist ein Arbeitsblock und als Material verboten`);
        if (!id.endsWith(formen[form])) ungueltig(`Rolle ${rolle}: ${id} passt nicht zur Form „${form}“ (Name endet auf ${formen[form]})`);
        if (rolle === 'licht' && !(eig.licht > 0)) ungueltig(`Rolle licht: ${id} leuchtet nicht`);
      }
    }
  }

  /** Ist die Palette vollständig (alle Rollen und die Formen, die die Bausteine brauchen)? */
  function vollstaendig(palette) {
    return rollen.every((r) => r in palette);
  }

  return { pruefe, vollstaendig, stimmung: (name) => stimmungen[name] ?? null, stimmungen: () => Object.keys(stimmungen), rollen };
}

/**
 * @param {{fachleute: object, paletten: ReturnType<typeof erzeugePaletten>}} quellen
 */
export function erzeugeDesigner({ fachleute, paletten }) {
  const aendere = (e, a) => fachleute.aendere(e, FACHMANN, a).entwurf;
  const hole = (name) => {
    const p = paletten.stimmung(name);
    if (!p) throw new GestaltungsFehler(`Stimmung „${String(name)}“ gibt es nicht (${paletten.stimmungen().join(', ')})`);
    return p;
  };

  /** Gesamtpalette für alle Abschnitte (Vorlauf). */
  const setzePalette = (entwurf, stimmung) => aendere(entwurf, { art: 'setze-palette', palette: structuredClone(hole(stimmung)) });
  /** Abschnittspalette: geht vor der Gesamtpalette, gilt nur für diesen Abschnitt. */
  const setzeAbschnittspalette = (entwurf, abschnitt, stimmung) => aendere(entwurf, { art: 'setze-abschnittspalette', abschnitt, palette: structuredClone(hole(stimmung)) });

  return { setzePalette, setzeAbschnittspalette, stimmungen: paletten.stimmungen, GestaltungsFehler };
}

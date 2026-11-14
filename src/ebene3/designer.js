// Ebene 3 – Designer: macht aus Rollen echte Blöcke (Gesamtpalette im Vorlauf, Abschnittspaletten je Abschnitt).
// Ändert nur verkleidbare Flächen (Rollen): Technikblöcke setzt Ebene 2 fest. Arbeitsblöcke als Material sind verboten (Sperre des Technikers).
// Regeln als Daten: data/regeln/planung.json (plan.palette). Fester Algorithmus: gleiche Eingabe = gleiches Ergebnis.
import { RechtFehler } from './fachleute.js';

const FACHMANN = 'designer';

/** Fehler der Gestaltung: unbekannte Stimmung u. Ä. (kein Raten). */
export class GestaltungsFehler extends Error {
  constructor(nachricht) { super(`Gestaltung: ${nachricht}`); this.name = 'GestaltungsFehler'; }
}

/** Ein Rollenwert als Zuordnung Form → Block: Text oder {id, zustand} ist die Form „voll“, sonst steht die Zuordnung schon da. */
export const formKarte = (wert) => {
  if (typeof wert === 'string' || (wert && typeof wert === 'object' && 'id' in wert)) return { voll: wert };
  return wert && typeof wert === 'object' && !Array.isArray(wert) ? { ...wert } : {};
};

/**
 * Mischt eine Überschreibung (Rolle → Block, je Rolle auch je Form) über eine Palette (zum Beispiel die einer Stimmung). Je Rolle und Form gewinnt die Überschreibung,
 * alle anderen Formen der Rolle bleiben (die Akzent-Treppe einer Stimmung bleibt, wenn nur der Vollblock überschrieben wird). Rein; die Eingaben bleiben unverändert;
 * Rollen und Formen erscheinen in fester Reihenfolge. Eine Rolle nur mit der Form „voll“ wird wieder zum einfachen Wert.
 * @param {object} basis @param {object} ueberschreibung @returns {object}
 */
export function mischePaletten(basis = {}, ueberschreibung = {}) {
  const eintraege = []; // Object.fromEntries am Ende: ein Rollenname wie __proto__ wird so nie zum Prototyp-Setter
  for (const rolle of [...new Set([...Object.keys(basis), ...Object.keys(ueberschreibung)])].sort()) {
    const karte = { ...formKarte(basis[rolle]), ...formKarte(ueberschreibung[rolle]) };
    const formen = Object.keys(karte).sort();
    eintraege.push([rolle, formen.length === 1 && formen[0] === 'voll' ? structuredClone(karte.voll) : Object.fromEntries(formen.map((f) => [f, structuredClone(karte[f])]))]);
  }
  return Object.fromEntries(eintraege);
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
    if (typeof wert === 'string') return [['voll', wert, {}]];
    if (wert && typeof wert === 'object' && 'id' in wert) return [['voll', wert.id, wert.zustand ?? {}]];
    if (wert && typeof wert === 'object') return Object.entries(wert).map(([form, w]) => [form, typeof w === 'string' ? w : w?.id, typeof w === 'object' ? (w?.zustand ?? {}) : {}]);
    return ungueltig(`Rolle ${rolle} braucht einen Block`);
  }

  /** Das Bauwerk wird gedreht und gespiegelt: ein Block mit Richtungszustand braucht dafür seinen Zustand (z. B. Säulenachse). */
  function kannDrehen(rolle, id, zustand) {
    const w = ebene0.neueWelt();
    w.setzeBlock(0, 0, 0, id, zustand);
    try { ebene0.vermesser.drehe(w.ausschnitt({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), 1); } catch (f) { ungueltig(`Rolle ${rolle}: ${id} lässt sich nicht drehen (${f.message})`); }
  }

  /** Prüft einen (auch unvollständigen) Palettenteil. */
  function pruefe(palette) {
    if (!palette || typeof palette !== 'object' || Array.isArray(palette)) ungueltig('keine Zuordnung von Rollen zu Blöcken');
    for (const [rolle, wert] of Object.entries(palette)) {
      if (!rollen.includes(rolle)) ungueltig(`Rolle „${rolle}“ unbekannt (${rollen.join(', ')})`);
      for (const [form, id, zustand] of eintraege(rolle, wert)) {
        if (!(form in formen)) ungueltig(`Rolle ${rolle}: Form „${form}“ unbekannt (${Object.keys(formen).join(', ')})`);
        if (typeof id !== 'string' || !bloecke.hat(id)) ungueltig(`Rolle ${rolle}: ${String(id)} steht nicht im Blockregister`);
        const eig = bloecke.block(id).eigenschaften;
        if (eig.arbeitsblock === true) ungueltig(`Rolle ${rolle}: ${id} ist ein Arbeitsblock und als Material verboten`);
        if (!id.endsWith(formen[form])) ungueltig(`Rolle ${rolle}: ${id} passt nicht zur Form „${form}“ (Name endet auf ${formen[form]})`);
        if (rolle === 'licht' && !(eig.licht > 0)) ungueltig(`Rolle licht: ${id} leuchtet nicht`);
        if (form === 'voll' || form === 'scheibe') kannDrehen(rolle, id, zustand);
      }
    }
  }

  /** Ist die Palette vollständig (alle Rollen und die Formen, die die Bausteine brauchen)? */
  function vollstaendig(palette) {
    return rollen.every((r) => r in palette);
  }

  return { pruefe, vollstaendig, stimmung: (name) => stimmungen[name] ?? null, stimmungen: () => Object.keys(stimmungen), rollen, formen: { ...formen } };
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
  /** Die Palette aus Stimmung (falls genannt) und Überschreibung (falls genannt); ohne beides gibt es nichts zu setzen. */
  const palette = (stimmung, ueberschreibung) => {
    if (stimmung === undefined && ueberschreibung === undefined) throw new GestaltungsFehler('weder Stimmung noch Materialwahl genannt');
    const basis = stimmung === undefined ? {} : structuredClone(hole(stimmung));
    return ueberschreibung === undefined ? basis : mischePaletten(basis, ueberschreibung);
  };
  const setzePalette = (entwurf, stimmung, ueberschreibung) => aendere(entwurf, { art: 'setze-palette', palette: palette(stimmung, ueberschreibung), ersetze: true });
  /** Abschnittspalette: geht vor der Gesamtpalette, gilt nur für diesen Abschnitt. */
  const setzeAbschnittspalette = (entwurf, abschnitt, stimmung, ueberschreibung) => aendere(entwurf, { art: 'setze-abschnittspalette', abschnitt, palette: palette(stimmung, ueberschreibung), ersetze: true });

  return { setzePalette, setzeAbschnittspalette, stimmungen: paletten.stimmungen, GestaltungsFehler };
}

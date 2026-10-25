// Ebene 4 – Freigabe und Versionen: Jonah gibt die Spezifikation frei, bevor die Planung startet; jede Änderung hebt die Freigabe auf.
// Der Vergleich zweier Versionen ist die Grundlage dafür, dass der Konstrukteur entscheidet, welche Abschnitte neu geplant werden.
import { kopie, abdruck } from './spezifikation.js';

/** Fehler bei der Freigabe: mit den offenen Rückfragen. */
export class FreigabeFehler extends Error {
  constructor(nachricht, rueckfragen = []) { super(`Freigabe: ${nachricht}`); this.name = 'FreigabeFehler'; this.rueckfragen = rueckfragen; }
}

/** Alle Pfade (a.b[0].c), an denen sich zwei Werte unterscheiden. */
function unterschiede(a, b, pfad = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  const istO = (w) => w !== null && typeof w === 'object';
  if (!istO(a) || !istO(b) || Array.isArray(a) !== Array.isArray(b)) return [pfad];
  const schluessel = Array.isArray(a) ? [...new Set([...a.keys(), ...b.keys()])] : [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return schluessel.flatMap((k) => unterschiede(a[k], b[k], Array.isArray(a) ? `${pfad}[${k}]` : pfad ? `${pfad}.${k}` : k));
}

/**
 * @param {{pruefer: {pruefe: Function}}} quellen
 */
export function erzeugeVersionen({ pruefer }) {
  /** Gibt frei: nur ohne offene Rückfragen. Liefert eine Kopie mit Freigabe (Version und Abdruck des Inhalts). */
  function freigeben(spec, von = 'jonah') {
    const { rueckfragen } = pruefer.pruefe(spec);
    if (rueckfragen.length) throw new FreigabeFehler(`${rueckfragen.length} Rückfrage${rueckfragen.length === 1 ? '' : 'n'} sind noch offen`, rueckfragen);
    const s = kopie(spec);
    s.freigabe = { von, version: spec.version, abdruck: abdruck(spec) };
    return s;
  }

  /** Ist genau dieser Inhalt freigegeben? Jede Änderung seit der Freigabe macht sie ungültig. */
  function istFreigegeben(spec) {
    return !!spec.freigabe && spec.freigabe.version === spec.version && spec.freigabe.abdruck === abdruck(spec);
  }

  /** Eine neue Version aus der alten (Version + 1, ohne Freigabe), mit den Änderungen aus `aendere` angewendet. */
  function neueVersion(spec, aendere = (s) => s) {
    const arbeit = kopie(spec);
    const neu = kopie(aendere(arbeit) ?? arbeit);
    neu.version = spec.version + 1;
    delete neu.freigabe;
    return neu;
  }

  /** Unterschiede zweier Spezifikationen: Teile hinzugefügt, entfernt, geändert (mit den geänderten Feldern), dazu Änderungen am Projekt. */
  function vergleiche(alt, neu) {
    const a = new Map(alt.teile.map((t) => [t.id, t])), b = new Map(neu.teile.map((t) => [t.id, t]));
    return {
      projekt: unterschiede(alt.projekt, neu.projekt, 'projekt'),
      hinzugefuegt: [...b.keys()].filter((id) => !a.has(id)).sort(),
      entfernt: [...a.keys()].filter((id) => !b.has(id)).sort(),
      geaendert: [...b.keys()].filter((id) => a.has(id)).sort().map((id) => ({ id, felder: unterschiede(a.get(id), b.get(id)) })).filter((x) => x.felder.length),
    };
  }

  return { freigeben, istFreigegeben, neueVersion, vergleiche, FreigabeFehler };
}

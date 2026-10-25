// Ebene 3 – Planentwurf: das gemeinsame Datenmodell aller Fachleute (reines JSON, deterministisch, ohne Uhr und Zufall).
// Alles hier ist unveränderlich gedacht: Änderungen liefern einen neuen Entwurf (siehe fachleute.js). Laufende Nummern ersetzen Zeitstempel.

export const VERSION = 1;

/** Tiefe Kopie (der Entwurf ist reines JSON). */
export const kopie = (entwurf) => structuredClone(entwurf);

const ganz = (n) => Number.isInteger(n);
const pos = (p) => p && ganz(p.x) && ganz(p.y) && ganz(p.z);

/**
 * @param {{name: string, bauplatz?: {breite:number, hoehe:number, tiefe:number}, nullpunkt?: {x:number,y:number,z:number}}} projekt
 */
export function neuerEntwurf({ name, bauplatz = { breite: 256, hoehe: 320, tiefe: 256 }, nullpunkt = { x: 0, y: 0, z: 0 } }) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('Entwurf: Projektname fehlt');
  if (![bauplatz?.breite, bauplatz?.hoehe, bauplatz?.tiefe].every((n) => ganz(n) && n > 0)) throw new Error('Entwurf: Bauplatz braucht breite, hoehe, tiefe (ganze Zahlen > 0)');
  if (!pos(nullpunkt)) throw new Error('Entwurf: Nullpunkt braucht x, y, z');
  return {
    version: VERSION,
    projekt: { name: name.trim(), bauplatz: { ...bauplatz }, nullpunkt: { ...nullpunkt } },
    abschnitte: [], teile: [], zonen: [], sperrzonen: [], palette: {}, pruefungen: [],
    bedarf: [], anfragen: [], formwuensche: [], paletten: {}, sperren: [], einwaende: [], bericht: [], rueckfragen: [],
    zaehler: { teil: 1, einwand: 1, bericht: 1, rueckfrage: 1 },
  };
}

const FELDER = ['abschnitte', 'teile', 'zonen', 'sperrzonen', 'pruefungen', 'sperren', 'einwaende', 'bericht', 'rueckfragen'];

/** Prüft die Form eines Entwurfs und wirft bei Fehlern (z. B. nach dem Laden). */
export function pruefeForm(e) {
  const fehler = (m) => { throw new Error(`Entwurf: ${m}`); };
  if (!e || typeof e !== 'object') fehler('kein Objekt');
  if (e.version !== VERSION) fehler(`Version ${String(e.version)} nicht unterstützt`);
  if (typeof e.projekt?.name !== 'string' || !pos(e.projekt?.nullpunkt)) fehler('projekt unvollständig');
  for (const f of FELDER) if (!Array.isArray(e[f])) fehler(`${f} fehlt`);
  for (const f of ['bedarf', 'anfragen', 'formwuensche']) if (e[f] !== undefined && !Array.isArray(e[f])) fehler(`${f} ungültig`);
  if (e.paletten !== undefined && (!e.paletten || typeof e.paletten !== 'object' || Array.isArray(e.paletten))) fehler('paletten ungültig');
  if (!e.palette || typeof e.palette !== 'object' || Array.isArray(e.palette)) fehler('palette fehlt');
  for (const k of ['teil', 'einwand', 'bericht', 'rueckfrage']) if (!ganz(e.zaehler?.[k]) || e.zaehler[k] < 1) fehler(`zaehler.${k} fehlt`);
  const ids = new Set();
  for (const t of e.teile) {
    if (typeof t.id !== 'string' || ids.has(t.id)) fehler(`Teil-ID doppelt oder fehlend: ${String(t.id)}`);
    ids.add(t.id);
    if (typeof t.baustein !== 'string' || !pos(t.lage) || !ganz(t.lage.drehung) || t.lage.drehung < 0 || t.lage.drehung > 3) fehler(`Teil ${t.id}: baustein oder lage ungültig`);
  }
  for (const a of e.abschnitte) {
    if (typeof a.id !== 'string') fehler('Abschnitt ohne ID');
    if (a.huelle !== undefined && !(pos(a.huelle.von) && pos(a.huelle.bis))) fehler(`Abschnitt ${a.id}: huelle ungültig`);
  }
  return e;
}

/** Sortiert alle Schlüssel rekursiv (kanonische Reihenfolge, damit gleiche Entwürfe gleichen Text ergeben). */
function sortiert(w) {
  if (Array.isArray(w)) return w.map(sortiert);
  if (w && typeof w === 'object') return Object.fromEntries(Object.keys(w).sort().map((k) => [k, sortiert(w[k])]));
  return w;
}

export const entwurfZuJson = (e) => JSON.stringify(sortiert(pruefeForm(e)), null, 2);
export const entwurfAusJson = (text) => pruefeForm(JSON.parse(text));

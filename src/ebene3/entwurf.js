// Ebene 3 – Planentwurf: das gemeinsame Datenmodell aller Fachleute (reines JSON, deterministisch, ohne Uhr und Zufall).
// Alles hier ist unveränderlich gedacht: Änderungen liefern einen neuen Entwurf (siehe fachleute.js). Laufende Nummern ersetzen Zeitstempel.

export const VERSION = 2;
/** Ankerpunkte einer Einbauzone: vier Ecken (unten) und die Mitte (unten). */
export const ANKER = Object.freeze(['nw', 'ne', 'sw', 'se', 'mitte']);

/** Tiefe Kopie (der Entwurf ist reines JSON). */
export const kopie = (entwurf) => structuredClone(entwurf);

const ganz = (n) => Number.isInteger(n);
const pos = (p) => p && ganz(p.x) && ganz(p.y) && ganz(p.z);
const posSicher = (p) => p !== null && typeof p === 'object' && [p.x, p.y, p.z].every(Number.isSafeInteger);

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
    abschnitte: [], teile: [], aenderungen: [], bestaetigungen: [], zonen: [], sperrzonen: [], palette: {}, pruefungen: [],
    bedarf: [], anfragen: [], formwuensche: [], paletten: {}, sperren: [], einwaende: [], bericht: [], rueckfragen: [],
    zaehler: { teil: 1, einwand: 1, bericht: 1, rueckfrage: 1, aenderung: 1 },
  };
}

const FELDER = ['abschnitte', 'teile', 'aenderungen', 'zonen', 'sperrzonen', 'pruefungen', 'sperren', 'einwaende', 'bericht', 'rueckfragen'];

/** Prüft die Form eines Entwurfs und wirft bei Fehlern (z. B. nach dem Laden). */
export function pruefeForm(e) {
  const fehler = (m) => { throw new Error(`Entwurf: ${m}`); };
  if (!e || typeof e !== 'object') fehler('kein Objekt');
  if (e.version !== VERSION) fehler(`Version ${String(e.version)} nicht unterstützt${e.version === 1 ? ' (ältere Fassung: mit migriere() auf Version 2 heben)' : ''}`);
  if (typeof e.projekt?.name !== 'string' || !pos(e.projekt?.nullpunkt)) fehler('projekt unvollständig');
  for (const f of FELDER) if (!Array.isArray(e[f])) fehler(`${f} fehlt`);
  for (const f of ['bedarf', 'anfragen', 'formwuensche', 'zulassungen', 'bestaetigungen']) if (e[f] !== undefined && !Array.isArray(e[f])) fehler(`${f} ungültig`);
  if (e.paletten !== undefined && (!e.paletten || typeof e.paletten !== 'object' || Array.isArray(e.paletten))) fehler('paletten ungültig');
  if (!e.palette || typeof e.palette !== 'object' || Array.isArray(e.palette)) fehler('palette fehlt');
  for (const k of ['teil', 'einwand', 'bericht', 'rueckfrage']) if (!ganz(e.zaehler?.[k]) || e.zaehler[k] < 1) fehler(`zaehler.${k} fehlt`);
  const ids = new Set();
  for (const t of e.teile) {
    if (typeof t.id !== 'string' || ids.has(t.id)) fehler(`Teil-ID doppelt oder fehlend: ${String(t.id)}`);
    ids.add(t.id);
    if (typeof t.baustein !== 'string' || !pos(t.lage) || !ganz(t.lage.drehung) || t.lage.drehung < 0 || t.lage.drehung > 3) fehler(`Teil ${t.id}: baustein oder lage ungültig`);
  }
  pruefeTraegerwald(e, fehler);
  for (const a of e.abschnitte) {
    if (typeof a.id !== 'string') fehler('Abschnitt ohne ID');
    if (a.huelle !== undefined && !(pos(a.huelle.von) && pos(a.huelle.bis))) fehler(`Abschnitt ${a.id}: huelle ungültig`);
  }
  return e;
}

/**
 * Stabile Kennung und Trägerwald eines Teils (docs/architektur-einbau.md 3.2 und 3.5): `ref` ist eindeutig; `traeger` nennt die `ref` des Trägers,
 * `einbau` die Lage im Träger (Zone, Anker, Versatz, Drehung) und gehört zu `traeger`. Genau ein Träger je Kind, der Träger existiert, keine Selbstbezüge,
 * keine Zyklen; ein Kind liegt im Abschnitt seines Trägers (Wurzeln vergeben den Abschnitt, Kinder erben ihn).
 */
export function pruefeTraegerwald(e, fehler = (m) => { throw new Error(`Entwurf: ${m}`); }) {
  const nachRef = new Map();
  for (const t of e.teile) {
    if (t.ref === undefined) continue;
    if (typeof t.ref !== 'string' || !t.ref) fehler(`Teil ${t.id}: ref ungültig`);
    if (nachRef.has(t.ref)) fehler(`ref doppelt: ${t.ref}`);
    nachRef.set(t.ref, t);
  }
  for (const t of e.teile) {
    if (t.traeger === undefined) { if (t.einbau !== undefined) fehler(`Teil ${t.id}: einbau ohne traeger`); continue; }
    if (typeof t.traeger !== 'string' || !t.traeger) fehler(`Teil ${t.id}: traeger ungültig`);
    if (t.ref === undefined) fehler(`Teil ${t.id}: ein Kind braucht eine ref`);
    if (t.traeger === t.ref) fehler(`Teil ${t.id}: Selbstbezug (traeger = ref)`);
    const tr = nachRef.get(t.traeger);
    if (!tr) fehler(`Teil ${t.id}: Träger ${t.traeger} existiert nicht`);
    if (tr.abschnitt !== t.abschnitt) fehler(`Teil ${t.id}: liegt im Abschnitt ${String(t.abschnitt)}, der Träger ${t.traeger} im Abschnitt ${String(tr.abschnitt)}`);
    const ei = t.einbau;
    if (!ei || typeof ei !== 'object' || typeof ei.zone !== 'string' || !ei.zone) fehler(`Teil ${t.id}: einbau braucht eine zone`);
    if (!ANKER.includes(ei.anker)) fehler(`Teil ${t.id}: anker "${String(ei.anker)}" unbekannt (${ANKER.join(', ')})`);
    if (!posSicher(ei.versatz)) fehler(`Teil ${t.id}: einbau.versatz braucht ganze Zahlen x, y, z`);
    if (!ganz(ei.drehung) || ei.drehung < 0 || ei.drehung > 3) fehler(`Teil ${t.id}: einbau.drehung muss 0 bis 3 sein`);
  }
  // Zyklen: von jedem Teil aufwärts höchstens so viele Schritte wie Teile
  for (const t of e.teile) {
    let k = t, schritte = 0;
    while (k.traeger !== undefined) {
      k = nachRef.get(k.traeger);
      if (++schritte > e.teile.length) fehler(`Zyklus im Trägerwald bei Teil ${t.id}`);
    }
  }
  if (!Array.isArray(e.aenderungen)) fehler('aenderungen fehlt');
  const aids = new Set();
  for (const a of e.aenderungen) {
    pruefeAenderungForm(a, fehler);
    if (aids.has(a.id)) fehler(`Änderung-ID doppelt: ${a.id}`);
    aids.add(a.id);
  }
}

/**
 * Hebt einen Entwurf der Version 1 auf Version 2 (verlustfrei, ohne das Original zu verändern): jedes Teil behält seine Nummer als stabile `ref`,
 * die Liste `aenderungen` (manuelle Einzelblockänderungen) beginnt leer. Version 2 bleibt unverändert (Kopie).
 */
export function migriere(e) {
  if (!e || typeof e !== 'object') throw new Error('Entwurf: kein Objekt');
  if (e.version === VERSION) return kopie(e);
  if (e.version !== 1) throw new Error(`Entwurf: Version ${String(e.version)} nicht unterstützt`);
  const neu = kopie(e);
  neu.version = VERSION;
  neu.aenderungen ??= [];
  for (const t of neu.teile ?? []) if (t.ref === undefined && typeof t.id === 'string') t.ref = t.id;
  return neu;
}

export const OPERATIONEN = Object.freeze(['setze', 'leere']);

/** Prüft die Form einer gespeicherten Änderung (auch nach dem Laden); wirft einen `Error` mit Klartext. */
export function pruefeAenderungForm(a, fehler = (m) => { throw new Error(`Entwurf: ${m}`); }) {
  if (!a || typeof a !== 'object') fehler('Änderung ist kein Objekt');
  if (typeof a.id !== 'string' || !a.id) fehler('Änderung ohne id');
  if (typeof a.teil !== 'string' || !a.teil) fehler(`Änderung ${a.id}: teil (ref) fehlt`);
  if (!posSicher(a.zelle)) fehler(`Änderung ${a.id}: zelle braucht ganze Zahlen x, y, z`);
  if (!OPERATIONEN.includes(a.op)) fehler(`Änderung ${a.id}: op „${String(a.op)}“ unbekannt (${OPERATIONEN.join(', ')})`);
  if (a.op === 'setze') {
    if (typeof a.block?.id !== 'string' || !a.block.id.startsWith('minecraft:')) fehler(`Änderung ${a.id}: setze braucht block.id (minecraft:…)`);
    if (a.block.zustand !== undefined && (a.block.zustand === null || typeof a.block.zustand !== 'object' || Array.isArray(a.block.zustand))) fehler(`Änderung ${a.id}: block.zustand muss ein Objekt sein`);
  } else if (a.block !== undefined) fehler(`Änderung ${a.id}: leere hat keinen block`);
  if (typeof a.von !== 'string' || !a.von) fehler(`Änderung ${a.id}: von (Name) fehlt`);
  if (a.quelle !== 'benutzer') fehler(`Änderung ${a.id}: quelle muss „benutzer“ sein`);
}


/** Sortiert alle Schlüssel rekursiv (kanonische Reihenfolge, damit gleiche Entwürfe gleichen Text ergeben). */
function sortiert(w) {
  if (Array.isArray(w)) return w.map(sortiert);
  if (w && typeof w === 'object') return Object.fromEntries(Object.keys(w).sort().map((k) => [k, sortiert(w[k])]));
  return w;
}

export const entwurfZuJson = (e) => JSON.stringify(sortiert(pruefeForm(e)), null, 2);
export const entwurfAusJson = (text) => pruefeForm(migriere(JSON.parse(text)));

// Ebene 0 – Speichern/Laden: Welt (Blöcke, Zustände, Blockinhalte, Wesen) verlustfrei als JSON.
// Das Dateiformat ist versioniert; die Ausgabe ist kanonisch (gleiche Welt = gleicher Text).
import { Welt } from './welt.js';

export const FORMAT = 'blockwerk-welt';
export const VERSION = 1;

/** Welt → einfaches Objekt (JSON-tauglich). Blöcke stehen als [x, y, z, Paletteneintrag, inhalt?]. */
export function weltZuObjekt(welt) {
  const palette = [];
  const index = new Map();
  const bloecke = welt.alleBloecke().map((b) => {
    const schluessel = JSON.stringify([b.id, b.zustand]);
    if (!index.has(schluessel)) {
      index.set(schluessel, palette.length);
      palette.push({ id: b.id, zustand: b.zustand });
    }
    const zeile = [b.x, b.y, b.z, index.get(schluessel)];
    if (b.inhalt) zeile.push(b.inhalt);
    return zeile;
  });
  return {
    format: FORMAT,
    version: VERSION,
    datenstand: welt.register.bloecke.datenstand,
    palette,
    bloecke,
    wesen: welt.wesen(),
    naechsteWesenNr: welt._naechsteNr,
  };
}

export function weltZuJson(welt) {
  return JSON.stringify(weltZuObjekt(welt));
}

/**
 * Objekt → Welt. Alles wird gegen das Register geprüft; ein Fehler wirft und liefert keine halbe Welt.
 * @param {object} daten
 * @param {ConstructorParameters<typeof Welt>[0]} register
 */
export function weltAusObjekt(daten, register) {
  if (!daten || daten.format !== FORMAT) throw new Error('Keine Blockwerk-Weltdatei');
  if (daten.version !== VERSION) throw new Error(`Nicht unterstützte Weltdatei-Version: ${daten.version}`);
  if (daten.datenstand !== register.bloecke.datenstand) {
    throw new Error(`Weltdatei hat Datenstand ${daten.datenstand}, Register hat ${register.bloecke.datenstand}`);
  }
  const welt = new Welt(register);
  for (const [x, y, z, p, inhalt] of daten.bloecke) {
    const eintrag = daten.palette[p];
    if (!eintrag) throw new Error(`Paletteneintrag ${p} fehlt`);
    welt.setzeBlock(x, y, z, eintrag.id, eintrag.zustand, inhalt ?? null);
  }
  const hoechste = Math.max(0, ...daten.wesen.map((w) => w.nr));
  const sortiert = [...daten.wesen].sort((a, b) => a.nr - b.nr);
  for (const w of sortiert) {
    const { nr, sitztIn, ...rest } = w;
    welt._naechsteNr = nr; // Nummern bleiben beim Laden erhalten
    if (welt._wesen.has(nr)) throw new Error(`Wesen-Nummer ${nr} doppelt`);
    welt.fuegeWesenHinzu(rest);
  }
  // Passagiere erst, wenn alle Wesen da sind (die Lore kann eine höhere Nummer haben als ihr Passagier)
  for (const w of sortiert) if (w.sitztIn !== undefined) { const p = { ...welt._wesen.get(w.nr) }; welt.setzePassagier(w.nr, w.sitztIn); Object.assign(welt._wesen.get(w.nr), { x: p.x, y: p.y, z: p.z }); }
  if (!Number.isInteger(daten.naechsteWesenNr) || daten.naechsteWesenNr <= hoechste) throw new Error('naechsteWesenNr ungültig');
  welt._naechsteNr = daten.naechsteWesenNr;
  return welt;
}

export function weltAusJson(text, register) {
  return weltAusObjekt(JSON.parse(text), register);
}

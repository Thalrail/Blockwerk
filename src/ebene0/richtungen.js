// Ebene 0 – Koordinaten & Richtungen
// Konvention (bewusst festgelegt, ändert sich nur durch Konventionsänderung):
//   x = Ost, z = Süd, y = oben. 1 Block = 1 Einheit. Chunk = 16×16. Nullpunkt = (0, 0, 0).
//   Ein Block (x, y, z) belegt den Raum [x, x+1) × [y, y+1) × [z, z+1).
//   Blickrichtung (yaw) in Grad wie in Bedrock: 0 = Süd, 90 = West, 180 = Nord, 270 = Ost (im Uhrzeigersinn von oben).

export const RICHTUNGEN = Object.freeze(['north', 'east', 'south', 'west', 'up', 'down']);
/** Horizontale Richtungen im Uhrzeigersinn (von oben gesehen, Norden oben). */
export const HORIZONTAL = Object.freeze(['north', 'east', 'south', 'west']);

export const VEKTOR = Object.freeze({
  north: Object.freeze({ x: 0, y: 0, z: -1 }),
  east: Object.freeze({ x: 1, y: 0, z: 0 }),
  south: Object.freeze({ x: 0, y: 0, z: 1 }),
  west: Object.freeze({ x: -1, y: 0, z: 0 }),
  up: Object.freeze({ x: 0, y: 1, z: 0 }),
  down: Object.freeze({ x: 0, y: -1, z: 0 }),
});

export const GEGENRICHTUNG = Object.freeze({
  north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up',
});

export const NULLPUNKT = Object.freeze({ x: 0, y: 0, z: 0 });

export const CHUNK_GROESSE = 16;
/** Bedrock-Überwelt: tiefster und höchster Block. Ebene 0 erzwingt diese Grenzen für alle Welten. */
export const HOEHE_MIN = -64;
export const HOEHE_MAX = 319;

/** Mathematisches Modulo (auch für negative Zahlen). */
export const modulo = (a, n) => ((a % n) + n) % n;

function pruefeRichtung(r) {
  if (!RICHTUNGEN.includes(r)) throw new Error(`Unbekannte Richtung: ${String(r)}`);
}

/** Dreht eine Richtung um `viertel` Vierteldrehungen im Uhrzeigersinn (von oben). up/down bleiben. */
export function dreheRichtung(richtung, viertel = 1) {
  pruefeRichtung(richtung);
  if (!Number.isInteger(viertel)) throw new Error('viertel muss eine ganze Zahl sein');
  const i = HORIZONTAL.indexOf(richtung);
  return i < 0 ? richtung : HORIZONTAL[modulo(i + viertel, 4)];
}

/** Spiegelt eine Richtung an der Achse: 'x' vertauscht Ost/West, 'z' vertauscht Nord/Süd. */
export function spiegleRichtung(richtung, achse) {
  pruefeRichtung(richtung);
  if (achse !== 'x' && achse !== 'z') throw new Error(`Unbekannte Spiegelachse: ${String(achse)}`);
  if (achse === 'x' && (richtung === 'east' || richtung === 'west')) return GEGENRICHTUNG[richtung];
  if (achse === 'z' && (richtung === 'north' || richtung === 'south')) return GEGENRICHTUNG[richtung];
  return richtung;
}

/** Blickrichtung (Grad) → Richtung, nur wenn exakt ein Vielfaches von 90°. */
export function yawZuRichtung(yaw) {
  const w = modulo(yaw, 360);
  const tabelle = { 0: 'south', 90: 'west', 180: 'north', 270: 'east' };
  return tabelle[w] ?? null;
}

export const normalisiereYaw = (yaw) => modulo(yaw, 360);

export function istGanzePosition(p) {
  return p !== null && typeof p === 'object' && Number.isInteger(p.x) && Number.isInteger(p.y) && Number.isInteger(p.z);
}

export function addiere(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/** Block-Koordinate → Chunk (cx, cz) und Lage im Chunk (lx, lz, jeweils 0–15). */
export function chunkVon(x, z) {
  return {
    cx: Math.floor(x / CHUNK_GROESSE),
    cz: Math.floor(z / CHUNK_GROESSE),
    lx: modulo(x, CHUNK_GROESSE),
    lz: modulo(z, CHUNK_GROESSE),
  };
}

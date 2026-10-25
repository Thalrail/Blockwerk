// Ebene 5 – kleine 4×4-Matrixfunktionen für die 3D-Ansicht (spaltenweise gespeichert wie in WebGL: Element (Zeile r, Spalte c) = m[c * 4 + r]).

export const identitaet = () => Float32Array.of(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);

/** Produkt a · b (erst b, dann a anwenden). */
export function multipliziere(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

/** Perspektivische Projektion (OpenGL-Konvention, Tiefe −1 … 1). fovy im Bogenmaß. */
export function perspektive(fovy, aspekt, nah, fern) {
  const f = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
  o[0] = f / aspekt; o[5] = f; o[10] = (fern + nah) / (nah - fern); o[11] = -1; o[14] = (2 * fern * nah) / (nah - fern);
  return o;
}

const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const kreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const punkt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a); return l ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };

/** Ansichtsmatrix: Auge schaut zum Ziel, „oben“ ist die Aufwärtsrichtung. */
export function blickAuf(auge, ziel, oben = [0, 1, 0]) {
  const z = norm(minus(auge, ziel)), x = norm(kreuz(oben, z)), y = kreuz(z, x);
  const o = new Float32Array(16);
  o[0] = x[0]; o[4] = x[1]; o[8] = x[2]; o[12] = -punkt(x, auge);
  o[1] = y[0]; o[5] = y[1]; o[9] = y[2]; o[13] = -punkt(y, auge);
  o[2] = z[0]; o[6] = z[1]; o[10] = z[2]; o[14] = -punkt(z, auge);
  o[15] = 1;
  return o;
}

/** Punkt mit Matrix multiplizieren: [x, y, z, w]. */
export function transformiere(m, p) {
  const [x, y, z] = p;
  return [0, 1, 2, 3].map((r) => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]);
}

/** Punkt in normierte Bildkoordinaten (−1 … 1) und Tiefe; w ≤ 0 heißt: hinter der Kamera. */
export function zuNdc(m, p) {
  const [x, y, z, w] = transformiere(m, p);
  return { x: x / w, y: y / w, z: z / w, w };
}

// Gemeinsame Prüfwerkzeuge für die Formtests (Index-Mengen, Symmetrie, Randabweichung, Dichtheit).
export const EPS = 1e-9;

/** Blöcke eines Pakets als Menge in Indexkoordinaten (i, j, k) = Position in der Hüllbox der Breite B, Höhe H, Tiefe T. */
export function indexMenge(p, B, T) {
  const ox = Math.floor(B / 2), oz = Math.floor(T / 2);
  const m = new Set();
  for (const b of p.bloecke) m.add(`${b.x + ox},${b.y},${b.z + oz}`);
  return m;
}
export const hat = (m, i, j, k) => m.has(`${i},${j},${k}`);
export const zelle = (s) => s.split(',').map(Number);

export function symmetrisch(m, B, H, T, { drehen = false, hoehe = false } = {}) {
  for (const s of m) {
    const [i, j, k] = zelle(s);
    if (!hat(m, B - 1 - i, j, k) || !hat(m, i, j, T - 1 - k)) return `Spiegelung (${s})`;
    if (hoehe && !hat(m, i, H - 1 - j, k)) return `Höhenspiegelung (${s})`;
    if (drehen && !hat(m, k, j, B - 1 - i)) return `Drehung (${s})`;
  }
  return null;
}

/** Abweichung des Rands vom Idealkreis/-ellipse (Halbachsen a, c) je Spalte und Zeile; Blockmitten mit Rundung zum nächsten Block. */
export function randAbweichung2D(m, B, T, j = 0) {
  let schlimmste = 0;
  const a = B / 2, c = T / 2;
  for (const [N, M, ha, hc, lies] of [[B, T, a, c, (i, k) => hat(m, i, j, k)], [T, B, c, a, (k, i) => hat(m, i, j, k)]]) {
    for (let n = 0; n < N; n++) {
      const xc = n - (N - 1) / 2;
      const r = 1 - (xc / ha) ** 2;
      if (r < 0) continue;
      const h = hc * Math.sqrt(r);
      let kante = 0;
      for (let q = 0; q < M; q++) if (lies(n, q)) kante = Math.max(kante, q - (M - 1) / 2 + 0.5);
      schlimmste = Math.max(schlimmste, Math.abs(kante - h));
    }
  }
  return schlimmste;
}

/** Wasserdicht: von außen (6er-Nachbarschaft, ohne den Boden unter j = 0) erreichbare Zellen sind nie Innenzellen laut `drin`. */
export function leck(schale, B, H, T, drin, { boden = false, flach = false, eben = false } = {}) {
  const px = B + 2, py = H + 2, pz = T + 2;
  const sehe = new Uint8Array(px * py * pz);
  const id = (i, j, k) => ((j + 1) * pz + (k + 1)) * px + (i + 1);
  const start = flach || boden ? 0 : -1;
  const kStart = eben ? 0 : -1;
  const stapel = [[-1, start, kStart]];
  sehe[id(-1, start, kStart)] = 1;
  while (stapel.length) {
    const [i, j, k] = stapel.pop();
    for (const [di, dj, dk] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      if (flach && dj !== 0) continue;
      if (eben && dk !== 0) continue;
      const x = i + di, y = j + dj, z = k + dk;
      if (x < -1 || x > B || y < start || (flach && y > 0) || y > H || z < -1 || z > T) continue;
      if (sehe[id(x, y, z)] || hat(schale, x, y, z)) continue;
      sehe[id(x, y, z)] = 1;
      if (x >= 0 && x < B && y >= 0 && y < H && z >= 0 && z < T && drin(x, y, z)) return [x, y, z];
      stapel.push([x, y, z]);
    }
  }
  return null;
}

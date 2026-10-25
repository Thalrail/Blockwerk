// Ebene 4 – Pixelbilder für die Bildmessung: Prüfung, Hintergrund und Vordergrund, Zusammenhangskomponenten, äußere Umrandung.
// Ein Bild ist {breite, hoehe, daten} mit RGBA (4 Werte je Pixel), wie es ein Canvas (getImageData) liefert. Die Engine kennt keine Bildformate.
// Alles deterministisch: feste Reihenfolge, keine Zufallszahlen.

/** Fehler bei der Bildmessung (unbrauchbares Bild, nichts zu messen). */
export class BildFehler extends Error {
  constructor(nachricht) { super(`Bild: ${nachricht}`); this.name = 'BildFehler'; }
}

/** Prüft die Form eines Pixelbilds. */
export function pruefeBild(bild) {
  if (!bild || !Number.isInteger(bild.breite) || !Number.isInteger(bild.hoehe) || bild.breite < 1 || bild.hoehe < 1) throw new BildFehler('breite und hoehe müssen ganze Zahlen ab 1 sein');
  if (!bild.daten || bild.daten.length !== bild.breite * bild.hoehe * 4) throw new BildFehler(`daten braucht ${bild.breite * bild.hoehe * 4} Werte (RGBA), es sind ${bild.daten?.length ?? 0}`);
  return bild;
}

/**
 * Trennt Vordergrund und Hintergrund. Hintergrund = häufigste (grob gerasterte) Farbe am Bildrand; durchsichtige Pixel (Alpha unter 128) zählen dazu.
 * Ein Pixel ist Vordergrund, wenn sein Farbabstand zum Hintergrund über der Schwelle liegt.
 * @returns {{hintergrund: {r: number, g: number, b: number}, vorder: Uint8Array, anzahl: number}}
 */
export function vordergrund(bild, abstandsSchwelle) {
  pruefeBild(bild);
  const { breite: B, hoehe: H, daten: d } = bild;
  const zaehler = new Map();
  const rand = (x, y) => {
    const i = (y * B + x) * 4;
    if (d[i + 3] < 128) return;
    const k = ((d[i] >> 5) << 6) | ((d[i + 1] >> 5) << 3) | (d[i + 2] >> 5);
    const e = zaehler.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2];
    zaehler.set(k, e);
  };
  for (let x = 0; x < B; x++) { rand(x, 0); rand(x, H - 1); }
  for (let y = 1; y < H - 1; y++) { rand(0, y); rand(B - 1, y); }
  let best = null;
  for (const [k, e] of [...zaehler.entries()].sort((a, b) => a[0] - b[0])) if (!best || e.n > best.n) best = e;
  const hg = best ? { r: best.r / best.n, g: best.g / best.n, b: best.b / best.n } : { r: 255, g: 255, b: 255 };
  const vorder = new Uint8Array(B * H);
  let anzahl = 0;
  for (let p = 0; p < B * H; p++) {
    const i = p * 4;
    if (d[i + 3] < 128) continue;
    const dr = d[i] - hg.r, dg = d[i + 1] - hg.g, db = d[i + 2] - hg.b;
    if (Math.sqrt(dr * dr + dg * dg + db * db) > abstandsSchwelle) { vorder[p] = 1; anzahl++; }
  }
  if (!anzahl) throw new BildFehler('im Bild ist nichts vom Hintergrund zu unterscheiden (kein Vordergrund)');
  return { hintergrund: hg, vorder, anzahl };
}

/** Umschließendes Rechteck einer Maske (Pixelindizes) – oder null, wenn leer. */
export function huelle(maske, B, H) {
  let x0 = B, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < B; x++) if (maske[y * B + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1, y1, breite: x1 - x0 + 1, hoehe: y1 - y0 + 1 };
}

/** Zusammenhangskomponenten (4er-Nachbarschaft) der Maske; Reihenfolge: nach dem ersten Pixel (zeilenweise). */
export function komponenten(maske, B, H) {
  const marke = new Int32Array(B * H).fill(-1);
  const liste = [];
  const stapel = new Int32Array(B * H);
  for (let start = 0; start < B * H; start++) {
    if (!maske[start] || marke[start] >= 0) continue;
    const id = liste.length;
    const pixel = [];
    let sp = 0;
    stapel[sp++] = start;
    marke[start] = id;
    while (sp) {
      const p = stapel[--sp];
      pixel.push(p);
      const x = p % B, y = (p - x) / B;
      if (x > 0 && maske[p - 1] && marke[p - 1] < 0) { marke[p - 1] = id; stapel[sp++] = p - 1; }
      if (x < B - 1 && maske[p + 1] && marke[p + 1] < 0) { marke[p + 1] = id; stapel[sp++] = p + 1; }
      if (y > 0 && maske[p - B] && marke[p - B] < 0) { marke[p - B] = id; stapel[sp++] = p - B; }
      if (y < H - 1 && maske[p + B] && marke[p + B] < 0) { marke[p + B] = id; stapel[sp++] = p + B; }
    }
    liste.push({ id, pixel });
  }
  return liste;
}

/** Hintergrund, der vom Bildrand her erreichbar ist (4er-Nachbarschaft): Löcher in Ringen gehören nicht dazu. */
export function aussen(maske, B, H) {
  const aus = new Uint8Array(B * H);
  const stapel = new Int32Array(B * H);
  let sp = 0;
  const push = (p) => { if (!maske[p] && !aus[p]) { aus[p] = 1; stapel[sp++] = p; } };
  for (let x = 0; x < B; x++) { push(x); push((H - 1) * B + x); }
  for (let y = 0; y < H; y++) { push(y * B); push(y * B + B - 1); }
  while (sp) {
    const p = stapel[--sp];
    const x = p % B, y = (p - x) / B;
    if (x > 0) push(p - 1);
    if (x < B - 1) push(p + 1);
    if (y > 0) push(p - B);
    if (y < H - 1) push(p + B);
  }
  return aus;
}

/** Äußere Randpixel einer Maske: Vordergrund mit einem Nachbarn im Außenbereich (oder am Bildrand). */
export function umrandung(maske, aus, B, H) {
  const rand = [];
  for (let p = 0; p < B * H; p++) {
    if (!maske[p]) continue;
    const x = p % B, y = (p - x) / B;
    if (x === 0 || y === 0 || x === B - 1 || y === H - 1 || aus[p - 1] || aus[p + 1] || aus[p - B] || aus[p + B]) rand.push(p);
  }
  return rand;
}

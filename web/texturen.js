// Blockwerk – Texturen laden (Faithful 32x, Bedrock): Index und PNGs aus data/texturen/, Atlas für die 3D-Ansicht, Kacheln für den Schichtplan.
// Die Zuordnung Block → Textur steckt im Bauplan (Legende `textur`), die Rechnung des Atlas in src/ebene5/atlas.js. Schlägt etwas fehl, läuft die Seite mit markierten Ersatzfarben weiter.
import { erzeugeAtlas } from '../src/ebene5/atlas.js';

/** Zustand: null, solange nichts geladen ist. */
export const T = { index: null, atlas: null, canvas: null, bilder: new Map(), urls: new Map(), fehler: null };

const wurzel = new URL('../', import.meta.url);
const holeBild = async (name) => {
  const r = await fetch(new URL(`data/texturen/${name}.png`, wurzel));
  if (!r.ok) throw new Error(`Textur ${name} fehlt (${r.status})`);
  const bmp = await createImageBitmap(await r.blob());
  // Animierte Texturen (Seelaterne …) sind ein Streifen aus Einzelbildern untereinander: Blockwerk zeigt das erste Bild.
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(bmp, 0, 0, bmp.width, bmp.width, 0, 0, 32, 32);
  bmp.close();
  return c;
};

/** Lädt den Index (liefert ihn auch für die Engine im Worker) und alle Kacheln; bei Fehlern bleibt T.index leer. */
export async function lade() {
  try {
    const r = await fetch(new URL('data/texturen.json', wurzel));
    if (!r.ok) throw new Error(`data/texturen.json fehlt (${r.status})`);
    const index = await r.json();
    const bilder = new Map(await Promise.all(index.kacheln.map(async (n) => [n, await holeBild(n)])));
    const atlas = erzeugeAtlas(index.kacheln);
    const canvas = document.createElement('canvas');
    canvas.width = atlas.breite; canvas.height = atlas.hoehe;
    const g = canvas.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, atlas.kachel, atlas.kachel); // weiße Kachel für Blöcke ohne Textur
    for (const [n, b] of bilder) { const e = atlas.eintraege.get(n); g.drawImage(b, e.x, e.y); }
    const urls = new Map();
    for (const [n, b] of bilder) urls.set(n, b.toDataURL());
    Object.assign(T, { index, atlas, canvas, bilder, urls, fehler: null });
  } catch (f) { T.fehler = String(f.message ?? f); }
  return T.index;
}

/** CSS für ein Farbfeld: Textur (Draufsicht) oder Ersatzfarbe. */
export function feldStil(l) {
  const u = l.textur && T.urls.get(l.textur.oben);
  return u ? `background:url(${u}) center/cover;image-rendering:pixelated` : `background:${l.farbe}`;
}
/** Bild (Canvas 32 × 32) der Draufsicht eines Blocks oder null. */
export const obenBild = (l) => (l.textur ? T.bilder.get(l.textur.oben) ?? null : null);
/** Titel für das Farbfeld: sagt, wenn Textur fehlt oder nur angenähert ist. */
export function feldTitel(l) {
  if (l.ersatz) return 'Ersatzfarbe: für diesen Block gibt es noch keine Textur';
  if (l.textur?.angenaehert) return 'Textur angenähert: der Block ist kein ganzer Würfel oder hat keine eigene Würfeltextur';
  return '';
}

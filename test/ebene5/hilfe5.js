// Gemeinsame Vorbereitung für die Tests der Ebene 5: die Engine wird wie im Browser per fetch-Attrappe geladen (einmal), das Beispielprojekt einmal gebaut.
import { readFile, readdir } from 'node:fs/promises';
import { ladeEngine, erzeugeEbene5 } from '../../src/ebene5/index.js';

export const wurzel = new URL('../../', import.meta.url);
export const holeJson = async (pfad) => JSON.parse(await readFile(new URL(pfad, wurzel), 'utf8'));
export const regeldateien = async () => (await readdir(new URL('data/regeln/', wurzel))).filter((n) => n.endsWith('.json')).sort();

let engineSpeicher, projektSpeicher;
export function engine() {
  return (engineSpeicher ??= (async () => {
    const e = await ladeEngine(holeJson);
    const darstellungsdaten = await holeJson('data/darstellung.json');
    return { ...e, darstellungsdaten, e5: erzeugeEbene5({ ebene0: e.ebene0, ebene3: e.ebene3, darstellungsdaten }) };
  })());
}
/** Das Beispielprojekt (freigegebene Spezifikation), gebaut: Entwurf und Bauplan. */
export function beispiel() {
  return (projektSpeicher ??= (async () => {
    const e = await engine();
    const spezifikation = await holeJson('data/beispiele/zitadelle-klein.json');
    const r = e.ebene4.baue(spezifikation);
    return { e, spezifikation, ergebnis: r, entwurf: r.entwurf, plan: e.e5.bauplan(r.entwurf) };
  })());
}
/** Bauplan ohne typisierte Felder, vergleichbar und als Text speicherbar. */
export const alsText = (w) => JSON.stringify(w, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v));
/** Zufall mit festem Startwert (LCG) für wiederholbare Zufallstests. */
export function zufall(start) {
  let s = start >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

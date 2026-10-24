// Ebene 2 – Baustein-Paket: Parameter mit Größenart, Blöcke als Rollen im eigenen Koordinatensystem, Anschlüsse, Platzbedarf, Testszenario, Status.
// Ein Baustein kennt weder Standort noch Stil noch Nachbarn und ist deterministisch: gleiche Parameter = gleiche Blöcke.
// Material kommt über Rollen (Ebene 3 entscheidet den Block); `platziere` schreibt nur über Ebene 0 (`welt.setzeBlock`).
import { STATI } from '../ebene1/regelwerk.js';

/** Größenarten (docs/ebenen.md): Geometrie skaliert frei, Menschenmaß bleibt fest, Technik skaliert über Anzahl. */
export const GROESSENARTEN = Object.freeze(['geometrie', 'menschenmass', 'technik']);
export const ROLLEN = Object.freeze(['wand', 'akzent', 'boden', 'licht']);

/** Beschreibt einen Parameter. `ganzzahl: false` erlaubt Kommazahlen (Proportionen). */
export function param(name, groessenart, { min, max, standard, beschreibung, ganzzahl = true }) {
  const p = { name, groessenart, min, max, standard, beschreibung, ganzzahl };
  if (!GROESSENARTEN.includes(groessenart)) throw new Error(`Parameter ${name}: Größenart "${groessenart}" ungültig`);
  for (const k of ['min', 'max', 'standard']) if (!Number.isFinite(p[k])) throw new Error(`Parameter ${name}: ${k} fehlt`);
  if (p.min > p.max || p.standard < p.min || p.standard > p.max) throw new Error(`Parameter ${name}: Bereich widersprüchlich`);
  if (typeof beschreibung !== 'string' || !beschreibung) throw new Error(`Parameter ${name}: Beschreibung fehlt`);
  return Object.freeze(p);
}

/** Prüft ein fertiges Paket auf Vollständigkeit und Form. Wirft bei Fehlern. */
export function pruefePaket(p) {
  const fehler = (m) => { throw new Error(`Baustein ${String(p?.id)}: ${m}`); };
  if (!p || typeof p !== 'object') throw new Error('Paket ist kein Objekt');
  for (const k of ['id', 'titel', 'status', 'quelle']) if (typeof p[k] !== 'string' || !p[k]) fehler(`Feld "${k}" fehlt`);
  if (!STATI.includes(p.status)) fehler(`Status "${p.status}" ungültig`);
  if (!/https?:\/\//.test(p.quelle)) fehler('quelle braucht einen Link');
  if (!p.parameter || typeof p.parameter !== 'object') fehler('Parameter fehlen');
  for (const [name, w] of Object.entries(p.parameter)) if (!Number.isFinite(w)) fehler(`Parameter ${name} ist keine Zahl`);
  if (!Array.isArray(p.bloecke)) fehler('Blöcke fehlen');
  for (const b of p.bloecke) {
    if (![b.x, b.y, b.z].every(Number.isInteger)) fehler('Blockkoordinate keine ganze Zahl');
    if (!ROLLEN.includes(b.rolle)) fehler(`Rolle "${b.rolle}" unbekannt`);
    if ('id' in b) fehler('Bausteine setzen Rollen, keine Block-IDs');
  }
  if (!Array.isArray(p.anschluesse)) fehler('Anschlüsse fehlen');
  const h = p.platzbedarf?.huelle;
  if (!h?.von || !h?.bis) fehler('Platzbedarf (Hüllquader) fehlt');
  if (!Array.isArray(p.platzbedarf.sperrzonen)) fehler('Sperrzonen fehlen');
  if (!p.testszenario || typeof p.testszenario.start !== 'string' || typeof p.testszenario.erwartung !== 'string') fehler('Testszenario fehlt (start und erwartung)');
  return p;
}

/** Hüllquader (Ecken inklusive) der Blöcke; leere Form → null. */
export function huelleVon(bloecke) {
  if (!bloecke.length) return null;
  const von = { x: Infinity, y: Infinity, z: Infinity }, bis = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const b of bloecke) for (const a of ['x', 'y', 'z']) { if (b[a] < von[a]) von[a] = b[a]; if (b[a] > bis[a]) bis[a] = b[a]; }
  return { von, bis };
}

/**
 * Legt einen Baustein an.
 * @param {{id:string, titel:string, quelle:string, status?:string, parameter:object[], testszenario:{start:string,erwartung:string},
 *   baue:(werte:object)=>{bloecke:{x:number,y:number,z:number,rolle:string}[], anschluesse?:object[], sperrzonen?:object[]}}} def
 */
export function definiere(def) {
  const beschreibung = new Map(def.parameter.map((p) => [p.name, p]));
  const baustein = {
    id: def.id, titel: def.titel, quelle: def.quelle, status: def.status ?? 'simuliert',
    parameter: def.parameter, testszenario: def.testszenario,
    /** Werte prüfen (Bereich, Ganzzahl), Standardwerte ergänzen, bauen. */
    erzeuge(eingabe = {}) {
      for (const k of Object.keys(eingabe)) if (!beschreibung.has(k)) throw new Error(`${def.id}: unbekannter Parameter "${k}"`);
      const werte = {};
      for (const p of def.parameter) {
        const w = eingabe[p.name] ?? p.standard;
        if (!Number.isFinite(w)) throw new Error(`${def.id}: Parameter ${p.name} muss eine Zahl sein`);
        if (p.ganzzahl && !Number.isInteger(w)) throw new Error(`${def.id}: Parameter ${p.name} muss ganzzahlig sein`);
        if (w < p.min || w > p.max) throw new Error(`${def.id}: Parameter ${p.name}=${w} außerhalb ${p.min}…${p.max}`);
        werte[p.name] = w;
      }
      const erg = def.baue(werte);
      const bloecke = erg.bloecke.slice().sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
      const huelle = huelleVon(bloecke) ?? { von: { x: 0, y: 0, z: 0 }, bis: { x: -1, y: -1, z: -1 } };
      return pruefePaket({
        id: def.id, titel: def.titel, status: baustein.status, quelle: def.quelle, parameter: werte, bloecke,
        anschluesse: erg.anschluesse ?? [], platzbedarf: { huelle, sperrzonen: erg.sperrzonen ?? [] }, testszenario: def.testszenario,
      });
    },
  };
  return Object.freeze(baustein);
}

/**
 * Setzt ein Paket in eine Welt (nur über Ebene 0). `palette` ordnet jeder Rolle einen Block zu: Rolle → id oder {id, zustand}.
 * Bausteine kennen kein Material; diese Zuordnung ist Sache von Ebene 3 (hier nur für Tests und Vorschau).
 */
export function platziere(welt, paket, palette, versatz = { x: 0, y: 0, z: 0 }) {
  for (const b of paket.bloecke) {
    const m = palette[b.rolle];
    if (!m) throw new Error(`Palette kennt die Rolle "${b.rolle}" nicht`);
    const { id, zustand = {} } = typeof m === 'string' ? { id: m } : m;
    welt.setzeBlock(b.x + versatz.x, b.y + versatz.y, b.z + versatz.z, id, zustand);
  }
}

/** Einfache Palette für Tests und Vorschau (alles Stein, Boden und Licht erkennbar). */
export const TESTPALETTE = Object.freeze({ wand: 'minecraft:stone', akzent: 'minecraft:cobblestone', boden: 'minecraft:stone', licht: 'minecraft:glowstone' });

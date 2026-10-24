// Ebene 2 – Baustein-Paket: Parameter mit Größenart, Blöcke als Rollen im eigenen Koordinatensystem, Anschlüsse, Platzbedarf, Testszenario, Status.
// Ein Baustein kennt weder Standort noch Stil noch Nachbarn und ist deterministisch: gleiche Parameter = gleiche Blöcke.
// Material kommt über Rollen (Ebene 3 entscheidet den Block); `platziere` schreibt nur über Ebene 0 (`welt.setzeBlock`).
import { STATI } from '../ebene1/regelwerk.js';

/** Größenarten (docs/ebenen.md): Geometrie skaliert frei, Menschenmaß bleibt fest, Technik skaliert über Anzahl. */
export const GROESSENARTEN = Object.freeze(['geometrie', 'menschenmass', 'technik']);
export const ROLLEN = Object.freeze(['wand', 'akzent', 'boden', 'licht', 'glas']);
/** Formen eines Blocks: `voll` (Standard) oder formgebunden mit Richtung (Treppe, Tür) bzw. Scheibe. Das Material bleibt Sache der Rolle. */
export const FORMEN = Object.freeze(['voll', 'treppe', 'tuer', 'scheibe']);
export const RICHTUNGEN = Object.freeze(['north', 'east', 'south', 'west']);

/** Beschreibt einen Parameter. `ganzzahl: false` erlaubt Kommazahlen (Proportionen). */
export function param(name, groessenart, { min, max, standard, beschreibung, ganzzahl = true }) {
  const p = { name, groessenart, min, max, standard, beschreibung, ganzzahl };
  if (!GROESSENARTEN.includes(groessenart)) throw new Error(`Parameter ${name}: Größenart "${groessenart}" ungültig`);
  for (const k of ['min', 'max', 'standard']) if (!Number.isFinite(p[k])) throw new Error(`Parameter ${name}: ${k} fehlt`);
  if (p.min > p.max || p.standard < p.min || p.standard > p.max) throw new Error(`Parameter ${name}: Bereich widersprüchlich`);
  if (typeof beschreibung !== 'string' || !beschreibung) throw new Error(`Parameter ${name}: Beschreibung fehlt`);
  return Object.freeze(p);
}

/** Beschreibt einen Listenparameter (z. B. die Gegenstandssorten eines Lagers): Liste von Texten mit Länge min…max. */
export function listeParam(name, groessenart, { min, max, standard, beschreibung }) {
  if (!GROESSENARTEN.includes(groessenart)) throw new Error(`Parameter ${name}: Größenart "${groessenart}" ungültig`);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || min > max) throw new Error(`Parameter ${name}: Längenbereich widersprüchlich`);
  if (!Array.isArray(standard) || standard.length < min || standard.length > max) throw new Error(`Parameter ${name}: Standardliste passt nicht`);
  if (typeof beschreibung !== 'string' || !beschreibung) throw new Error(`Parameter ${name}: Beschreibung fehlt`);
  return Object.freeze({ name, groessenart, min, max, standard, beschreibung, liste: true });
}

/** Prüft ein fertiges Paket auf Vollständigkeit und Form. Wirft bei Fehlern. */
export function pruefePaket(p) {
  const fehler = (m) => { throw new Error(`Baustein ${String(p?.id)}: ${m}`); };
  if (!p || typeof p !== 'object') throw new Error('Paket ist kein Objekt');
  for (const k of ['id', 'titel', 'status', 'quelle']) if (typeof p[k] !== 'string' || !p[k]) fehler(`Feld "${k}" fehlt`);
  if (!STATI.includes(p.status)) fehler(`Status "${p.status}" ungültig`);
  if (!/https?:\/\//.test(p.quelle)) fehler('quelle braucht einen Link');
  if (!p.parameter || typeof p.parameter !== 'object') fehler('Parameter fehlen');
  for (const [name, w] of Object.entries(p.parameter)) {
    const liste = Array.isArray(w) && w.every((x) => typeof x === 'string');
    if (!Number.isFinite(w) && !liste) fehler(`Parameter ${name} ist weder Zahl noch Liste von Texten`);
  }
  if (!Array.isArray(p.bloecke)) fehler('Blöcke fehlen');
  for (const b of p.bloecke) {
    if (![b.x, b.y, b.z].every(Number.isInteger)) fehler('Blockkoordinate keine ganze Zahl');
    if (b.technik === true) {
      // Technikblöcke (Schiene, Redstone-Block, Trichter …) sind fest: id + Zustand, keine Rolle
      if (typeof b.id !== 'string' || !b.id.startsWith('minecraft:')) fehler('Technikblock braucht eine Block-ID (minecraft:…)');
      if ('rolle' in b || 'form' in b) fehler('Technikblöcke haben keine Rolle und keine Form');
      if (b.zustand !== undefined && (b.zustand === null || typeof b.zustand !== 'object')) fehler('zustand muss ein Objekt sein');
      if (b.inhalt !== undefined) {
        if (!Array.isArray(b.inhalt)) fehler('inhalt muss eine Liste von Slots sein');
        for (const s of b.inhalt) if (!Number.isInteger(s?.slot) || s.slot < 0 || typeof s.gegenstand !== 'string' || !Number.isInteger(s.anzahl) || s.anzahl < 1) fehler('inhalt: Slot braucht slot, gegenstand und anzahl');
      }
      continue;
    }
    if (!ROLLEN.includes(b.rolle)) fehler(`Rolle "${b.rolle}" unbekannt`);
    if ('id' in b) fehler('Bausteine setzen Rollen, keine Block-IDs (Technikblöcke nur mit technik: true)');
    const form = b.form ?? 'voll';
    if (!FORMEN.includes(form)) fehler(`Form "${form}" unbekannt`);
    if ((form === 'treppe' || form === 'tuer') && !RICHTUNGEN.includes(b.richtung)) fehler(`${form} braucht eine Richtung`);
    if (form === 'tuer' && (!['unten', 'oben'].includes(b.haelfte) || !['links', 'rechts'].includes(b.scharnier))) fehler('Tür braucht haelfte (unten/oben) und scharnier (links/rechts)');
  }
  if (!Array.isArray(p.anschluesse)) fehler('Anschlüsse fehlen');
  if (p.wesen !== undefined) {
    if (!Array.isArray(p.wesen)) fehler('wesen muss eine Liste sein');
    for (const w of p.wesen) {
      if (typeof w.id !== 'string' || !w.id.startsWith('minecraft:')) fehler('Wesen braucht eine ID (minecraft:…)');
      if (![w.x, w.y, w.z].every(Number.isFinite)) fehler('Wesen braucht Koordinaten x, y, z');
    }
  }
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
        if (p.liste) {
          const l = eingabe[p.name] ?? p.standard;
          if (!Array.isArray(l) || !l.every((x) => typeof x === 'string')) throw new Error(`${def.id}: Parameter ${p.name} muss eine Liste von Texten sein`);
          if (l.length < p.min || l.length > p.max) throw new Error(`${def.id}: Parameter ${p.name} hat ${l.length} Einträge, erlaubt sind ${p.min}…${p.max} (außerhalb)`);
          werte[p.name] = [...l];
          continue;
        }
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
        anschluesse: erg.anschluesse ?? [], ...(erg.wesen ? { wesen: erg.wesen } : {}), platzbedarf: { huelle, sperrzonen: erg.sperrzonen ?? [] }, testszenario: def.testszenario,
      });
    },
  };
  return Object.freeze(baustein);
}

/** Zustandswert einer Richtung für einen Richtungszustand (umgekehrt zu `vermesser.richtungVon`), aus den Daten von Ebene 0. */
function wertFuer(ebene0, zustandName, richtung) {
  const werte = ebene0.register.bloecke.zustandsart(zustandName).werte;
  const w = werte.find((x) => ebene0.vermesser.richtungVon(zustandName, x) === richtung);
  if (w === undefined) throw new Error(`Zustand ${zustandName} kennt die Richtung ${richtung} nicht`);
  return w;
}

/** Zustände eines formgebundenen Blocks (Treppe: weirdo_direction = Seite des Vollblocks; Tür: Himmelsrichtung, Scharnier rechts = door_hinge_bit). */
function zustandVon(ebene0, b) {
  if (b.form === 'treppe') return { weirdo_direction: wertFuer(ebene0, 'weirdo_direction', b.richtung), upside_down_bit: false, 'minecraft:corner': 'none' };
  if (b.form === 'tuer') return { 'minecraft:cardinal_direction': wertFuer(ebene0, 'minecraft:cardinal_direction', b.richtung), door_hinge_bit: b.scharnier === 'rechts', upper_block_bit: b.haelfte === 'oben', open_bit: false };
  return {};
}

/**
 * Setzt ein Paket in eine Welt (nur über Ebene 0). `palette` ordnet jeder Rolle einen Block zu: Rolle → id, {id, zustand} oder je Form
 * {voll, treppe, tuer, scheibe}. Formgebundene Blöcke brauchen `ebene0` (Drehregeln für die Richtungszustände).
 * Bausteine kennen kein Material; diese Zuordnung ist Sache von Ebene 3 (hier nur für Tests und Vorschau).
 */
export function platziere(welt, paket, palette, versatz = { x: 0, y: 0, z: 0 }, ebene0 = null) {
  for (const b of paket.bloecke) {
    if (b.technik === true) {
      welt.setzeBlock(b.x + versatz.x, b.y + versatz.y, b.z + versatz.z, b.id, b.zustand ?? {}, b.inhalt ?? null);
      continue;
    }
    const m = palette[b.rolle];
    if (!m) throw new Error(`Palette kennt die Rolle "${b.rolle}" nicht`);
    const form = b.form ?? 'voll';
    const eintrag = typeof m === 'string' || 'id' in m ? (form === 'voll' ? m : null) : m[form];
    if (!eintrag) throw new Error(`Palette kennt für die Rolle "${b.rolle}" die Form "${form}" nicht`);
    const { id, zustand = {} } = typeof eintrag === 'string' ? { id: eintrag } : eintrag;
    let z = zustand;
    if (form !== 'voll' && form !== 'scheibe') {
      if (!ebene0) throw new Error(`${form} braucht ebene0 zum Berechnen der Zustände`);
      z = { ...zustandVon(ebene0, b), ...zustand };
    }
    welt.setzeBlock(b.x + versatz.x, b.y + versatz.y, b.z + versatz.z, id, z);
  }
  for (const w of paket.wesen ?? []) welt.fuegeWesenHinzu({ ...w, x: w.x + versatz.x, y: w.y + versatz.y, z: w.z + versatz.z });
}

/** Einfache Palette für Tests und Vorschau (Stein; Treppen, Holztür und Glas für die formgebundenen Bauelemente). */
export const TESTPALETTE = Object.freeze({
  wand: 'minecraft:stone',
  akzent: Object.freeze({ voll: 'minecraft:cobblestone', treppe: 'minecraft:stone_stairs', tuer: 'minecraft:wooden_door' }),
  boden: Object.freeze({ voll: 'minecraft:stone', treppe: 'minecraft:stone_stairs' }),
  licht: 'minecraft:glowstone',
  glas: Object.freeze({ voll: 'minecraft:glass', scheibe: 'minecraft:glass_pane' }),
});

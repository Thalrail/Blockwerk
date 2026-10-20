// Ebene 1 – Prüfer: findet Verstöße gegen die Regeln und meldet sie maschinenlesbar mit Koordinate.
// Meldung: { regel, ort: {x,y,z}, schwere: 'verstoss' | 'hinweis', meldung }.
//   'verstoss' = in Bedrock sicher falsch, 'hinweis' = unklar (z. B. Haltblock mit unbekannten Eigenschaften).
// Der Prüfer liest die Welt nur über Ebene 0 und ändert sie nie.
import { VEKTOR } from '../ebene0/richtungen.js';
import { LUFT } from '../ebene0/blockregister.js';

const SEITEN = { west: 'west', east: 'east', north: 'north', south: 'south', top: 'down' };

function sortiert(liste) {
  return liste.sort((a, b) => a.ort.y - b.ort.y || a.ort.z - b.ort.z || a.ort.x - b.ort.x || (a.regel < b.regel ? -1 : a.regel > b.regel ? 1 : 0));
}

/** Bewertet den Block, der etwas halten soll: 'ok' | 'fehlt' | 'unklar'. */
function haltblock(welt, register, x, y, z) {
  const b = welt.leseBlock(x, y, z);
  if (b.id === LUFT) return 'fehlt';
  const vollblock = register.bloecke.block(b.id).eigenschaften.vollblock;
  return vollblock === true ? 'ok' : 'unklar';
}

function pruefeHalt(welt, register, bloecke) {
  const fackeln = new Set(register.bloecke.ids().filter((id) => Object.hasOwn(register.bloecke.block(id).zustaende, 'torch_facing_direction')));
  const schienen = new Set(register.bloecke.ids().filter((id) => Object.hasOwn(register.bloecke.block(id).zustaende, 'rail_direction')));
  const meldungen = [];
  for (const b of bloecke) {
    const ort = { x: b.x, y: b.y, z: b.z };
    if (fackeln.has(b.id)) {
      const seite = b.zustand.torch_facing_direction;
      const richtung = SEITEN[seite];
      if (!richtung) {
        meldungen.push({ regel: 'pruefer.braucht-halt-fackel', ort, schwere: 'hinweis', meldung: `${b.id}: Haltseite ist nicht angegeben (${seite ?? 'kein Zustand'})` });
        continue;
      }
      const v = VEKTOR[richtung];
      const urteil = haltblock(welt, register, b.x + v.x, b.y + v.y, b.z + v.z);
      if (urteil === 'fehlt') meldungen.push({ regel: 'pruefer.braucht-halt-fackel', ort, schwere: 'verstoss', meldung: `${b.id} ohne Haltblock (${seite}): sie springt ab` });
      else if (urteil === 'unklar') meldungen.push({ regel: 'pruefer.braucht-halt-fackel', ort, schwere: 'hinweis', meldung: `${b.id}: Haltblock (${seite}) ist kein sicherer Vollblock – im Spiel prüfen` });
    } else if (schienen.has(b.id)) {
      const urteil = haltblock(welt, register, b.x, b.y - 1, b.z);
      if (urteil === 'fehlt') meldungen.push({ regel: 'pruefer.braucht-halt-schiene', ort, schwere: 'verstoss', meldung: `${b.id} ohne Boden: sie springt ab` });
      else if (urteil === 'unklar') meldungen.push({ regel: 'pruefer.braucht-halt-schiene', ort, schwere: 'hinweis', meldung: `${b.id}: Block darunter ist kein sicherer Vollblock – im Spiel prüfen` });
    }
  }
  return meldungen;
}

function pruefeTickbereich(welt, bloecke, tickbereich) {
  const ersteProChunk = new Map();
  const merke = (x, y, z, was) => {
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    if (tickbereich.tickt(cx, cz)) return;
    const k = `${cx},${cz}`;
    const e = ersteProChunk.get(k);
    if (e) e.anzahl += 1;
    else ersteProChunk.set(k, { cx, cz, ort: { x, y, z }, anzahl: 1, was });
  };
  for (const b of bloecke) merke(b.x, b.y, b.z, 'Block');
  for (const w of welt.wesen()) merke(Math.floor(w.x), Math.floor(w.y), Math.floor(w.z), 'Wesen');
  return [...ersteProChunk.values()].map((e) => ({
    regel: 'pruefer.tickbereich',
    ort: e.ort,
    schwere: 'verstoss',
    meldung: `Chunk ${e.cx}, ${e.cz} liegt außerhalb des Tickbereichs (${e.anzahl} Einträge): dort läuft nichts`,
  }));
}

/**
 * @param {import('../ebene0/welt.js').Welt} welt
 * @param {{register: object, tickbereich?: import('./tickbereich.js').Tickbereich}} optionen
 * @returns {{regel:string, ort:{x:number,y:number,z:number}, schwere:string, meldung:string}[]}
 */
export function pruefe(welt, { register, tickbereich = null }) {
  const bloecke = welt.alleBloecke();
  const meldungen = pruefeHalt(welt, register, bloecke);
  if (tickbereich) meldungen.push(...pruefeTickbereich(welt, bloecke, tickbereich));
  return sortiert(meldungen);
}

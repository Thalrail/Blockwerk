// Ebene 1 – Prüfer: findet Verstöße gegen die Regeln und meldet sie maschinenlesbar mit Koordinate.
// Meldung: { regel, ort: {x,y,z}, schwere: 'verstoss' | 'hinweis', meldung }.
//   'verstoss' = in Bedrock falsch (fehlender Block oder Block, der nachweislich nicht hält),
//   'hinweis'  = unklar (Eigenschaft in Ebene 0 unbekannt oder Zustand nicht angegeben).
// Was ein Block trägt (fackelOben, fackelSeiten, schiene), ist ein Fakt aus Ebene 0; der Prüfer wendet ihn nur an.
// Der Prüfer liest die Welt nur über Ebene 0 und ändert sie nie.
import { GEGENRICHTUNG, VEKTOR } from '../ebene0/richtungen.js';
import { LUFT } from '../ebene0/blockregister.js';

const SEITEN = { west: 'west', east: 'east', north: 'north', south: 'south', top: 'down' };

function sortiert(liste) {
  return liste.sort((a, b) => a.ort.y - b.ort.y || a.ort.z - b.ort.z || a.ort.x - b.ort.x || (a.regel < b.regel ? -1 : a.regel > b.regel ? 1 : 0));
}

/** Urteil über den Block, an/auf dem etwas hängt: 'ok' | 'nein' (hält nachweislich nicht) | 'fehlt' (Luft) | 'unklar'. */
function haltUrteil(art, block, register, richtungVon, zurFackel) {
  if (block.id === LUFT) return 'fehlt';
  const e = register.bloecke.block(block.id).eigenschaften;
  if (art === 'schiene') {
    if (e.schiene === true) return 'ok';
    if (e.schiene === false) return 'nein';
    if (e.schiene === 'wenn-oben') {
      // Halbstufe: obere Hälfte, Treppe: kopfstehend. Die normale Lage trägt nachweislich nicht, die umgekehrte schon
      // (Spieltests Jonah, 20./21.10.2026).
      const oben = block.zustand['minecraft:vertical_half'] ?? (block.zustand.upside_down_bit === undefined ? undefined : block.zustand.upside_down_bit ? 'top' : 'bottom');
      return oben === undefined ? 'unklar' : oben === 'top' ? 'ok' : 'nein';
    }
    return 'unklar';
  }
  if (art === 'fackel-oben') {
    if (e.fackelOben === true) return 'ok';
    if (e.fackelOben === false) return 'nein';
    if (e.fackelOben === 'obere-haelfte') {
      const h = block.zustand['minecraft:vertical_half'];
      return h === undefined ? 'unklar' : h === 'top' ? 'ok' : 'nein';
    }
    return 'unklar';
  }
  // fackel-seite: zurFackel = Richtung vom Haltblock zur Fackel
  if (e.fackelSeiten === 'alle') return 'ok';
  if (e.fackelSeiten === 'keine') return 'nein';
  if (e.fackelSeiten === 'grosse-seite') {
    const w = block.zustand.weirdo_direction;
    if (w === undefined) return 'unklar';
    return richtungVon('weirdo_direction', w) === zurFackel ? 'ok' : 'nein';
  }
  return 'unklar';
}

function pruefeHalt(welt, register, richtungVon, bloecke) {
  const hatZustand = (id, name) => Object.hasOwn(register.bloecke.block(id).zustaende, name);
  const fackeln = new Set(register.bloecke.ids().filter((id) => hatZustand(id, 'torch_facing_direction')));
  const schienen = new Set(register.bloecke.ids().filter((id) => hatZustand(id, 'rail_direction')));
  const meldungen = [];
  const melde = (regel, ort, schwere, meldung) => meldungen.push({ regel, ort, schwere, meldung });
  for (const b of bloecke) {
    const ort = { x: b.x, y: b.y, z: b.z };
    if (fackeln.has(b.id)) {
      const seite = b.zustand.torch_facing_direction;
      const richtung = SEITEN[seite];
      if (!richtung) {
        melde('pruefer.braucht-halt-fackel', ort, 'hinweis', `${b.id}: Haltseite ist nicht angegeben (${seite ?? 'kein Zustand'})`);
        continue;
      }
      const v = VEKTOR[richtung];
      const halt = welt.leseBlock(b.x + v.x, b.y + v.y, b.z + v.z);
      const art = seite === 'top' ? 'fackel-oben' : 'fackel-seite';
      const urteil = haltUrteil(art, halt, register, richtungVon, GEGENRICHTUNG[richtung]);
      if (urteil === 'fehlt') melde('pruefer.braucht-halt-fackel', ort, 'verstoss', `${b.id} ohne Haltblock (${seite}): sie springt ab`);
      else if (urteil === 'nein') melde('pruefer.braucht-halt-fackel', ort, 'verstoss', `${b.id}: ${halt.id} hält keine Fackel (${seite}): sie springt ab`);
      else if (urteil === 'unklar') melde('pruefer.braucht-halt-fackel', ort, 'hinweis', `${b.id}: ob ${halt.id} die Fackel hält (${seite}), ist noch nicht belegt – im Spiel prüfen`);
    } else if (schienen.has(b.id)) {
      const halt = welt.leseBlock(b.x, b.y - 1, b.z);
      const urteil = haltUrteil('schiene', halt, register, richtungVon, null);
      if (urteil === 'fehlt') melde('pruefer.braucht-halt-schiene', ort, 'verstoss', `${b.id} ohne Boden: sie springt ab`);
      else if (urteil === 'nein') melde('pruefer.braucht-halt-schiene', ort, 'verstoss', `${b.id}: ${halt.id} trägt keine Schiene: sie springt ab`);
      else if (urteil === 'unklar') melde('pruefer.braucht-halt-schiene', ort, 'hinweis', `${b.id}: ob ${halt.id} die Schiene trägt, ist noch nicht belegt – im Spiel prüfen`);
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

function pruefeSchienen(welt, schienen, bloecke) {
  const meldungen = [];
  const melde = (regel, ort, schwere, meldung) => meldungen.push({ regel, ort, schwere, meldung });
  for (const b of bloecke) {
    if (!schienen.istSchienenId(b.id)) continue;
    const ort = { x: b.x, y: b.y, z: b.z };
    const ende = schienen.enden(b.zustand);
    if (!ende) {
      melde('pruefer.schiene-verbindung', ort, 'hinweis', `${b.id}: Form (rail_direction) ist nicht angegeben, Verbindungen nicht prüfbar`);
      continue;
    }
    const wert = b.zustand.rail_direction;
    if (wert > 5 && schienen.nurGerade.has(b.id)) {
      melde('pruefer.antriebsschiene-kurve', ort, schienen.belegtGerade.has(b.id) ? 'verstoss' : 'hinweis',
        `${b.id} als Kurve (${wert}): Antriebsschienen sind gerade${schienen.belegtGerade.has(b.id) ? '' : ' (für diese Schiene nicht belegt)'}`);
    }
    for (const e of ende) {
      const g = schienen.gegenstelle(welt, ort, e);
      const wohin = `${e.richtung}${e.dy ? ' (hoch)' : ''}`;
      if (g.art === 'einseitig') melde('pruefer.schiene-verbindung', ort, 'hinweis', `${b.id}: Ende ${wohin} zeigt auf ${g.partner.id} bei ${g.partner.pos.x}, ${g.partner.pos.y}, ${g.partner.pos.z}, das nicht zurückzeigt (Abzweig oder Lücke) – im Spiel prüfen`);
      else if (g.art === 'leer') melde('pruefer.schiene-verbindung', ort, 'hinweis', `${b.id}: Ende ${wohin} führt ins Leere (Sackgasse)`);
    }
  }
  return meldungen;
}

/**
 * @param {import('../ebene0/welt.js').Welt} welt
 * @param {{register: object, richtungVon: (zustandName:string, wert:any) => string|null, tickbereich?: import('./tickbereich.js').Tickbereich, schienen?: ReturnType<typeof import('./schienen.js').erzeugeSchienen>}} optionen
 *   richtungVon kommt vom Vermesser aus Ebene 0
 * @returns {{regel:string, ort:{x:number,y:number,z:number}, schwere:string, meldung:string}[]}
 */
export function pruefe(welt, { register, richtungVon, tickbereich = null, schienen = null }) {
  const bloecke = welt.alleBloecke();
  const meldungen = pruefeHalt(welt, register, richtungVon, bloecke);
  if (schienen) meldungen.push(...pruefeSchienen(welt, schienen, bloecke));
  if (tickbereich) meldungen.push(...pruefeTickbereich(welt, bloecke, tickbereich));
  return sortiert(meldungen);
}

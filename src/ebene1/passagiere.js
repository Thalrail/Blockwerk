// Ebene 1 – Passagiere in Loren: Auswurf an der Aktivierungsschiene, Landung nach dem Fall (Teil der Lorenbahn-Nische, 27.10.2026).
// Diskretes Modell ohne Physik (wie lore.js): wohin steigt der Passagier aus, wie tief fällt er, wo kommt er an? Regeln: data/regeln/passagiere.json.
// Bedrock nennt dazu wenig: Die Reihenfolge der Austrittszellen stammt aus dem Wiki (Minecart) und ist für Bedrock nicht belegt → Java-Platzhalter, `ungeprüft`.
// Die Welt wird nur über Ebene 0 gelesen und geschrieben (Wesen versetzen, aussteigen lassen); Bewegungsregeln kommen aus bewegung.js.
import { VEKTOR } from '../ebene0/richtungen.js';

const HORIZONTAL = ['north', 'east', 'south', 'west'];
const RECHTS = { north: 'east', east: 'south', south: 'west', west: 'north' };
const LINKS = { north: 'west', west: 'south', south: 'east', east: 'north' };
const HINTEN = { north: 'south', south: 'north', east: 'west', west: 'east' };
/** yaw → Fahrtrichtung (Minecraft: 0 = Süden, 90 = Westen, 180 = Norden, 270 = Osten; der Vermesser dreht yaw mit). */
const YAW_RICHTUNG = { 0: 'south', 90: 'west', 180: 'north', 270: 'east' };

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, register: {bloecke: object, wesen: object}, bewegung: ReturnType<typeof import('./bewegung.js').erzeugeBewegung>, aktivierung: {istAntriebsschiene: (id: string) => boolean}}} quellen
 */
export function erzeugePassagiere({ regelwerk, register, bewegung, aktivierung }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  const reihenfolge = P('passagiere.auswurf', 'reihenfolge');
  const bodenNoetig = P('passagiere.auswurf-ort', 'bodenNoetig');
  const lorenIds = register.wesen.lore();
  const dorfIds = P('passagiere.art', 'dorfbewohnerIds');

  /** Fahrtrichtung aus yaw (nur Vielfache von 90 Grad sind gültig). */
  function richtungAusYaw(yaw) {
    const r = YAW_RICHTUNG[((Math.round(yaw) % 360) + 360) % 360];
    if (!r) throw new Error(`Die Fahrtrichtung der Lore lässt sich aus yaw ${yaw} nicht bestimmen (nur 0, 90, 180, 270)`);
    return r;
  }

  const vektor = (r) => VEKTOR[r];
  /** Zelle für einen Kandidatennamen, relativ zur Zelle der Lore und der Fahrtrichtung. */
  function kandidatenZelle(zelle, richtung, name) {
    const rechts = vektor(RECHTS[richtung]), links = vektor(LINKS[richtung]), vorn = vektor(richtung), hinten = vektor(HINTEN[richtung]);
    const add = (...vs) => ({ x: zelle.x + vs.reduce((s, v) => s + v.x, 0), y: zelle.y, z: zelle.z + vs.reduce((s, v) => s + v.z, 0) });
    switch (name) {
      case 'rechts': return add(rechts);
      case 'links': return add(links);
      case 'hinten-rechts': return add(hinten, rechts);
      case 'hinten-links': return add(hinten, links);
      case 'vorn-rechts': return add(vorn, rechts);
      case 'vorn-links': return add(vorn, links);
      case 'hinten': return add(hinten);
      case 'vorn': return add(vorn);
      case 'oben': return { ...add(), y: zelle.y + 1 };
      case 'unten': return { ...add(), y: zelle.y - 1 };
      default: throw new Error(`Unbekannter Austrittsort: ${name}`);
    }
  }

  /** Art des Passagiers für die Bewegungsregeln: 'dorfbewohner' | 'baby' | 'spieler'. */
  function artVon(w) {
    if (w.id === 'minecraft:player') return 'spieler';
    if (dorfIds.includes(w.id)) return w.baby ? 'baby' : 'dorfbewohner';
    throw new Error(`${w.id}: für diese Art gibt es noch keine Bewegungsregeln (nur Dorfbewohner, Baby, Spieler)`);
  }

  const lore = (welt, nr) => {
    const l = welt.wesen().find((w) => w.nr === nr);
    if (!l) throw new Error(`Kein Wesen mit Nummer ${nr}`);
    if (!lorenIds.includes(l.id)) throw new Error(`${l.id} ist keine Lore`);
    return l;
  };

  /**
   * Wohin würde der Passagier der Lore aussteigen? Prüft die Kandidaten in der Reihenfolge aus den Daten: Platz für den Körper und (Regel `bodenNoetig`) tragender Boden oder Wasser.
   * @returns {{ok: true, ziel: {x:number,y:number,z:number}, kandidat: string, verworfen: {kandidat: string, grund: string}[], ohneBoden: boolean} | {ok: false, grund: string, verworfen: object[]}}
   */
  function auswurfZiel(welt, loreNr, richtung = null) {
    const l = lore(welt, loreNr);
    const p = welt.passagier(loreNr);
    if (!p) return { ok: false, grund: 'die Lore hat keinen Passagier', verworfen: [] };
    const r = richtung ?? richtungAusYaw(l.yaw);
    const zelle = { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) };
    const art = artVon(p);
    const verworfen = [];
    for (const name of reihenfolge) {
      const z = kandidatenZelle(zelle, r, name);
      const s = bewegung.stehstelle(welt, z, art);
      if (s.unklar) { verworfen.push({ kandidat: name, grund: `${s.grund}` }); continue; }
      if (!s.platz) { verworfen.push({ kandidat: name, grund: s.grund ?? 'kein Platz' }); continue; }
      if (bodenNoetig && !s.traegt) { verworfen.push({ kandidat: name, grund: 'kein Boden darunter' }); continue; }
      return { ok: true, ziel: z, kandidat: name, verworfen, ohneBoden: !s.traegt };
    }
    return { ok: false, grund: 'keine der Austrittszellen ist frei', verworfen };
  }

  /**
   * Der Passagier steigt aus (an der Zelle von `auswurfZiel`) und fällt bis zum Boden oder ins Wasser.
   * Ändert die Welt über Ebene 0 (Wesen versetzen, aussteigen). Bleibt die Lore besetzt, wenn keine Zelle frei ist.
   * @returns {{ok: boolean, passagier?: number, ziel?: object, kandidat?: string, fall?: object, grund?: string}}
   */
  function wirfAus(welt, loreNr, richtung = null) {
    const z = auswurfZiel(welt, loreNr, richtung);
    if (!z.ok) return z;
    const p = welt.passagier(loreNr);
    welt.steigeAus(p.nr);
    welt.setzeWesenPosition(p.nr, { x: z.ziel.x + 0.5, y: z.ziel.y, z: z.ziel.z + 0.5 });
    const fall = bewegung.faellt(welt, z.ziel, artVon(p));
    if (fall.ok) welt.setzeWesenPosition(p.nr, { x: fall.ziel.x + 0.5, y: fall.Y / 2, z: fall.ziel.z + 0.5 });
    return { ok: true, passagier: p.nr, ziel: z.ziel, kandidat: z.kandidat, verworfen: z.verworfen, ohneBoden: z.ohneBoden, fall };
  }

  /** Eine Lore auf einer eingeschalteten Aktivierungsschiene? (Schiene in der Zelle der Lore, `rail_data_bit` = aktiv) */
  function aufAktiverSchiene(welt, l) {
    const b = welt.leseBlock(Math.floor(l.x), Math.floor(l.y), Math.floor(l.z));
    return aktivierung.istAntriebsschiene(b.id) && b.zustand.rail_data_bit === true;
  }

  /**
   * Was würde beim Auswurf passieren? Wie `wirfAus`, ändert die Welt aber nicht (für den Prüfer).
   * @returns {{ok: boolean, ziel?: object, kandidat?: string, fall?: object, ohneBoden?: boolean, grund?: string, verworfen: object[]}}
   */
  function simuliereAuswurf(welt, loreNr, richtung = null) {
    const z = auswurfZiel(welt, loreNr, richtung);
    if (!z.ok) return z;
    return { ...z, fall: bewegung.faellt(welt, z.ziel, artVon(welt.passagier(loreNr))) };
  }

  /** Alle besetzten Loren auf einer eingeschalteten Aktivierungsschiene (Lore-Wesen, sortiert nach Nummer). */
  function ausloeser(welt) {
    return welt.wesen().filter((l) => lorenIds.includes(l.id) && welt.passagier(l.nr) && aufAktiverSchiene(welt, l));
  }

  /**
   * Mechanik für den Taktgeber. Tickart 'mechanismus': nur im C-Tick (Bedrock: Aktivierungsschienen schalten im C-Tick).
   * Jede besetzte Lore auf einer aktiven Aktivierungsschiene wirft ihren Passagier aus; die Fahrtrichtung kommt aus yaw der Lore.
   * @returns {{id: string, tickart: string, schritt: Function, ereignisse: object[]}}
   */
  function mechanik() {
    const ereignisse = [];
    return {
      id: 'passagiere', tickart: 'mechanismus', ereignisse,
      schritt: (ktx) => {
        for (const l of ktx.welt.wesen()) {
          if (!lorenIds.includes(l.id) || !ktx.welt.passagier(l.nr) || !aufAktiverSchiene(ktx.welt, l)) continue;
          const r = wirfAus(ktx.welt, l.nr);
          ereignisse.push({ tick: ktx.tick, lore: l.nr, ...r });
        }
      },
    };
  }

  return { auswurfZiel, simuliereAuswurf, ausloeser, wirfAus, mechanik, richtungAusYaw, kandidatenZelle, aufAktiverSchiene, reihenfolge, bodenNoetig };
}

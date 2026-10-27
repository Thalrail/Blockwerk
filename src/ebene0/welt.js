// Ebene 0 – Voxelwelt
// Blöcke setzen/lesen/löschen, Speicherung in Chunks (16×16, sparse), Luft als Standard.
// Dazu: Blockinhalte (Slots) und wo welches Wesen steht. Kein Verhalten, keine Simulation.
// Deterministisch: alle Listen kommen in fester Reihenfolge heraus.
import { CHUNK_GROESSE, HOEHE_MAX, HOEHE_MIN, chunkVon, normalisiereYaw } from './richtungen.js';
import { LUFT } from './blockregister.js';

export const MAX_STAPEL = 64;
const SCHICHT = CHUNK_GROESSE * CHUNK_GROESSE;

const kopieZustand = (z) => Object.fromEntries(Object.entries(z).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const kopieInhalt = (inh) => inh.map((s) => ({ slot: s.slot, gegenstand: s.gegenstand, anzahl: s.anzahl }));

export class Welt {
  /**
   * @param {{bloecke: import('./blockregister.js').Blockregister, wesen: import('./wesenregister.js').Wesenregister, gegenstaende: Iterable<string>}} register
   */
  constructor({ bloecke, wesen, gegenstaende, stapel = () => MAX_STAPEL }) {
    this.register = { bloecke, wesen, gegenstaende: new Set(gegenstaende), stapel };
    /** @type {Map<string, Map<number, {id:string, zustand:object, inhalt?:object[]}>>} */
    this._chunks = new Map();
    /** @type {Map<number, object>} */
    this._wesen = new Map();
    this._naechsteNr = 1;
    /** Zähler der Blockänderungen: solange er gleich bleibt, ist die sortierte Blockliste von `alleBloecke` noch gültig. */
    this._version = 0;
    this._liste = null;
    this._listeVersion = -1;
  }

  // ---------- Hilfen ----------
  _pruefePos(x, y, z) {
    if (![x, y, z].every(Number.isInteger)) throw new Error(`Block-Koordinaten müssen ganze Zahlen sein: ${x}, ${y}, ${z}`);
    if (y < HOEHE_MIN || y > HOEHE_MAX) throw new Error(`Höhe y=${y} außerhalb ${HOEHE_MIN}…${HOEHE_MAX}`);
  }

  _ort(x, y, z) {
    const { cx, cz, lx, lz } = chunkVon(x, z);
    return { schluessel: `${cx},${cz}`, index: (y - HOEHE_MIN) * SCHICHT + lz * CHUNK_GROESSE + lx };
  }

  // ---------- Blöcke ----------
  /**
   * Setzt einen Block. Luft löscht. Ersetzt immer auch den alten Inhalt.
   * @param {string} id z. B. "minecraft:stone"
   * @param {object} [zustand] nur erlaubte Zustände mit erlaubten Werten
   * @param {{slot:number, gegenstand:string, anzahl:number}[]} [inhalt] nur bei Behälterblöcken
   */
  setzeBlock(x, y, z, id, zustand = {}, inhalt = null) {
    this._pruefePos(x, y, z);
    const reg = this.register.bloecke;
    reg.pruefeZustand(id, zustand);
    const inhaltNeu = inhalt === null || inhalt === undefined ? null : this._pruefeInhalt(id, inhalt);
    const { schluessel, index } = this._ort(x, y, z);
    if (id === LUFT) {
      if (inhaltNeu && inhaltNeu.length) throw new Error('Luft kann keinen Inhalt haben');
      this._entferne(schluessel, index);
      this._version++;
      return;
    }
    let chunk = this._chunks.get(schluessel);
    if (!chunk) this._chunks.set(schluessel, (chunk = new Map()));
    const eintrag = { id, zustand: kopieZustand(zustand) };
    if (inhaltNeu && inhaltNeu.length) eintrag.inhalt = inhaltNeu;
    chunk.set(index, eintrag);
    this._version++;
  }

  loescheBlock(x, y, z) {
    this.setzeBlock(x, y, z, LUFT);
  }

  _entferne(schluessel, index) {
    const chunk = this._chunks.get(schluessel);
    if (!chunk) return;
    chunk.delete(index);
    if (chunk.size === 0) this._chunks.delete(schluessel);
  }

  /** Liest einen Block. Nichts gesetzt → Luft. Das Ergebnis ist eine Kopie. */
  leseBlock(x, y, z) {
    this._pruefePos(x, y, z);
    const { schluessel, index } = this._ort(x, y, z);
    const e = this._chunks.get(schluessel)?.get(index);
    if (!e) return { id: LUFT, zustand: {} };
    return { id: e.id, zustand: { ...e.zustand }, ...(e.inhalt ? { inhalt: kopieInhalt(e.inhalt) } : {}) };
  }

  istLuft(x, y, z) {
    return this.leseBlock(x, y, z).id === LUFT;
  }

  // ---------- Blockinhalt ----------
  _pruefeInhalt(id, inhalt) {
    const slots = this.register.bloecke.slots(id);
    if (!Array.isArray(inhalt)) throw new Error('Inhalt muss eine Liste von Slots sein');
    if (inhalt.length && slots === 0) throw new Error(`${id} ist kein Behälter und kann keinen Inhalt haben`);
    const benutzt = new Set();
    for (const s of inhalt) {
      if (!Number.isInteger(s?.slot) || s.slot < 0 || s.slot >= slots) throw new Error(`${id}: Slot ${s?.slot} außerhalb 0…${slots - 1}`);
      if (benutzt.has(s.slot)) throw new Error(`${id}: Slot ${s.slot} doppelt belegt`);
      benutzt.add(s.slot);
      if (!this.register.gegenstaende.has(s.gegenstand)) throw new Error(`Unbekannter Gegenstand: ${String(s.gegenstand)}`);
      if (!Number.isInteger(s.anzahl) || s.anzahl < 1 || s.anzahl > this.register.stapel(s.gegenstand)) throw new Error(`${s.gegenstand}: Anzahl muss 1…${this.register.stapel(s.gegenstand)} sein`);
    }
    return kopieInhalt([...inhalt].sort((a, b) => a.slot - b.slot));
  }

  /** Ersetzt den Inhalt eines Behälterblocks. Leere Liste leert ihn. */
  setzeInhalt(x, y, z, inhalt) {
    this._pruefePos(x, y, z);
    const { schluessel, index } = this._ort(x, y, z);
    const e = this._chunks.get(schluessel)?.get(index);
    if (!e) throw new Error(`Kein Block bei ${x}, ${y}, ${z}`);
    const neu = this._pruefeInhalt(e.id, inhalt);
    if (neu.length) e.inhalt = neu;
    else delete e.inhalt;
    this._version++;
  }

  leseInhalt(x, y, z) {
    return this.leseBlock(x, y, z).inhalt ?? [];
  }

  // ---------- Wesen ----------
  /**
   * @param {{id:string, x:number, y:number, z:number, yaw?:number, baby?:boolean, name?:string}} w
   * @returns {number} laufende Nummer des Wesens
   */
  fuegeWesenHinzu(w) {
    const reg = this.register.wesen;
    if (!reg.hat(w?.id)) throw new Error(`Unbekanntes Wesen: ${String(w?.id)}`);
    for (const k of ['x', 'y', 'z']) if (!Number.isFinite(w[k])) throw new Error(`Wesen: ${k} muss eine Zahl sein`);
    if (w.y < HOEHE_MIN || w.y > HOEHE_MAX + 1) throw new Error(`Wesen: Höhe y=${w.y} außerhalb des Weltbereichs`);
    const yaw = w.yaw === undefined ? 0 : w.yaw;
    if (!Number.isFinite(yaw)) throw new Error('Wesen: yaw muss eine Zahl sein');
    const baby = w.baby === true;
    if (w.baby !== undefined && typeof w.baby !== 'boolean') throw new Error('Wesen: baby muss true/false sein');
    if (baby && !reg.kannBaby(w.id)) throw new Error(`${w.id} hat keine Babyform`);
    if (w.name !== undefined && typeof w.name !== 'string') throw new Error('Wesen: name muss ein Text sein');
    const nr = this._naechsteNr++;
    const eintrag = { nr, id: w.id, x: w.x, y: w.y, z: w.z, yaw: normalisiereYaw(yaw), baby };
    if (w.name !== undefined) eintrag.name = w.name;
    this._wesen.set(nr, eintrag);
    return nr;
  }

  entferneWesen(nr) {
    if (!this._wesen.delete(nr)) throw new Error(`Kein Wesen mit Nummer ${nr}`);
  }

  /** Alle Wesen, sortiert nach Nummer (Kopien). */
  wesen() {
    return [...this._wesen.values()].sort((a, b) => a.nr - b.nr).map((w) => ({ ...w }));
  }

  // ---------- Übersicht (deterministisch) ----------
  /** Alle Chunks, in denen etwas steht, sortiert nach (cx, cz). */
  chunks() {
    return [...this._chunks.keys()]
      .map((k) => k.split(',').map(Number))
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .map(([cx, cz]) => ({ cx, cz }));
  }

  anzahlBloecke() {
    let n = 0;
    for (const c of this._chunks.values()) n += c.size;
    return n;
  }

  /**
   * Alle Nicht-Luft-Blöcke, sortiert nach y, dann z, dann x (Schicht für Schicht).
   * Die Liste wird zwischengespeichert, solange sich kein Block ändert (die Prüfer fragen sie hundertfach ab); die Einträge sind eingefroren,
   * damit niemand den gemeinsamen Zwischenspeicher verändert (eine Änderung wirft einen Fehler). Die Liste selbst ist eine frische Kopie.
   */
  alleBloecke() {
    if (this._liste && this._listeVersion === this._version) return [...this._liste];
    const liste = [];
    for (const [schluessel, chunk] of this._chunks) {
      const [cx, cz] = schluessel.split(',').map(Number);
      for (const [index, e] of chunk) {
        const yi = Math.floor(index / SCHICHT);
        const rest = index % SCHICHT;
        liste.push({
          x: cx * CHUNK_GROESSE + (rest % CHUNK_GROESSE),
          y: yi + HOEHE_MIN,
          z: cz * CHUNK_GROESSE + Math.floor(rest / CHUNK_GROESSE),
          id: e.id,
          zustand: { ...e.zustand },
          ...(e.inhalt ? { inhalt: kopieInhalt(e.inhalt) } : {}),
        });
      }
    }
    liste.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
    for (const b of liste) { Object.freeze(b.zustand); if (b.inhalt) { for (const s of b.inhalt) Object.freeze(s); Object.freeze(b.inhalt); } Object.freeze(b); }
    this._liste = liste; this._listeVersion = this._version;
    return [...liste];
  }

  // ---------- Bauteile (Austausch mit dem Vermesser) ----------
  /**
   * Kopiert einen Quader (Ecken inklusive) als Bauteil mit absoluten Koordinaten.
   * Wesen zählen dazu, wenn ihr Block im Quader liegt.
   */
  ausschnitt(a, b) {
    const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
    const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
    const z1 = Math.min(a.z, b.z), z2 = Math.max(a.z, b.z);
    const innen = (x, y, z) => x >= x1 && x <= x2 && y >= y1 && y <= y2 && z >= z1 && z <= z2;
    return {
      bloecke: this.alleBloecke().filter((e) => innen(e.x, e.y, e.z)),
      wesen: this.wesen()
        .filter((w) => innen(Math.floor(w.x), Math.floor(w.y), Math.floor(w.z)))
        .map(({ nr, ...rest }) => rest),
    };
  }

  /** Setzt ein Bauteil ein (mit Versatz). Vorhandene Blöcke werden ersetzt; Luft im Bauteil löscht nichts. */
  fuegeBauteilEin(bauteil, versatz = { x: 0, y: 0, z: 0 }) {
    // Erst alles prüfen, dann schreiben: bei einem Fehler bleibt die Welt unverändert.
    const probe = new Welt(this.register);
    for (const b of bauteil.bloecke) probe.setzeBlock(b.x + versatz.x, b.y + versatz.y, b.z + versatz.z, b.id, b.zustand, b.inhalt ?? null);
    for (const w of bauteil.wesen) probe.fuegeWesenHinzu({ ...w, x: w.x + versatz.x, y: w.y + versatz.y, z: w.z + versatz.z });
    for (const b of bauteil.bloecke) this.setzeBlock(b.x + versatz.x, b.y + versatz.y, b.z + versatz.z, b.id, b.zustand, b.inhalt ?? null);
    for (const w of bauteil.wesen) this.fuegeWesenHinzu({ ...w, x: w.x + versatz.x, y: w.y + versatz.y, z: w.z + versatz.z });
  }

  kopie() {
    const k = new Welt({ ...this.register });
    for (const [s, chunk] of this._chunks) {
      const c = new Map();
      for (const [i, e] of chunk) c.set(i, { id: e.id, zustand: { ...e.zustand }, ...(e.inhalt ? { inhalt: kopieInhalt(e.inhalt) } : {}) });
      k._chunks.set(s, c);
    }
    for (const [nr, w] of this._wesen) k._wesen.set(nr, { ...w });
    k._naechsteNr = this._naechsteNr;
    return k;
  }
}

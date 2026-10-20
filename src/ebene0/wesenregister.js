// Ebene 0 – Wesenregister (Daten aus data/wesen.json)
// Je Wesen die Hitbox-Größe als Fakt. Kein Verhalten (das gehört in Ebene 1).

export const SPIELER = 'minecraft:player';
export const ITEM = 'minecraft:item';
export const DORFBEWOHNER = Object.freeze(['minecraft:villager_v2', 'minecraft:villager']);

export class Wesenregister {
  /** @param {object} daten Inhalt von data/wesen.json */
  constructor(daten) {
    if (!daten || typeof daten !== 'object' || !daten.wesen) throw new Error('Wesenregister: ungültige Daten');
    this.datenstand = daten.datenstand;
    this._wesen = daten.wesen;
    for (const pflicht of [SPIELER, ITEM, ...DORFBEWOHNER]) {
      if (!this._wesen[pflicht]) throw new Error(`Wesenregister: ${pflicht} fehlt`);
    }
  }

  hat(id) {
    return Object.hasOwn(this._wesen, id);
  }

  ids() {
    return Object.keys(this._wesen);
  }

  /** Alle Loren (Minecarts) laut Register. */
  lore() {
    return this.ids().filter((id) => id.endsWith('minecart'));
  }

  dorfbewohner() {
    return [...DORFBEWOHNER];
  }

  wesen(id) {
    if (!this.hat(id)) throw new Error(`Unbekanntes Wesen: ${String(id)}`);
    return this._wesen[id];
  }

  kannBaby(id) {
    return this.wesen(id).baby !== null;
  }

  /**
   * Hitbox (Breite × Höhe in Blöcken). Für Babys gilt: Box × Skalierung (laut Mojang-Definition, ungeprüft).
   * @returns {{breite:number, hoehe:number}|null} null, wenn die Mojang-Daten keine Hitbox enthalten.
   */
  hitbox(id, { baby = false } = {}) {
    const w = this.wesen(id);
    if (!baby) return w.hitbox ? { ...w.hitbox } : null;
    if (!w.baby) throw new Error(`${id} hat keine Babyform im Register`);
    const s = w.baby.skalierung ?? 1;
    const runde = (v) => Math.round(v * s * 1e6) / 1e6;
    return { breite: runde(w.baby.breite), hoehe: runde(w.baby.hoehe) };
  }
}

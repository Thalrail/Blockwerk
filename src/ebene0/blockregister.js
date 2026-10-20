// Ebene 0 – Blockregister (Bedrock, Daten aus data/bloecke.json)
// Reine Fakten: ID, erlaubte Zustände, Eigenschaften. Kennt kein Verhalten und keine Bauwerke.

export const LUFT = 'minecraft:air';

export class Blockregister {
  /** @param {object} daten Inhalt von data/bloecke.json */
  constructor(daten) {
    if (!daten || typeof daten !== 'object' || !daten.bloecke || !daten.zustandsarten) {
      throw new Error('Blockregister: ungültige Daten');
    }
    this.datenstand = daten.datenstand;
    this.eigenschaftenStatus = daten.eigenschaftenStatus;
    this._arten = daten.zustandsarten;
    this._bloecke = daten.bloecke;
    for (const [id, b] of Object.entries(this._bloecke)) {
      for (const z of b.zustaende) {
        if (!this._arten[z]) throw new Error(`Blockregister: ${id} nutzt unbekannten Zustand ${z}`);
      }
    }
    if (!this._bloecke[LUFT]) throw new Error('Blockregister: Luft fehlt');
  }

  hat(id) {
    return Object.hasOwn(this._bloecke, id);
  }

  ids() {
    return Object.keys(this._bloecke);
  }

  /** @returns {{id:string, zustaende:Object<string,{typ:string,werte:any[]}>, eigenschaften:object, behaelter?:number}} */
  block(id) {
    const b = this._bloecke[id];
    if (!b || !Object.hasOwn(this._bloecke, id)) throw new Error(`Unbekannter Block: ${String(id)}`);
    const zustaende = {};
    for (const z of b.zustaende) zustaende[z] = this._arten[z];
    return { id, zustaende, eigenschaften: b.eigenschaften, ...(b.behaelter ? { behaelter: b.behaelter } : {}) };
  }

  /** Erlaubte Werte einer Zustandsart (unabhängig vom Block). */
  zustandsart(name) {
    if (!Object.hasOwn(this._arten, name)) throw new Error(`Unbekannter Zustand: ${name}`);
    return this._arten[name];
  }

  /** Wirft einen Fehler, wenn `zustand` für den Block nicht erlaubt ist. Teilzustände sind erlaubt. */
  pruefeZustand(id, zustand = {}) {
    const b = this.block(id);
    if (zustand === null || typeof zustand !== 'object' || Array.isArray(zustand)) {
      throw new Error(`Zustand von ${id} muss ein Objekt sein`);
    }
    for (const [name, wert] of Object.entries(zustand)) {
      const art = b.zustaende[name];
      if (!art) throw new Error(`${id} hat keinen Zustand "${name}"`);
      if (!art.werte.includes(wert)) {
        throw new Error(`${id}: Wert ${JSON.stringify(wert)} ist für "${name}" nicht erlaubt (erlaubt: ${art.werte.join(', ')})`);
      }
    }
  }

  zustandGueltig(id, zustand = {}) {
    try {
      this.pruefeZustand(id, zustand);
      return true;
    } catch {
      return false;
    }
  }

  /** Anzahl Inhaltsplätze (Slots), 0 wenn der Block kein Behälter ist. */
  slots(id) {
    return this.block(id).behaelter ?? 0;
  }
}

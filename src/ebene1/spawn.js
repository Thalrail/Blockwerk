// Ebene 1 – Mechanik „Spawnstellen“: Wo können Monster natürlich spawnen?
// Regeln: data/regeln/spawn.json (Quelle: minecraft.wiki „Mob spawning“, Bedrock-Abschnitt).
//   - Blocklicht am Standort = 0 (die meisten Monster, Bedrock ab 1.17.30) und inneres Himmelslicht < 7.
//   - Der Block unter den Füßen braucht eine volle feste Oberseite (Ebene-0-Eigenschaft `spawnBoden`).
//   - Die Hitbox des Monsters (Wesenregister aus Ebene 0) darf keinen festen Block überlappen; Füße und Körper stehen in Luft.
// Jede Bedingung hat drei Ausgänge: ja / nein / unklar. „Unklar“ entsteht nur durch Unbekanntes (Lichtfilter, Boden, Blöcke im Platzbedarf);
// geraten wird nicht. Das Urteil ist „unmöglich“, sobald EINE Bedingung sicher nicht erfüllt ist, „möglich“, wenn ALLE sicher erfüllt sind.
// Die Welt wird nur über Ebene 0 gelesen.
import { LUFT } from '../ebene0/blockregister.js';

const EPS = 1e-9;

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, register: {bloecke: import('../ebene0/blockregister.js').Blockregister, wesen: import('../ebene0/wesenregister.js').Wesenregister}, licht: ReturnType<typeof import('./licht.js').erzeugeLicht>}} quellen
 */
export function erzeugeSpawn({ regelwerk, register, licht }) {
  const maxHimmel = regelwerk.parameter('spawn.himmelslicht', 'hoechstensInnen');
  const maxBlock = regelwerk.parameter('spawn.blocklicht', 'hoechstens');
  const standardMonster = regelwerk.parameter('spawn.platz', 'standardMonster');
  const eigenschaften = (id) => register.bloecke.block(id).eigenschaften;

  /** Klasse einer Zelle für den Platzbedarf: 'frei' (Luft), 'fest' (undurchsichtiger Vollblock oder Flüssigkeit), sonst 'unklar'. */
  function zelle(welt, x, y, z) {
    const b = welt.leseBlock(x, y, z);
    if (b.id === LUFT) return 'frei';
    const e = eigenschaften(b.id);
    if (/^minecraft:(flowing_)?(water|lava)$/.test(b.id)) return 'fest';
    if (e.vollblock === true && e.durchsichtig === false) return 'fest';
    return 'unklar';
  }

  /** Urteil über den Boden unter den Füßen: 'ja' | 'nein' | 'unklar'. */
  function boden(welt, x, y, z) {
    const b = welt.leseBlock(x, y - 1, z);
    if (b.id === LUFT) return 'nein';
    const s = eigenschaften(b.id).spawnBoden;
    if (s === true) return 'ja';
    if (s === false) return 'nein';
    if (s === 'halbstufe') return b.zustand['minecraft:vertical_half'] === 'bottom' ? 'nein' : 'unklar';
    return 'unklar';
  }

  /** Platz für die Hitbox ab den Füßen (x, y, z): 'ja' | 'nein' | 'unklar'. */
  function platz(welt, hitbox, x, y, z) {
    const cx = x + 0.5, cz = z + 0.5;
    const x0 = Math.floor(cx - hitbox.breite / 2 + EPS), x1 = Math.floor(cx + hitbox.breite / 2 - EPS);
    const z0 = Math.floor(cz - hitbox.breite / 2 + EPS), z1 = Math.floor(cz + hitbox.breite / 2 - EPS);
    const hoch = Math.ceil(hitbox.hoehe - EPS);
    let unklar = false;
    for (let yy = y; yy < y + hoch; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        for (let zz = z0; zz <= z1; zz++) {
          const k = zelle(welt, xx, yy, zz);
          if (k === 'fest') return 'nein';
          if (k === 'unklar') unklar = true;
        }
      }
    }
    return unklar ? 'unklar' : 'ja';
  }

  /**
   * Untersucht alle Fuß-Zellen im Bereich.
   * @param {{von:{x:number,y:number,z:number}, bis:{x:number,y:number,z:number}}} bereich
   * @param {{himmel?: 'tag'|'regen'|'gewitter'|'nacht', monster?: string}} [optionen]
   * @returns {{x:number,y:number,z:number,urteil:'moeglich'|'unklar',gruende:string[]}[]} nur Stellen, die nicht sicher unmöglich sind; sortiert nach y, z, x
   */
  function spawnstellen(welt, bereich, { himmel = 'nacht', monster = standardMonster } = {}) {
    const hitbox = register.wesen.hitbox(monster);
    if (!hitbox) throw new Error(`${monster} hat keine bekannte Hitbox`);
    const karte = licht.lichtkarte(welt, bereich, { himmel });
    const { von, bis } = karte.bereich;
    const ergebnis = [];
    for (let y = von.y; y <= bis.y; y++) {
      for (let z = von.z; z <= bis.z; z++) {
        for (let x = von.x; x <= bis.x; x++) {
          if (welt.leseBlock(x, y, z).id !== LUFT) continue;
          const urteile = {};
          urteile.boden = boden(welt, x, y, z);
          if (urteile.boden === 'nein') continue;
          urteile.platz = platz(welt, hitbox, x, y, z);
          if (urteile.platz === 'nein') continue;
          const bl = karte.block(x, y, z);
          urteile.blocklicht = bl.max <= maxBlock ? 'ja' : bl.min > maxBlock ? 'nein' : 'unklar';
          if (urteile.blocklicht === 'nein') continue;
          const hi = karte.himmelInnen(x, y, z);
          urteile.himmel = hi.max <= maxHimmel ? 'ja' : hi.min > maxHimmel ? 'nein' : 'unklar';
          if (urteile.himmel === 'nein') continue;
          const gruende = Object.entries(urteile).filter(([, u]) => u === 'unklar').map(([name]) => name);
          ergebnis.push({ x, y, z, urteil: gruende.length ? 'unklar' : 'moeglich', gruende });
        }
      }
    }
    return ergebnis;
  }

  return { spawnstellen, boden, platz, zelle };
}

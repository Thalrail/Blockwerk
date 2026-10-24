// Ebene 1 – Mechanik „Schienen-Antrieb“ (Antriebsschienen, golden_rail)
// Regeln: data/regeln/antrieb.json (Quelle und Status je Regel).
//   - Bedrock: Antriebsschienen schalten nur im C-Tick (dokumentiert). Darum ist `mechanik()` eine Mechanik der Tickart
//     'mechanismus': der Taktgeber ruft sie nur in C-Ticks auf.
//   - Eine versorgte Antriebsschiene aktiviert verbundene Antriebsschienen bis zu `reichweite` Schienen weit
//     (Wiki, Edition nicht gekennzeichnet → ungeprüft). Strom geben nur verbundene Antriebsschienen weiter (Annahme).
//   - Direkte Versorgung (Spieltests Jonah, 24.10.2026): Redstone-Block auf einem der 6 Nachbarfelder, leuchtende Redstonefackel seitlich,
//     eingeschalteter Hebel an den von Jonah genannten Blöcken (antrieb.hebel), oder eine von außen übergebene Stromquelle.
// Die Welt wird nur über Ebene 0 gelesen und geschrieben.
import { RICHTUNGEN, VEKTOR } from '../ebene0/richtungen.js';

const key = (p) => `${p.x},${p.y},${p.z}`;

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, schienen: ReturnType<typeof import('./schienen.js').erzeugeSchienen>}} quellen
 */
export function erzeugeAntrieb({ regelwerk, schienen }) {
  const reichweite = regelwerk.parameter('antrieb.reichweite', 'reichweite');
  const stromBloecke = new Set(regelwerk.parameter('antrieb.stromblock', 'quellenBloecke'));
  const stromHorizontal = new Set(regelwerk.parameter('antrieb.redstonefackel', 'quellenHorizontal'));
  const hebel = {
    block: regelwerk.parameter('antrieb.hebel', 'block'),
    zustand: regelwerk.parameter('antrieb.hebel', 'zustand'),
    oberseiteVon: regelwerk.parameter('antrieb.hebel', 'oberseiteVon'),
    ueberallAn: regelwerk.parameter('antrieb.hebel', 'ueberallAn'),
    befestigtAn: regelwerk.parameter('antrieb.hebel', 'befestigtAn'),
  };
  const antriebsIds = schienen.belegtGerade; // golden_rail (Antriebsschiene)

  const istAntriebsschiene = (id) => antriebsIds.has(id);

  /** Hat die Schiene an `pos` direkt Strom? (Stromblock oder externe Quelle auf einem der 6 Nachbarfelder) */
  function direktVersorgt(welt, pos, strom) {
    for (const r of RICHTUNGEN) {
      const n = { x: pos.x + VEKTOR[r].x, y: pos.y + VEKTOR[r].y, z: pos.z + VEKTOR[r].z };
      if (strom.has(key(n))) return true;
      const nb = welt.leseBlock(n.x, n.y, n.z);
      if (stromBloecke.has(nb.id)) return true;
      if (r !== 'up' && r !== 'down' && stromHorizontal.has(nb.id)) return true; // Fackel: seitlich (links/rechts getestet, vorn/hinten angenommen)
    }
    return hebelVersorgt(welt, pos);
  }

  /** Sitzt ein eingeschalteter Hebel so, wie Jonah es gemessen hat (antrieb.hebel)? */
  function hebelVersorgt(welt, pos) {
    const bei = (b, d) => ({ x: b.x + d[0], y: b.y + d[1], z: b.z + d[2] });
    const sitztAn = (stelle, block) => {
      const h = welt.leseBlock(stelle.x, stelle.y, stelle.z);
      if (h.id !== hebel.block || !Object.entries(hebel.zustand).every(([k, v]) => h.zustand[k] === v)) return false;
      const r = hebel.befestigtAn[h.zustand.lever_direction];
      return r !== undefined && stelle.x + VEKTOR[r].x === block.x && stelle.y + VEKTOR[r].y === block.y && stelle.z + VEKTOR[r].z === block.z;
    };
    for (const d of hebel.oberseiteVon) {
      const block = bei(pos, d);
      if (sitztAn(bei(block, [0, 1, 0]), block)) return true;
    }
    for (const d of hebel.ueberallAn) {
      const block = bei(pos, d);
      for (const r of RICHTUNGEN) if (sitztAn({ x: block.x + VEKTOR[r].x, y: block.y + VEKTOR[r].y, z: block.z + VEKTOR[r].z }, block)) return true;
    }
    return false;
  }

  /** Alle Antriebsschienen der Welt, sortiert (y, z, x). */
  function alleAntriebsschienen(welt) {
    return welt.alleBloecke().filter((b) => istAntriebsschiene(b.id)).map((b) => ({ pos: { x: b.x, y: b.y, z: b.z }, id: b.id, zustand: b.zustand }));
  }

  /**
   * Welche Antriebsschienen sind aktiv? Breitensuche von den direkt versorgten Schienen entlang der Schienenverbindung,
   * höchstens `reichweite` Schritte weit, nur über Antriebsschienen.
   * @param {Iterable<{x:number,y:number,z:number}>} [stromQuellen] Positionen von außen gelieferter Stromquellen
   * @returns {Set<string>} Schlüssel "x,y,z" der aktiven Antriebsschienen
   */
  function aktive(welt, stromQuellen = []) {
    const strom = new Set([...stromQuellen].map(key));
    const abstand = new Map();
    let rand = [];
    for (const s of alleAntriebsschienen(welt)) {
      if (direktVersorgt(welt, s.pos, strom)) { abstand.set(key(s.pos), 0); rand.push(s); }
    }
    for (let schritt = 1; schritt <= reichweite && rand.length; schritt++) {
      const neu = [];
      for (const s of rand) {
        for (const ende of schienen.enden(s.zustand) ?? []) {
          const g = schienen.gegenstelle(welt, s.pos, ende);
          if (g.art !== 'verbunden' || !istAntriebsschiene(g.partner.id)) continue;
          const k = key(g.partner.pos);
          if (abstand.has(k)) continue;
          abstand.set(k, schritt);
          neu.push(g.partner);
        }
      }
      rand = neu;
    }
    return new Set(abstand.keys());
  }

  /**
   * Setzt rail_data_bit aller Antriebsschienen entsprechend der Versorgung.
   * Mit `tickbereich` bleiben Schienen in Chunks, die nicht ticken, unverändert (dort läuft im Spiel nichts).
   * @returns {{pos:{x:number,y:number,z:number}, aktiv:boolean}[]} nur die Schienen, die sich geändert haben
   */
  function aktiviere(welt, stromQuellen = [], tickbereich = null) {
    const aktiv = aktive(welt, stromQuellen);
    const aenderungen = [];
    for (const s of alleAntriebsschienen(welt)) {
      if (tickbereich && !tickbereich.ticktBlock(s.pos.x, s.pos.z)) continue;
      const soll = aktiv.has(key(s.pos));
      if ((s.zustand.rail_data_bit ?? false) === soll) continue;
      welt.setzeBlock(s.pos.x, s.pos.y, s.pos.z, s.id, { ...s.zustand, rail_data_bit: soll });
      aenderungen.push({ pos: s.pos, aktiv: soll });
    }
    return aenderungen;
  }

  /**
   * Mechanik für den Taktgeber. Tickart 'mechanismus': wird nur im C-Tick aufgerufen (Bedrock: Antriebsschienen schalten im C-Tick).
   * @param {{stromQuellen?: () => Iterable<{x:number,y:number,z:number}>}} [optionen] liefert in jedem C-Tick die aktuellen Stromquellen
   */
  function mechanik({ stromQuellen = () => [] } = {}) {
    return {
      id: 'antrieb',
      tickart: 'mechanismus',
      schritt: (ktx) => { aktiviere(ktx.welt, stromQuellen(), ktx.tickbereich ?? null); },
    };
  }

  return { aktive, aktiviere, mechanik, istAntriebsschiene, reichweite };
}

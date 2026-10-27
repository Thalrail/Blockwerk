// Ebene 1 – Strömung auf Wesen (Teil der Lorenbahn-Nische, 27.10.2026): fließendes Wasser trägt Wesen in Strömungsrichtung.
// Diskretes Modell ohne Physik: `richtung` bestimmt die Richtung in einer Wasserzelle, `treibe` folgt ihr Zelle für Zelle bis zum Ende und liefert Weg und Zeit.
// Bedrock (Wiki „Water“): Strömung schiebt mit rund 1,39 Blöcken je Sekunde; ein Quellblock schiebt in Bedrock NICHT (nur optisch); die Richtung ist die Summe der Zuflüsse der
// vier waagerechten Nachbarn. Für die Fälle, die das Wiki nicht nennt (Fall am Gefälle, Wesen in 1 Block hohen Kanälen), gelten Java-Platzhalter, `ungeprüft`.
// Die Welt wird nur über Ebene 0 gelesen. Regeln: data/regeln/passagiere.json (stroemung.*).
import { VEKTOR } from '../ebene0/richtungen.js';

const WAAGERECHT = ['north', 'east', 'south', 'west'];

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, fluessigkeit: {artVon: (id: string) => ('wasser'|'lava'|null)}}} quellen
 */
export function erzeugeStroemung({ regelwerk, fluessigkeit }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  const blockProSekunde = P('stroemung.wasser', 'blockProSekunde');
  const quelleSchiebt = P('stroemung.quelle', 'schiebt');
  const maxSchritte = P('stroemung.wasser', 'maxSchritte');
  const FALLEND = 8; // liquid_depth ab 8: fallendes Wasser

  const wasserBei = (welt, p) => {
    if (p.y < -64 || p.y > 319) return null;
    const b = welt.leseBlock(p.x, p.y, p.z);
    if (fluessigkeit.artVon(b.id) !== 'wasser') return null;
    const tiefe = b.zustand.liquid_depth ?? 0;
    return { tiefe, quelle: tiefe === 0 && b.id === 'minecraft:water', fallend: tiefe >= FALLEND, wirksam: tiefe >= FALLEND ? 0 : tiefe };
  };
  const nachbar = (p, r) => ({ x: p.x + VEKTOR[r].x, y: p.y, z: p.z + VEKTOR[r].z });

  /**
   * Strömung in einer Wasserzelle.
   * @returns {{art: 'keine'|'quelle'|'waagerecht'|'fall'|'kein-wasser', richtung?: string, vektor?: {x:number,z:number}}}
   *   `fall`: darunter ist ebenfalls Wasser und die Zelle fällt (Wasserfall) → das Wesen sinkt.
   */
  function richtung(welt, zelle) {
    const w = wasserBei(welt, zelle);
    if (!w) return { art: 'kein-wasser' };
    if (w.quelle && !quelleSchiebt) return { art: 'quelle' };
    // Fallendes Wasser (Wasserfall) darunter oder in der Zelle selbst mit Wasser darunter: das Wesen sinkt (Java-Platzhalter, `ungeprüft`)
    const unten = wasserBei(welt, { ...zelle, y: zelle.y - 1 });
    if (unten && (unten.fallend || w.fallend)) return { art: 'fall', richtung: 'down' };
    // Summe der Zuflüsse: zum Nachbarn mit tieferer Oberfläche (größere Stufe) hin, vom höheren weg; Nachbarn ohne Wasser zählen nicht
    let vx = 0, vz = 0;
    for (const r of WAAGERECHT) {
      const n = wasserBei(welt, nachbar(zelle, r));
      if (!n) continue;
      const diff = n.wirksam - w.wirksam;
      vx += VEKTOR[r].x * diff; vz += VEKTOR[r].z * diff;
    }
    if (vx === 0 && vz === 0) return { art: 'keine' };
    // Hauptachse; bei Gleichstand gilt Nord, Ost, Süd, West (feste Reihenfolge, deterministisch)
    const kandidaten = WAAGERECHT.map((r) => ({ r, wert: vx * VEKTOR[r].x + vz * VEKTOR[r].z })).filter((k) => k.wert > 0);
    const beste = kandidaten.reduce((a, b) => (b.wert > a.wert ? b : a), kandidaten[0]);
    return { art: 'waagerecht', richtung: beste.r, vektor: { x: vx, z: vz } };
  }

  /**
   * Ein Wesen treibt ab `start` (Wasserzelle) mit der Strömung, bis es nicht mehr weitergetragen wird.
   * Stoppgründe: 'quelle' (Quellblock oder stilles Wasser: keine Strömung), 'ende' (die nächste Zelle in Strömungsrichtung ist kein Wasser), 'kreis' (Zelle wiederholt sich),
   * 'kein-wasser' (Start nicht im Wasser), 'zu-lang' (mehr Schritte als erlaubt).
   * @returns {{weg: {x:number,y:number,z:number}[], ende: {x:number,y:number,z:number}, sekunden: number, grund: string}}
   */
  function treibe(welt, start) {
    const weg = [{ ...start }];
    const gesehen = new Set([`${start.x},${start.y},${start.z}`]);
    let z = { ...start };
    for (let i = 0; i < maxSchritte; i++) {
      const s = richtung(welt, z);
      if (s.art === 'kein-wasser') return fertig(weg, 'kein-wasser');
      if (s.art === 'quelle' || s.art === 'keine') return fertig(weg, s.art === 'quelle' ? 'quelle' : 'quelle');
      const naechste = s.art === 'fall' ? { x: z.x, y: z.y - 1, z: z.z } : nachbar(z, s.richtung);
      if (!wasserBei(welt, naechste)) return fertig(weg, 'ende');
      const k = `${naechste.x},${naechste.y},${naechste.z}`;
      if (gesehen.has(k)) return fertig(weg, 'kreis');
      gesehen.add(k);
      weg.push(naechste);
      z = naechste;
    }
    return fertig(weg, 'zu-lang');
  }
  const fertig = (weg, grund) => ({ weg, ende: weg[weg.length - 1], sekunden: Math.round(((weg.length - 1) / blockProSekunde) * 100) / 100, grund });

  return { richtung, treibe, blockProSekunde };
}

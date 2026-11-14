// Ebene 3 – Lagen der Kindbauteile (Paket P4 der Einbau-Architektur, docs/architektur-einbau.md 3.2 und 3.6).
// Ein Kind speichert nur seine Relativlage (`traeger`, `einbau`); die Weltlage `lage` ist abgeleitet. `loeseLagen` rechnet sie deterministisch aus
// (Träger vor Kindern) und liefert einen neuen Entwurf. Dreht oder verschiebt man den Träger, wandern die Kinder mit.
//
// Regel (3.6): Der Ankerpunkt `anker` der Einbauzone `zone` des Trägers (Ecke unten oder Mitte unten, Paketkoordinaten des Trägers) plus `versatz`
// ist die Stelle, an der die passende Ecke (bzw. Mitte) des gedrehten Kind-Quaders (Kasten um seine Blöcke) liegt. Die Drehung `einbau.drehung`
// gilt relativ zum Träger. Alles läuft über den Vermesser (Drehung 0–3, Verschiebung), es gibt keine zweite Rechenregel.
import { kopie } from './entwurf.js';
import { huelleVon } from '../ebene2/baustein.js';
import { zellenInWelt } from '../ebene2/zellen.js';

export class LagenFehler extends Error {
  constructor(nachricht) { super(nachricht); this.name = 'LagenFehler'; }
}

/** @param {{ebene0: object, ebene2: object}} quellen */
export function erzeugeLagen({ ebene0, ebene2 }) {
  const drehe = (zelle, viertel) => zellenInWelt(ebene0, [zelle], { x: 0, y: 0, z: 0, drehung: viertel })[0];

  /** Punkt des Kasten `h` (von/bis) für einen Anker: Ecke unten oder Mitte unten (bei gerader Breite der kleinere Mittelblock). */
  function punkt(h, anker) {
    const mitteX = h.von.x + Math.floor((h.bis.x - h.von.x) / 2), mitteZ = h.von.z + Math.floor((h.bis.z - h.von.z) / 2);
    switch (anker) {
      case 'nw': return { x: h.von.x, y: h.von.y, z: h.von.z };
      case 'ne': return { x: h.bis.x, y: h.von.y, z: h.von.z };
      case 'sw': return { x: h.von.x, y: h.von.y, z: h.bis.z };
      case 'se': return { x: h.bis.x, y: h.von.y, z: h.bis.z };
      case 'mitte': return { x: mitteX, y: h.von.y, z: mitteZ };
      default: throw new LagenFehler(`Anker "${String(anker)}" unbekannt`);
    }
  }

  /** Lage des Kinds in Paketkoordinaten des Trägers: { x, y, z, drehung }. */
  function relativeLage(traegerPaket, kindPaket, einbau, wer) {
    const zone = (traegerPaket.einbauzonen ?? []).find((z) => z.id === einbau.zone);
    if (!zone) throw new LagenFehler(`${wer}: der Träger kennt keine Einbauzone "${einbau.zone}" (vorhanden: ${(traegerPaket.einbauzonen ?? []).map((z) => z.id).join(', ') || 'keine'})`);
    if (!kindPaket.bloecke.length) throw new LagenFehler(`${wer}: ein Kind ohne Blöcke lässt sich nicht einbauen`);
    const gedreht = huelleVon(zellenInWelt(ebene0, kindPaket.bloecke, { x: 0, y: 0, z: 0, drehung: einbau.drehung }));
    const ziel = punkt(zone, einbau.anker), ecke = punkt(gedreht, einbau.anker);
    const nf = (n) => 0 - (0 - n);
    return {
      x: nf(ziel.x + einbau.versatz.x - ecke.x), y: nf(ziel.y + einbau.versatz.y - ecke.y), z: nf(ziel.z + einbau.versatz.z - ecke.z),
      drehung: einbau.drehung,
    };
  }

  /**
   * Setzt die Weltlage aller Kinder. Wurzelteile behalten ihre Lage. Wirft `LagenFehler` bei unbekannter Zone oder Anker; Zyklen, fehlende Träger und
   * Abschnittsfehler fängt schon `pruefeForm` ab (hier zusätzlich geprüft, damit die Funktion nie endlos läuft).
   */
  function loeseLagen(entwurf) {
    const e = kopie(entwurf);
    const nachRef = new Map(e.teile.filter((t) => t.ref !== undefined).map((t) => [t.ref, t]));
    const fertig = new Set();
    const paket = new Map();
    const baue = (t) => { if (!paket.has(t.id)) paket.set(t.id, ebene2.baue(t.baustein, t.parameter ?? {})); return paket.get(t.id); };
    const loese = (t, kette) => {
      if (t.traeger === undefined || fertig.has(t.id)) return;
      if (kette.has(t.id)) throw new LagenFehler(`Zyklus im Trägerwald bei Teil ${t.id}`);
      const tr = nachRef.get(t.traeger);
      if (!tr) throw new LagenFehler(`Teil ${t.id}: Träger ${t.traeger} existiert nicht`);
      loese(tr, new Set([...kette, t.id]));
      const rel = relativeLage(baue(tr), baue(t), t.einbau, `Teil ${t.id}`);
      // Welt = Träger-Lage ∘ relative Lage: Drehung addiert sich, die Verschiebung wird um die Träger-Drehung gedreht
      const v = drehe({ x: rel.x, y: rel.y, z: rel.z }, tr.lage.drehung);
      t.lage = { x: v.x + tr.lage.x, y: v.y + tr.lage.y, z: v.z + tr.lage.z, drehung: (tr.lage.drehung + rel.drehung) % 4 };
      fertig.add(t.id);
    };
    for (const t of [...e.teile].sort((a, b) => (a.ref ?? a.id) < (b.ref ?? b.id) ? -1 : 1)) loese(t, new Set());
    return e;
  }

  return { loeseLagen, relativeLage };
}

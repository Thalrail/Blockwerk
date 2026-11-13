// Ebene 2 – Zellenoperationen (Paket P1 der Einbau-Architektur, docs/architektur-einbau.md, Abschnitt 3.3 und 3.6).
// Reine Hilfsfunktionen, keine neue Weltregel: Zellenmengen (Aussparungen, später Benutzeränderungen) laufen durch dieselbe Kette
// wie die Blöcke eines Pakets (Drehung 0–3, dann Verschiebung, beides über den Vermesser von Ebene 0). Es gibt keine zweite Rechenregel.
// Entfernen geschieht nur über Ebene 0 (`welt.loescheBlock`).
//
// Koordinatensysteme (docs/architektur-einbau.md 3.6):
//  - Paketkoordinaten: das System der Blöcke eines Pakets (Nullpunkt je Baustein; bei `bau.raum` in der Mitte der Grundfläche).
//  - Referenzrahmen: Ursprung an der Ecke Nordwest unten der Paketbegrenzung (kleinster Quader um die Blöcke). Alle Zellen im Rahmen sind ≥ 0.
//    Aussparungen dürfen außerhalb der Paketbegrenzung liegen (negative Rahmenkoordinaten), verschieben den Rahmen aber nicht.
import { huelleVon, pruefeQuader } from './baustein.js';

const PLATZHALTER = 'minecraft:stone'; // ohne Richtungszustand: dreht und verschiebt sich rein geometrisch

const nf = (n) => 0 - (0 - n); // -0 → 0 (Pakete liefern teils -0)
const istGanz = (z) => z !== null && typeof z === 'object' && [z.x, z.y, z.z].every(Number.isSafeInteger);

/** Ursprung des Referenzrahmens eines Pakets (Ecke Nordwest unten der Blöcke, in Paketkoordinaten); Paket ohne Blöcke → Fehler. */
export function rahmenUrsprung(paket) {
  const h = huelleVon(paket.bloecke);
  if (!h) throw new Error(`Paket ${String(paket?.id)}: ohne Blöcke gibt es keinen Referenzrahmen`);
  return { x: nf(h.von.x), y: nf(h.von.y), z: nf(h.von.z) };
}

/** Zelle aus Paketkoordinaten in den Referenzrahmen des Pakets. */
export function paketZuRahmen(paket, zelle) {
  if (!istGanz(zelle)) throw new Error('Zelle braucht ganze Zahlen x, y, z');
  const u = rahmenUrsprung(paket);
  return { x: nf(zelle.x - u.x), y: nf(zelle.y - u.y), z: nf(zelle.z - u.z) };
}

/** Zelle aus dem Referenzrahmen zurück in Paketkoordinaten. */
export function rahmenZuPaket(paket, zelle) {
  if (!istGanz(zelle)) throw new Error('Zelle braucht ganze Zahlen x, y, z');
  const u = rahmenUrsprung(paket);
  return { x: nf(zelle.x + u.x), y: nf(zelle.y + u.y), z: nf(zelle.z + u.z) };
}

const schluessel = (z) => `${z.x},${z.y},${z.z}`;

/** Alle Zellen eines Quaders (Ecken inklusive, von ≤ bis je Achse), sortiert nach y, z, x. */
export function quaderZellen(von, bis) {
  pruefeQuader({ von, bis }, 'Quader', (m) => { throw new Error(m); }); // gleiche Prüfung wie bei Aussparungen: ganze Zahlen, von ≤ bis, höchstens MAX_ZELLEN
  const aus = [];
  for (let y = von.y; y <= bis.y; y++) for (let z = von.z; z <= bis.z; z++) for (let x = von.x; x <= bis.x; x++) aus.push({ x, y, z });
  return aus;
}

/**
 * Zellen (Paketkoordinaten) mit Lage `{x, y, z, drehung}` in die Welt (drehung: beliebige ganze Zahl, der Vermesser rechnet modulo 4): erst drehen (um den Paket-Nullpunkt), dann verschieben. Genau die Kette von
 * `materialisiere` für die Blöcke (Drehung 0–3 und Verschiebung über den Vermesser); die Zellen laufen als Platzhalterblöcke ohne Zustand hindurch.
 * Ergebnis: sortiert nach y, z, x, ohne Doppelte.
 */
export function zellenInWelt(ebene0, zellen, lage) {
  if (!Number.isInteger(lage?.drehung) || ![lage.x, lage.y, lage.z].every(Number.isSafeInteger)) throw new Error('Lage braucht ganze Zahlen x, y, z und drehung');
  const teil = { bloecke: zellen.map((z) => { if (!istGanz(z)) throw new Error('Zelle braucht ganze Zahlen x, y, z'); return { id: PLATZHALTER, x: z.x, y: z.y, z: z.z, zustand: {} }; }), wesen: [] };
  const gedreht = ebene0.vermesser.drehe(teil, lage.drehung);
  const verschoben = ebene0.vermesser.verschiebe(gedreht, { x: lage.x, y: lage.y, z: lage.z });
  const eindeutig = new Map(verschoben.bloecke.map((b) => [schluessel(b), { x: b.x, y: b.y, z: b.z }]));
  return [...eindeutig.values()].sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
}

/**
 * Entfernt Zellen (Weltkoordinaten) aus der Welt, nur über Ebene 0 (`loescheBlock`). Liefert die tatsächlich entfernten Blöcke
 * (Position, ID, Zustand; sortiert wie die Zellen) für die spätere Besitzkarte und die Umbauhinweise. Leere Zellen bleiben unberührt.
 */
export function leereZellen(welt, zellen) {
  const entfernt = [];
  for (const z of zellen) {
    if (!istGanz(z)) throw new Error('Zelle braucht ganze Zahlen x, y, z');
    if (welt.istLuft(z.x, z.y, z.z)) continue;
    const b = welt.leseBlock(z.x, z.y, z.z);
    entfernt.push({ x: z.x, y: z.y, z: z.z, id: b.id, zustand: b.zustand });
    welt.loescheBlock(z.x, z.y, z.z);
  }
  return entfernt;
}

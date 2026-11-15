// Aufbau (Paket 1a): reine Messgröße für fertige Blockdaten, baupraktische Probleme beim Bauen von Hand (Schicht für Schicht, von unten nach oben).
// Rein, deterministisch, ändert die Eingabe nie; misst nur und bewertet nicht (keine Schwellen).
//
// Eingabe: Liste {x,y,z,id}, Luft weggelassen (wie bei messeGestaltung; gleiche Prüfung und Grenzen, kontrollierter Fehler). Die unterste Schicht y0 steht auf dem Boden (gilt als angelegt).
//
// Bedrock-Annahmen (Status `ungeprüft`, Testanleitung: docs/spieltests.md „Aufbau“):
//  - Belegt: Ein Block muss an einen schon gesetzten Block angrenzen; seitliches Setzen an einen Nachbarn derselben Schicht geht auch ohne Block darunter (Brücke/Überhang).
//    Quellen: https://minecraft.wiki/w/Tutorial:Bridging und https://minecraft.wiki/w/Sneaking (Bedrock).
//  - NICHT belegt: ob nur diagonale Berührung (Kante/Ecke) zum Setzen genügt. Konservativ zählt nur Flächenkontakt (6er-Nachbarschaft) als Anlage; diagonal braucht einen Hilfsblock.
//  - Planken, Stein, Glas fallen nicht: keine Schwerkraft.
//
// Ausgabe (feste Schlüssel):
//  unverbunden: Zusammenhangskomponenten der ganzen Menge in der 26er-Nachbarschaft. Hauptteil = Komponente mit den meisten Blöcken in y0 (Gleichstand: die größte, dann die mit der kleinsten (y,z,x)-Zelle);
//    alle anderen sind unverbunden: { teile, bloecke, gruppen: [{ bloecke, von }] } (höchstens 8, nach (y,z,x) von sortiert).
//  Bauabfolge je Schicht y aufsteigend. „Setzbar“: Blöcke mit Block darunter (oder y == y0) und alles, was über Seitenflächen (4er in der Schicht) von setzbaren Blöcken erreichbar ist.
//    ueberhang.bloecke = erreichbare Blöcke ohne Block darunter (zulässig). Alle übrigen Blöcke der Schicht bilden (4er in der Schicht) Gruppen; jede Gruppe braucht genau EINE Hilfsmaßnahme.
//    Gruppenart: `diagonal`, wenn ein Block der Gruppe in der 26er-Nachbarschaft einen schon gesetzten Block hat (untere Schichten oder setzbarer Block dieser Schicht), sonst `frei` (gar kein Kontakt).
//  hilfsmassnahmen: { punkte (= Zahl der Gruppen), bloecke, diagonal, frei, schichten: [{ y, gruppen, bloecke }] } (nur Schichten mit Gruppen, höchstens 64, danach nur Summen).
//  schichten (oben): Zahl der belegten Schichten.
import { MAX_AUSDEHNUNG, MAX_ZELLEN } from './gestaltung.js';

const LUFT = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air']);
const MAX_GRUPPEN = 8;
const MAX_SCHICHTEN = 64;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const cmp = (a, b) => a.y - b.y || a.z - b.z || a.x - b.x;

/** Prüft die Blockliste (wie messeGestaltung) und liefert die Blöcke ohne Luft, nach (y,z,x) sortiert, samt Schlüsselfunktion. */
function pruefe(bloecke) {
  if (!Array.isArray(bloecke)) throw new Error('Aufbauprüfer: Blockliste muss ein Array sein');
  const echte = [];
  for (const b of bloecke) {
    if (!b || ![b.x, b.y, b.z].every(Number.isSafeInteger) || typeof b.id !== 'string' || b.id === '') throw new Error(`Aufbauprüfer: ungültiger Block ${JSON.stringify(b)}`);
    if (!LUFT.has(b.id)) echte.push({ x: b.x, y: b.y, z: b.z });
  }
  if (!echte.length) return { echte };
  const v = { x: Infinity, y: Infinity, z: Infinity }, w = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const b of echte) for (const k of ['x', 'y', 'z']) { v[k] = Math.min(v[k], b[k]); w[k] = Math.max(w[k], b[k]); }
  const B = w.x - v.x + 1, H = w.y - v.y + 1, T = w.z - v.z + 1;
  for (const a of [B, H, T]) if (a > MAX_AUSDEHNUNG) throw new Error(`Aufbauprüfer: Bauwerk zu groß (Ausdehnung ${a} > ${MAX_AUSDEHNUNG} Zellen)`);
  if ((B + 2) * (H + 2) * (T + 2) > MAX_ZELLEN) throw new Error(`Aufbauprüfer: Bauwerk zu groß (Raster mit ${(B + 2) * (H + 2) * (T + 2)} Zellen > ${MAX_ZELLEN})`);
  // Schlüssel mit Rand 1, damit Nachbarn außerhalb nicht mit echten Zellen kollidieren.
  const key = (x, y, z) => ((x - v.x + 1) * (H + 2) + (y - v.y + 1)) * (T + 2) + (z - v.z + 1);
  const menge = new Set();
  for (const b of echte) {
    const k = key(b.x, b.y, b.z);
    if (menge.has(k)) throw new Error(`Aufbauprüfer: Zelle ${b.x},${b.y},${b.z} doppelt belegt`);
    menge.add(k);
  }
  echte.sort(cmp);
  return { echte, menge, key, y0: v.y };
}

/** Misst den Aufbau (siehe Kopfkommentar). */
export function messeAufbau(bloecke) {
  const { echte, menge, key, y0 } = pruefe(bloecke);
  if (!echte.length) {
    return { schichten: 0, bloecke: 0, unverbunden: { teile: 0, bloecke: 0, gruppen: [] }, ueberhang: { bloecke: 0 }, hilfsmassnahmen: { punkte: 0, bloecke: 0, diagonal: 0, frei: 0, schichten: [] } };
  }
  const hat = (x, y, z) => menge.has(key(x, y, z));

  // Teil 1: Zusammenhang in der 26er-Nachbarschaft. Die Reihenfolge der sortierten Liste macht die erste Zelle jeder Komponente zur kleinsten.
  const gesehen = new Set();
  const komponenten = [];
  for (const s of echte) {
    if (gesehen.has(key(s.x, s.y, s.z))) continue;
    const komp = { von: s, n: 0, unten: 0 };
    const stapel = [s];
    gesehen.add(key(s.x, s.y, s.z));
    while (stapel.length) {
      const b = stapel.pop();
      komp.n++;
      if (b.y === y0) komp.unten++;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dy && !dz) continue;
        const k = key(b.x + dx, b.y + dy, b.z + dz);
        if (!menge.has(k) || gesehen.has(k)) continue;
        gesehen.add(k);
        stapel.push({ x: b.x + dx, y: b.y + dy, z: b.z + dz });
      }
    }
    komponenten.push(komp);
  }
  // Komponenten stehen schon nach kleinster Zelle sortiert; das stabile Sortieren behält das bei Gleichstand.
  const haupt = [...komponenten].sort((a, b) => b.unten - a.unten || b.n - a.n)[0];
  const lose = komponenten.filter((k) => k !== haupt);
  const unverbunden = {
    teile: lose.length,
    bloecke: lose.reduce((s, k) => s + k.n, 0),
    gruppen: lose.slice(0, MAX_GRUPPEN).map((k) => ({ bloecke: k.n, von: { x: k.von.x, y: k.von.y, z: k.von.z } })),
  };

  // Teil 2: Bauabfolge je Schicht.
  const schichtMap = new Map();
  for (const b of echte) { if (!schichtMap.has(b.y)) schichtMap.set(b.y, []); schichtMap.get(b.y).push(b); }
  const hilfe = { punkte: 0, bloecke: 0, diagonal: 0, frei: 0, schichten: [] };
  let ueberhang = 0;
  for (const y of [...schichtMap.keys()].sort((a, b) => a - b)) {
    const reihe = schichtMap.get(y);
    const setzbar = new Set();
    const stapel = [];
    for (const b of reihe) {
      if (y === y0 || hat(b.x, y - 1, b.z)) { setzbar.add(key(b.x, y, b.z)); stapel.push(b); }
    }
    while (stapel.length) {
      const b = stapel.pop();
      for (const [dx, dz] of N4) {
        const k = key(b.x + dx, y, b.z + dz);
        if (!menge.has(k) || setzbar.has(k)) continue;
        setzbar.add(k);
        stapel.push({ x: b.x + dx, y, z: b.z + dz });
        if (!hat(b.x + dx, y - 1, b.z + dz)) ueberhang++;
      }
    }
    // Übrige Blöcke: Gruppen in der 4er-Nachbarschaft, je Gruppe eine Hilfsmaßnahme.
    const rest = reihe.filter((b) => !setzbar.has(key(b.x, y, b.z)));
    if (!rest.length) continue;
    const vergeben = new Set();
    let gruppen = 0;
    for (const s of rest) {
      if (vergeben.has(key(s.x, y, s.z))) continue;
      gruppen++;
      let kontakt = false;
      const st = [s];
      vergeben.add(key(s.x, y, s.z));
      while (st.length) {
        const b = st.pop();
        hilfe.bloecke++;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 0; dy++) for (let dz = -1; dz <= 1; dz++) {
          if (!dx && !dy && !dz) continue;
          const k = key(b.x + dx, y + dy, b.z + dz);
          if (dy < 0 ? menge.has(k) : setzbar.has(k)) kontakt = true;
        }
        for (const [dx, dz] of N4) {
          const k = key(b.x + dx, y, b.z + dz);
          if (!menge.has(k) || setzbar.has(k) || vergeben.has(k)) continue;
          vergeben.add(k);
          st.push({ x: b.x + dx, y, z: b.z + dz });
        }
      }
      if (kontakt) hilfe.diagonal++; else hilfe.frei++;
    }
    hilfe.punkte += gruppen;
    if (hilfe.schichten.length < MAX_SCHICHTEN) hilfe.schichten.push({ y, gruppen, bloecke: rest.length });
  }
  return { schichten: schichtMap.size, bloecke: echte.length, unverbunden, ueberhang: { bloecke: ueberhang }, hilfsmassnahmen: hilfe };
}

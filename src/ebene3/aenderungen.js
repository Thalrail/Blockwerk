// Ebene 3 – Manuelle Einzelblockänderungen (Paket P8 der Einbau-Architektur, docs/architektur-einbau.md 3.2/3.3 und Bearbeitungsmodell B).
// Eine Änderung hängt am Bauteil (stabile `ref`) und nennt eine Zelle im Referenzrahmen des Teils (Ecke Nordwest unten der Blöcke, siehe ebene2/zellen.js):
// Dreht oder verschiebt man das Teil, wandert die Änderung mit; ändert sich seine Größe, bleibt sie an derselben Stelle relativ zur Nordwest-Ecke.
//   { id: 'C<n>', teil: <ref>, zelle: {x,y,z}, op: 'setze' | 'leere', block?: {id, zustand?}, von: <Name>, quelle: 'benutzer' }
// Der Zusammenbau (`materialisiere`) wendet sie nach den Kindern des Teils an. Jede Änderung hat danach einen Status:
//   angewandt  – wirkt;  ueberholt – wirkt nicht, weil ein Kind die Zelle schon ausgespart hat;
//   verwaist   – die Zelle liegt nicht mehr im Teil (Teil kleiner geworden, Teil entfernt, kein Block mehr dort): NICHTS passiert automatisch, Jonah entscheidet
//                (verwerfen oder neu verankern);
//   konflikt   – setze auf einen fremden Block oder in eine Freihaltung; ungueltig – Block oder Zustand nicht möglich.
// Alles deterministisch; ohne Uhr und Zufall; nie stilles Überschreiben fremder Blöcke.
import { kopie, OPERATIONEN, pruefeAenderungForm } from './entwurf.js';
import { haengeAn } from './bericht.js';
import { huelleVon } from '../ebene2/baustein.js';
import { zellenInWelt, bloeckeInWelt } from '../ebene2/zellen.js';

export class AenderungsFehler extends Error {
  constructor(nachricht) { super(`Änderung: ${nachricht}`); this.name = 'AenderungsFehler'; }
}

export { OPERATIONEN, pruefeAenderungForm };
const ganz = (z) => z !== null && typeof z === 'object' && [z.x, z.y, z.z].every(Number.isSafeInteger);
const key = (x, y, z) => `${x},${y},${z}`;
const nummer = (id) => Number(String(id).replace(/\D/g, '')) || 0;

/** @param {{ebene0: object, ebene2: object}} quellen */
export function erzeugeAenderungen({ ebene0, ebene2 }) {
  /** Block und Zustand prüfen, ohne eine Welt zu verändern (Register und Zustandswerte von Ebene 0). */
  function pruefeBlock(block) {
    try { ebene0.neueWelt().setzeBlock(0, 0, 0, block.id, block.zustand ?? {}); } catch (f) { throw new AenderungsFehler(`${block.id}: ${f.message}`); }
  }

  /** Neue oder ersetzte Änderung (je Teil und Zelle gilt die jüngste). Liefert { entwurf, id }. */
  function setze(entwurf, a, von) {
    const e = kopie(entwurf);
    if (typeof a?.teil !== 'string' || !e.teile.some((t) => t.ref === a.teil)) throw new AenderungsFehler(`das Teil „${String(a?.teil)}“ gibt es nicht (ref)`);
    if (a.block?.zustand !== undefined && (a.block.zustand === null || typeof a.block.zustand !== 'object' || Array.isArray(a.block.zustand))) throw new AenderungsFehler('block.zustand muss ein Objekt sein');
    if (a.op === 'leere' && a.block !== undefined) throw new AenderungsFehler('leere hat keinen block');
    e.zaehler.aenderung ??= 1;
    const neu = { id: `C${e.zaehler.aenderung++}`, teil: a.teil, zelle: { x: a.zelle?.x, y: a.zelle?.y, z: a.zelle?.z }, op: a.op, ...(a.op === 'setze' ? { block: { id: a.block?.id, ...(a.block?.zustand ? { zustand: { ...a.block.zustand } } : {}) } } : {}), von, quelle: 'benutzer' };
    pruefeAenderungForm(neu, (m) => { throw new AenderungsFehler(m.replace(/^Änderung C\d+: /, '')); });
    if (neu.op === 'setze') pruefeBlock(neu.block);
    const gleich = (x) => x.teil === neu.teil && x.zelle.x === neu.zelle.x && x.zelle.y === neu.zelle.y && x.zelle.z === neu.zelle.z;
    e.aenderungen = [...e.aenderungen.filter((x) => !gleich(x)), neu];
    haengeAn(e, 'aenderung', { von: 'jonah', ziel: `Teil ${neu.teil}`, beschreibung: `${neu.op === 'setze' ? `${neu.block.id} gesetzt` : 'Block entfernt'} an Zelle (${neu.zelle.x}, ${neu.zelle.y}, ${neu.zelle.z}) im Rahmen des Teils (${neu.id}, von ${von})`, art: 'blockaenderung' });
    return { entwurf: e, id: neu.id };
  }

  /** Änderung verwerfen (ausdrückliche Entscheidung von Jonah). */
  function verwirf(entwurf, id, von) {
    const e = kopie(entwurf);
    const a = e.aenderungen.find((x) => x.id === id);
    if (!a) throw new AenderungsFehler(`${String(id)} gibt es nicht`);
    e.aenderungen = e.aenderungen.filter((x) => x.id !== id);
    haengeAn(e, 'aenderung', { von: 'jonah', ziel: `Teil ${a.teil}`, beschreibung: `Änderung ${id} (Zelle ${a.zelle.x}, ${a.zelle.y}, ${a.zelle.z}) verworfen auf Entscheidung von ${von ?? 'Jonah'}`, art: 'blockaenderung-verworfen' });
    return { entwurf: e };
  }

  /** Änderung an eine andere Zelle desselben oder eines anderen Teils hängen (ausdrückliche Entscheidung von Jonah). */
  function verankere(entwurf, id, { teil, zelle }, von) {
    const e = kopie(entwurf);
    const i = e.aenderungen.findIndex((x) => x.id === id);
    if (i < 0) throw new AenderungsFehler(`${String(id)} gibt es nicht`);
    const alt = e.aenderungen[i];
    const ziel = teil ?? alt.teil;
    if (!e.teile.some((t) => t.ref === ziel)) throw new AenderungsFehler(`das Teil „${String(ziel)}“ gibt es nicht (ref)`);
    if (!ganz(zelle)) throw new AenderungsFehler('die neue Zelle braucht ganze Zahlen x, y, z');
    const neu = { ...alt, teil: ziel, zelle: { x: zelle.x, y: zelle.y, z: zelle.z } };
    e.aenderungen = e.aenderungen.filter((x) => x.id !== id && !(x.teil === neu.teil && x.zelle.x === neu.zelle.x && x.zelle.y === neu.zelle.y && x.zelle.z === neu.zelle.z));
    e.aenderungen.push(neu);
    haengeAn(e, 'aenderung', { von: 'jonah', ziel: `Teil ${neu.teil}`, beschreibung: `Änderung ${id} neu verankert: von Teil ${alt.teil} Zelle (${alt.zelle.x}, ${alt.zelle.y}, ${alt.zelle.z}) nach Teil ${neu.teil} Zelle (${neu.zelle.x}, ${neu.zelle.y}, ${neu.zelle.z}) auf Entscheidung von ${von ?? 'Jonah'}`, art: 'blockaenderung-verankert' });
    return { entwurf: e };
  }

  /**
   * Wendet alle Änderungen auf die fertig zusammengebauten Teile an (nach den Aussparungen der Kinder).
   * @param {object} entwurf  Entwurf mit abgeleiteten Lagen
   * @param {object[]} reihe  Teile in Bau-Reihenfolge
   * @param {Map<string, object>} eintraege  Teil-ID → { bauteil, schluessel, arbeitsbloecke, … } (nach den Aussparungen; werden hier ersetzt, nie verändert)
   * @param {{freihaltung: Map}|null} einbau
   * @returns {{status: Map<string, object>}}  Änderungs-ID → { status, teil, ort, grund? }; `eintraege` enthält die geänderten Teile als Kopien
   */
  function wendeAn(entwurf, reihe, eintraege, einbau) {
    const status = new Map();
    const nachRef = new Map(reihe.filter((t) => t.ref !== undefined).map((t) => [t.ref, t]));
    const besitz = new Map(); // Zelle → alle Teile, die sie belegen (zwei Teile in einer Zelle sind schon ein Einwand der Planung, hier zählen beide)
    for (const t of reihe) for (const k of eintraege.get(t.id).schluessel) { if (!besitz.has(k)) besitz.set(k, new Set()); besitz.get(k).add(t.id); }
    const kopiert = new Set();
    const eigene = (t) => { // Kopie des Eintrags, bevor er verändert wird (gemerkte Teile bleiben unberührt)
      if (!kopiert.has(t.id)) {
        const x = eintraege.get(t.id);
        eintraege.set(t.id, { ...x, bauteil: { ...x.bauteil, bloecke: [...x.bauteil.bloecke] }, schluessel: new Set(x.schluessel), arbeitsbloecke: new Set(x.arbeitsbloecke) });
        kopiert.add(t.id);
      }
      return eintraege.get(t.id);
    };
    const paketVon = new Map();
    const paket = (t) => { if (!paketVon.has(t.id)) paketVon.set(t.id, ebene2.baue(t.baustein, t.parameter ?? {})); return paketVon.get(t.id); };
    for (const a of [...(entwurf.aenderungen ?? [])].sort((p, q) => nummer(p.id) - nummer(q.id))) {
      const t = nachRef.get(a.teil);
      if (!t) { status.set(a.id, { status: 'verwaist', grund: 'teil-fehlt', teil: a.teil, ort: null }); continue; }
      const p = paket(t), h = huelleVon(p.bloecke);
      if (!h) { status.set(a.id, { status: 'verwaist', grund: 'teil-leer', teil: t.id, ort: null }); continue; }
      const z = a.zelle, pz = { x: z.x + h.von.x, y: z.y + h.von.y, z: z.z + h.von.z };
      const welt = zellenInWelt(ebene0, [pz], t.lage)[0], k = key(welt.x, welt.y, welt.z), ort = { ...welt };
      const drin = z.x >= 0 && z.y >= 0 && z.z >= 0 && pz.x <= h.bis.x && pz.y <= h.bis.y && pz.z <= h.bis.z;
      if (!drin) { status.set(a.id, { status: 'verwaist', grund: 'ausserhalb', teil: t.id, ort }); continue; }
      if (a.op === 'leere') {
        if (!p.bloecke.some((b) => b.x === pz.x && b.y === pz.y && b.z === pz.z)) { status.set(a.id, { status: 'verwaist', grund: 'kein-block', teil: t.id, ort }); continue; }
        if (!eintraege.get(t.id).schluessel.has(k)) { status.set(a.id, { status: 'ueberholt', teil: t.id, ort }); continue; }
        const e = eigene(t);
        e.bauteil.bloecke = e.bauteil.bloecke.filter((b) => key(b.x, b.y, b.z) !== k);
        e.schluessel.delete(k); e.arbeitsbloecke.delete(k);
        besitz.get(k)?.delete(t.id);
        status.set(a.id, { status: 'angewandt', teil: t.id, ort });
        continue;
      }
      // setze: nur auf Zellen des Teils selbst oder freie Zellen, nie in eine Freihaltung
      const andere = [...(besitz.get(k) ?? [])].filter((x) => x !== t.id).sort();
      if (andere.length) { status.set(a.id, { status: 'konflikt', grund: 'fremder-block', mit: andere.join(', '), teil: t.id, ort }); continue; }
      const frei = einbau?.freihaltung.get(k);
      if (frei) { status.set(a.id, { status: 'konflikt', grund: 'freiraum', mit: [...frei].sort(), teil: t.id, ort }); continue; }
      let block;
      try { [block] = bloeckeInWelt(ebene0, [{ id: a.block.id, zustand: a.block.zustand ?? {}, x: pz.x, y: pz.y, z: pz.z }], t.lage); } catch (f) { status.set(a.id, { status: 'ungueltig', grund: f.message, teil: t.id, ort }); continue; }
      const e = eigene(t);
      e.bauteil.bloecke = e.bauteil.bloecke.filter((b) => key(b.x, b.y, b.z) !== k);
      e.bauteil.bloecke.push({ id: block.id, x: block.x, y: block.y, z: block.z, zustand: block.zustand });
      e.schluessel.add(k);
      const arbeits = (() => { try { return ebene0.register.bloecke.block(block.id).eigenschaften.arbeitsblock; } catch { return false; } })();
      if (arbeits) e.arbeitsbloecke.add(k); else e.arbeitsbloecke.delete(k);
      if (!besitz.has(k)) besitz.set(k, new Set());
      besitz.get(k).add(t.id);
      status.set(a.id, { status: 'angewandt', teil: t.id, ort });
    }
    return { status };
  }

  return { setze, verwirf, verankere, wendeAn };
}

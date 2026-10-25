// Ebene 5 – Bauplan: aus einem geplanten Entwurf (Ebene 3) die Schichtpläne zum Nachbauen von Hand.
// Abschnitte in der Bau-Reihenfolge des Konstrukteurs, je Abschnitt Schichten von unten nach oben (Raster x Ost, z Süd), mit Legende, Summen und Blickrichtung.
// Die Ebene rechnet nichts Neues aus, sie ordnet nur an, was Ebene 0–3 berechnet haben. Deterministisch; keine Uhr, kein Zufall.

export const RICHTUNGEN = [null, 'north', 'east', 'south', 'west', 'up', 'down'];
const SYMBOLE = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** FNV-1a (32 Bit) über einen Text. */
export function fnv(text, start = 0x811c9dc5) {
  let h = start;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}
const hex8 = (n) => n.toString(16).padStart(8, '0');

/**
 * @param {{ebene0: object, ebene3: object, darstellung: ReturnType<typeof import('./darstellung.js').erzeugeDarstellung>}} quellen
 */
export function erzeugeBauplan({ ebene0, ebene3, darstellung }) {
  const richtungVon = ebene0.vermesser.richtungVon;
  const luft = 'minecraft:air';

  /** Blickrichtung eines Blocks aus seinen Zuständen (Nummer in RICHTUNGEN, 0 = keine). */
  function richtungsNummer(id, zustand) {
    for (const [name, wert] of Object.entries(zustand ?? {})) {
      const r = richtungVon(name, wert, id);
      if (r) return Math.max(0, RICHTUNGEN.indexOf(r));
    }
    return 0;
  }

  /** @param {object} entwurf  geplanter Entwurf (Ebene 3) */
  function bauplan(entwurf) {
    const mat = ebene3.materialisiere(entwurf);
    const welt = mat.welt;
    const abschnitte = [...entwurf.abschnitte].sort((a, b) => a.reihenfolge - b.reihenfolge);
    const alleWesen = welt.wesen();
    const ergebnis = [];
    const gesamt = {};
    for (const a of abschnitte) {
      // Zellen aller Teile des Abschnitts (ohne Doppelte)
      const zellen = new Map();
      for (const t of entwurf.teile.filter((x) => x.abschnitt === a.id)) {
        for (const k of mat.teile.get(t.id).schluessel) {
          if (zellen.has(k)) continue;
          const [x, y, z] = k.split(',').map(Number);
          const b = welt.leseBlock(x, y, z);
          if (b.id === luft) continue;
          zellen.set(k, { x, y, z, id: b.id, zustand: b.zustand, inhalt: b.inhalt ?? null });
        }
      }
      // Legende: häufigste Blöcke zuerst, feste Symbole
      const zaehler = {};
      for (const c of zellen.values()) zaehler[c.id] = (zaehler[c.id] ?? 0) + 1;
      const ids = Object.keys(zaehler).sort((p, q) => zaehler[q] - zaehler[p] || (p < q ? -1 : 1));
      const legende = ids.map((id, i) => ({ symbol: SYMBOLE[i] ?? '?', ...darstellung.block(id), anzahl: zaehler[id] }));
      const index = new Map(ids.map((id, i) => [id, i]));
      // Schichten von unten nach oben
      const nachY = new Map();
      for (const c of zellen.values()) { if (!nachY.has(c.y)) nachY.set(c.y, []); nachY.get(c.y).push(c); }
      const schichten = [...nachY.keys()].sort((p, q) => p - q).map((y) => {
        const liste = nachY.get(y).sort((p, q) => p.z - q.z || p.x - q.x);
        const n = liste.length;
        const sx = new Int32Array(n), sz = new Int32Array(n), sb = new Uint16Array(n), sr = new Uint8Array(n);
        const summe = {};
        const inhalte = [];
        let h = fnv(`${a.id}|${y}`);
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        liste.forEach((c, i) => {
          sx[i] = c.x; sz[i] = c.z; sb[i] = index.get(c.id); sr[i] = richtungsNummer(c.id, c.zustand);
          summe[c.id] = (summe[c.id] ?? 0) + 1;
          if (c.x < x0) x0 = c.x; if (c.x > x1) x1 = c.x; if (c.z < z0) z0 = c.z; if (c.z > z1) z1 = c.z;
          h = fnv(`;${c.x},${c.z},${c.id},${sr[i]}`, h);
          if (c.inhalt?.length) {
            inhalte.push({ x: c.x, z: c.z, id: c.id, inhalt: c.inhalt.map((s) => ({ ...s })) });
            h = fnv(JSON.stringify(c.inhalt), h);
          }
        });
        for (const [id, m] of Object.entries(summe)) gesamt[id] = (gesamt[id] ?? 0) + m;
        return { y, n, x: sx, z: sz, b: sb, r: sr, bereich: { x0, x1, z0, z1 }, summe, inhalte, abdruck: hex8(h) };
      });
      const huelle = a.huelle;
      const wesen = alleWesen
        .filter((w) => w.x >= huelle.von.x && w.x < huelle.bis.x + 1 && w.y >= huelle.von.y && w.y < huelle.bis.y + 1 && w.z >= huelle.von.z && w.z < huelle.bis.z + 1)
        .map((w) => ({ id: w.id, x: Math.floor(w.x), y: Math.floor(w.y), z: Math.floor(w.z), baby: !!w.baby }));
      const summeA = {};
      for (const s of schichten) for (const [id, m] of Object.entries(s.summe)) summeA[id] = (summeA[id] ?? 0) + m;
      ergebnis.push({ id: a.id, name: a.name, status: a.status, huelle, legende, schichten, wesen, summe: summeA, bloecke: zellen.size });
    }
    return { projekt: { name: entwurf.projekt.name }, abschnitte: ergebnis, summe: gesamt, bloecke: ergebnis.reduce((s, a) => s + a.bloecke, 0) };
  }

  return { bauplan };
}

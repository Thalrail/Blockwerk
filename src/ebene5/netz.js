// Ebene 5 – Netz für die 3D-Ansicht: aus dem Bauplan ein Dreiecksnetz mit nur den sichtbaren Würfelflächen.
// Vereinfachung (in der Oberfläche gekennzeichnet): jeder Block ist ein voller Würfel. Koordinaten wie in Minecraft: x Ost, y oben, z Süd.
// Die Sicht (Etagenschnitt, Abschnitte, Technik ausblenden, Fortschritt) bestimmt, welche Zellen als vorhanden gelten; Flächen zu vorhandenen Nachbarn entfallen.
// Mit Atlas (Teil 6d, Faithful 32x) bekommt jede Fläche das UV-Rechteck der Textur ihres Blocks (oben, unten, Seite); die Tönung (Schattierung, Fortschritt, Dimmen) wird in der Zeichnung mit der Textur multipliziert.
// Blöcke ohne Textur zeigen die weiße Kachel des Atlas, eingefärbt mit ihrer Ersatzfarbe.
// Deterministisch; keine Uhr, kein Zufall.

/** Flächenschattierung: oben hell, unten dunkel, Seiten dazwischen (feste Werte statt Beleuchtung). */
const SCHATTEN = { '+y': 1, '-y': 0.5, '+x': 0.8, '-x': 0.8, '+z': 0.65, '-z': 0.65 };

/** Die sechs Richtungen mit je vier Ecken, gegen den Uhrzeigersinn von außen gesehen (Achsen zyklisch, damit a × b = Normale). */
const FLAECHEN = [];
for (let achse = 0; achse < 3; achse++) {
  for (const vorzeichen of [1, -1]) {
    const a = (achse + 1) % 3, b = (achse + 2) % 3;
    const reihenfolge = vorzeichen > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
    const ecken = reihenfolge.map(([s, t]) => { const p = [0, 0, 0]; p[achse] = vorzeichen > 0 ? 1 : 0; p[a] = s; p[b] = t; return p; });
    const d = [0, 0, 0]; d[achse] = vorzeichen;
    FLAECHEN.push({ d, ecken, schatten: SCHATTEN[`${vorzeichen > 0 ? '+' : '-'}${'xyz'[achse]}`] });
  }
}

const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mische = (c, ziel, anteil) => c.map((v, i) => v + (ziel[i] - v) * anteil);
const GRUEN = [76, 195, 138], WEISS = [255, 255, 255], BLAU = [110, 180, 255];

/** Bildkoordinaten (0 … 1, v nach unten) einer Würfelecke je Flächenrichtung, so dass Texturen von außen aufrecht und nicht gespiegelt erscheinen (oben: Norden ist oben im Bild). */
function uvEcke(d, e) {
  if (d[0] > 0) return [1 - e[2], 1 - e[1]];
  if (d[0] < 0) return [e[2], 1 - e[1]];
  if (d[2] > 0) return [e[0], 1 - e[1]];
  if (d[2] < 0) return [1 - e[0], 1 - e[1]];
  return d[1] > 0 ? [e[0], e[2]] : [e[0], 1 - e[2]];
}
const flaechenArt = (d) => (d[1] > 0 ? 'oben' : d[1] < 0 ? 'unten' : 'seite');

/**
 * @param {object} plan  Bauplan (Ebene 5): abschnitte[].legende[].farbe, schichten[] mit x, z, b, t (Art des Teils), y
 * @param {{maxY?: number, abschnitte?: 'alle'|'nur'|'bis', gewaehlt?: number, ausgeblendet?: number[], hervorheben?: boolean, fortschritt?: ((abschnitt: number, schicht: number) => 0|1|2) | null, atlas?: ReturnType<typeof import('./atlas.js').erzeugeAtlas> | null}} [sicht]
 *   Etagenschnitt (höchste gezeigte Höhe), Abschnittsauswahl (alle, nur der gewählte, bis einschließlich des gewählten), ausgeblendete Arten (2 = Technik, 3 = Verbindungen),
 *   Hervorhebung des gewählten Abschnitts (andere gedimmt), Fortschritt je Schicht (0 offen, 1 fertig, 2 aktuell)
 */
export function baueNetz(plan, sicht = {}) {
  const maxY = sicht.maxY ?? Infinity, modus = sicht.abschnitte ?? 'alle', gewaehlt = sicht.gewaehlt ?? 0;
  const aus = new Set(sicht.ausgeblendet ?? []);
  // 1. sichtbare Zellen sammeln
  const atlas = sicht.atlas ?? null;
  const X = [], Y = [], Z = [], FARBE = [], TEX = [];
  let x0 = Infinity, y0 = Infinity, z0 = Infinity;
  plan.abschnitte.forEach((a, ai) => {
    if ((modus === 'nur' && ai !== gewaehlt) || (modus === 'bis' && ai > gewaehlt)) return;
    const rgb = a.legende.map((l) => hexRgb(l.farbe));
    const rechte = a.legende.map((l) => (atlas && l.textur ? { oben: atlas.rechteck(l.textur.oben), unten: atlas.rechteck(l.textur.unten), seite: atlas.rechteck(l.textur.seite) } : null));
    const gedimmt = sicht.hervorheben && modus === 'alle' && ai !== gewaehlt;
    a.schichten.forEach((s, si) => {
      if (s.y > maxY) return;
      const zustand = sicht.fortschritt ? sicht.fortschritt(ai, si) : 0;
      for (let i = 0; i < s.n; i++) {
        if (aus.has(s.t[i])) continue;
        const tex = rechte[s.b[i]];
        let c = tex ? WEISS : rgb[s.b[i]];
        if (zustand === 1) c = mische(c, GRUEN, 0.45);
        else if (zustand === 2) c = mische(c, tex ? BLAU : WEISS, 0.5);
        if (gedimmt) c = c.map((v) => v * 0.55);
        X.push(s.x[i]); Y.push(s.y); Z.push(s.z[i]); FARBE.push(c); TEX.push(tex);
        if (s.x[i] < x0) x0 = s.x[i]; if (s.y < y0) y0 = s.y; if (s.z[i] < z0) z0 = s.z[i];
      }
    });
  });
  const n = X.length;
  if (!n) return { positionen: new Float32Array(0), uvs: new Float32Array(0), farben: new Uint8Array(0), indizes: new Uint32Array(0), flaechen: 0, bloecke: 0, huelle: null };
  let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) { if (X[i] > x1) x1 = X[i]; if (Y[i] > y1) y1 = Y[i]; if (Z[i] > z1) z1 = Z[i]; }
  const dy = y1 - y0 + 3, dz = z1 - z0 + 3;
  const schluessel = (x, y, z) => ((x - x0 + 1) * dy + (y - y0 + 1)) * dz + (z - z0 + 1);
  const dort = new Set();
  for (let i = 0; i < n; i++) dort.add(schluessel(X[i], Y[i], Z[i]));
  // 2. Flächen zählen, dann füllen
  const sichtbar = new Uint8Array(n); // Bitmaske der sichtbaren Richtungen je Zelle
  let flaechen = 0;
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let f = 0; f < 6; f++) { const d = FLAECHEN[f].d; if (!dort.has(schluessel(X[i] + d[0], Y[i] + d[1], Z[i] + d[2]))) { m |= 1 << f; flaechen++; } }
    sichtbar[i] = m;
  }
  const wk = atlas ? atlas.rechteck('#weiss') : null;
  const positionen = new Float32Array(flaechen * 12), uvs = new Float32Array(flaechen * 8), farben = new Uint8Array(flaechen * 12), indizes = new Uint32Array(flaechen * 6);
  let v = 0, ix = 0;
  for (let i = 0; i < n; i++) {
    for (let f = 0; f < 6; f++) {
      if (!(sichtbar[i] & (1 << f))) continue;
      const fl = FLAECHEN[f];
      const r = TEX[i] ? TEX[i][flaechenArt(fl.d)] : wk;
      for (const e of fl.ecken) {
        if (r) { const [u, w] = uvEcke(fl.d, e); uvs[v * 2] = r.u0 + u * (r.u1 - r.u0); uvs[v * 2 + 1] = r.v0 + w * (r.v1 - r.v0); }
        positionen[v * 3] = X[i] + e[0]; positionen[v * 3 + 1] = Y[i] + e[1]; positionen[v * 3 + 2] = Z[i] + e[2];
        farben[v * 3] = Math.round(FARBE[i][0] * fl.schatten); farben[v * 3 + 1] = Math.round(FARBE[i][1] * fl.schatten); farben[v * 3 + 2] = Math.round(FARBE[i][2] * fl.schatten);
        v++;
      }
      indizes.set([v - 4, v - 3, v - 2, v - 4, v - 2, v - 1], ix);
      ix += 6;
    }
  }
  return { positionen, uvs, farben, indizes, flaechen, bloecke: n, huelle: { von: [x0, y0, z0], bis: [x1 + 1, y1 + 1, z1 + 1] } };
}

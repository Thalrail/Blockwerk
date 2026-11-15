// Gestaltungsprüfer (D1): misst die Architekturqualität fertiger Blockdaten. Er MISST nur (keine Bewertung, keine Schwellen, keine Punkte; die kommen später)
// und ändert nichts: reine, deterministische Funktionen, Eingabe wird nur gelesen. Darstellungsqualität (Ebene 5, Netz) gehört ausdrücklich nicht dazu.
// Eingabe: einfache Blockliste [{ x, y, z, id }]; Luft wird ignoriert. Reihenfolge der Liste und Herkunft der Blöcke sind egal. Zahlen sind ganz oder auf 3 Stellen gerundet.
//
// Definitionen (x Ost, z Süd, y oben):
// - maße: umschließender Quader (von/bis), breite = x, tiefe = z, hoehe = y (je Anzahl Zellen), anzahlBloecke.
// - materialien: Anzahl verschiedener Block-IDs und Häufigkeit je ID (absteigend nach Anzahl, dann nach ID).
// - silhouette: je Höhenschicht das Außenmaß (Breite × Tiefe des Umrissquaders der belegten Zellen) und die Blockzahl; leere Schichten dazwischen zählen als 0 × 0.
//   verschiedeneQuerschnitte = Anzahl verschiedener Außenmaße; groessteAenderung = größter Sprung von breite oder tiefe zwischen benachbarten Schichten;
//   gleichDarunter = Anteil der Schichten (ab der zweiten), deren Außenmaß dem der Schicht darunter gleicht (1 = „Rohr ohne Gliederung“).
// - außen: Luftzelle, die von außerhalb des Umrissquaders (plus eine Zelle Rand) über Luft in 6er-Nachbarschaft erreichbar ist. Geschlossene Innenräume zählen nicht als außen,
//   ein oben offener Turm schon (Abkürzung: Hohlräume mit einem Loch gelten als außen, ausbauen wenn D2 das braucht).
// - fassade: Block mit mindestens einer waagerechten Seite (Nord, Süd, West, Ost) zu Außenluft. Eine Fassadenfläche ist diese Seite eines Blocks.
// - glatteFlaeche: je Himmelsrichtung die größte zusammenhängende Gruppe von Fassadenflächen aus demselben Block in einer Ebene (gleiche x- bzw. z-Koordinate), 4er-Nachbarschaft
//   in der Ebene (Breite und Höhe). Das Maximum (bei Gleichstand: erste Richtung in der Reihenfolge nord, sued, west, ost, dann kleinere ID) steht oben.
// - oeffnungen: Anteil der Fassadenzellen, deren ID eine der OEFFNUNGS_TEILE enthält (Glas, Tür inkl. Falltür, Eisenstangen, Gitter).
// - abschluss: Raumzelle = Luftzelle innerhalb des Umrissquaders, die waagerecht in allen vier Richtungen irgendwann auf einen Block trifft (Abkürzung: ein Hof zwischen Flügeln
//   zählt auch als Raum). hatBoden / hatDach: in jeder Spalte mit Raumzellen liegt unter der tiefsten bzw. über der höchsten Raumzelle irgendein Block. Ohne Raumzellen null.
//   Ein oben offener Turm hat deshalb hatDach = false.
// Der Speicher wächst mit dem Volumen des Umrissquaders. Grenzen (vor jeder Allokation geprüft, kontrollierter Fehler): je Ausdehnung höchstens MAX_AUSDEHNUNG = 1024 Zellen
// (reicht für den Bauplatz 600 × 600 und einzelne Bauwerke) und höchstens MAX_ZELLEN = 16 000 000 Rasterzellen einschließlich des um 2 größeren Flutfüll-Rasters.
// Abkürzung: Bauwerke darüber werden abgelehnt statt gemessen, ausbauen mit dünn besetztem Raster, falls größere Messungen nötig werden.

/** Teile von Block-IDs, die als Öffnung zählen (Daten, kein Code verstreut). */
export const OEFFNUNGS_TEILE = ['glass', 'door', 'iron_bars', 'grate'];
export const MAX_AUSDEHNUNG = 1024;
export const MAX_ZELLEN = 16_000_000;
const LUFT = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air']);
const RICHTUNGEN = [['nord', 0, -1], ['sued', 0, 1], ['west', -1, 0], ['ost', 1, 0]]; // Name, dx, dz
const r3 = (v) => Math.round(v * 1000) / 1000;
const sortiere = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Prüft die Blockliste, entfernt Luft und baut ein Raster über den Umrissquader. Wirft bei ungültigen Blöcken oder doppelten Zellen. */
function raster(bloecke) {
  const echte = [];
  for (const b of bloecke) {
    // Leere ID '' ist ungültig (sonst wäre sie von „keine Zelle“ nicht zu unterscheiden); nur sichere Ganzzahlen, damit die Rastergröße rechenbar bleibt.
    if (!b || ![b.x, b.y, b.z].every(Number.isSafeInteger) || typeof b.id !== 'string' || b.id === '') throw new Error(`Gestaltungsprüfer: ungültiger Block ${JSON.stringify(b)}`);
    if (!LUFT.has(b.id)) echte.push(b);
  }
  if (!echte.length) return { n: 0, bloecke: [] };
  const von = { x: Infinity, y: Infinity, z: Infinity }, bis = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const b of echte) for (const k of ['x', 'y', 'z']) { von[k] = Math.min(von[k], b[k]); bis[k] = Math.max(bis[k], b[k]); }
  const B = bis.x - von.x + 1, H = bis.y - von.y + 1, T = bis.z - von.z + 1;
  // Obergrenze vor jeder Allokation; die Flutfüllung legt das um 2 je Ausdehnung größere Raster an und zählt mit.
  for (const a of [B, H, T]) if (a > MAX_AUSDEHNUNG) throw new Error(`Gestaltungsprüfer: Bauwerk zu groß (Ausdehnung ${a} > ${MAX_AUSDEHNUNG} Zellen)`);
  if ((B + 2) * (H + 2) * (T + 2) > MAX_ZELLEN) throw new Error(`Gestaltungsprüfer: Bauwerk zu groß (Raster mit ${(B + 2) * (H + 2) * (T + 2)} Zellen > ${MAX_ZELLEN})`);
  const idx = (x, y, zz) => ((x - von.x) * H + (y - von.y)) * T + (zz - von.z);
  const zellen = new Array(B * H * T).fill(null);
  for (const b of echte) {
    const i = idx(b.x, b.y, b.z);
    if (zellen[i] !== null) throw new Error(`Gestaltungsprüfer: Zelle ${b.x},${b.y},${b.z} doppelt belegt`);
    zellen[i] = b.id;
  }
  const drin = (x, y, zz) => x >= von.x && x <= bis.x && y >= von.y && y <= bis.y && zz >= von.z && zz <= bis.z;
  /** ID an der Zelle oder null (Luft oder außerhalb). */
  const id = (x, y, zz) => (drin(x, y, zz) ? zellen[idx(x, y, zz)] : null);
  return { n: echte.length, bloecke: echte, von, bis, B, H, T, id, drin };
}

/** Außenluft: Flutfüllung (6er-Nachbarschaft) von einer Zelle außerhalb des Quaders. Gibt eine Funktion (x, y, z) → Boolean zurück. */
function aussenluft(r) {
  const { von, bis } = r;
  const B = r.B + 2, H = r.H + 2, T = r.T + 2;
  const idx = (x, y, zz) => ((x - von.x + 1) * H + (y - von.y + 1)) * T + (zz - von.z + 1);
  const besucht = new Uint8Array(B * H * T);
  const stapel = [[von.x - 1, von.y - 1, von.z - 1]];
  besucht[idx(von.x - 1, von.y - 1, von.z - 1)] = 1;
  while (stapel.length) {
    const [x, y, zz] = stapel.pop();
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const nx = x + dx, ny = y + dy, nz = zz + dz;
      if (nx < von.x - 1 || nx > bis.x + 1 || ny < von.y - 1 || ny > bis.y + 1 || nz < von.z - 1 || nz > bis.z + 1) continue;
      if (besucht[idx(nx, ny, nz)] || r.id(nx, ny, nz) !== null) continue;
      besucht[idx(nx, ny, nz)] = 1;
      stapel.push([nx, ny, nz]);
    }
  }
  return (x, y, zz) => !r.drin(x, y, zz) || besucht[idx(x, y, zz)] === 1;
}

function masse(r) {
  if (!r.n) return { von: null, bis: null, breite: 0, tiefe: 0, hoehe: 0, anzahlBloecke: 0 };
  return { von: { ...r.von }, bis: { ...r.bis }, breite: r.B, tiefe: r.T, hoehe: r.H, anzahlBloecke: r.n };
}

function materialien(r) {
  const zaehler = new Map();
  for (const b of r.bloecke) zaehler.set(b.id, (zaehler.get(b.id) ?? 0) + 1);
  const haeufigkeit = [...zaehler].map(([id, anzahl]) => ({ id, anzahl })).sort((a, b) => b.anzahl - a.anzahl || sortiere(a.id, b.id));
  return { anzahlVerschieden: zaehler.size, haeufigkeit };
}

function silhouette(r) {
  const leer = { schichten: [], verschiedeneQuerschnitte: 0, groessteAenderung: 0, gleichDarunter: 0 };
  if (!r.n) return leer;
  const schichten = [];
  for (let y = r.von.y; y <= r.bis.y; y++) {
    const m = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, n: 0 };
    for (const b of r.bloecke) if (b.y === y) { m.x0 = Math.min(m.x0, b.x); m.x1 = Math.max(m.x1, b.x); m.z0 = Math.min(m.z0, b.z); m.z1 = Math.max(m.z1, b.z); m.n++; }
    schichten.push({ y, breite: m.n ? m.x1 - m.x0 + 1 : 0, tiefe: m.n ? m.z1 - m.z0 + 1 : 0, bloecke: m.n });
  }
  let sprung = 0, gleich = 0;
  for (let i = 1; i < schichten.length; i++) {
    const a = schichten[i - 1], b = schichten[i];
    sprung = Math.max(sprung, Math.abs(a.breite - b.breite), Math.abs(a.tiefe - b.tiefe));
    if (a.breite === b.breite && a.tiefe === b.tiefe) gleich++;
  }
  return {
    schichten,
    verschiedeneQuerschnitte: new Set(schichten.map((s) => `${s.breite}×${s.tiefe}`)).size,
    groessteAenderung: sprung,
    gleichDarunter: schichten.length > 1 ? r3(gleich / (schichten.length - 1)) : 0,
  };
}

/** Fassadenflächen: je Richtung die Blöcke, deren Nachbar in dieser Richtung Außenluft ist. */
function fassade(r, aussen) {
  return RICHTUNGEN.map(([name, dx, dz]) => ({ name, dx, dz, flaechen: r.bloecke.filter((b) => aussen(b.x + dx, b.y, b.z + dz)) }));
}

function glatteFlaeche(fassaden) {
  const jeRichtung = {};
  let max = { groesse: 0, richtung: null, id: null };
  for (const f of fassaden) {
    let groesst = { groesse: 0, id: null };
    // Gruppe = gleiche Ebene (x bei West/Ost, z bei Nord/Süd) und gleicher Block; Nachbarn in der Ebene: ±1 entlang der anderen Waagerechten, ±1 in y
    const alsAchse = f.dx === 0 ? 'x' : 'z', ebene = f.dx === 0 ? 'z' : 'x';
    const rest = new Map(f.flaechen.map((b) => [`${b[ebene]},${b[alsAchse]},${b.y}`, b]));
    for (const start of [...rest.values()].sort((a, b) => a[ebene] - b[ebene] || a[alsAchse] - b[alsAchse] || a.y - b.y)) {
      const k0 = `${start[ebene]},${start[alsAchse]},${start.y}`;
      if (!rest.has(k0)) continue;
      rest.delete(k0);
      let groesse = 0;
      const stapel = [start];
      while (stapel.length) {
        const b = stapel.pop();
        groesse++;
        for (const [da, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${b[ebene]},${b[alsAchse] + da},${b.y + dy}`, n = rest.get(k);
          if (n && n.id === start.id) { rest.delete(k); stapel.push(n); }
        }
      }
      if (groesse > groesst.groesse || (groesse === groesst.groesse && sortiere(start.id, groesst.id) < 0)) groesst = { groesse, id: start.id };
    }
    jeRichtung[f.name] = groesst;
    if (groesst.groesse > max.groesse) max = { groesse: groesst.groesse, richtung: f.name, id: groesst.id };
  }
  return { max, jeRichtung };
}

function oeffnungen(fassaden) {
  const fassadenzellen = new Map();
  for (const f of fassaden) for (const b of f.flaechen) fassadenzellen.set(`${b.x},${b.y},${b.z}`, b.id);
  const oeffnung = [...fassadenzellen.values()].filter((id) => OEFFNUNGS_TEILE.some((t) => id.includes(t))).length;
  return { fassadenzellen: fassadenzellen.size, oeffnungszellen: oeffnung, anteil: fassadenzellen.size ? r3(oeffnung / fassadenzellen.size) : 0 };
}

function abschluss(r) {
  const leer = { raumzellen: 0, hatBoden: null, hatDach: null };
  if (!r.n) return leer;
  const { von, bis } = r;
  // je Zeile (y,z) bzw. (y,x) kleinster und größter belegter Wert: ein Strahl nach beiden Seiten trifft genau dann einen Block, wenn die Zelle dazwischen liegt
  const zeileX = new Map(), zeileZ = new Map();
  const merke = (m, k, v) => { const e = m.get(k); if (e) { e[0] = Math.min(e[0], v); e[1] = Math.max(e[1], v); } else m.set(k, [v, v]); };
  for (const b of r.bloecke) { merke(zeileX, `${b.y},${b.z}`, b.x); merke(zeileZ, `${b.y},${b.x}`, b.z); }
  const spalten = new Map(); // "x,z" → [tiefste, höchste Raumzelle]
  let raumzellen = 0;
  for (let x = von.x; x <= bis.x; x++) for (let y = von.y; y <= bis.y; y++) for (let zz = von.z; zz <= bis.z; zz++) {
    if (r.id(x, y, zz) !== null) continue;
    const ex = zeileX.get(`${y},${zz}`), ez = zeileZ.get(`${y},${x}`);
    if (!ex || !ez || !(x > ex[0] && x < ex[1] && zz > ez[0] && zz < ez[1])) continue;
    raumzellen++;
    merke(spalten, `${x},${zz}`, y);
  }
  if (!raumzellen) return leer;
  let boden = true, dach = true;
  for (const [k, [tief, hoch]] of spalten) {
    const [x, zz] = k.split(',').map(Number);
    let darunter = false, darueber = false;
    for (let y = von.y; y < tief; y++) if (r.id(x, y, zz) !== null) darunter = true;
    for (let y = hoch + 1; y <= bis.y; y++) if (r.id(x, y, zz) !== null) darueber = true;
    boden &&= darunter; dach &&= darueber;
  }
  return { raumzellen, hatBoden: boden, hatDach: dach };
}

/**
 * Misst eine Blockliste [{ x, y, z, id }]. Ändert die Eingabe nicht.
 * @returns {{maße: object, materialien: object, silhouette: object, glatteFlaeche: object, oeffnungen: object, abschluss: object}}
 */
export function messeGestaltung(bloecke) {
  const r = raster(bloecke);
  const fassaden = r.n ? fassade(r, aussenluft(r)) : RICHTUNGEN.map(([name, dx, dz]) => ({ name, dx, dz, flaechen: [] }));
  return {
    maße: masse(r),
    materialien: materialien(r),
    silhouette: silhouette(r),
    glatteFlaeche: glatteFlaeche(fassaden),
    oeffnungen: oeffnungen(fassaden),
    abschluss: abschluss(r),
  };
}

/** Dünner Adapter: die endgültigen Weltblöcke eines Planentwurfs als Blockliste (nur Ebene 3: `materialisiere`, nie das Renderbild). */
export function bloeckeAusEntwurf(ebene3, entwurf) {
  return ebene3.materialisiere(entwurf).welt.alleBloecke().map((b) => ({ x: b.x, y: b.y, z: b.z, id: b.id }));
}

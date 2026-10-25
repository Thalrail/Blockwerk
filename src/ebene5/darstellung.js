// Ebene 5 – Darstellung ohne Texturen: Farbfläche und lesbarer Name je Block (Daten: data/darstellung.json).
// Fehlt eine Zuordnung, bekommt der Block eine Ersatzfarbe aus seiner Block-ID und wird als Ersatz markiert (Vorgabe aus Ebene 5: fehlende Texturen nie still weglassen).
// Texturen (Faithful 32x) folgen später; diese Datei bleibt dann die Rückfallebene.

const hex = (n) => n.toString(16).padStart(2, '0');

/** Deterministische Ersatzfarbe aus der Block-ID (FNV-1a), mittlere Sättigung und Helligkeit. */
function ersatzFarbe(id) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  const ton = h % 360, s = 0.45, l = 0.5;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + ton / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

/** „minecraft:stone_bricks“ → „Stone Bricks“ */
function lesbar(id) {
  return id.replace(/^minecraft:/, '').split('_').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/**
 * @param {{farben: {muster: string, farbe: string}[], namen: Record<string, string>}} daten
 */
export function erzeugeDarstellung(daten) {
  const regeln = daten.farben.map((r) => ({ re: new RegExp(r.muster), farbe: r.farbe }));
  const cache = new Map();
  /** @returns {{id: string, name: string, farbe: string, ersatz: boolean}} */
  function block(id) {
    let e = cache.get(id);
    if (!e) {
      const treffer = regeln.find((r) => r.re.test(id));
      e = { id, name: daten.namen[id] ?? lesbar(id), farbe: treffer?.farbe ?? ersatzFarbe(id), ersatz: !treffer };
      cache.set(id, e);
    }
    return e;
  }
  return { block, lesbar, ersatzFarbe };
}

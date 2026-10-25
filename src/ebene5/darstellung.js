// Ebene 5 – Darstellung: Textur (Faithful 32x, Index data/texturen.json), Farbfläche und lesbarer Name je Block (Daten: data/darstellung.json).
// Mit Texturindex ist ein Block ohne Textur ein Ersatz: er bekommt eine Farbfläche (Regel oder Farbe aus der Block-ID) und wird markiert (Vorgabe aus Ebene 5: fehlende Texturen nie still weglassen).
// Ohne Texturindex (Tests, Seite ohne Texturen) gilt wie bisher: Ersatz ist, was keine Farbregel hat.

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
 * @param {{pack: object, kacheln: string[], bloecke: Record<string, {oben: string, unten: string, seite: string, angenaehert: boolean}>} | null} [texturen]
 */
export function erzeugeDarstellung(daten, texturen = null) {
  const regeln = daten.farben.map((r) => ({ re: new RegExp(r.muster), farbe: r.farbe }));
  const cache = new Map();
  /** @returns {{id: string, name: string, farbe: string, ersatz: boolean, textur: {oben: string, unten: string, seite: string, angenaehert: boolean} | null}} */
  function block(id) {
    let e = cache.get(id);
    if (!e) {
      const treffer = regeln.find((r) => r.re.test(id));
      const textur = texturen?.bloecke[id] ?? null;
      e = { id, name: daten.namen[id] ?? lesbar(id), farbe: treffer?.farbe ?? ersatzFarbe(id), ersatz: texturen ? !textur : !treffer, textur };
      cache.set(id, e);
    }
    return e;
  }
  return { block, lesbar, ersatzFarbe };
}

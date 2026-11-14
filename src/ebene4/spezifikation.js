// Ebene 4 – Bauspezifikation als Datenstruktur: Lesen aus dem Chat-Text, kanonisches JSON, Abdruck (Prüfsumme) für die Freigabe.
// Reines JSON, deterministisch, ohne Uhr und Zufall.

/** Fehler beim Lesen der Spezifikation (z. B. kein gültiges JSON): Jonah bekommt den Grund im Klartext. */
export class SpezifikationFehler extends Error {
  constructor(nachricht) { super(`Spezifikation: ${nachricht}`); this.name = 'SpezifikationFehler'; }
}

export const kopie = (spec) => structuredClone(spec);

/** Form der Projektkennung (`projekt.id`): p- und 32 Hexzeichen (128 Bit, von der Oberfläche vergeben; die Logik hier kennt keinen Zufall). */
export const PROJEKT_ID = /^p-[0-9a-f]{32}$/;

/** Liest die Antwort aus dem Claude-Chat: mit oder ohne ```json-Zaun, davor und danach darf Text stehen. */
export function liesJson(text) {
  if (typeof text !== 'string' || !text.trim()) throw new SpezifikationFehler('der Text ist leer');
  let t = text.trim();
  const zaun = t.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (zaun) t = zaun[1].trim();
  else if (!t.startsWith('{')) {
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b < a) throw new SpezifikationFehler('im Text steht kein JSON-Objekt');
    t = t.slice(a, b + 1);
  }
  let wert;
  try { wert = JSON.parse(t); } catch (f) { throw new SpezifikationFehler(`kein gültiges JSON (${f.message})`); }
  if (!wert || typeof wert !== 'object' || Array.isArray(wert)) throw new SpezifikationFehler('das JSON ist kein Objekt');
  return wert;
}

/** Sortiert alle Schlüssel rekursiv (kanonische Reihenfolge); Listen behalten ihre Reihenfolge. */
function sortiert(w) {
  if (Array.isArray(w)) return w.map(sortiert);
  if (w && typeof w === 'object') return Object.fromEntries(Object.keys(w).sort().map((k) => [k, sortiert(w[k])]));
  return w;
}

export const zuJson = (spec) => JSON.stringify(sortiert(spec), null, 2);

/** FNV-1a (32 Bit) über das kanonische JSON ohne die Freigabe: ändert sich der Inhalt, ändert sich der Abdruck. */
export function abdruck(spec) {
  const { freigabe, ...inhalt } = spec;
  void freigabe;
  // die Projektkennung ist Herkunft, nicht Inhalt: sie ändert weder Freigabe noch Plan (Jonah, 14.11.2026)
  if (inhalt.projekt && typeof inhalt.projekt === 'object' && 'id' in inhalt.projekt) { const { id, ...rest } = inhalt.projekt; void id; inhalt.projekt = rest; }
  const text = JSON.stringify(sortiert(inhalt));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Ebene 5 – Texturen (Faithful 32x, Bedrock): welche Blöcke Blockwerk überhaupt braucht, welche Texturdatei zu welcher Blockfläche gehört und der Index, den die Seite lädt.
// Nur Logik ohne Dateizugriff: das Werkzeug tools/texturen-extrahieren.js liest das Pack und ruft `erzeugeIndex` auf. Zuordnung als Daten: data/texturen-regeln.json.
// Fehlt eine Zuordnung oder eine Datei, bekommt der Block KEINE Textur und wird als Ersatz markiert (`fehlend`): nie raten, nie still weglassen.

/** Fehler bei der Zuordnung (kaputte Regeltabelle). */
export class TexturFehler extends Error {
  constructor(nachricht) { super(`Texturen: ${nachricht}`); this.name = 'TexturFehler'; }
}

const FLAECHEN = ['oben', 'unten', 'seite'];

/** Eintrag der Tabelle (Text = alle Flächen, Objekt mit oben/unten/seite) in die drei Flächen bringen; fehlende Flächen fallen auf `seite` zurück. */
function normiere(e, id) {
  if (typeof e === 'string') return { oben: e, unten: e, seite: e, angenaehert: false };
  if (!e || typeof e !== 'object' || typeof (e.seite ?? e.oben) !== 'string') throw new TexturFehler(`der Eintrag für ${id} braucht mindestens „seite“ oder „oben“`);
  const seite = e.seite ?? e.oben;
  return { oben: e.oben ?? seite, unten: e.unten ?? e.oben ?? seite, seite, angenaehert: e.angenaehert === true };
}

/**
 * Textur-Dateinamen (ohne Endung, relativ zu textures/blocks) je Fläche für einen Block, oder null ohne Zuordnung.
 * Reihenfolge: ausdrücklicher Eintrag, dann die Regeln (`wie` = nimm die Textur eines anderen Blocks, `textur` = Vorlage mit $1).
 * @param {string} id
 * @param {{bloecke: Record<string, string | object>, regeln: {muster: string, wie?: string, textur?: string, angenaehert?: boolean}[]}} tabelle
 */
export function loeseAuf(id, tabelle, tiefe = 0) {
  if (tiefe > 4) throw new TexturFehler(`die Regeln für ${id} verweisen im Kreis`);
  if (Object.hasOwn(tabelle.bloecke, id)) return normiere(tabelle.bloecke[id], id);
  for (const r of tabelle.regeln ?? []) {
    const m = new RegExp(r.muster).exec(id);
    if (!m) continue;
    const ersetze = (t) => t.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? '');
    if (r.wie) { const a = loeseAuf(ersetze(r.wie), tabelle, tiefe + 1); if (a) return { ...a, angenaehert: a.angenaehert || r.angenaehert === true }; continue; } // ohne Treffer gilt die nächste Regel
    if (r.textur) return normiere(ersetze(r.textur), id);
  }
  return null;
}

/**
 * Alle Blöcke, die Blockwerk setzen kann und die eine Darstellung brauchen: Block-IDs aus Quelltexten (Bausteine, Paletten), Berufsblöcke und Betten (Ebene 0),
 * dazu was der Aufrufer zusätzlich nennt (z. B. die Legende des Beispielprojekts). Nur IDs, die das Blockregister kennt.
 * @param {{register: {hat: (id: string) => boolean, ids: () => string[], block: (id: string) => any}, texte?: string[], zusaetzlich?: string[]}} q
 */
export function benoetigteBloecke({ register, texte = [], zusaetzlich = [] }) {
  const ids = new Set(zusaetzlich);
  for (const t of texte) for (const m of t.matchAll(/minecraft:[a-z0-9_]+/g)) ids.add(m[0]);
  for (const id of register.ids()) { const p = register.block(id).eigenschaften; if (p.beruf || p.bett) ids.add(id); }
  return [...ids].filter((id) => register.hat(id)).sort();
}

/**
 * Index für die Seite: welche Kacheln (Dateien) gebraucht werden und welche Blöcke welche Flächen haben.
 * @param {{ids: string[], tabelle: object, vorhanden: (name: string) => boolean, pack: object}} q
 * @returns {{pack: object, kacheln: string[], bloecke: Record<string, {oben: string, unten: string, seite: string, angenaehert: boolean}>, fehlend: {id: string, grund: string}[]}}
 */
export function erzeugeIndex({ ids, tabelle, vorhanden, pack }) {
  const bloecke = {}, fehlend = [], kacheln = new Set();
  for (const id of [...new Set(ids)].sort()) {
    const a = loeseAuf(id, tabelle);
    if (!a) { fehlend.push({ id, grund: 'keine Zuordnung in data/texturen-regeln.json' }); continue; }
    const luecken = [...new Set(FLAECHEN.map((f) => a[f]))].filter((n) => !vorhanden(n));
    if (luecken.length) { fehlend.push({ id, grund: `Datei fehlt im Pack: ${luecken.join(', ')}` }); continue; }
    bloecke[id] = a;
    for (const f of FLAECHEN) kacheln.add(a[f]);
  }
  return { pack, kacheln: [...kacheln].sort(), bloecke, fehlend };
}

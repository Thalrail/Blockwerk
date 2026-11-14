// Ebene 5 – Stil und Materialien bearbeiten (Paket U4 der Oberfläche, docs/plan-oberflaeche-bearbeiten.md, Entscheidung „Materialwahl in der Spezifikation“ vom 14.11.2026).
// Reines Modul ohne DOM. Eine Änderung am Stil ist eine Änderung der SPEZIFIKATION (Spezifikationsweg): hier entsteht nur die neue Spezifikation; den Rest übernimmt der vorhandene
// Weg (Prüfer mit `bearbeitet` → neue Version → Freigabe → Bau → Umbauhinweise). Diese Ebene rechnet nichts am Plan und prüft nichts doppelt: gültig ist, was der Prüfer der
// Spezifikation (Ebene 4, mit den Palettenregeln des Designers) annimmt; die Auswahlliste filtert nur vorab mit denselben Regeln, damit nichts angeboten wird, was abgelehnt würde.
import { formKarte, mischePaletten } from '../ebene3/designer.js';
import { blockSuche, blockInfo } from './bearbeiten.js';

export class MaterialFehler extends Error {
  constructor(nachricht) { super(nachricht); this.name = 'MaterialFehler'; }
}

/** Ebenen, auf denen Stil gewählt werden kann: das Projekt und jedes Teil mit eigenem Abschnitt (Kindteile wie Tür, Fenster, Treppe im Haus haben keinen). */
export function ebenen(spec, kindrelationen = []) {
  const kind = (t) => typeof t.lage?.relation === 'string' && kindrelationen.includes(t.lage.relation);
  return [{ id: 'projekt', name: 'Ganzes Projekt' }, ...(spec.teile ?? []).filter((t) => !kind(t)).map((t) => ({ id: t.id, name: t.name ?? t.id }))];
}

const stilOrt = (spec, ebene) => {
  if (ebene === 'projekt') return spec.projekt;
  const t = (spec.teile ?? []).find((x) => x.id === ebene);
  if (!t) throw new MaterialFehler(`Das Teil „${String(ebene)}“ gibt es nicht.`);
  return t;
};
const aufraeumen = (ort) => {
  if (ort.stil?.palette && !Object.keys(ort.stil.palette).length) delete ort.stil.palette;
  if (ort.stil && !Object.keys(ort.stil).length) delete ort.stil;
};

/** Der Stil (Stimmung, Materialwahl) einer Ebene, wie er in der Spezifikation steht (leer, wenn nichts gewählt ist). */
export const stilVon = (spec, ebene) => { const s = stilOrt(spec, ebene).stil ?? {}; return { stimmung: s.stimmung ?? null, palette: structuredClone(s.palette ?? {}) }; };

/** Neue Spezifikation (Kopie) mit anderer Stimmung; `null` nimmt die Stimmung dieser Ebene weg. Die Version und die Freigabe regelt der bestehende Weg. */
export function setzeStimmung(spec, ebene, name, stimmungen = null) {
  if (name !== null && stimmungen && !stimmungen.includes(name)) throw new MaterialFehler(`Die Stimmung „${String(name)}“ gibt es nicht (${stimmungen.join(', ')}).`);
  const neu = structuredClone(spec), ort = stilOrt(neu, ebene);
  if (name === null) { if (ort.stil) delete ort.stil.stimmung; } else ort.stil = { ...(ort.stil ?? {}), stimmung: name };
  aufraeumen(ort);
  return neu;
}

/**
 * Neue Spezifikation (Kopie) mit einem Block für Rolle und Form; `block` ist `{id, zustand?}` oder `null` (diese Wahl wieder wegnehmen, es gilt wieder die Stimmung).
 * Andere Formen derselben Rolle bleiben. Ein Block ohne Zustand steht als Text, sonst als `{id, zustand}`; nur die Form „voll“ steht ohne Formnamen.
 */
export function setzeMaterial(spec, ebene, rolle, form, block, { rollen = null, formen = null } = {}) {
  if (rollen && !rollen.includes(rolle)) throw new MaterialFehler(`Die Rolle „${String(rolle)}“ gibt es nicht (${rollen.join(', ')}).`);
  if (formen && !formen.includes(form)) throw new MaterialFehler(`Die Form „${String(form)}“ gibt es nicht (${formen.join(', ')}).`);
  const neu = structuredClone(spec), ort = stilOrt(neu, ebene);
  const palette = { ...(ort.stil?.palette ?? {}) };
  const karte = formKarte(palette[rolle]);
  if (block === null) delete karte[form];
  else {
    if (typeof block?.id !== 'string') throw new MaterialFehler('Der Block braucht eine Kennung (minecraft:…).');
    karte[form] = block.zustand && Object.keys(block.zustand).length ? { id: block.id, zustand: { ...block.zustand } } : block.id;
  }
  if (Object.keys(karte).length) palette[rolle] = mischePaletten({}, { [rolle]: karte })[rolle]; else delete palette[rolle];
  ort.stil = { ...(ort.stil ?? {}), palette };
  aufraeumen(ort);
  return neu;
}

/** Die Wahl für Rolle und Form (Block mit Zustand oder null). */
export function wahlFuer(spec, ebene, rolle, form) {
  const w = formKarte(stilOrt(spec, ebene).stil?.palette?.[rolle])[form];
  return w === undefined ? null : (typeof w === 'string' ? { id: w } : { id: w.id, ...(w.zustand ? { zustand: { ...w.zustand } } : {}) });
}

/** Angaben für die Oberfläche: Stimmungen, Rollen, welche Formen es je Rolle gibt (aus den Stimmungen), Beziehungen, die ein Kindteil kennzeichnen. */
export function stilInfo({ paletten, vokabular }) {
  const rollenFormen = {};
  for (const r of paletten.rollen) {
    const formen = new Set(['voll']);
    for (const n of paletten.stimmungen()) for (const f of Object.keys(formKarte(paletten.stimmung(n)[r]))) formen.add(f);
    rollenFormen[r] = [...formen].sort((a, b) => (a === 'voll' ? -1 : b === 'voll' ? 1 : a < b ? -1 : 1));
  }
  return { stimmungen: [...paletten.stimmungen()].sort(), rollen: [...paletten.rollen], rollenFormen, kindrelationen: Object.keys(vokabular.kindrelationen) };
}

/**
 * Blöcke, die für Rolle und Form angeboten werden: Treffer der Suche im Register, die die Palettenregeln des Designers annehmen (kein Arbeitsblock, Form passt zum Namen,
 * Licht leuchtet, der Block lässt sich drehen). Blöcke, die dafür einen Zustand brauchen (z. B. Säulenachse), werden mit ihrem Vorschlag geprüft; die Auswahl verlangt ihn dann.
 */
export function materialSuche({ ebene0, paletten }, text, rolle, form, grenze = 40) {
  const treffer = [];
  let mehr = false;
  // Die Form „voll“ nimmt die Regel des Designers für jeden Namen an (Endung leer); angeboten werden dafür aber keine Treppen, Türen oder Scheiben
  const fremdeEndungen = Object.entries(paletten.formen).filter(([f, endung]) => f !== form && endung).map(([, endung]) => endung);
  for (const t of blockSuche(ebene0, text, 2000)) {
    if (form === 'voll' && fremdeEndungen.some((e) => t.id.endsWith(e))) continue;
    let info; try { info = blockInfo(ebene0, t.id); } catch { continue; }
    const zustand = Object.fromEntries(info.zustaende.filter((z) => z.pflicht).map((z) => [z.name, z.vorschlag]));
    try { paletten.pruefe({ [rolle]: { [form]: Object.keys(zustand).length ? { id: t.id, zustand } : t.id } }); } catch { continue; }
    if (treffer.length >= grenze) { mehr = true; break; }
    treffer.push(t);
  }
  return { treffer, mehr };
}

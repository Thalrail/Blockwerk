// Ebene 5 – Bauteile bearbeiten (Paket U5 der Oberfläche, docs/plan-oberflaeche-bearbeiten.md): Teile, Größen und Lage in der Spezifikation ändern, Teile hinzufügen und entfernen.
// Reines Modul ohne DOM, Spezifikationsweg wie U4: hier entsteht nur eine neue Spezifikation (Kopie); Prüfer (Ebene 4), neue Version, Freigabe, Bau und Umbauhinweise macht der
// vorhandene Weg. Wertebereiche und Beschriftungen kommen aus den Bausteinpaketen (Parameter mit Größenart) und dem Vokabular, nichts davon steht fest in der Oberfläche, damit neue
// Bausteine ohne Umbau erscheinen. Die Prüfung der Werte hier ist nur die erste Schranke für Eingabefelder; gültig ist, was der Prüfer der Spezifikation annimmt.

import { pruefeAlles } from './eingabe.js';
import { bauePlan } from './bauen.js';

export class TeileFehler extends Error {
  constructor(nachricht) { super(nachricht); this.name = 'TeileFehler'; }
}

const ID_MUSTER = /^[a-z0-9][a-z0-9-]*$/;
const istObjekt = (w) => w !== null && typeof w === 'object' && !Array.isArray(w);
const teilVon = (spec, id) => {
  const t = (spec.teile ?? []).find((x) => x.id === id);
  if (!t) throw new TeileFehler(`Das Teil „${String(id)}“ gibt es nicht.`);
  return t;
};

/** Angaben für die Oberfläche aus dem Vokabular (Ebene 4): Bausteine mit Parametern, Lagebeziehungen, Anker, Ausrichtungen, Versatzachsen, Arten, Wichtigkeiten. */
export function teileInfo(vokabular) {
  return {
    bausteine: vokabular.bausteine.map((b) => ({ id: b.id, titel: b.titel, parameter: b.parameter.filter((p) => !p.liste).map((p) => ({ ...p })) })),
    relationen: { ...vokabular.relationen }, kindrelationen: Object.keys(vokabular.kindrelationen),
    anker: Object.keys(vokabular.anker), ausrichtungen: Object.keys(vokabular.ausrichtungen), versatzAchsen: [...vokabular.versatz.achsen], versatzMax: vokabular.versatz.maximum,
    teilarten: [...vokabular.teilarten], wichtigkeiten: [...vokabular.wichtigkeiten], abstandMax: vokabular.bauplatz.breite.max,
  };
}

const istKind = (t, kindrelationen) => typeof t?.lage?.relation === 'string' && kindrelationen.includes(t.lage.relation);

/** Die Teile für die Liste: Kennung, Name, Baustein, Wichtigkeit, Größe als Text, ob es in einem anderen Bauteil liegt (Kindteil) und worin. */
export function teilListe(spec, kindrelationen = []) {
  return (spec.teile ?? []).map((t) => ({
    id: t.id, name: t.name ?? t.id, baustein: t.form?.baustein ?? null, art: t.art, wichtigkeit: t.wichtigkeit,
    groesse: Object.entries(t.form?.groesse ?? {}).map(([k, w]) => `${k} ${w}`).join(', '), kind: istKind(t, kindrelationen), traeger: istKind(t, kindrelationen) ? t.lage.bezug : null,
  }));
}

/** Eine Zahl für einen Parameter: ganze Zahl, wenn der Parameter es verlangt, im Bereich des Bausteinpakets. */
export function pruefeParameterWert(par, wert) {
  if (typeof wert !== 'number' || !Number.isFinite(wert)) throw new TeileFehler(`${par.name}: bitte eine Zahl eingeben.`);
  if (par.ganzzahl && !Number.isInteger(wert)) throw new TeileFehler(`${par.name}: bitte eine ganze Zahl eingeben.`);
  if (wert < par.min || wert > par.max) throw new TeileFehler(`${par.name} = ${wert} ist nicht möglich (${par.min} bis ${par.max}).`);
  return wert;
}

/** Name, Wichtigkeit (Kopie). */
export function setzeEigenschaft(spec, id, feld, wert, info = null) {
  if (!['name', 'wichtigkeit'].includes(feld)) throw new TeileFehler(`Das Feld „${String(feld)}“ lässt sich hier nicht ändern.`);
  if (feld === 'name' && (typeof wert !== 'string' || !wert.trim() || wert.length > 60)) throw new TeileFehler('Der Name braucht 1 bis 60 Zeichen.');
  if (feld === 'wichtigkeit' && info && !info.wichtigkeiten.includes(wert)) throw new TeileFehler(`Die Wichtigkeit „${String(wert)}“ gibt es nicht (${info.wichtigkeiten.join(', ')}).`);
  const neu = structuredClone(spec);
  teilVon(neu, id)[feld] = feld === 'name' ? wert.trim() : wert;
  return neu;
}

/** Größe eines Parameters (Kopie); `null` nimmt die Angabe weg, es gilt wieder der Standard des Bausteins. Der Wert wird gegen das Bausteinpaket geprüft. */
export function setzeParameter(spec, id, name, wert, info) {
  const neu = structuredClone(spec), t = teilVon(neu, id);
  const baustein = info.bausteine.find((b) => b.id === t.form?.baustein);
  const par = baustein?.parameter.find((p) => p.name === name);
  if (!par) throw new TeileFehler(`Den Parameter „${String(name)}“ gibt es bei ${baustein?.titel ?? String(t.form?.baustein)} nicht.`);
  t.form = { ...(t.form ?? {}), groesse: { ...(t.form?.groesse ?? {}) } };
  if (wert === null) delete t.form.groesse[name]; else t.form.groesse[name] = pruefeParameterWert(par, wert);
  return neu;
}

/**
 * Lage eines Teils (Kopie), auch die von Kindteilen (Tür, Fenster, Treppe, Wand im Haus): Beziehung, Bezug und je nach Beziehung Abstand oder Anker, Ausrichtung, Versatz.
 * Felder, die zur gewählten Beziehung nicht passen, werden nicht übernommen (der Prüfer lehnt sie sonst ab). Die Reihenfolge der Beziehungen und das Ergebnis prüft der Prüfer.
 * @param {{relation: string, bezug: string, abstand?: number, anker?: string, ausrichtung?: string, versatz?: object}} lage
 */
export function setzeLage(spec, id, lage, info) {
  const neu = structuredClone(spec), t = teilVon(neu, id);
  if (!istObjekt(lage)) throw new TeileFehler('Die Lage braucht Beziehung und Bezug.');
  if (!Object.hasOwn(info.relationen, lage.relation)) throw new TeileFehler(`Die Lagebeziehung „${String(lage.relation)}“ gibt es nicht.`);
  if (lage.bezug !== 'projekt' && !neu.teile.some((x) => x.id === lage.bezug)) throw new TeileFehler(`Worauf sich das Teil bezieht („${String(lage.bezug)}“), gibt es nicht.`);
  if (lage.bezug === id) throw new TeileFehler('Ein Teil kann sich nicht auf sich selbst beziehen.');
  const aus = { bezug: lage.bezug, relation: lage.relation };
  if (info.kindrelationen.includes(lage.relation)) {
    if (lage.anker !== undefined) { if (!info.anker.includes(lage.anker)) throw new TeileFehler(`Den Anker „${String(lage.anker)}“ gibt es nicht.`); aus.anker = lage.anker; }
    if (lage.ausrichtung !== undefined && !/^wand-/.test(lage.relation)) { if (!info.ausrichtungen.includes(lage.ausrichtung)) throw new TeileFehler(`Die Ausrichtung „${String(lage.ausrichtung)}“ gibt es nicht.`); aus.ausrichtung = lage.ausrichtung; }
    if (lage.versatz !== undefined) {
      if (!istObjekt(lage.versatz)) throw new TeileFehler('Der Versatz braucht Zahlen je Achse.');
      const v = {};
      for (const [k, w] of Object.entries(lage.versatz)) {
        if (!info.versatzAchsen.includes(k)) throw new TeileFehler(`Der Versatz kennt „${k}“ nicht (${info.versatzAchsen.join(', ')}).`);
        if (!Number.isInteger(w) || Math.abs(w) > info.versatzMax) throw new TeileFehler(`Der Versatz ${k} = ${String(w)} ist nicht möglich (ganze Zahl von -${info.versatzMax} bis ${info.versatzMax}).`);
        if (w !== 0) v[k] = w;
      }
      if (Object.keys(v).length) aus.versatz = v;
    }
  } else if (lage.abstand !== undefined) {
    if (!Number.isInteger(lage.abstand) || lage.abstand < 0 || lage.abstand > info.abstandMax) throw new TeileFehler(`Der Abstand ${String(lage.abstand)} ist nicht möglich (ganze Zahl von 0 bis ${info.abstandMax}).`);
    if (lage.abstand > 0) aus.abstand = lage.abstand;
  }
  t.lage = aus;
  return neu;
}

const UMLAUTE = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
/** Kennung aus einem Namen („Nordturm“ → „nordturm“), eindeutig unter den vorhandenen Teilen (Zahl angehängt). */
export function neueKennung(spec, name) {
  let basis = String(name ?? '').toLowerCase().replace(/[äöüß]/g, (c) => UMLAUTE[c]).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  if (!basis) basis = 'teil';
  const belegt = new Set((spec.teile ?? []).map((t) => t.id));
  let id = basis;
  for (let i = 2; belegt.has(id); i++) id = `${basis}-${i}`;
  if (!ID_MUSTER.test(id)) throw new TeileFehler('Aus dem Namen lässt sich keine Kennung bilden.');
  return id;
}

/** Neues Teil (Kopie) mit den genannten Größen, sonst den Standardgrößen des Bausteins; die Größe lässt sich danach ändern. @returns {{spec: object, id: string}} */
export function fuegeTeilHinzu(spec, { name, baustein, art, wichtigkeit = 'soll', lage, groesse = {} }, info) {
  if (typeof name !== 'string' || !name.trim() || name.length > 60) throw new TeileFehler('Der Name braucht 1 bis 60 Zeichen.');
  if (!info.bausteine.some((b) => b.id === baustein)) throw new TeileFehler(`Den Baustein „${String(baustein)}“ gibt es nicht.`);
  if (!info.teilarten.includes(art)) throw new TeileFehler(`Die Art „${String(art)}“ gibt es nicht (${info.teilarten.join(', ')}).`);
  if (!info.wichtigkeiten.includes(wichtigkeit)) throw new TeileFehler(`Die Wichtigkeit „${String(wichtigkeit)}“ gibt es nicht.`);
  const id = neueKennung(spec, name);
  const neu = structuredClone(spec);
  const par = info.bausteine.find((b) => b.id === baustein).parameter;
  const g = {};
  for (const [k, w] of Object.entries(groesse)) { const p = par.find((x) => x.name === k); if (!p) throw new TeileFehler(`Den Parameter „${k}“ gibt es bei ${baustein} nicht.`); g[k] = pruefeParameterWert(p, w); }
  neu.teile = [...(neu.teile ?? []), { id, name: name.trim(), art, form: { baustein, groesse: g }, lage: { bezug: 'projekt', relation: 'mitte' }, wichtigkeit }];
  return { spec: setzeLage(neu, id, lage, info), id };
}

/** Was hängt an einem Teil? Kinder (liegen in ihm), andere Teile, die sich auf es beziehen, und Verbindungen zu ihm. */
export function abhaengige(spec, id, kindrelationen = []) {
  const kinder = [], bezogene = [], verbindungen = [];
  for (const t of spec.teile ?? []) {
    if (t.id === id) continue;
    if (t.lage?.bezug === id) (istKind(t, kindrelationen) ? kinder : bezogene).push(t.id);
    for (const v of t.verbindungen ?? []) if (v?.mit === id) verbindungen.push({ von: t.id, art: v.art });
  }
  const eigene = (teilVon(spec, id).verbindungen ?? []).map((v) => ({ von: id, mit: v.mit, art: v.art }));
  return { kinder, bezogene, verbindungen, eigeneVerbindungen: eigene };
}

/**
 * Teil entfernen (Kopie). Ein Teil, in dem andere liegen oder auf das sich andere beziehen, wird nie stumm entfernt: erst diese Teile entfernen oder anders legen.
 * Verbindungen anderer Teile zu ihm entfallen (sie bleiben sonst ohne Ziel) und werden zurückgegeben, damit die Oberfläche sie vor dem Übernehmen nennen kann.
 * @returns {{spec: object, entfernteVerbindungen: {von: string, art: string}[]}}
 */
export function entferneTeil(spec, id, kindrelationen = []) {
  teilVon(spec, id);
  const a = abhaengige(spec, id, kindrelationen);
  if (a.kinder.length || a.bezogene.length) {
    const nenne = (l) => l.map((x) => `„${x}“`).join(', ');
    throw new TeileFehler(`${a.kinder.length ? `In diesem Teil liegen ${nenne(a.kinder)}. ` : ''}${a.bezogene.length ? `Auf dieses Teil beziehen sich ${nenne(a.bezogene)}. ` : ''}Erst diese Teile entfernen oder anders legen, dann lässt es sich entfernen.`);
  }
  const neu = structuredClone(spec);
  neu.teile = neu.teile.filter((t) => t.id !== id);
  for (const t of neu.teile) if (Array.isArray(t.verbindungen)) { t.verbindungen = t.verbindungen.filter((v) => v?.mit !== id); if (!t.verbindungen.length) delete t.verbindungen; }
  return { spec: neu, entfernteVerbindungen: a.verbindungen };
}

/**
 * Folgen einer Änderung für die Einzelblockänderungen (U3), aus einem Probebau mit der neuen Spezifikation: alle Änderungen, die danach nicht mehr wirken (verwaist, Konflikt,
 * überholt, ungültig), je mit Zelle und einem Satz zum Grund. Rein: bekommt den Plan, der Probebau selbst läuft im Worker.
 * @param {{aenderungen?: {id: string, teil: string, zelle: object, op: string, status: string, grund?: string, ort: object|null}[]}} plan
 * @param {{aenderungen?: object[]}} planVorher  Plan vor der Änderung (damit nur NEUE Probleme gemeldet werden)
 */
export function aenderungsFolgen(plan, planVorher = null) {
  const vorher = new Set((planVorher?.aenderungen ?? []).filter((a) => a.status !== 'angewandt').map((a) => `${a.teil}|${a.zelle.x},${a.zelle.y},${a.zelle.z}`));
  const GRUND = { 'teil-fehlt': 'das Teil gibt es nicht mehr', 'teil-leer': 'das Teil hat keine Blöcke mehr', ausserhalb: 'die Zelle liegt nicht mehr im Teil', 'kein-block': 'dort ist kein Block mehr, den man entfernen könnte', 'fremder-block': 'dort steht jetzt ein Block eines anderen Teils', freiraum: 'die Zelle gehört jetzt zu einem freizuhaltenden Raum' };
  return (plan?.aenderungen ?? []).filter((a) => a.status !== 'angewandt' && !vorher.has(`${a.teil}|${a.zelle.x},${a.zelle.y},${a.zelle.z}`)).map((a) => ({
    id: a.id, teil: a.teil, zelle: { ...a.zelle }, op: a.op, status: a.status,
    text: `Änderung ${a.id} (${a.op === 'leere' ? 'Block entfernt' : 'Block gesetzt'} an Zelle ${a.zelle.x}, ${a.zelle.y}, ${a.zelle.z} von „${a.teil}“) ${a.status === 'ueberholt' ? 'wirkt nicht mehr, weil ein Einbauteil die Zelle ausspart' : `wird ${a.status === 'verwaist' ? 'verwaist' : a.status === 'konflikt' ? 'ein Konflikt' : 'ungültig'}: ${GRUND[a.grund] ?? a.grund ?? 'siehe Plan'}`}.`,
  }));
}

/**
 * Vorschau einer Änderung der Spezifikation (U5): erst die Prüfung (Prüfer, Abgleich, Übersetzung), dann – nur wenn es Einzelblockänderungen gibt – ein Probebau mit ihnen, um vorab
 * zu zeigen, welche danach nicht mehr wirken. Ändert nichts: der Probebau läuft auf einer Kopie.
 * @param {object} e  geladene Engine
 * @param {{spezifikation: object, aenderungen?: object|null, messungen?: object[], planVorher?: object|null}} eingabe
 * @returns {{rueckfragen: {pfad: string, frage: string}[], folgen: object[]}}
 */
export function vorschau(e, { spezifikation, aenderungen = null, messungen = [], planVorher = null }) {
  const frage = (liste) => liste.map((q) => ({ pfad: q.pfad ?? '', frage: q.frage }));
  const p = pruefeAlles(e, spezifikation, messungen, []);
  if (p.rueckfragen.length) return { rueckfragen: frage(p.rueckfragen), folgen: [] };
  const pf = aenderungen && Object.keys(aenderungen.eintraege ?? {}).length ? aenderungen : null;
  if (!pf) return { rueckfragen: [], folgen: [] };
  const r = bauePlan(e, e.ebene4.freigeben(structuredClone(spezifikation), 'vorschau', messungen), messungen, pf);
  if (!r.entwurf) return { rueckfragen: frage(r.rueckfragen ?? []), folgen: [] };
  return { rueckfragen: [], folgen: aenderungsFolgen(e.e5.bauplan(r.entwurf), planVorher) };
}

// ---------- Formularfelder (Text aus Eingabefeldern) ⇄ Spezifikation ----------
// Die Oberfläche hält die Eingaben eines Formulars als einfache Zuordnung Feldname → Text (so, wie sie in den Feldern stehen); die Umwandlung in Zahlen und die Anwendung sind hier,
// damit sie ohne Browser testbar sind. Feldnamen: name, wicht, rel, bezug, abstand, anker, ausr, v-<Achse>, p-<Parameter>; beim neuen Teil zusätzlich baustein und art.
const zahlAus = (roh, was) => {
  const t = String(roh ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new TeileFehler(`${was}: bitte eine Zahl eingeben.`);
  return n;
};

/** Anfangswerte der Felder für ein vorhandenes Teil. */
export function felderVon(spec, id) {
  const t = teilVon(spec, id), l = t.lage ?? {};
  const f = { name: t.name ?? '', wicht: t.wichtigkeit ?? '', rel: l.relation ?? '', bezug: l.bezug ?? 'projekt', abstand: l.abstand === undefined ? '' : String(l.abstand), anker: l.anker ?? '', ausr: l.ausrichtung ?? '' };
  for (const [k, w] of Object.entries(l.versatz ?? {})) f[`v-${k}`] = String(w);
  for (const [k, w] of Object.entries(t.form?.groesse ?? {})) f[`p-${k}`] = String(w);
  return f;
}

/** Lage aus Feldern (nur Angaben, die gesetzt sind; `setzeLage` verwirft, was zur Beziehung nicht passt). */
function lageAusFeldern(f, info) {
  const lage = { relation: f.rel, bezug: f.bezug };
  const abstand = zahlAus(f.abstand, 'Abstand'); if (abstand !== null) lage.abstand = abstand;
  if (f.anker) lage.anker = f.anker;
  if (f.ausr) lage.ausrichtung = f.ausr;
  const versatz = {};
  for (const achse of info.versatzAchsen) { const w = zahlAus(f[`v-${achse}`], `Versatz ${achse}`); if (w !== null) versatz[achse] = w; }
  if (Object.keys(versatz).length) lage.versatz = versatz;
  return lage;
}

/** Wendet alle Felder eines Teils an (nur, was sich unterscheidet); ohne Unterschied kommt eine unveränderte Kopie zurück. */
export function wendeFelder(spec, id, felder, info) {
  let neu = structuredClone(spec);
  const t0 = teilVon(spec, id);
  if (felder.name !== undefined && felder.name !== t0.name) neu = setzeEigenschaft(neu, id, 'name', felder.name, info);
  if (felder.wicht && felder.wicht !== t0.wichtigkeit) neu = setzeEigenschaft(neu, id, 'wichtigkeit', felder.wicht, info);
  const baustein = info.bausteine.find((b) => b.id === t0.form?.baustein);
  for (const p of baustein?.parameter ?? []) {
    if (!Object.hasOwn(felder, `p-${p.name}`)) continue; // ein fehlendes Feld ist keine Angabe; nur ein vorhandenes leeres Feld heißt „Standard“
    const ziel = zahlAus(felder[`p-${p.name}`], p.name), jetzt = t0.form?.groesse?.[p.name] ?? null;
    if (ziel !== jetzt) neu = setzeParameter(neu, id, p.name, ziel, info);
  }
  if (felder.rel) {
    // verglichen wird mit der Lage, die die unveränderten Felder ergäben (gleiche Normalisierung): ein Teil, dessen Lage nur anders geschrieben ist (z. B. Abstand 0), bleibt unangetastet
    const gesetzt = setzeLage(neu, id, lageAusFeldern(felder, info), info), ausgangsLage = teilVon(setzeLage(spec, id, lageAusFeldern(felderVon(spec, id), info), info), id).lage;
    if (JSON.stringify(teilVon(gesetzt, id).lage) !== JSON.stringify(ausgangsLage)) neu = gesetzt;
  }
  return neu;
}

/** Neues Teil aus Feldern (name, baustein, art, wicht, Lage, p-<Parameter>). @returns {{spec: object, id: string}} */
export function neuAusFeldern(spec, felder, info) {
  const baustein = info.bausteine.find((b) => b.id === felder.baustein);
  const groesse = {};
  for (const p of baustein?.parameter ?? []) { const w = zahlAus(felder[`p-${p.name}`], p.name); if (w !== null) groesse[p.name] = w; }
  return fuegeTeilHinzu(spec, { name: felder.name, baustein: felder.baustein, art: felder.art, wichtigkeit: felder.wicht || 'soll', lage: lageAusFeldern(felder, info), groesse }, info);
}

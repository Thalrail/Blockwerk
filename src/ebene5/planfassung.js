// Ebene 5 – Planfassung: die gemeinsame, versionierte Menge der manuellen Einzelblockänderungen mehrerer Spieler (Paket P10 der Einbau-Architektur,
// Bearbeitungsmodell B, Entscheidung 3: Änderungen gehören zu einer gemeinsamen Planfassung mit Version; Konflikte werden nie stillschweigend überschrieben).
//   { version: <ganze Zahl ≥ 0>, eintraege: { '<teil>|<x>,<y>,<z>': { teil, zelle: {x,y,z}, op: 'setze'|'leere', block?: {id, zustand?}, zugelassen?: true, von } } }
// `zugelassen` (U6): Jonah hat entschieden, dass eine nicht anwendbare Änderung gespeichert bleibt und der Bau ohne sie weitergeht; es gehört zum Inhalt (wird mit verglichen und geteilt).
// Eine Änderung wird nur angenommen, wenn die Zelle im Raum noch so ist, wie der Absender sie kannte (`erwartet`, Vergleichen-und-Setzen je Zelle). Andernfalls kommt
// ein Konflikt mit dem aktuellen Eintrag zurück; der Raum bleibt unverändert, und der Absender (nur er, nach Rückfrage) kann mit dem aktuellen Eintrag als Erwartung
// bewusst überschreiben. Verschiedene Zellen stören sich nie. Rein, deterministisch, ohne Uhr und Zufall.

/** Grenzen für fremde Eingaben (ein Ort für Dienst, Seite und Link). */
// `groesse` ist das Gesamtbudget (Zeichen des gespeicherten JSON der Einträge): zusammen mit Spezifikation (200.000) und Fortschritt bleibt der Raum unter den Grenzen von
// Nachricht und Speicher; ohne dieses Budget wären 1000 Einträge mit je 500 Zeichen Zustand weit darüber.
export const PF_GRENZEN = Object.freeze({ eintraege: 1000, operationen: 200, koordinate: 100_000, zustand: 500, teil: 64, groesse: 120_000, version: 1_000_000_000 });
const TEIL = /^[^|\s]{1,64}$/;
const BLOCK = /^minecraft:[a-z0-9_]{1,64}$/;
const OPS = ['setze', 'leere'];

const istObjekt = (w) => w !== null && typeof w === 'object' && !Array.isArray(w);
const ganz = (n) => Number.isSafeInteger(n) && Math.abs(n) <= PF_GRENZEN.koordinate;
const sortiert = (w) => (Array.isArray(w) ? w.map(sortiert) : istObjekt(w) ? Object.fromEntries(Object.keys(w).sort().map((k) => [k, sortiert(w[k])])) : w);

/** Fehler bei einer unbrauchbaren Planfassung oder Operation. `grund` ist ein kurzes Stichwort für die Ablehnung. */
export class PlanfassungFehler extends Error {
  constructor(grund, nachricht) { super(nachricht); this.name = 'PlanfassungFehler'; this.grund = grund; }
}

export const leer = () => ({ version: 0, eintraege: {} });

// ---------- Format und Verträglichkeit mit älteren Versionen (U6, Entscheidung 14.11.2026) ----------
// Eine Planfassung mit Zulassungen (`zugelassen: true`) kann eine ältere Blockwerk-Version nicht verlustfrei lesen: sie würde das unbekannte Feld beim Laden stillschweigend entfernen und beim
// erneuten Speichern oder Teilen die Zulassung verlieren. Darum bekommt so eine Planfassung eine Form, die ältere Versionen **sichtbar ablehnen**, statt sie zu verstümmeln:
//  - Speicher im Browser: `{ format: 2, planfassung }` (ältere Versionen finden darin keine gültige Planfassung, legen eine Kopie unter „….defekt“ an und melden es);
//  - Link und Datei: Umschlag `version: 2` (ältere Versionen lehnen ihn mit „Version 2 wird nicht verstanden“ ab; siehe teilen.js);
//  - im Raum schützt der Vergleich je Zelle: ein älterer Klient kennt die Zulassung nicht, seine Erwartung weicht ab, und der Raum meldet einen Konflikt statt zu überschreiben.
// Ohne Zulassung bleibt alles wie bisher (Format 1, auch von älteren Versionen lesbar).
export const FORMAT = 2;
export const enthaeltZulassung = (pf) => Object.values(pf?.eintraege ?? {}).some((e) => e?.zugelassen === true);
/** Die Form, in der eine Planfassung gespeichert wird (Browser-Speicher, Sicherungen): mit Zulassungen eingewickelt, sonst unverändert. */
export const fuerSpeicher = (pf) => (enthaeltZulassung(pf) ? { format: FORMAT, planfassung: pf } : pf);
/**
 * Liest die Speicherform (`fuerSpeicher`) und prüft sie streng. Ein Format, das diese Version nicht kennt (neuer als sie), ist ein klarer Fehler und wird nie still gelesen oder überschrieben.
 * @returns {{version: number, eintraege: object}}
 */
export function ausSpeicher(roh) {
  if (istObjekt(roh) && Object.hasOwn(roh, 'format')) {
    if (roh.format !== FORMAT) throw new PlanfassungFehler('format', `Diese Änderungen haben das Format ${String(roh.format).slice(0, 20)}, das diese Version von Blockwerk nicht kennt. Bitte Blockwerk aktualisieren; nichts wurde verändert.`);
    return pruefeForm(roh.planfassung);
  }
  return pruefeForm(roh);
}
export const schluessel = (teil, zelle) => `${teil}|${zelle.x},${zelle.y},${zelle.z}`;

function pruefeZelle(z) {
  if (!istObjekt(z) || ![z.x, z.y, z.z].every(ganz)) throw new PlanfassungFehler('zelle', `Die Zelle braucht ganze Zahlen x, y, z (höchstens ±${PF_GRENZEN.koordinate})`);
}

/** Inhalt einer Änderung ohne Autor: `{op}` oder `{op, block}` (Block `{id, zustand?}`), dazu optional `zugelassen: true`. Wirft bei Formfehlern. */
export function pruefeInhalt(e) {
  if (!istObjekt(e) || !OPS.includes(e.op)) throw new PlanfassungFehler('op', `op muss ${OPS.join(' oder ')} sein`);
  if (e.zugelassen !== undefined && e.zugelassen !== true && e.zugelassen !== false) throw new PlanfassungFehler('zugelassen', 'zugelassen muss wahr oder falsch sein');
  const zu = e.zugelassen === true ? { zugelassen: true } : {};
  if (e.op === 'leere') {
    if (e.block !== undefined) throw new PlanfassungFehler('block', 'leere hat keinen Block');
    return { op: 'leere', ...zu };
  }
  if (!istObjekt(e.block) || typeof e.block.id !== 'string' || !BLOCK.test(e.block.id)) throw new PlanfassungFehler('block', 'setze braucht einen Block (minecraft:…)');
  if (e.block.zustand !== undefined && (!istObjekt(e.block.zustand) || JSON.stringify(e.block.zustand).length > PF_GRENZEN.zustand)) throw new PlanfassungFehler('block', `Der Blockzustand muss ein kleines Objekt sein (höchstens ${PF_GRENZEN.zustand} Zeichen)`);
  return { op: 'setze', block: { id: e.block.id, ...(e.block.zustand ? { zustand: sortiert(e.block.zustand) } : {}) }, ...zu };
}

/** Stimmen zwei Inhalte überein (ohne Autor und Zelle)? `null` heißt „keine Änderung an dieser Zelle“. */
export const gleichInhalt = (a, b) => (a == null || b == null ? (a == null) === (b == null) : JSON.stringify(sortiert(pruefeInhalt(a))) === JSON.stringify(sortiert(pruefeInhalt(b))));

/** Prüft eine Operation `{teil, zelle, erwartet, neu}` und liefert sie in kanonischer Form. */
export function pruefeOperation(op) {
  if (!istObjekt(op)) throw new PlanfassungFehler('form', 'Eine Operation ist kein Objekt');
  if (typeof op.teil !== 'string' || !TEIL.test(op.teil)) throw new PlanfassungFehler('teil', `Das Teil braucht eine Kennung ohne | und Leerzeichen (1 bis ${PF_GRENZEN.teil} Zeichen)`);
  pruefeZelle(op.zelle);
  if (!('erwartet' in op) || !('neu' in op)) throw new PlanfassungFehler('form', 'Eine Operation braucht erwartet und neu (null, wenn es nichts gibt)');
  return {
    teil: op.teil, zelle: { x: op.zelle.x, y: op.zelle.y, z: op.zelle.z },
    erwartet: op.erwartet == null ? null : pruefeInhalt(op.erwartet), neu: op.neu == null ? null : pruefeInhalt(op.neu),
  };
}

/** Prüft die Form einer ganzen Planfassung (nach dem Laden aus Raum, Link oder Datei) und liefert eine saubere Kopie. */
export function pruefeForm(pf) {
  if (!istObjekt(pf) || !Number.isSafeInteger(pf.version) || pf.version < 0 || pf.version > PF_GRENZEN.version || !istObjekt(pf.eintraege)) throw new PlanfassungFehler('form', 'Planfassung ungültig (version, eintraege)');
  const aus = {};
  const ks = Object.keys(pf.eintraege);
  if (ks.length > PF_GRENZEN.eintraege) throw new PlanfassungFehler('zu-gross', `Eine Planfassung hat höchstens ${PF_GRENZEN.eintraege} Änderungen`);
  for (const k of ks.sort()) {
    const e = pf.eintraege[k];
    if (!istObjekt(e) || typeof e.teil !== 'string' || !TEIL.test(e.teil)) throw new PlanfassungFehler('teil', `Änderung „${k.slice(0, 40)}“ hat kein gültiges Teil`);
    pruefeZelle(e.zelle);
    if (k !== schluessel(e.teil, e.zelle)) throw new PlanfassungFehler('schluessel', `Der Schlüssel „${k.slice(0, 40)}“ passt nicht zu Teil und Zelle`);
    if (typeof e.von !== 'string' || !e.von || e.von.length > 24) throw new PlanfassungFehler('von', 'Eine Änderung braucht den Namen des Spielers (höchstens 24 Zeichen)');
    aus[k] = { teil: e.teil, zelle: { x: e.zelle.x, y: e.zelle.y, z: e.zelle.z }, ...pruefeInhalt(e), von: e.von };
  }
  if (JSON.stringify(aus).length > PF_GRENZEN.groesse) throw new PlanfassungFehler('zu-gross', `Die Änderungen sind zusammen größer als ${PF_GRENZEN.groesse} Zeichen`);
  return { version: pf.version, eintraege: aus };
}

/**
 * Wendet Operationen an (rein: liefert eine neue Planfassung). Je Operation gilt Vergleichen-und-Setzen: `erwartet` muss dem aktuellen Eintrag entsprechen,
 * sonst ist es ein Konflikt (nichts wird überschrieben). Die Version steigt einmal, wenn mindestens eine Operation etwas geändert hat.
 * Mit `gruppe: true` gelten alle Operationen ganz oder gar nicht (U6, z. B. „neu verankern“ = alten Eintrag löschen und neuen setzen): gibt es einen Konflikt, bleibt die
 * Planfassung unverändert, nichts wird angenommen, und `gruppeAbgelehnt` ist wahr.
 * @returns {{planfassung: object, angenommen: {teil, zelle, neu}[], konflikte: {teil, zelle, aktuell, vorschlag}[], geaendert: boolean, gruppeAbgelehnt?: boolean}}
 */
export function wende(pf, operationen, von, { gruppe = false } = {}) {
  if (!Array.isArray(operationen) || !operationen.length) throw new PlanfassungFehler('form', 'aenderung braucht mindestens eine Operation');
  if (operationen.length > PF_GRENZEN.operationen) throw new PlanfassungFehler('zu-gross', `Höchstens ${PF_GRENZEN.operationen} Operationen je Nachricht`);
  const ops = operationen.map(pruefeOperation); // alles prüfen, bevor etwas geändert wird: eine kaputte Operation lehnt die ganze Nachricht ab
  const eintraege = { ...pf.eintraege };
  const angenommen = [], konflikte = [], beruehrt = new Map();
  let geaendert = false;
  if (pf.version >= PF_GRENZEN.version) throw new PlanfassungFehler('version', 'Die Planfassung hat ihre höchste Versionsnummer erreicht');
  for (const op of ops) {
    const k = schluessel(op.teil, op.zelle), aktuell = eintraege[k] ?? null;
    beruehrt.set(k, { teil: op.teil, zelle: op.zelle });
    if (!gleichInhalt(aktuell, op.erwartet)) {
      konflikte.push({ teil: op.teil, zelle: op.zelle, aktuell: null, vorschlag: op.neu }); // `aktuell` wird unten mit dem Endstand der Zelle gefüllt (spätere Operationen derselben Nachricht können sie noch ändern)
      continue;
    }
    if (gleichInhalt(aktuell, op.neu)) continue; // schon so: nichts zu tun (Wiederholungen schaden nie)
    if (op.neu === null) delete eintraege[k];
    else eintraege[k] = { teil: op.teil, zelle: op.zelle, ...op.neu, von };
    angenommen.push({ teil: op.teil, zelle: op.zelle, neu: op.neu === null ? null : { ...op.neu, von } });
    geaendert = true;
  }
  const abgelehnt = gruppe && konflikte.length > 0; // eine Gruppe gilt ganz oder gar nicht: der Stand vor der Nachricht bleibt
  if (abgelehnt) { for (const k of Object.keys(eintraege)) delete eintraege[k]; Object.assign(eintraege, pf.eintraege); geaendert = false; angenommen.length = 0; }
  // Grenzen gelten nur für einen Stand, der wirklich übernommen wird (eine abgelehnte Gruppe meldet ihren Konflikt, nicht einen Größenfehler ihres verworfenen Zwischenstands)
  if (Object.keys(eintraege).length > PF_GRENZEN.eintraege) throw new PlanfassungFehler('zu-gross', `Eine Planfassung hat höchstens ${PF_GRENZEN.eintraege} Änderungen`);
  if (geaendert && JSON.stringify(eintraege).length > PF_GRENZEN.groesse) throw new PlanfassungFehler('zu-gross', `Die Änderungen sind zusammen größer als ${PF_GRENZEN.groesse} Zeichen`);
  // Endstand jeder berührten Zelle (angenommen oder Konflikt): das ist, was der Raum nach der Nachricht hält; der Absender übernimmt genau das
  const endstand = (k) => (eintraege[k] ? { op: eintraege[k].op, ...(eintraege[k].block ? { block: eintraege[k].block } : {}), ...(eintraege[k].zugelassen ? { zugelassen: true } : {}), von: eintraege[k].von } : null);
  for (const x of konflikte) x.aktuell = endstand(schluessel(x.teil, x.zelle));
  const zellen = [...beruehrt].sort((p, q) => (p[0] < q[0] ? -1 : 1)).map(([k, c]) => ({ teil: c.teil, zelle: c.zelle, aktuell: endstand(k) }));
  return { planfassung: geaendert ? { version: pf.version + 1, eintraege } : pf, angenommen, konflikte, zellen, geaendert, ...(abgelehnt ? { gruppeAbgelehnt: true } : {}) };
}

/** Setzt die Endstände einzelner Zellen (Antwort des Raums) in eine lokale Kopie; `aktuell: null` löscht. */
export function setzeZellen(pf, zellen, version) {
  const e = { ...pf.eintraege };
  for (const x of zellen) {
    const k = schluessel(x.teil, x.zelle);
    if (x.aktuell == null) delete e[k]; else e[k] = { teil: x.teil, zelle: { x: x.zelle.x, y: x.zelle.y, z: x.zelle.z }, ...pruefeInhalt(x.aktuell), von: String(x.aktuell.von ?? '') };
  }
  return { version: Math.max(pf.version, version), eintraege: e };
}

/** Übernimmt schon entschiedene Einträge in eine lokale Kopie (Antwort oder Rundsendung des Raums); `neu: null` löscht. */
export function uebernimm(pf, eintraege, version) {
  const e = { ...pf.eintraege };
  for (const x of eintraege) {
    const k = schluessel(x.teil, x.zelle);
    if (x.neu == null) delete e[k]; else e[k] = { teil: x.teil, zelle: { x: x.zelle.x, y: x.zelle.y, z: x.zelle.z }, ...pruefeInhalt(x.neu), von: String(x.neu.von ?? '') };
  }
  return { version: Math.max(pf.version, version), eintraege: e };
}

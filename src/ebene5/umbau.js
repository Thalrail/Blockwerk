// Ebene 5 – Umbauhinweise (Paket P11 der Einbau-Architektur, docs/architektur-einbau.md Abschnitt 7).
// Wird eine neue Planfassung übernommen, obwohl Schichten nach der alten schon gebaut sind (abgehakt), steht im Spiel noch der alte Stand. Dieses Modul vergleicht die zuletzt
// bestätigte Fassung mit der neuen und nennt je gebauter Schicht, was geändert werden muss: Blöcke ENTFERNEN (dort steht jetzt nichts mehr), ERSETZEN (anderer Block oder
// andere Richtung) oder ERGÄNZEN (neuer Block in einer schon gebauten Schicht). Schichten, die nicht gebaut sind, brauchen keinen Hinweis (es steht ja nichts). Rein, deterministisch,
// ohne Uhr und Zufall; ändert weder Plan noch Fortschritt. Die Übernahme der neuen Fassung verlangt die Bestätigung dieser Hinweise (`uebernahme`).
import * as F from './fortschritt.js';

const zellenVon = (abschnitt, schicht) => {
  const m = new Map();
  for (let i = 0; i < schicht.n; i++) m.set(`${schicht.x[i]},${schicht.z[i]}`, { x: schicht.x[i], z: schicht.z[i], id: abschnitt.legende[schicht.b[i]].id, r: schicht.r[i] });
  return m;
};
const ordnung = (p, q) => p.z - q.z || p.x - q.x;
/** Alle Blöcke des neuen Plans nach Weltkoordinate (über alle Abschnitte): ein schon gebauter Block, der jetzt in einem anderen Abschnitt steht, ist nichts, was entfernt werden müsste. */
const weltIndex = (plan) => {
  const m = new Map();
  for (const a of plan.abschnitte) for (const s of a.schichten) for (let i = 0; i < s.n; i++) m.set(`${s.x[i]},${s.y},${s.z[i]}`, { id: a.legende[s.b[i]].id, r: s.r[i] });
  return m;
};

/**
 * Vergleicht die alte mit der neuen Fassung für alle Schichten, die nach der alten gebaut sind (`fortschritt` gehört zur alten Fassung).
 * @param {{abschnitte: object[]}} alt  Bauplan der zuletzt bestätigten Fassung
 * @param {{abschnitte: object[]}} neu  Bauplan der neuen Fassung
 * @param {{eintraege: object, uhr: number}} fortschritt  Haken der alten Fassung
 * @returns {{noetig: boolean, schichten: {abschnitt: string, y: number, entfernen: object[], ersetzen: object[], ergaenzen: object[]}[], summe: {entfernen: number, ersetzen: number, ergaenzen: number, schichten: number}}}
 */
export function hinweise(alt, neu, fortschritt) {
  const neuVon = new Map(neu.abschnitte.map((a) => [a.id, a]));
  const imNeuen = weltIndex(neu);
  const schichten = [];
  for (const a of alt.abschnitte) {
    const b = neuVon.get(a.id);
    for (const s of a.schichten) {
      if (!F.istAbgehakt(fortschritt, F.schluessel(a.id, s))) continue; // nicht gebaut: nichts umzubauen
      const t = b?.schichten.find((x) => x.y === s.y);
      if (t && t.abdruck === s.abdruck) continue; // dieselbe Schicht, nichts zu tun
      const vorher = zellenVon(a, s), nachher = t ? zellenVon(b, t) : new Map(); // `nachher` nur für „ergänzen“ (gleicher Abschnitt und Höhe)
      const entfernen = [], ersetzen = [], ergaenzen = [];
      for (const [k, c] of vorher) {
        const n = imNeuen.get(`${c.x},${s.y},${c.z}`); // über alle Abschnitte des neuen Plans
        if (!n) entfernen.push({ x: c.x, y: s.y, z: c.z, alt: c.id, ...(c.r ? { altRichtung: c.r } : {}) });
        else if (n.id !== c.id || n.r !== c.r) ersetzen.push({ x: c.x, y: s.y, z: c.z, alt: c.id, neu: n.id, ...(c.r ? { altRichtung: c.r } : {}), ...(n.r ? { neuRichtung: n.r } : {}) });
      }
      for (const [k, n] of nachher) if (!vorher.has(k)) ergaenzen.push({ x: n.x, y: s.y, z: n.z, neu: n.id, ...(n.r ? { neuRichtung: n.r } : {}) });
      if (!entfernen.length && !ersetzen.length && !ergaenzen.length) continue; // nur der Abdruck hat sich geändert (z. B. Inhalt von Behältern), kein Block
      schichten.push({ abschnitt: a.id, y: s.y, entfernen: entfernen.sort(ordnung), ersetzen: ersetzen.sort(ordnung), ergaenzen: ergaenzen.sort(ordnung) });
    }
  }
  const summe = { entfernen: 0, ersetzen: 0, ergaenzen: 0, schichten: schichten.length };
  for (const s of schichten) { summe.entfernen += s.entfernen.length; summe.ersetzen += s.ersetzen.length; summe.ergaenzen += s.ergaenzen.length; }
  return { noetig: schichten.length > 0, schichten, summe };
}

/**
 * Übernahme einer neuen Fassung: Sind Umbauhinweise nötig, wird sie nur mit ausdrücklicher Bestätigung übernommen; sonst bleibt alles beim Alten (`bestaetigung-noetig`).
 * Der Fortschritt der alten Fassung geht mit: Haken unveränderter Schichten bleiben gültig (der Schlüssel enthält den Abdruck), die geänderten gebauten Schichten sind in der neuen
 * Fassung offen und werden nach den Hinweisen neu gebaut.
 * @returns {{status: 'uebernommen'|'bestaetigung-noetig', hinweise: object, fortschritt?: object}}
 */
export function uebernahme(alt, neu, fortschritt, { bestaetigt = false } = {}) {
  const h = hinweise(alt, neu, fortschritt);
  if (h.noetig && bestaetigt !== true) return { status: 'bestaetigung-noetig', hinweise: h };
  return { status: 'uebernommen', hinweise: h, fortschritt };
}

/** Kurzer deutscher Text zu einem Hinweis (für Anzeige und Baubericht). */
export function hinweisText(s) {
  const teile = [];
  if (s.entfernen.length) teile.push(`${s.entfernen.length} Blöcke entfernen`);
  if (s.ersetzen.length) teile.push(`${s.ersetzen.length} Blöcke ersetzen`);
  if (s.ergaenzen.length) teile.push(`${s.ergaenzen.length} Blöcke ergänzen`);
  return `Abschnitt ${s.abschnitt}, Höhe ${s.y}: ${teile.join(', ')}`;
}

/**
 * Setzt die geänderten, schon gebauten Schichten der neuen Fassung ausdrücklich auf OFFEN (mit einer höheren logischen Uhr als alle vorhandenen Einträge). Ein alter Haken für
 * denselben Abdruck (z. B. beim Zurückwechseln A → B → A) gilt damit auch nach einer Zusammenführung nicht wieder: die Schicht muss erst nach den Hinweisen umgebaut werden.
 * @returns {object} neuer Fortschritt
 */
export function offeneSchichten(fortschritt, neuPlan, h, von) {
  const schluessel = [];
  for (const s of h.schichten) {
    const a = neuPlan.abschnitte.find((x) => x.id === s.abschnitt);
    const t = a?.schichten.find((x) => x.y === s.y);
    if (t) schluessel.push(F.schluessel(a.id, t));
  }
  return schluessel.length ? F.haken(fortschritt, schluessel, false, von) : fortschritt;
}

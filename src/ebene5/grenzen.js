// Ebene 5 – Grenzen sichtbar machen (Paket U7 der Oberfläche, docs/plan-oberflaeche-bearbeiten.md): wie voll sind Änderungen, Spezifikation, Fortschritt, Raum und Link?
// Reines Modul ohne DOM: es rechnet nur aus den Zahlen, die die anderen Module als Grenzen führen (planfassung.js, live.js, teilen.js) – es erfindet keine eigenen Grenzen. Die Seite
// zeigt das Ergebnis und warnt rechtzeitig, damit nichts erst am Limit scheitert („zu groß für einen Link“, „der Raum lehnt ab“).
import { PF_GRENZEN } from './planfassung.js';
import { GRENZEN as RAUM } from './live.js';
import { EMPFOHLEN_MAX, CODE_MAX } from './teilen.js';

/** Ab diesem Anteil der Grenze gilt „warnen“, ab dem zweiten „voll“. */
export const WARN_AB = 0.7;
export const VOLL_AB = 0.95;

const stufeVon = (anteil) => (anteil >= VOLL_AB ? 'voll' : anteil >= WARN_AB ? 'warn' : 'ok');
/** Länge als JSON; nicht messbar (zyklisch o. Ä.) gilt als „voll“ (Maximalwert), nie als leer und damit scheinbar sicher. */
const laenge = (w) => { try { return JSON.stringify(w ?? null).length; } catch { return Number.MAX_SAFE_INTEGER; } };
const eintrag = (id, name, wert, grenze, einheit, hinweis) => {
  const anteil = grenze > 0 ? wert / grenze : 0;
  const stufe = stufeVon(anteil);
  return { id, name, wert, grenze, einheit, anteil, prozent: Math.min(999, Math.round(anteil * 100)), stufe, text: `${name}: ${wert} von ${grenze} ${einheit} (${Math.min(999, Math.round(anteil * 100))} %)${stufe === 'ok' ? '' : `. ${hinweis}`}` };
};

/**
 * @param {{spezifikation?: object|null, planfassung?: {eintraege: object}|null, fortschritt?: {eintraege: object}|null, spieler?: number|null, linkLaenge?: number|null}} q
 *   `linkLaenge`: Länge des Link-Codes (nur bekannt, wenn die Seite ihn berechnet hat; das Kodieren ist asynchron)
 * @returns {{eintraege: object[], stufe: 'ok'|'warn'|'voll'}}  alle Grenzen mit Anteil und Stufe, dazu die schlimmste Stufe
 */
export function grenzenAnsicht({ spezifikation = null, planfassung = null, fortschritt = null, spieler = null, linkLaenge = null } = {}) {
  const liste = [];
  const n = Object.keys(planfassung?.eintraege ?? {}).length;
  liste.push(eintrag('aenderungen', 'Änderungen', n, PF_GRENZEN.eintraege, 'Einträge', 'Mehr Änderungen nimmt weder ein Raum noch ein Link an; Verwaistes verwerfen oder die Datei statt des Links nutzen.'));
  liste.push(eintrag('aenderungen-groesse', 'Größe der Änderungen', laenge(planfassung?.eintraege ?? {}), PF_GRENZEN.groesse, 'Zeichen', 'Bei Erreichen lehnt der Raum weitere Änderungen ab.'));
  if (spezifikation) liste.push(eintrag('spezifikation', 'Spezifikation', laenge(spezifikation), RAUM.spezifikation, 'Zeichen', 'Der Raum nimmt größere Spezifikationen nicht an.'));
  if (fortschritt) liste.push(eintrag('fortschritt', 'Haken im Fortschritt', Object.keys(fortschritt.eintraege ?? {}).length, RAUM.eintraege, 'Einträge', 'Der Raum nimmt nicht mehr Haken an.'));
  if (Number.isInteger(spieler)) liste.push(eintrag('spieler', 'Spieler im Raum', spieler, RAUM.spieler, 'Spieler', 'Weitere Spieler werden abgewiesen.'));
  if (Number.isInteger(linkLaenge)) {
    const e = eintrag('link', 'Link', linkLaenge, CODE_MAX, 'Zeichen', 'Der Link wird zu lang; bitte als Datei sichern.');
    if (linkLaenge > EMPFOHLEN_MAX && e.stufe === 'ok') { e.stufe = 'warn'; e.text += `. Über ${EMPFOHLEN_MAX} Zeichen kürzen manche Chats Links ab; im Zweifel „Datei sichern“.`; }
    liste.push(e);
  }
  const rang = { ok: 0, warn: 1, voll: 2 };
  return { eintraege: liste, stufe: liste.reduce((s, e) => (rang[e.stufe] > rang[s] ? e.stufe : s), 'ok') };
}

/** Eine Meldung, wenn eine Grenze neu ins Warnen oder Volle kommt (damit die Seite nicht bei jedem Bau dieselbe Warnung zeigt). `vorher` ist das Ergebnis der letzten Ansicht oder null. */
export function neueWarnungen(vorher, jetzt) {
  const alt = new Map((vorher?.eintraege ?? []).map((e) => [e.id, e.stufe]));
  const rang = { ok: 0, warn: 1, voll: 2 };
  return jetzt.eintraege.filter((e) => rang[e.stufe] > (rang[alt.get(e.id) ?? 'ok'])).map((e) => e.text);
}

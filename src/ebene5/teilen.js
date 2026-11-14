// Ebene 5 – Teilen: Projekt (freigegebene Spezifikation), Fortschritt und manuelle Änderungen (Planfassung, P10) als Link oder Datei weitergeben.
// Der Empfänger baut aus der Spezifikation deterministisch denselben Plan; geteilt wird also nur die kleine Spezifikation, nicht der Entwurf.
// Dokumentierte Einschränkung (Entscheidung 5 des Bearbeitungsmodells): Der Link ist auch mit Änderungen auf CODE_MAX Zeichen begrenzt; wird er zu lang, sagt `kodiere`
// es klar und verweist auf die Datei (TEXT_MAX). Eine dauerhafte Ablage der Änderungen jenseits von Link, Datei und Live-Raum ist ein späteres Paket.
// Nur Web-Standards (CompressionStream, btoa/atob), keine Pakete. Link: <Adresse>#p=<deflate + base64url>.

import * as PF from './planfassung.js';
import { PROJEKT_ID } from '../ebene4/spezifikation.js';

export const TYP = 'blockwerk-projekt';
export const VERSION = 1;
/** Umschlag mit Zulassungen in den Änderungen (U6): ältere Versionen verstehen ihn nicht und lehnen ihn sichtbar ab, statt die Zulassungen beim Lesen zu verlieren. */
export const VERSION_MIT_ZULASSUNG = 2;
/** Ab dieser Länge des Codes schlägt die Oberfläche die Datei vor (Chat-Programme kürzen lange Links). */
export const EMPFOHLEN_MAX = 4000;
/** Grenzen für fremde Eingaben (Links, Dateien): größer ist kein Blockwerk-Projekt, sondern ein Fehler oder ein Angriff (Dekompressionsbombe). */
export const CODE_MAX = 200_000;
export const TEXT_MAX = 2 * 1024 * 1024;

/** Fehler beim Teilen oder Lesen eines Links oder einer Datei: Jonah bekommt den Grund im Klartext. */
export class TeilenFehler extends Error {
  constructor(nachricht) { super(`Teilen: ${nachricht}`); this.name = 'TeilenFehler'; }
}

async function strom(bytes, transformation) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(transformation)).arrayBuffer());
}
const komprimiere = (bytes) => strom(bytes, new CompressionStream('deflate-raw'));
/** Entkomprimiert in Stücken und bricht ab, sobald mehr als TEXT_MAX Bytes herauskommen (statt erst den ganzen Speicher zu füllen). */
async function entkomprimiere(bytes) {
  const leser = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const stuecke = [];
  let summe = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    summe += value.length;
    if (summe > TEXT_MAX) { await leser.cancel(); throw new TeilenFehler(`der Link ist zu groß (mehr als ${TEXT_MAX / 1024 / 1024} MB entpackt); ein Blockwerk-Projekt ist viel kleiner`); }
    stuecke.push(value);
  }
  const aus = new Uint8Array(summe);
  let pos = 0;
  for (const c of stuecke) { aus.set(c, pos); pos += c.length; }
  return aus;
}

function zuBase64Url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function ausBase64Url(text) {
  if (text.length > CODE_MAX) throw new TeilenFehler(`der Link ist zu lang (mehr als ${CODE_MAX} Zeichen)`);
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new TeilenFehler('der Link enthält ungültige Zeichen (vielleicht wurde er abgeschnitten)');
  const b = atob(text.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (text.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

/** Prüft die Form der geteilten Daten. */
function pruefe(d) {
  if (!d || d.typ !== TYP) throw new TeilenFehler('das ist kein Blockwerk-Projekt');
  if (d.version !== VERSION && d.version !== VERSION_MIT_ZULASSUNG) throw new TeilenFehler(`Version ${String(d.version)} wird nicht verstanden (erwartet ${VERSION} oder ${VERSION_MIT_ZULASSUNG}); bitte Blockwerk aktualisieren`);
  if (!d.spezifikation || typeof d.spezifikation !== 'object') throw new TeilenFehler('die Spezifikation fehlt');
  const kennung = d.spezifikation.projekt?.id;
  if (kennung !== undefined && !(typeof kennung === 'string' && PROJEKT_ID.test(kennung))) throw new TeilenFehler('die Projektkennung ist ungültig (erwartet p- und 32 Hexzeichen)');
  if (d.fortschritt !== undefined && (typeof d.fortschritt !== 'object' || d.fortschritt === null)) throw new TeilenFehler('der Fortschritt ist ungültig');
  if (d.aenderungen !== undefined) {
    try { d = { ...d, aenderungen: PF.pruefeForm(d.aenderungen) }; } catch (f) {
      if (f instanceof PF.PlanfassungFehler) throw new TeilenFehler(`die Änderungen sind ungültig: ${f.message}`);
      throw f;
    }
    if (d.version === VERSION && PF.enthaeltZulassung(d.aenderungen)) throw new TeilenFehler(`die Änderungen enthalten Zulassungen, tragen aber die Version ${VERSION}; ältere Versionen würden sie still entfernen. Erwartet wird Version ${VERSION_MIT_ZULASSUNG}`);
  }
  return d;
}

/** @param {{spezifikation: object, fortschritt?: object, aenderungen?: {version: number, eintraege: object}, name?: string}} projekt */
const paket = (projekt) => ({ typ: TYP, version: PF.enthaeltZulassung(projekt.aenderungen) ? VERSION_MIT_ZULASSUNG : VERSION, spezifikation: projekt.spezifikation, ...(projekt.fortschritt ? { fortschritt: projekt.fortschritt } : {}), ...(projekt.aenderungen && Object.keys(projekt.aenderungen.eintraege ?? {}).length ? { aenderungen: projekt.aenderungen } : {}) });

/** Kodiert ein Projekt für einen Link. @returns {Promise<{code: string, zuLang: boolean}>} */
export async function kodiere(projekt) {
  const bytes = new TextEncoder().encode(JSON.stringify(paket(projekt)));
  const code = zuBase64Url(await komprimiere(bytes));
  if (code.length > CODE_MAX) throw new TeilenFehler(`das Projekt ist für einen Link zu groß (${code.length} Zeichen, höchstens ${CODE_MAX}${projekt.aenderungen ? '; vielleicht sind es zu viele Änderungen' : ''}); bitte als Datei sichern`);
  return { code, zuLang: code.length > EMPFOHLEN_MAX };
}

/** Liest den Code eines Links. @returns {Promise<{spezifikation: object, fortschritt?: object, aenderungen?: object}>} */
export async function dekodiere(code) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(await entkomprimiere(ausBase64Url(code.trim()))); } catch (f) {
    if (f instanceof TeilenFehler) throw f;
    throw new TeilenFehler('der Link ist beschädigt oder unvollständig');
  }
  let d;
  try { d = JSON.parse(text); } catch { throw new TeilenFehler('der Inhalt des Links ist kein gültiges JSON'); }
  return pruefe(d);
}

/** Link aus Adresse und Projekt (ohne vorhandenen Fragmentteil). */
export async function link(adresse, projekt) {
  const { code, zuLang } = await kodiere(projekt);
  return { link: `${adresse.replace(/#.*$/, '')}#p=${code}`, zuLang };
}

/** Projekt aus einer Adresse mit „#p=…“ (oder null, wenn keins darin steckt). */
export async function ausLink(adresse) {
  const m = adresse.match(/#p=([^&]*)/);
  return m ? dekodiere(m[1]) : null;
}

/** Datei-Export (lesbares JSON) und -Import. */
export const exportDatei = (projekt) => JSON.stringify(paket(projekt), null, 2);
export function importDatei(text) {
  if (typeof text !== 'string' || text.length > TEXT_MAX) throw new TeilenFehler(`die Datei ist zu groß (mehr als ${TEXT_MAX / 1024 / 1024} MB)`);
  let d;
  try { d = JSON.parse(text); } catch { throw new TeilenFehler('die Datei ist kein gültiges JSON'); }
  return pruefe(d);
}

// Ebene 5 – Projektkennung (`projekt.id`): ein Projekt behält über alle Fassungen, Bearbeitungen, Export und Import und gemeinsame Räume dieselbe Kennung.
// Die Kennung ist Herkunft, nicht Inhalt: sie steckt nicht im Abdruck der Spezifikation (Freigabe bleibt gültig) und beeinflusst weder Planung noch Geometrie.
// Zufall gibt es hier nicht: die Oberfläche liefert die 16 Zufallsbytes, alles hier ist deterministisch und ohne Browser testbar.
import { PROJEKT_ID, abdruck, kopie } from '../ebene4/spezifikation.js';

export class ProjektIdFehler extends Error {
  constructor(nachricht) { super(`Projektkennung: ${nachricht}`); this.name = 'ProjektIdFehler'; }
}

/** Die gültige Kennung einer Spezifikation oder null (fehlt oder ungültig). */
export const idVon = (spec) => (typeof spec?.projekt?.id === 'string' && PROJEKT_ID.test(spec.projekt.id) ? spec.projekt.id : null);

/** Eine vorhandene, aber ungültige Kennung ist ein Fehler (sie wird nie stillschweigend ersetzt); nur ein fehlendes Feld ist Altbestand. */
export function pruefeKennung(spec) {
  const id = spec?.projekt?.id;
  if (id !== undefined && !(typeof id === 'string' && PROJEKT_ID.test(id))) throw new ProjektIdFehler(`die Projektkennung ${JSON.stringify(id)} hat nicht die Form p-<32 Hexzeichen>; bitte das Feld projekt.id entfernen (Blockwerk vergibt eine neue) oder korrigieren`);
}

/** Neue Kennung aus 16 Zufallsbytes (128 Bit): `p-` plus 32 Hexzeichen. */
export function neueId(bytes) {
  if (!bytes || bytes.length !== 16 || ![...bytes].every((b) => Number.isInteger(b) && b >= 0 && b <= 255)) throw new ProjektIdFehler('neue Kennungen brauchen genau 16 Zufallsbytes (0 bis 255)');
  return `p-${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Kopie der Spezifikation mit dieser Kennung (Version und Freigabe bleiben, weil die Kennung nicht im Abdruck steckt). */
export function mitId(spec, id) {
  if (typeof id !== 'string' || !PROJEKT_ID.test(id)) throw new ProjektIdFehler('Form p-<32 Hexzeichen> erwartet');
  if (spec === null || typeof spec !== 'object' || spec.projekt === null || typeof spec.projekt !== 'object') throw new ProjektIdFehler('die Spezifikation hat kein Projekt');
  const s = kopie(spec);
  s.projekt.id = id;
  return s;
}

/** Eigenständige Kopie eines Projekts: gleicher Inhalt, neue Kennung (eigener Fortschritt, eigene Änderungen, nie mit dem Original gemischt). */
export const eigenstaendigeKopie = (spec, bytes) => mitId(spec, neueId(bytes));

/**
 * Wie verhält sich eine ankommende Spezifikation (Datei, Link, Raum, Eingabe) zum geöffneten Projekt?
 * - `neu`: es ist noch nichts offen;
 * - `gleich`: dieselbe Kennung und derselbe Inhalt;
 * - `fortsetzung`: dieselbe Kennung, anderer Inhalt (neue Fassung desselben Projekts);
 * - `unabhaengig`: beide haben eine Kennung, sie sind verschieden (nie vermischen, auch bei gleichem Namen);
 * - `unklar`: bei mindestens einer Seite fehlt die Kennung (Altbestand): der Benutzer entscheidet (`nameGleich`, `inhaltGleich` helfen dabei).
 */
export function bezug(vorhanden, ankommend) {
  pruefeKennung(ankommend);
  if (!vorhanden) return { art: 'neu' };
  const a = idVon(vorhanden), b = idVon(ankommend);
  const inhaltGleich = abdruck(vorhanden) === abdruck(ankommend);
  if (a && b) return a === b ? { art: inhaltGleich ? 'gleich' : 'fortsetzung', inhaltGleich } : { art: 'unabhaengig', inhaltGleich };
  return { art: 'unklar', inhaltGleich, nameGleich: vorhanden.projekt?.name === ankommend.projekt?.name };
}

/**
 * Legt die Kennung der ankommenden Spezifikation fest.
 * @param {object|null} vorhanden  das geöffnete Projekt (oder null)
 * @param {object} ankommend  die ankommende Spezifikation
 * @param {{entscheidung?: 'fortsetzung'|'neu', bytes: Uint8Array|number[]}} optionen  `bytes` für eine neue Kennung; `entscheidung` bei `unklar` (sonst Fehler)
 * @returns {{spec: object, art: string, kennung: string, vergeben: boolean}}  `vergeben`: die Kennung wurde neu erzeugt (Altbestand übernommen)
 */
export function uebernehme(vorhanden, ankommend, { entscheidung, bytes } = {}) {
  pruefeKennung(ankommend);
  const b = bezug(vorhanden, ankommend);
  if (b.art === 'unklar' && !['fortsetzung', 'neu'].includes(entscheidung)) throw new ProjektIdFehler('es ist unklar, ob das eine Fortsetzung oder ein eigenständiges Projekt ist; der Benutzer muss entscheiden');
  const eigene = idVon(ankommend);
  if (b.art === 'unklar' && entscheidung === 'fortsetzung') {
    const id = idVon(vorhanden) ?? eigene;
    if (id) return { spec: mitId(ankommend, id), art: 'fortsetzung', kennung: id, vergeben: false };
    const neu = neueId(bytes); // beide Altbestand: die Fortsetzung bekommt eine Kennung, die das Projekt ab jetzt trägt
    return { spec: mitId(ankommend, neu), art: 'fortsetzung', kennung: neu, vergeben: true };
  }
  if (eigene && b.art !== 'unklar') return { spec: kopie(ankommend), art: b.art, kennung: eigene, vergeben: false };
  if (eigene) return { spec: kopie(ankommend), art: 'neu', kennung: eigene, vergeben: false }; // unklar, `neu` gewählt, aber die Kennung ist schon da und gehört der ankommenden Seite
  const neu = neueId(bytes);
  return { spec: mitId(ankommend, neu), art: b.art === 'unklar' ? 'neu' : b.art, kennung: neu, vergeben: true };
}

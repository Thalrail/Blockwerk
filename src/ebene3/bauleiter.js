// Ebene 3 – Bauleiter: überwacht alle Fachleute, steht außerhalb der Rangfolge und stellt Jonah eine konkrete Rückfrage mit Optionen,
// wenn sich ein Problem in höchstens N Runden nicht lösen lässt. Er ändert den Plan nie selbst.
import { haengeAn } from './bericht.js';

const OPTIONEN = [
  { id: 'aendern', text: 'Plan ändern: du nennst die Vorgabe (zum Beispiel neue Lage oder Größe), die Fachleute setzen sie um' },
  { id: 'zulassen', text: 'Einwand zulassen und weiterbauen (das Risiko bleibt und steht im Baubericht)' },
  { id: 'abschnitt-neu', text: 'Den Abschnitt neu planen lassen' },
];

const ort = (o) => (o ? `(${o.x}, ${o.y}, ${o.z})` : 'ohne Ort');

/** Erzeugt die Rückfrage zu einem eskalierten Einwand und trägt sie in Entwurf und Baubericht ein (verändert die übergebene Kopie). */
export function rueckfrage(entwurf, einwand, { runden }) {
  const id = `R${entwurf.zaehler.rueckfrage++}`;
  const frage = `${einwand.text} (bei ${ort(einwand.ort)}, Regel ${einwand.regel}). Wie soll es weitergehen?`;
  const r = { id, einwand: einwand.id, ort: einwand.ort, ziel: einwand.ziel ?? null, frage, optionen: OPTIONEN.map((o) => ({ ...o })) };
  entwurf.rueckfragen.push(r);
  haengeAn(entwurf, 'eskalation', { einwand: einwand.id, regel: einwand.regel, ort: einwand.ort, runden });
  haengeAn(entwurf, 'rueckfrage', { id, frage, optionen: r.optionen });
  return r;
}

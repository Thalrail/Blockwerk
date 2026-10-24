// Ebene 3 – Baubericht: lückenlose Liste aller Einwände, Änderungen und Entscheidungen. Nur anhängen, nie ändern.
// Jeder Eintrag hat eine laufende Nummer, einen maschinenlesbaren Teil (`daten`) und einen deutschen Satz für Jonah.

const ort = (o) => (o ? `(${o.x}, ${o.y}, ${o.z})` : 'ohne Ort');
const NAMEN = { techniker: 'Der Techniker', grobdesigner: 'Der Grobdesigner', architekt: 'Der Architekt', konstrukteur: 'Der Konstrukteur', designer: 'Der Designer', bauleiter: 'Der Bauleiter', jonah: 'Jonah' };
const name = (f) => NAMEN[f] ?? String(f);

/** Sätze je Art; `d` sind die Daten des Eintrags. */
const SAETZE = {
  einwand: (d) => `${name(d.von)} erhebt Einwand gegen ${d.ziel ?? 'den Plan'} bei ${ort(d.ort)}: ${d.text} (Regel ${d.regel}, zuständig: ${name(d.an).toLowerCase().replace('der ', '')}, Runde ${d.runde}).`,
  aenderung: (d) => `${name(d.von)} ändert ${d.ziel}: ${d.beschreibung}.`,
  abgelehnt: (d) => `Der Einwand ${d.einwand} gegen ${d.ziel} wird zurückgestellt: ${d.grund}.`,
  erledigt: (d) => `Der Einwand ${d.einwand} (${d.regel}) ist nach Runde ${d.runde} erledigt.`,
  eskalation: (d) => `Der Einwand ${d.einwand} (${d.regel}) bei ${ort(d.ort)} ist nach ${d.runden} Runden nicht gelöst; der Bauleiter fragt Jonah.`,
  rueckfrage: (d) => `Frage an Jonah (${d.id}): ${d.frage} Optionen: ${d.optionen.map((o, i) => `${i + 1}) ${o.text}`).join('; ')}.`,
  entscheidung: (d) => `${name(d.von)} entscheidet: ${d.text}.`,
  fixierung: (d) => `${name(d.von)} fixiert ${d.ziel}: ${d.text}.`,
  abschnitt: (d) => `Abschnitt ${d.abschnitt}: ${d.text}.`,
};

/** Hängt einen Eintrag an `entwurf.bericht` an (verändert den übergebenen Entwurf; gedacht für Kopien). */
export function haengeAn(entwurf, art, daten) {
  if (!SAETZE[art]) throw new Error(`Berichtsart unbekannt: ${art}`);
  const nr = entwurf.zaehler.bericht++;
  const eintrag = { nr, art, daten, satz: SAETZE[art](daten) };
  entwurf.bericht.push(eintrag);
  return eintrag;
}

/** Der Bericht als lesbarer Text, eine Zeile je Eintrag. */
export const berichtAlsText = (entwurf) => entwurf.bericht.map((e) => `${String(e.nr).padStart(3, '0')}  ${e.satz}`).join('\n');

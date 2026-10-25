// Ebene 5 – Fortschritt: Abhaken als mischbares Datenmodell (LWW-Map mit logischer Uhr), damit mehrere Spieler denselben Bauplan abhaken können.
// Schlüssel = Abschnitt + Höhe + Abdruck der Schicht: ändert sich eine Schicht durch eine neue Fassung, passt der Abdruck nicht mehr und der Haken verschwindet von selbst.
// Zusammenführen ist kommutativ, assoziativ und idempotent; ein Live-Dienst (später) muss nur Einträge austauschen. Keine Wanduhr, kein Zufall.

/** Fehler bei unbrauchbaren Fortschrittsdaten (z. B. aus einem Link oder einer Datei). */
export class FortschrittFehler extends Error {
  constructor(nachricht) { super(`Fortschritt: ${nachricht}`); this.name = 'FortschrittFehler'; }
}

export const leer = () => ({ eintraege: {}, uhr: 0 });
export const schluessel = (abschnittId, schicht) => `${abschnittId}|${schicht.y}|${schicht.abdruck}`;

/** Gesamtordnung der Einträge: höhere Uhr gewinnt, dann der Spielername, dann „abgehakt“ vor „offen“. */
function neuer(a, b) {
  if (a.uhr !== b.uhr) return a.uhr > b.uhr;
  if (a.von !== b.von) return a.von > b.von;
  return a.wert && !b.wert;
}

/** Prüft die Form (nach dem Laden) und liefert eine saubere Kopie. */
export function pruefe(f) {
  if (!f || typeof f !== 'object' || typeof f.eintraege !== 'object' || f.eintraege === null || !Number.isInteger(f.uhr) || f.uhr < 0) throw new FortschrittFehler('Form ungültig (eintraege, uhr)');
  const eintraege = {};
  for (const [k, e] of Object.entries(f.eintraege)) {
    if (!e || typeof e.wert !== 'boolean' || !Number.isInteger(e.uhr) || e.uhr < 1 || typeof e.von !== 'string') throw new FortschrittFehler(`Eintrag „${k}“ ungültig`);
    eintraege[k] = { wert: e.wert, uhr: e.uhr, von: e.von };
  }
  return { eintraege, uhr: f.uhr };
}

/** Setzt für alle Schlüssel den Wert (abgehakt oder nicht). Liefert einen neuen Fortschritt; die Uhr zählt hoch. */
export function haken(f, schluesselListe, wert, von) {
  if (typeof von !== 'string' || !von) throw new FortschrittFehler('Der Spielername fehlt');
  const uhr = f.uhr + 1;
  const eintraege = { ...f.eintraege };
  for (const k of schluesselListe) eintraege[k] = { wert: !!wert, uhr, von };
  return { eintraege, uhr };
}

/** Führt zwei Stände zusammen (der jüngere Eintrag je Schlüssel gewinnt). */
export function zusammenfuehren(a, b) {
  const eintraege = { ...a.eintraege };
  for (const [k, e] of Object.entries(b.eintraege)) {
    const x = eintraege[k];
    if (!x || neuer(e, x)) eintraege[k] = { ...e };
  }
  return { eintraege, uhr: Math.max(a.uhr, b.uhr) };
}

export const istAbgehakt = (f, k) => f.eintraege[k]?.wert === true;

/** Fortschritt eines Plans: Anteil der abgehakten Schichten und Blöcke, gesamt oder für einen Abschnitt. */
export function prozent(f, plan, abschnittId = null) {
  let schichten = 0, fertigeSchichten = 0, bloecke = 0, fertigeBloecke = 0;
  for (const a of plan.abschnitte) {
    if (abschnittId && a.id !== abschnittId) continue;
    for (const s of a.schichten) {
      schichten++; bloecke += s.n;
      if (istAbgehakt(f, schluessel(a.id, s))) { fertigeSchichten++; fertigeBloecke += s.n; }
    }
  }
  return { schichten, fertigeSchichten, bloecke, fertigeBloecke, anteil: bloecke ? fertigeBloecke / bloecke : 0 };
}

/** Die erste Schicht in Bau-Reihenfolge, die noch nicht abgehakt ist: {abschnitt, index} oder null. */
export function naechsteSchicht(f, plan) {
  for (let i = 0; i < plan.abschnitte.length; i++) {
    const a = plan.abschnitte[i];
    const j = a.schichten.findIndex((s) => !istAbgehakt(f, schluessel(a.id, s)));
    if (j >= 0) return { abschnitt: i, index: j };
  }
  return null;
}

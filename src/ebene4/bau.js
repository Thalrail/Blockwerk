// Ebene 4 – Klebestelle zur Planung: aus der freigegebenen Spezifikation wird gebaut (Ebene 3 übersetzt und plant), bei einer neuen Version wird neu geplant.
// Ab der Freigabe ist alles deterministisch. Ohne Freigabe oder mit offenen Rückfragen wird nichts gebaut.

/** Fehler: Die Spezifikation ist nicht freigegeben (oder wurde nach der Freigabe geändert). */
export class BauFehler extends Error {
  constructor(nachricht) { super(`Bau: ${nachricht}`); this.name = 'BauFehler'; }
}

/**
 * @param {{ebene3: object, versionen: object, abgleich: {abgleich: Function}}} quellen
 */
export function erzeugeBau({ ebene3, versionen, abgleich }) {
  /** Prüft Freigabe und Abgleich, übersetzt in die Vorgabe. */
  function vorbereiten(spec, messungen = []) {
    if (!versionen.istFreigegeben(spec)) throw new BauFehler('Die Spezifikation ist nicht freigegeben (oder nach der Freigabe geändert worden).');
    const a = abgleich.abgleich(spec, messungen);
    if (a.rueckfragen.length) return { status: 'rueckfragen', rueckfragen: a.rueckfragen, hinweise: a.hinweise };
    const u = ebene3.uebersetzung.uebersetze(spec);
    if (u.rueckfragen.length) return { status: 'rueckfragen', rueckfragen: u.rueckfragen, hinweise: u.hinweise };
    return { status: 'bereit', vorgabe: u.vorgabe, hinweise: [...a.hinweise, ...u.hinweise] };
  }

  /** Baut aus der freigegebenen Spezifikation: Übersetzung, dann der ganze Ablauf der Planung. */
  function baue(spec, messungen = [], optionen = {}) {
    const v = vorbereiten(spec, messungen);
    if (v.status !== 'bereit') return v;
    return { ...ebene3.ablauf.starte(v.vorgabe, optionen), hinweise: v.hinweise, vorgabe: v.vorgabe };
  }

  /** Wendet eine neue Version der Spezifikation auf einen vorhandenen Entwurf an: der Konstrukteur plant nur neu, was sich ändert. */
  function aktualisiere(entwurf, neueSpec, messungen = [], optionen = {}) {
    const v = vorbereiten(neueSpec, messungen);
    if (v.status !== 'bereit') return v;
    return { ...ebene3.ablauf.aktualisiere(entwurf, v.vorgabe, optionen), hinweise: v.hinweise, vorgabe: v.vorgabe };
  }

  return { baue, aktualisiere, vorbereiten, BauFehler };
}

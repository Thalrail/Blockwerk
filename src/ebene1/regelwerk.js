// Ebene 1 – Regelwerk als Daten: jede Bedrock-Regel einzeln, mit Quelle und Status.
// Status: entworfen → simuliert (Test in Ebene 1 bestanden) → geprüft (nur wenn Jonah es im Spiel bestätigt hat).
// `ungeprueft: true` heißt: die Regel stützt sich auf eine Annahme und braucht eine Testanleitung für Jonah.
export const STATI = Object.freeze(['entworfen', 'simuliert', 'geprüft']);

function pruefeRegel(r) {
  const wo = `Regel ${String(r?.id)}`;
  const fehler = (m) => { throw new Error(`${wo}: ${m}`); };
  if (!r || typeof r !== 'object') throw new Error('Regel ist kein Objekt');
  for (const k of ['id', 'titel', 'regel', 'quelle', 'status']) if (typeof r[k] !== 'string' || !r[k].trim()) fehler(`Feld "${k}" fehlt`);
  if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(r.id)) fehler('id muss die Form bereich.name haben');
  if (!/https?:\/\//.test(r.quelle)) fehler('quelle braucht einen Link (https://…) – ohne Quelle keine Regel');
  if (!STATI.includes(r.status)) fehler(`Status "${r.status}" ungültig`);
  if (typeof r.ungeprueft !== 'boolean') fehler('ungeprueft muss true/false sein');
  if (r.parameter === null || typeof r.parameter !== 'object' || Array.isArray(r.parameter)) fehler('parameter muss ein Objekt sein');
  if (r.ungeprueft && !(typeof r.testanleitung === 'string' && r.testanleitung.length > 20)) fehler('ungeprüfte Regel braucht eine Testanleitung');
  if (r.status === 'simuliert' && !/^test\/.+\.test\.js::.+/.test(r.simulationstest ?? '')) {
    fehler('Status "simuliert" braucht simulationstest im Format test/datei.test.js::Testname');
  }
  if (r.status === 'geprüft') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.geprueftAm ?? '')) fehler('„geprüft“ braucht geprueftAm (Datum)');
    if (!(typeof r.beobachtung === 'string' && r.beobachtung.length > 10)) fehler('„geprüft“ braucht eine Beobachtung von Jonah');
    if (r.ungeprueft) fehler('eine geprüfte Regel kann nicht zugleich ungeprüft sein');
  }
}

export class Regelwerk {
  /** @param {object[]} dateien Inhalte der Dateien aus data/regeln/*.json ({bereich, regeln:[…]}) */
  constructor(dateien) {
    this._regeln = new Map();
    for (const d of dateien) {
      if (!d || !Array.isArray(d.regeln) || typeof d.bereich !== 'string') throw new Error('Regeldatei ungültig');
      for (const r of d.regeln) {
        pruefeRegel(r);
        if (!r.id.startsWith(`${d.bereich}.`)) throw new Error(`Regel ${r.id} gehört nicht in den Bereich ${d.bereich}`);
        if (this._regeln.has(r.id)) throw new Error(`Regel ${r.id} doppelt`);
        this._regeln.set(r.id, r);
      }
    }
  }

  hat(id) {
    return this._regeln.has(id);
  }

  regel(id) {
    const r = this._regeln.get(id);
    if (!r) throw new Error(`Unbekannte Regel: ${id}`);
    return r;
  }

  /** Wert eines Parameters einer Regel; wirft bei unbekanntem Namen. */
  parameter(id, name) {
    const p = this.regel(id).parameter;
    if (!Object.hasOwn(p, name)) throw new Error(`Regel ${id} hat keinen Parameter "${name}"`);
    return p[name];
  }

  alle() {
    return [...this._regeln.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  nachStatus(status) {
    return this.alle().filter((r) => r.status === status);
  }

  /** Regeln, die Jonah im Spiel prüfen soll (ungeprüft), mit Testanleitung. */
  offeneTests() {
    return this.alle().filter((r) => r.ungeprueft).map((r) => ({ id: r.id, titel: r.titel, testanleitung: r.testanleitung }));
  }
}

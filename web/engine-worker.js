// Blockwerk – Engine im Hintergrund (Modul-Worker): lädt die Daten per fetch und rechnet Spezifikation → Plan → Bauplan,
// damit die Seite während der mehrsekündigen Berechnung bedienbar bleibt. Die Oberfläche bekommt nur fertige, einfache Daten.
import { ladeEngine, erzeugeEbene5 } from '../src/ebene5/index.js';
import { berichtAlsText } from '../src/ebene3/index.js';
import { eingabe as eingabeModul } from '../src/ebene5/index.js';
import { liesJson, abdruck } from '../src/ebene4/index.js';

const wurzel = new URL('../', import.meta.url);
const holeJson = async (pfad) => {
  const r = await fetch(new URL(pfad, wurzel));
  if (!r.ok) throw new Error(`${pfad} konnte nicht geladen werden (${r.status})`);
  return r.json();
};

let bereit = null;
async function engine() {
  bereit ??= (async () => {
    const e = await ladeEngine(holeJson);
    const e5 = erzeugeEbene5({ ebene0: e.ebene0, ebene3: e.ebene3, darstellungsdaten: await holeJson('data/darstellung.json') });
    return { ...e, e5 };
  })();
  return bereit;
}

/** Status der Regeln und Bausteine für die Anzeige (entworfen / simuliert / geprüft, ungeprüfte Annahmen). */
function status(e) {
  const regeln = e.ebene1.regelwerk.alle();
  const zaehl = { entworfen: 0, simuliert: 0, geprueft: 0, ungeprueft: 0 };
  for (const r of regeln) { zaehl[r.status] = (zaehl[r.status] ?? 0) + 1; if (r.ungeprueft) zaehl.ungeprueft++; }
  const bausteine = [...e.ebene2.bausteine.values()].map((b) => ({ id: b.id, titel: b.titel, status: b.status ?? 'entworfen' })).sort((a, b) => (a.id < b.id ? -1 : 1));
  return { regeln: zaehl, anzahlRegeln: regeln.length, bausteine };
}

/** Eingabe (Teil 6c): alles läuft über src/ebene5/eingabe.js, die Seite bekommt nur einfache Daten. */
async function eingabe(data) {
  const e = await engine();
  const E = eingabeModul;
  if (data.typ === 'briefing') return { typ: 'briefing', text: e.ebene4.briefing({ text: data.wunsch ?? '', messungen: data.messungen ?? [] }) };
  if (data.typ === 'pruefe') {
    let spec = data.spezifikation;
    if (data.text !== undefined) spec = liesJson(data.text);
    // von Hand bearbeitet: ändert sich der Inhalt gegenüber der letzten Fassung, ist es eine neue Version (die Freigabe entfällt)
    if (data.bearbeitet && data.vorher && abdruck(spec) !== abdruck(data.vorher)) { spec.version = data.vorher.version; spec = e.ebene4.neueVersion(spec); }
    return { typ: 'geprueft', spezifikation: spec, ...E.pruefeAlles(e, spec, data.messungen ?? [], data.ignoriert ?? []), vergleich: data.vorher ? e.ebene4.vergleiche(data.vorher, spec) : null };
  }
  if (data.typ === 'antworte') {
    const frage = E.pruefeAlles(e, data.spezifikation, data.messungen ?? [], data.ignoriert ?? []).rueckfragen.find((q) => q.id === data.frageId);
    if (!frage) throw new Error('Diese Frage gibt es nicht mehr. Bitte neu prüfen.');
    const a = E.antworte(e, data.spezifikation, frage, data.option, data.ignoriert ?? []);
    return { typ: 'geprueft', art: a.art, spezifikation: a.spec, ignoriert: a.ignoriert, ...E.pruefeAlles(e, a.spec, data.messungen ?? [], a.ignoriert), vergleich: data.vorher ? e.ebene4.vergleiche(data.vorher, a.spec) : null };
  }
  if (data.typ === 'messe') return { typ: 'gemessen', messung: E.messeBild(e, { breite: data.breite, hoehe: data.hoehe, daten: new Uint8ClampedArray(data.daten) }, data.optionen) };
  if (data.typ === 'freigebe') return { typ: 'freigegeben', spezifikation: e.ebene4.freigeben(data.spezifikation, data.von, data.messungen ?? []) };
  return null;
}

async function baue(spezifikation, messungen = []) {
  const e = await engine();
  self.postMessage({ typ: 'status', text: 'Spezifikation wird geprüft …' });
  const r = e.ebene4.baue(spezifikation, messungen);
  if (r.status === 'rueckfragen') return { typ: 'rueckfragen', rueckfragen: r.rueckfragen };
  self.postMessage({ typ: 'status', text: 'Bauplan wird angelegt …' });
  const plan = e.e5.bauplan(r.entwurf);
  return {
    typ: 'fertig', status: r.status, plan, material: e.e5.material(plan),
    bericht: berichtAlsText(r.entwurf), zusammenfassung: e.ebene4.zusammenfassung(spezifikation),
    rueckfragenOffen: r.rueckfragen, anfragen: r.offeneAnfragen, baustatus: status(e),
  };
}

self.onmessage = async ({ data }) => {
  try {
    if (data.typ === 'baue') self.postMessage(await baue(data.spezifikation, data.messungen));
    else { const antwort = await eingabe(data); if (antwort) self.postMessage({ ...antwort, anfrage: data.anfrage }); }
  } catch (f) {
    self.postMessage({ typ: 'fehler', text: String(f?.message ?? f), anfrage: data?.anfrage });
  }
};

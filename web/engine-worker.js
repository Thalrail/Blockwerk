// Blockwerk – Engine im Hintergrund (Modul-Worker): lädt die Daten per fetch und rechnet Spezifikation → Plan → Bauplan,
// damit die Seite während der mehrsekündigen Berechnung bedienbar bleibt. Die Oberfläche bekommt nur fertige, einfache Daten.
import { ladeEngine, erzeugeEbene5, bauePlan, erzeugeEntwurfsspeicher } from '../src/ebene5/index.js';
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
    const texturen = await holeJson('data/texturen.json').catch(() => null); // ohne Index zeigt die Seite markierte Ersatzfarben
    const e5 = erzeugeEbene5({ ebene0: e.ebene0, ebene3: e.ebene3, darstellungsdaten: await holeJson('data/darstellung.json'), texturen });
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

const merker = erzeugeEntwurfsspeicher(); // Entwurf des fertig gebauten Plans des neuesten Auftrags (eigene Erzeugungsnummer, unabhängig von `lauf`)

async function baue(spezifikation, messungen = [], lauf, aenderungen = null, erzeugung) {
  const e = await engine();
  self.postMessage({ typ: 'status', text: 'Spezifikation wird geprüft …', lauf });
  const r = bauePlan(e, spezifikation, messungen, aenderungen); // manuelle Änderungen (Planfassung) fließen in den wirksamen Plan ein
  if (r.status === 'rueckfragen') return { typ: 'rueckfragen', rueckfragen: r.rueckfragen };
  self.postMessage({ typ: 'status', text: 'Bauplan wird angelegt …', lauf });
  const plan = e.e5.bauplan(r.entwurf);
  merker.setze(erzeugung, { entwurf: r.entwurf, mat: null }); // nie ein überholter Auftrag // für die Zellenwahl (Klick auf eine Zelle): derselbe Entwurf wie der angezeigte Plan
  return {
    typ: 'fertig', status: r.status, plan, material: e.e5.material(plan),
    bericht: berichtAlsText(r.entwurf), zusammenfassung: e.ebene4.zusammenfassung(spezifikation),
    rueckfragenOffen: r.rueckfragen, anfragen: r.offeneAnfragen, baustatus: status(e),
  };
}

/** Zellenwahl (U2): welchem Teil gehört die angeklickte Weltzelle, und wie heißt sie im Rahmen des Teils? Rechnet Ebene 3 am zuletzt gebauten Entwurf. */
async function waehleZelle(zelle) {
  const e = await engine();
  const letzter = merker.hole();
  if (!letzter) throw new Error('Es gibt noch keinen Bauplan, in dem sich eine Zelle wählen ließe.');
  letzter.mat ??= e.ebene3.materialisiere(letzter.entwurf);
  return e.ebene3.zellenwahl.waehle(letzter.entwurf, zelle, { mat: letzter.mat });
}

self.onmessage = async ({ data }) => {
  try {
    if (data.typ === 'baue') self.postMessage({ ...(await baue(data.spezifikation, data.messungen, data.lauf, data.aenderungen, merker.beginne())), lauf: data.lauf }); // beginne(): ab jetzt gilt nur noch der Plan dieses Auftrags // `lauf` zeigt der Seite, zu welchem Auftrag die Antwort gehört
    else if (data.typ === 'waehleZelle') self.postMessage({ typ: 'zelle', ...(await waehleZelle(data.zelle)), anfrage: data.anfrage, lauf: data.lauf });
    else { const antwort = await eingabe(data); if (antwort) self.postMessage({ ...antwort, anfrage: data.anfrage }); }
  } catch (f) {
    self.postMessage({ typ: 'fehler', text: String(f?.message ?? f), anfrage: data?.anfrage, lauf: data?.lauf });
  }
};

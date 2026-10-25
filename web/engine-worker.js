// Blockwerk – Engine im Hintergrund (Modul-Worker): lädt die Daten per fetch und rechnet Spezifikation → Plan → Bauplan,
// damit die Seite während der mehrsekündigen Berechnung bedienbar bleibt. Die Oberfläche bekommt nur fertige, einfache Daten.
import { ladeEngine, erzeugeEbene5 } from '../src/ebene5/index.js';
import { berichtAlsText } from '../src/ebene3/index.js';

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

async function baue(spezifikation) {
  const e = await engine();
  self.postMessage({ typ: 'status', text: 'Spezifikation wird geprüft …' });
  const r = e.ebene4.baue(spezifikation);
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
    if (data.typ === 'baue') self.postMessage(await baue(data.spezifikation));
  } catch (f) {
    self.postMessage({ typ: 'fehler', text: String(f?.message ?? f) });
  }
};

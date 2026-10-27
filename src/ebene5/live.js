// Ebene 5 – Live-Abhaken: Protokoll und Raumlogik für gemeinsames Abhaken mit Freunden (Teil 6e).
// Alles Fachliche steht hier und läuft in Node-Tests; der Dienst (dienst/worker.js, tools/live-lokal.js) ist nur Verdrahtung, die Seite (web/live.js) nur Anzeige.
// Ein Raum hält die freigegebene Spezifikation (mit Version) und den Fortschritt (mischbare LWW-Map aus fortschritt.js). Haken werden gemischt, nie überschrieben;
// eine neue Planversion wird nur angenommen, wenn der Absender den aktuellen Stand kannte (`basis`) und die Freigabe zum Inhalt passt – sonst wird sie abgelehnt.
// Der Raum ändert sich bei einer Ablehnung nie. Deterministisch: keine Uhr, kein Zufall (die Raum-Nummer erzeugt die Seite).
import * as F from './fortschritt.js';
import { abdruck } from '../ebene4/spezifikation.js';

/** Grenzen (ein Ort für Dienst und Seite). */
export const GRENZEN = Object.freeze({ spezifikation: 200_000, spieler: 12, eintraege: 5_000, name: 24, nachricht: 262_144, verfallTage: 30, uhrMax: 1_000_000_000, uhrSprung: 100_000 });
/** Schlüssel eines Hakens: Abschnitt|Höhe|Abdruck der Schicht (siehe fortschritt.schluessel). Alles andere ist Müll und füllt nur den Raum. */
const SCHLUESSEL = /^[^|\s]{1,64}\|-?\d{1,4}\|[0-9a-f]{1,16}$/;
const ARTEN = ['hallo', 'haken', 'plan', 'ping'];

/** Fehler bei einer unbrauchbaren Nachricht (der Dienst antwortet mit „abgelehnt“). */
export class LiveFehler extends Error {
  constructor(grund, nachricht) { super(nachricht); this.name = 'LiveFehler'; this.grund = grund; }
}

const istObjekt = (w) => w !== null && typeof w === 'object' && !Array.isArray(w);
const kopie = (w) => structuredClone(w);

export const neuerRaum = () => ({ spezifikation: null, fortschritt: F.leer(), spieler: {} });
export const spielerListe = (raum) => Object.values(raum.spieler).map((s) => s.name).sort();
const version = (raum) => raum.spezifikation?.version ?? 0;
const zustandVon = (raum) => ({ typ: 'zustand', spezifikation: raum.spezifikation, fortschritt: raum.fortschritt, spieler: spielerListe(raum) });

/** Liest den Text einer Nachricht (Größe und Form werden geprüft, bevor etwas geparst wird, das groß sein könnte). */
export function liesNachricht(text) {
  if (typeof text !== 'string') throw new LiveFehler('form', 'Nachricht ist kein Text');
  if (text.length > GRENZEN.nachricht) throw new LiveFehler('zu-gross', 'Nachricht ist zu groß');
  let m;
  try { m = JSON.parse(text); } catch { throw new LiveFehler('form', 'Nachricht ist kein gültiges JSON'); }
  if (!istObjekt(m) || !ARTEN.includes(m.typ)) throw new LiveFehler('unbekannt', `unbekannte Nachrichtenart${istObjekt(m) && typeof m.typ === 'string' ? ` „${m.typ.slice(0, 20)}“` : ''}`);
  return m;
}

const abgelehnt = (raum, grund, text) => ({ raum, senden: [{ an: 'absender', nachricht: { typ: 'abgelehnt', grund, text, version: version(raum) } }] });

/** Prüft die Freigabe: gehört zu genau diesem Inhalt und dieser Version. */
function freigegeben(spec) {
  return istObjekt(spec) && Number.isInteger(spec.version) && spec.version >= 1 && istObjekt(spec.freigabe)
    && spec.freigabe.version === spec.version && spec.freigabe.abdruck === abdruck(spec);
}

/**
 * Verarbeitet eine geprüfte Nachricht. Gibt den neuen Raum und die zu sendenden Nachrichten zurück: `an` ist 'absender', 'andere' oder 'alle'.
 * Bei Ablehnung ist der Raum derselbe wie vorher.
 * @param {ReturnType<typeof neuerRaum>} raum
 * @param {object} m  Nachricht (Form schon über liesNachricht geprüft)
 * @param {string} absender  Kennung der Verbindung
 */
export function verarbeite(raum, m, absender) {
  if (!istObjekt(m) || !ARTEN.includes(m.typ)) return abgelehnt(raum, 'unbekannt', 'unbekannte Nachrichtenart');
  if (m.typ === 'ping') return { raum, senden: [{ an: 'absender', nachricht: { typ: 'pong' } }] };

  if (m.typ === 'hallo') {
    const name = typeof m.name === 'string' ? m.name.trim() : '';
    if (!name || name.length > GRENZEN.name) return abgelehnt(raum, 'name', `Der Name muss 1 bis ${GRENZEN.name} Zeichen lang sein`);
    if (!raum.spieler[absender] && Object.keys(raum.spieler).length >= GRENZEN.spieler) return abgelehnt(raum, 'voll', `Im Raum sind höchstens ${GRENZEN.spieler} Spieler`);
    const neu = { ...raum, spieler: { ...raum.spieler, [absender]: { name } } };
    return { raum: neu, senden: [{ an: 'absender', nachricht: zustandVon(neu) }, { an: 'andere', nachricht: { typ: 'spieler', spieler: spielerListe(neu), neu: name } }] };
  }
  if (!raum.spieler[absender]) return abgelehnt(raum, 'hallo', 'Bitte zuerst anmelden (hallo)');

  if (m.typ === 'haken') {
    if (!istObjekt(m.eintraege)) return abgelehnt(raum, 'form', 'haken braucht eintraege');
    const schluessel = Object.keys(m.eintraege);
    // Schlüssel und Uhren sind fremde Eingabe: eine riesige Uhr würde jeden späteren Haken überstimmen und die Uhr aller Spieler vergiften, Müllschlüssel füllen den Raum.
    const obergrenze = Math.min(GRENZEN.uhrMax, raum.fortschritt.uhr + GRENZEN.uhrSprung);
    for (const k of schluessel) {
      if (!SCHLUESSEL.test(k)) return abgelehnt(raum, 'schluessel', 'Ungültiger Schlüssel (erwartet: Abschnitt|Höhe|Abdruck)');
      const e = m.eintraege[k];
      if (Number.isInteger(e?.uhr) && e.uhr > obergrenze) return abgelehnt(raum, 'uhr', 'Die Uhr eines Hakens liegt unmöglich weit vor dem Raum');
      if (typeof e?.von === 'string' && e.von.length > GRENZEN.name) return abgelehnt(raum, 'form', 'Der Name eines Hakens ist zu lang');
    }
    let eingang;
    try {
      const uhr = schluessel.reduce((x, k) => (Number.isInteger(m.eintraege[k]?.uhr) ? Math.max(x, m.eintraege[k].uhr) : x), 0);
      eingang = F.pruefe({ eintraege: m.eintraege, uhr });
    } catch (f) { return abgelehnt(raum, 'form', f.message); }
    const alt = raum.fortschritt, neu = F.zusammenfuehren(alt, eingang);
    if (Object.keys(neu.eintraege).length > GRENZEN.eintraege) return abgelehnt(raum, 'zu-gross', `Im Raum sind höchstens ${GRENZEN.eintraege} Haken`);
    const gleich = (a, b) => a && b && a.wert === b.wert && a.uhr === b.uhr && a.von === b.von;
    const geaendert = {}, zurueck = {};
    for (const k of schluessel) {
      if (!gleich(alt.eintraege[k], neu.eintraege[k])) geaendert[k] = neu.eintraege[k];
      else if (!gleich(eingang.eintraege[k], neu.eintraege[k])) zurueck[k] = neu.eintraege[k]; // der Raum kennt Neueres: dem Absender sagen
    }
    const senden = [];
    if (Object.keys(geaendert).length) senden.push({ an: 'andere', nachricht: { typ: 'eintraege', eintraege: geaendert, von: raum.spieler[absender].name } });
    if (Object.keys(zurueck).length) senden.push({ an: 'absender', nachricht: { typ: 'eintraege', eintraege: zurueck, von: null } });
    return { raum: Object.keys(geaendert).length ? { ...raum, fortschritt: neu } : raum, senden };
  }

  // plan
  const spec = m.spezifikation;
  if (!Number.isInteger(m.basis) || m.basis < 0) return abgelehnt(raum, 'form', 'plan braucht basis (die Version, die du kennst)');
  if (m.basis !== version(raum)) return { raum, senden: [{ an: 'absender', nachricht: { typ: 'abgelehnt', grund: 'veraltet', text: `Im Raum gilt schon Version ${version(raum)}`, version: version(raum), spezifikation: raum.spezifikation } }] };
  if (!istObjekt(spec)) return abgelehnt(raum, 'form', 'plan braucht eine Spezifikation');
  if (JSON.stringify(spec).length > GRENZEN.spezifikation) return abgelehnt(raum, 'zu-gross', `Die Spezifikation ist größer als ${GRENZEN.spezifikation} Zeichen`);
  if (!freigegeben(spec)) return abgelehnt(raum, 'freigabe', 'Nur freigegebene Spezifikationen können in den Raum (die Freigabe passt nicht zum Inhalt)');
  if (spec.version <= version(raum)) return abgelehnt(raum, 'version', `Die neue Version muss größer als ${version(raum)} sein`);
  const neu = { ...raum, spezifikation: kopie(spec) };
  return { raum: neu, senden: [{ an: 'andere', nachricht: { typ: 'plan', von: raum.spieler[absender].name, spezifikation: neu.spezifikation } }, { an: 'absender', nachricht: { typ: 'plan-angenommen', version: spec.version } }] };
}

/**
 * Wer bekommt was? Macht aus `senden` Zustellungen {an: Verbindung, nachricht}. Nur angemeldete Spieler bekommen Rundsendungen („andere“, „alle“);
 * der Absender bekommt nur, was an ihn selbst geht. Einmal hier, damit jeder Dienst (Cloudflare, Probedienst) gleich zustellt.
 * @param {ReturnType<typeof neuerRaum>} raum  der Raum NACH der Verarbeitung
 */
export function zustellungen(raum, senden, absender) {
  const aus = [];
  for (const s of senden) {
    if (s.an === 'absender') aus.push({ an: absender, nachricht: s.nachricht });
    else for (const id of Object.keys(raum.spieler)) if (s.an === 'alle' || id !== absender) aus.push({ an: id, nachricht: s.nachricht });
  }
  return aus;
}

/** Eine Verbindung geht weg. */
export function austritt(raum, absender) {
  if (!raum.spieler[absender]) return { raum, senden: [] };
  const { [absender]: weg, ...rest } = raum.spieler;
  const neu = { ...raum, spieler: rest };
  return { raum: neu, senden: [{ an: 'andere', nachricht: { typ: 'spieler', spieler: spielerListe(neu), weg: weg.name } }] };
}

/**
 * Anteil der Seite: hält den lokalen Stand und macht aus Ereignissen des Dienstes Meldungen für die Anzeige. Sendet nie selbst; die Seite reicht die Nachrichten weiter.
 * @param {{name: string, fortschritt?: object}} start
 */
export function erzeugeKlient({ name, fortschritt = F.leer() }) {
  const z = { name, fortschritt, gesendet: {}, raumVersion: 0, spieler: [], vorschlag: null };
  const gleich = (a, b) => a && b && a.wert === b.wert && a.uhr === b.uhr && a.von === b.von;
  /** Alle Einträge, die der Raum noch nicht von uns kennt. */
  const neuesVon = (f) => Object.fromEntries(Object.entries(f.eintraege).filter(([k, e]) => !gleich(z.gesendet[k], e)));
  return {
    zustand: z,
    /** Beim (Wieder-)Verbinden: anmelden, danach den ganzen lokalen Stand schicken (die LWW-Map verträgt Wiederholungen). */
    verbunden() { z.gesendet = {}; return [{ typ: 'hallo', name: z.name }]; },
    /** Lokal wurde abgehakt: nur Geändertes senden (oder nichts). */
    lokalGeaendert(f) {
      z.fortschritt = f;
      const neu = neuesVon(f);
      if (!Object.keys(neu).length) return [];
      Object.assign(z.gesendet, kopie(neu));
      return [{ typ: 'haken', eintraege: neu }];
    },
    /** Eine neue Planversion für den Raum (der Absender nennt die Version, die er kennt). */
    planVeroeffentlichen(spec) { return [{ typ: 'plan', basis: z.raumVersion, spezifikation: spec }]; },
    /** Antwort des Dienstes verarbeiten. Gibt Meldungen für die Anzeige zurück und Nachrichten, die gesendet werden müssen. */
    beiNachricht(m) {
      const meldungen = [], senden = [];
      if (m.typ === 'zustand') {
        z.spieler = m.spieler;
        z.raumVersion = m.spezifikation?.version ?? 0;
        const merged = F.zusammenfuehren(z.fortschritt, F.pruefe(m.fortschritt));
        const mein = neuesVon(merged); // lokal Neueres geht jetzt in den Raum
        for (const [k, e] of Object.entries(m.fortschritt.eintraege)) if (gleich(merged.eintraege[k], e)) z.gesendet[k] = e;
        z.fortschritt = merged;
        if (Object.keys(mein).length) { Object.assign(z.gesendet, kopie(mein)); senden.push({ typ: 'haken', eintraege: mein }); }
        meldungen.push({ art: 'zustand', spezifikation: m.spezifikation ?? null, fortschritt: merged });
      } else if (m.typ === 'eintraege') {
        const eingang = F.pruefe({ eintraege: m.eintraege, uhr: Math.max(0, ...Object.values(m.eintraege).map((e) => e.uhr)) });
        z.fortschritt = F.zusammenfuehren(z.fortschritt, eingang);
        for (const [k, e] of Object.entries(eingang.eintraege)) if (gleich(z.fortschritt.eintraege[k], e)) z.gesendet[k] = e;
        meldungen.push({ art: 'haken', von: m.von, eintraege: eingang.eintraege, fortschritt: z.fortschritt });
      } else if (m.typ === 'spieler') {
        z.spieler = m.spieler;
        meldungen.push({ art: 'spieler', spieler: m.spieler, neu: m.neu ?? null, weg: m.weg ?? null });
      } else if (m.typ === 'plan') {
        z.raumVersion = m.spezifikation.version;
        z.vorschlag = { von: m.von, spezifikation: m.spezifikation };
        meldungen.push({ art: 'vorschlag', von: m.von, version: m.spezifikation.version, spezifikation: m.spezifikation });
      } else if (m.typ === 'plan-angenommen') {
        z.raumVersion = m.version;
        meldungen.push({ art: 'plan-angenommen', version: m.version });
      } else if (m.typ === 'abgelehnt') {
        if (m.grund === 'veraltet') z.raumVersion = m.version;
        meldungen.push({ art: 'abgelehnt', grund: m.grund, text: m.text, version: m.version, spezifikation: m.spezifikation ?? null });
      }
      return { meldungen, senden };
    },
    /** Der Vorschlag wurde übernommen oder verworfen. */
    vorschlagErledigt() { z.vorschlag = null; },
  };
}

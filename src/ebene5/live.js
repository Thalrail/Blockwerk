// Ebene 5 – Live-Abhaken: Protokoll und Raumlogik für gemeinsames Abhaken mit Freunden (Teil 6e).
// Alles Fachliche steht hier und läuft in Node-Tests; der Dienst (dienst/worker.js, tools/live-lokal.js) ist nur Verdrahtung, die Seite (web/live.js) nur Anzeige.
// Ein Raum hält die freigegebene Spezifikation (mit Version) und den Fortschritt (mischbare LWW-Map aus fortschritt.js). Haken werden gemischt, nie überschrieben;
// eine neue Planversion wird nur angenommen, wenn der Absender den aktuellen Stand kannte (`basis`) und die Freigabe zum Inhalt passt – sonst wird sie abgelehnt.
// Der Raum ändert sich bei einer Ablehnung nie. Deterministisch: keine Uhr, kein Zufall (die Raum-Nummer erzeugt die Seite).
import * as F from './fortschritt.js';
import { abdruck, PROJEKT_ID } from '../ebene4/spezifikation.js';
import * as PF from './planfassung.js';

/** Grenzen (ein Ort für Dienst und Seite). */
export const GRENZEN = Object.freeze({ spezifikation: 200_000, spieler: 12, eintraege: 5_000, name: 24, nachricht: 262_144, verfallTage: 30, uhrMax: 1_000_000_000, uhrSprung: 100_000 });
/** Schlüssel eines Hakens: Abschnitt|Höhe|Abdruck der Schicht (siehe fortschritt.schluessel). Alles andere ist Müll und füllt nur den Raum. */
const SCHLUESSEL = /^[^|\s]{1,64}\|-?\d{1,4}\|[0-9a-f]{1,16}$/;
const ARTEN = ['hallo', 'haken', 'plan', 'aenderung', 'ping'];

/** Fehler bei einer unbrauchbaren Nachricht (der Dienst antwortet mit „abgelehnt“). */
export class LiveFehler extends Error {
  constructor(grund, nachricht) { super(nachricht); this.name = 'LiveFehler'; this.grund = grund; }
}

const istObjekt = (w) => w !== null && typeof w === 'object' && !Array.isArray(w);
const kopie = (w) => structuredClone(w);

export const neuerRaum = () => ({ spezifikation: null, fortschritt: F.leer(), aenderungen: PF.leer(), spieler: {} });
const aenderungenVon = (raum) => raum.aenderungen ?? PF.leer(); // ältere gespeicherte Räume kennen noch keine Änderungen
export const spielerListe = (raum) => Object.values(raum.spieler).map((s) => s.name).sort();
const version = (raum) => raum.spezifikation?.version ?? 0;
// `format`: das Planfassungsformat, das der Raum versteht (2 = mit Zulassungen). Ein älterer Dienst nennt es nicht; die Seite sendet ihm dann keine Zulassungen (sie gingen dort still verloren).
const zustandVon = (raum) => ({ typ: 'zustand', spezifikation: raum.spezifikation, fortschritt: raum.fortschritt, aenderungen: aenderungenVon(raum), spieler: spielerListe(raum), format: PF.FORMAT });

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

  if (m.typ === 'aenderung') {
    // manuelle Einzelblockänderungen (P10): je Zelle Vergleichen-und-Setzen, Konflikte kommen sichtbar zurück, der Raum überschreibt nie still
    const alt = aenderungenVon(raum);
    let e;
    try { e = PF.wende(alt, m.operationen, raum.spieler[absender].name, { gruppe: m.gruppe === true }); } catch (f) {
      if (f instanceof PF.PlanfassungFehler) return abgelehnt(raum, f.grund, f.message);
      throw f;
    }
    const senden = [{ an: 'absender', nachricht: { typ: 'aenderung-ergebnis', version: e.planfassung.version, angenommen: e.angenommen, konflikte: e.konflikte, zellen: e.zellen, ...(e.gruppeAbgelehnt ? { gruppeAbgelehnt: true } : {}) } }];
    if (e.angenommen.length) senden.push({ an: 'andere', nachricht: { typ: 'aenderungen', von: raum.spieler[absender].name, version: e.planfassung.version, operationen: e.angenommen } });
    return { raum: e.geaendert ? { ...raum, aenderungen: e.planfassung } : raum, senden };
  }

  // plan
  const spec = m.spezifikation;
  if (!Number.isInteger(m.basis) || m.basis < 0) return abgelehnt(raum, 'form', 'plan braucht basis (die Version, die du kennst)');
  if (m.basis !== version(raum)) return { raum, senden: [{ an: 'absender', nachricht: { typ: 'abgelehnt', grund: 'veraltet', text: `Im Raum gilt schon Version ${version(raum)}`, version: version(raum), spezifikation: raum.spezifikation } }] };
  if (!istObjekt(spec)) return abgelehnt(raum, 'form', 'plan braucht eine Spezifikation');
  if (JSON.stringify(spec).length > GRENZEN.spezifikation) return abgelehnt(raum, 'zu-gross', `Die Spezifikation ist größer als ${GRENZEN.spezifikation} Zeichen`);
  if (!freigegeben(spec)) return abgelehnt(raum, 'freigabe', 'Nur freigegebene Spezifikationen können in den Raum (die Freigabe passt nicht zum Inhalt)');
  // Ein Raum gehört zu einem Projekt: die Kennung bleibt erhalten, ein anderes Projekt kommt nie in einen bestehenden Raum
  const neueKennung = spec.projekt?.id, raumKennung = raum.spezifikation?.projekt?.id;
  if (neueKennung !== undefined && !(typeof neueKennung === 'string' && PROJEKT_ID.test(neueKennung))) return abgelehnt(raum, 'form', 'Die Projektkennung hat nicht die Form p-<32 Hexzeichen>');
  if (raumKennung !== undefined && neueKennung !== raumKennung) return abgelehnt(raum, 'projekt', neueKennung === undefined ? 'Dem Plan fehlt die Projektkennung des Raums' : 'Der Raum gehört zu einem anderen Projekt (andere Projektkennung)');
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
/** Inhalt eines Eintrags als Erwartung (ohne Autor, mit Zulassung). */
const inhalt = (e) => (e ? { op: e.op, ...(e.block ? { block: e.block } : {}), ...(e.zugelassen === true ? { zugelassen: true } : {}) } : null);

export function erzeugeKlient({ name, fortschritt = F.leer() }) {
  const z = { name, fortschritt, gesendet: {}, raumVersion: 0, spieler: [], vorschlag: null, aenderungen: PF.leer(), raumFormat: 1 };
  const gleich = (a, b) => a && b && a.wert === b.wert && a.uhr === b.uhr && a.von === b.von;
  /** Alle Einträge, die der Raum noch nicht von uns kennt. */
  const neuesVon = (f) => Object.fromEntries(Object.entries(f.eintraege).filter(([k, e]) => !gleich(z.gesendet[k], e)));
  /** Zulassungen und atomare Gruppen versteht nur ein Dienst mit Planfassungsformat 2: ein älterer wendet eine Gruppe einzeln an und entfernt Zulassungen still. Darum wird ihm beides nicht gesendet. */
  const braucheFormat2 = (ops, gruppe) => {
    if (z.raumFormat >= PF.FORMAT) return;
    if (gruppe) throw new Error('Der Dienst dieses Raums ist älter und kennt keine zusammengehörigen Änderungen (Neu verankern). Es wurde nichts gesendet, damit nichts halb ankommt. Bitte den Dienst aktualisieren.');
    if (ops.some((o) => o?.neu?.zugelassen === true)) throw new Error('Der Dienst dieses Raums ist älter und kennt keine Zulassungen. Es wurde nichts gesendet, damit die Zulassung nicht still verloren geht. Bitte den Dienst aktualisieren.');
  };
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
    /**
     * Eine Änderung an einer Zelle eines Teils (`neu`: {op: 'setze', block} | {op: 'leere'} | null = Änderung entfernen). Die Erwartung ist der lokal bekannte Stand der Zelle:
     * hat inzwischen jemand anders dort etwas geändert, antwortet der Raum mit einem Konflikt statt zu überschreiben. Lokal ändert sich erst etwas, wenn der Raum annimmt.
     */
    aendere(teil, zelle, neu) {
      braucheFormat2([{ neu }], false);
      const k = PF.schluessel(teil, zelle), aktuell = z.aenderungen.eintraege[k] ?? null;
      return [{ typ: 'aenderung', operationen: [{ teil, zelle, erwartet: inhalt(aktuell), neu }] }];
    },
    /** Eine fertige Operation der Oberfläche (bearbeiten.js): ihre Erwartung ist der Stand zum Zeitpunkt der Auswahl, nicht der jüngste lokale Stand; so bleibt eine Änderung der Mitspieler dazwischen ein Konflikt. */
    aendereOperation(op) { braucheFormat2([op], false); return [{ typ: 'aenderung', operationen: [PF.pruefeOperation(op)] }]; },
    /** Eine Gruppe von Operationen, die der Raum ganz oder gar nicht annimmt (U6: „neu verankern“ = alten Eintrag löschen und neuen setzen). */
    aendereGruppe(ops) { braucheFormat2(ops, true); return [{ typ: 'aenderung', gruppe: true, operationen: ops.map(PF.pruefeOperation) }]; },
    /** Viele fertige Operationen (z. B. die lokalen Änderungen in einen neuen Raum ohne Änderungen), in Päckchen nach der Grenze für Operationen je Nachricht. */
    aendereOperationen(ops) {
      braucheFormat2(ops, false);
      const gepruefte = ops.map(PF.pruefeOperation), aus = [];
      for (let i = 0; i < gepruefte.length; i += PF.PF_GRENZEN.operationen) aus.push({ typ: 'aenderung', operationen: gepruefte.slice(i, i + PF.PF_GRENZEN.operationen) });
      return aus;
    },
    /** Ein Konflikt wurde entschieden: `meine` überschreibt bewusst den aktuellen Eintrag des anderen Spielers, `ihre` behält ihn (nichts wird gesendet). */
    konfliktLoesen(konflikt, wahl) {
      if (wahl === 'ihre') return [];
      if (wahl !== 'meine') throw new Error('wahl muss „meine“ oder „ihre“ sein');
      braucheFormat2([{ neu: konflikt.vorschlag }], false); // ein Konflikt kann eine Wiederverbindung überdauern: auch hier geht keine Zulassung an einen älteren Dienst
      return [{ typ: 'aenderung', operationen: [{ teil: konflikt.teil, zelle: konflikt.zelle, erwartet: inhalt(konflikt.aktuell), neu: konflikt.vorschlag }] }];
    },
    /** Eine neue Planversion für den Raum (der Absender nennt die Version, die er kennt). */
    planVeroeffentlichen(spec) { return [{ typ: 'plan', basis: z.raumVersion, spezifikation: spec }]; },
    /** Antwort des Dienstes verarbeiten. Gibt Meldungen für die Anzeige zurück und Nachrichten, die gesendet werden müssen. */
    beiNachricht(m) {
      const meldungen = [], senden = [];
      if (m.typ === 'zustand') {
        z.spieler = m.spieler;
        z.raumVersion = m.spezifikation?.version ?? 0;
        z.raumFormat = Number.isInteger(m.format) ? m.format : 1; // ohne Angabe ein älterer Dienst
        z.aenderungen = PF.pruefeForm(m.aenderungen ?? PF.leer());
        const merged = F.zusammenfuehren(z.fortschritt, F.pruefe(m.fortschritt));
        const mein = neuesVon(merged); // lokal Neueres geht jetzt in den Raum
        for (const [k, e] of Object.entries(m.fortschritt.eintraege)) if (gleich(merged.eintraege[k], e)) z.gesendet[k] = e;
        z.fortschritt = merged;
        if (Object.keys(mein).length) { Object.assign(z.gesendet, kopie(mein)); senden.push({ typ: 'haken', eintraege: mein }); }
        meldungen.push({ art: 'zustand', spezifikation: m.spezifikation ?? null, fortschritt: merged, aenderungen: z.aenderungen, format: z.raumFormat });
      } else if (m.typ === 'eintraege') {
        const eingang = F.pruefe({ eintraege: m.eintraege, uhr: Math.max(0, ...Object.values(m.eintraege).map((e) => e.uhr)) });
        z.fortschritt = F.zusammenfuehren(z.fortschritt, eingang);
        for (const [k, e] of Object.entries(eingang.eintraege)) if (gleich(z.fortschritt.eintraege[k], e)) z.gesendet[k] = e;
        meldungen.push({ art: 'haken', von: m.von, eintraege: eingang.eintraege, fortschritt: z.fortschritt });
      } else if (m.typ === 'aenderung-ergebnis') {
        // Die Antwort wird zuerst eingeordnet und erst dann angewendet: passt ihre Version genau (eine Änderung mehr, bei reinen Konflikten dieselbe), übernimmt der Absender den Endstand
        // der berührten Zellen. Ist sie älter als der lokale Stand, ändert sie nichts. Fehlen Versionen dazwischen (verlorene Rundsendung), bleibt der lokale Stand unverändert (kein
        // halber Zwischenstand) und der Klient holt den vollen Zustand nach. Ein Konflikt wird in jedem Fall gemeldet, damit der Vorschlag des Spielers nie still verloren geht.
        const alt = z.aenderungen;
        const veraltet = m.version < alt.version;
        const luecke = !veraltet && m.version !== (m.angenommen.length ? alt.version + 1 : alt.version);
        if (!veraltet && !luecke) {
          z.aenderungen = PF.setzeZellen(alt, m.zellen, m.version);
          meldungen.push({ art: 'aenderungen-angenommen', version: m.version, anzahl: m.angenommen.length, aenderungen: z.aenderungen });
        }
        if (m.konflikte.length) meldungen.push({ art: 'aenderung-konflikt', konflikte: m.konflikte, version: m.version, abgleich: luecke, aenderungen: z.aenderungen, gruppe: m.gruppeAbgelehnt === true });
        if (luecke) senden.push({ typ: 'hallo', name: z.name });
      } else if (m.typ === 'aenderungen') {
        const alt = z.aenderungen;
        if (m.version <= alt.version) { /* schon bekannt (oder älter): nichts tun */ } else if (m.version === alt.version + 1) {
          z.aenderungen = PF.uebernimm(alt, m.operationen, m.version);
          meldungen.push({ art: 'aenderungen', von: m.von, version: m.version, operationen: m.operationen, aenderungen: z.aenderungen });
        } else senden.push({ typ: 'hallo', name: z.name }); // Lücke: den ganzen Zustand neu holen statt ein Teilstück anzuwenden
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

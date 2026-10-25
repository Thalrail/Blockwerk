// Ebene 3 – Fachleute: Besitz, Rangfolge, Sperren. Jeder ändert nur seinen eigenen Teil; was ein Höherrangiger festgelegt hat, ist gesperrt.
// Regeln als Daten: data/regeln/planung.json (plan.rangfolge, plan.besitz). `aendere` liefert immer einen neuen Entwurf.
import { kopie } from './entwurf.js';
import { haengeAn } from './bericht.js';

/** Fehler mit Code: 'fremd' (Feld gehört einem anderen), 'gesperrt' (ein Höherrangiger hat es festgelegt), 'ungueltig'. */
export class RechtFehler extends Error {
  constructor(code, nachricht) { super(nachricht); this.name = 'RechtFehler'; this.code = code; }
}

/**
 * @param {{regelwerk: import('../ebene1/regelwerk.js').Regelwerk}} quellen
 */
export function erzeugeFachleute({ regelwerk, pruefePalette = () => {} }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  const reihenfolge = P('plan.rangfolge', 'reihenfolge');
  const bauleiter = P('plan.rangfolge', 'bauleiter');
  const fixierer = P('plan.rangfolge', 'fixierung');
  const feldBesitz = P('plan.besitz', 'felder');
  const teilBesitz = P('plan.besitz', 'teile');
  const praefixe = P('plan.besitz', 'bausteinPraefix');
  const funktionen = P('plan.zonenplan', 'funktionen');
  const anker = P('plan.formen', 'anker');

  /** Rang (0 = höchster). Fixierung durch Jonah steht darüber (−1); der Bauleiter hat keinen Rang (Infinity: er ändert nichts selbst). */
  function rang(f) {
    if (f === fixierer) return -1;
    const i = reihenfolge.indexOf(f);
    return i < 0 ? Infinity : i;
  }
  const istFachmann = (f) => reihenfolge.includes(f);
  const hoeher = (a, b) => rang(a) < rang(b);

  /** Art eines Teils aus der Baustein-ID. */
  function artVon(baustein) {
    for (const [praefix, art] of Object.entries(praefixe)) if (baustein.startsWith(praefix)) return art;
    throw new RechtFehler('ungueltig', `Unbekannte Bausteinart: ${baustein}`);
  }
  /** Besitzer eines Teils (aus seiner Art: form, bauelement, technik oder verbindung). */
  const besitzer = (teil) => teilBesitz[teil.art];

  /** Die Sperre mit dem höchsten Rang auf dem Ziel (null, wenn keine). */
  const sperreFuer = (e, ziel) => e.sperren.filter((s) => s.ziel === ziel).reduce((best, s) => (best === null || rang(s.von) < rang(best.von) ? s : best), null);

  function pruefeDarf(e, fachmann, ziel, besitzer) {
    if (!istFachmann(fachmann)) throw new RechtFehler('fremd', `${String(fachmann)} ist kein Fachmann der Planung`);
    if (besitzer !== fachmann) throw new RechtFehler('fremd', `${fachmann} darf ${ziel} nicht ändern (gehört dem ${besitzer})`);
    const s = sperreFuer(e, ziel);
    if (s && rang(s.von) < rang(fachmann)) throw new RechtFehler('gesperrt', `${ziel} ist gesperrt: ${s.von} hat es festgelegt (Rang höher als ${fachmann})`);
  }

  function merkeSperre(e, ziel, fachmann) {
    const i = e.sperren.findIndex((s) => s.ziel === ziel);
    const eintrag = { ziel, von: fachmann, rang: rang(fachmann) };
    if (i >= 0) e.sperren[i] = eintrag; else e.sperren.push(eintrag);
  }

  const ersetzeOderFuegeEin = (liste, neu) => { const i = liste.findIndex((x) => x.id === neu.id); if (i >= 0) liste[i] = neu; else liste.push(neu); };
  const quader = (q, was) => { for (const k of ['von', 'bis']) if (![q?.[k]?.x, q?.[k]?.y, q?.[k]?.z].every(Number.isInteger)) throw new RechtFehler('ungueltig', `${was}: ${k} braucht x, y, z`); };

  /**
   * @param {object} entwurf
   * @param {string} fachmann
   * @param {{art: string}} aenderung  setze-abschnitt | setze-zone | setze-sperrzone | setze-palette | setze-pruefung | setze-teil | aendere-teil | entferne-teil
   * @returns {{entwurf: object, eintrag: object}} neuer Entwurf und Berichtseintrag
   */
  function aendere(entwurf, fachmann, aenderung) {
    const e = kopie(entwurf);
    let ziel, beschreibung;
    switch (aenderung.art) {
      case 'setze-abschnitt': {
        const a = aenderung.abschnitt;
        ziel = `abschnitt:${a?.id}`;
        if (typeof a?.id !== 'string' || typeof a.name !== 'string' || !Number.isInteger(a.reihenfolge)) throw new RechtFehler('ungueltig', 'Abschnitt braucht id, name, reihenfolge');
        pruefeDarf(e, fachmann, ziel, feldBesitz.abschnitte);
        ersetzeOderFuegeEin(e.abschnitte, { status: 'offen', ...a });
        beschreibung = `Abschnitt „${a.name}“ (Reihenfolge ${a.reihenfolge}) gesetzt`;
        break;
      }
      case 'setze-zone': case 'setze-sperrzone': {
        const sperr = aenderung.art === 'setze-sperrzone';
        const z = sperr ? aenderung.sperrzone : aenderung.zone;
        ziel = `${sperr ? 'sperrzone' : 'zone'}:${z?.id}`;
        if (typeof z?.id !== 'string') throw new RechtFehler('ungueltig', 'Zone braucht eine id');
        quader(z, ziel);
        if (sperr && !['alles', 'arbeitsblock'].includes(z.verbot)) throw new RechtFehler('ungueltig', 'Sperrzone: verbot ist „alles“ oder „arbeitsblock“');
        pruefeDarf(e, fachmann, ziel, sperr ? feldBesitz.sperrzonen : feldBesitz.zonen);
        ersetzeOderFuegeEin(sperr ? e.sperrzonen : e.zonen, { ...z, gesetztVon: fachmann });
        beschreibung = `${sperr ? 'Sperrzone' : 'Zone'} ${z.id} gesetzt`;
        break;
      }
      case 'setze-palette': {
        ziel = 'palette';
        pruefeDarf(e, fachmann, ziel, feldBesitz.palette);
        pruefePalette(aenderung.palette);
        e.palette = { ...e.palette, ...aenderung.palette };
        beschreibung = `Palette für ${Object.keys(aenderung.palette).join(', ')} gesetzt`;
        break;
      }
      case 'setze-pruefung': {
        const p = aenderung.pruefung;
        ziel = `pruefung:${p?.id}`;
        if (typeof p?.id !== 'string' || typeof p.art !== 'string') throw new RechtFehler('ungueltig', 'Prüfauftrag braucht id und art');
        pruefeDarf(e, fachmann, ziel, feldBesitz.pruefungen);
        ersetzeOderFuegeEin(e.pruefungen, p);
        beschreibung = `Prüfauftrag ${p.id} (${p.art}) gesetzt`;
        break;
      }
      case 'entferne-zone': {
        const i = e.zonen.findIndex((x) => x.id === aenderung.id);
        if (i < 0) throw new RechtFehler('ungueltig', `Zone ${String(aenderung.id)} existiert nicht`);
        ziel = `zone:${aenderung.id}`;
        pruefeDarf(e, fachmann, ziel, feldBesitz.zonen);
        e.zonen.splice(i, 1);
        beschreibung = `Zone ${aenderung.id} entfernt`;
        break;
      }
      case 'setze-formwunsch': {
        const w = aenderung.formwunsch;
        ziel = `formwunsch:${w?.id}`;
        if (typeof w?.id !== 'string' || typeof w.baustein !== 'string') throw new RechtFehler('ungueltig', 'Formwunsch braucht id und baustein');
        if (!['form.', 'bau.'].some((pr) => w.baustein.startsWith(pr))) throw new RechtFehler('ungueltig', `Formwunsch: ${w.baustein} ist keine Form und kein Bauelement`);
        if (!e.abschnitte.some((a) => a.id === w.abschnitt)) throw new RechtFehler('ungueltig', `Abschnitt ${String(w.abschnitt)} existiert nicht`);
        if (!funktionen.includes(w.zone)) throw new RechtFehler('ungueltig', `Formwunsch: Zone „${String(w.zone)}“ unbekannt (${funktionen.join(', ')})`);
        if (!anker.includes(w.anker ?? 'mitte')) throw new RechtFehler('ungueltig', `Formwunsch: Anker „${String(w.anker)}“ unbekannt (${anker.join(', ')})`);
        pruefeDarf(e, fachmann, ziel, feldBesitz.formwuensche);
        e.formwuensche ??= [];
        ersetzeOderFuegeEin(e.formwuensche, { anker: 'mitte', parameter: {}, ...w });
        beschreibung = `Formwunsch ${w.id} (${w.baustein}, Zone ${w.zone}, Anker ${w.anker ?? 'mitte'}) gesetzt`;
        break;
      }
      case 'setze-abschnittspalette': {
        ziel = `palette:${aenderung.abschnitt}`;
        if (!e.abschnitte.some((a) => a.id === aenderung.abschnitt)) throw new RechtFehler('ungueltig', `Abschnitt ${String(aenderung.abschnitt)} existiert nicht`);
        pruefeDarf(e, fachmann, ziel, feldBesitz.paletten);
        pruefePalette(aenderung.palette);
        e.paletten ??= {};
        e.paletten[aenderung.abschnitt] = { ...(e.paletten[aenderung.abschnitt] ?? {}), ...aenderung.palette };
        beschreibung = `Abschnittspalette für ${Object.keys(aenderung.palette).join(', ')} gesetzt`;
        break;
      }
      case 'setze-bedarf': {
        const b = aenderung.bedarf;
        ziel = `bedarf:${b?.id}`;
        if (typeof b?.id !== 'string' || typeof b.art !== 'string') throw new RechtFehler('ungueltig', 'Bedarf braucht id und art');
        if (!e.abschnitte.some((a) => a.id === b.abschnitt)) throw new RechtFehler('ungueltig', `Abschnitt ${String(b.abschnitt)} existiert nicht`);
        pruefeDarf(e, fachmann, ziel, feldBesitz.bedarf);
        e.bedarf ??= [];
        ersetzeOderFuegeEin(e.bedarf, b);
        beschreibung = `Bedarf ${b.id} (${b.art}) im Abschnitt ${b.abschnitt} gesetzt`;
        break;
      }
      case 'setze-anfrage': {
        const a = aenderung.anfrage;
        ziel = `anfrage:${a?.id}`;
        if (typeof a?.id !== 'string' || typeof a.bedarf !== 'string') throw new RechtFehler('ungueltig', 'Schaltungsanfrage braucht id und bedarf');
        pruefeDarf(e, fachmann, ziel, feldBesitz.anfragen);
        e.anfragen ??= [];
        ersetzeOderFuegeEin(e.anfragen, { status: 'offen', ...a });
        beschreibung = `Schaltungsanfrage ${a.id} für ${a.bedarf} gesetzt`;
        break;
      }
      case 'setze-teil': {
        const t = { ...aenderung.teil };
        if (typeof t.baustein !== 'string' || typeof t.abschnitt !== 'string') throw new RechtFehler('ungueltig', 'Teil braucht baustein und abschnitt');
        if (!e.abschnitte.some((a) => a.id === t.abschnitt)) throw new RechtFehler('ungueltig', `Abschnitt ${t.abschnitt} existiert nicht`);
        const art = t.verbindung === true ? 'verbindung' : artVon(t.baustein); // Verbindungen (Gänge, Treppen, Schienen zwischen Abschnitten) legt der Konstrukteur
        t.id ??= `T${e.zaehler.teil++}`;
        t.art = art;
        t.parameter ??= {};
        t.lage = { x: 0, y: 0, z: 0, drehung: 0, ...t.lage };
        if (![t.lage.x, t.lage.y, t.lage.z].every(Number.isInteger) || ![0, 1, 2, 3].includes(t.lage.drehung)) throw new RechtFehler('ungueltig', 'Lage braucht ganze x, y, z und drehung 0–3');
        ziel = `teil:${t.id}`;
        const vorhanden = e.teile.find((x) => x.id === t.id);
        pruefeDarf(e, fachmann, ziel, teilBesitz[art]);
        if (vorhanden && teilBesitz[vorhanden.art] !== fachmann) throw new RechtFehler('fremd', `${fachmann} darf ${ziel} nicht ändern (gehört dem ${teilBesitz[vorhanden.art]})`);
        t.gesetztVon = fachmann;
        ersetzeOderFuegeEin(e.teile, t);
        beschreibung = `${t.baustein} bei (${t.lage.x}, ${t.lage.y}, ${t.lage.z}), Drehung ${t.lage.drehung * 90}°, gesetzt`;
        break;
      }
      case 'aendere-teil': {
        const t = e.teile.find((x) => x.id === aenderung.id);
        if (!t) throw new RechtFehler('ungueltig', `Teil ${String(aenderung.id)} existiert nicht`);
        ziel = `teil:${t.id}`;
        pruefeDarf(e, fachmann, ziel, teilBesitz[t.art]);
        const f = aenderung.felder ?? {};
        for (const k of Object.keys(f)) if (!['parameter', 'lage', 'abschnitt'].includes(k)) throw new RechtFehler('ungueltig', `Feld ${k} eines Teils ist nicht änderbar`);
        if (f.parameter) t.parameter = { ...t.parameter, ...f.parameter };
        if (f.lage) {
          t.lage = { ...t.lage, ...f.lage };
          if (![t.lage.x, t.lage.y, t.lage.z].every(Number.isInteger) || ![0, 1, 2, 3].includes(t.lage.drehung)) throw new RechtFehler('ungueltig', 'Lage braucht ganze x, y, z und drehung 0–3');
        }
        if (f.abschnitt) { if (!e.abschnitte.some((a) => a.id === f.abschnitt)) throw new RechtFehler('ungueltig', `Abschnitt ${f.abschnitt} existiert nicht`); t.abschnitt = f.abschnitt; }
        t.gesetztVon = fachmann;
        beschreibung = `${Object.keys(f).join(' und ')} von ${t.baustein} geändert`;
        break;
      }
      case 'entferne-teil': {
        const i = e.teile.findIndex((x) => x.id === aenderung.id);
        if (i < 0) throw new RechtFehler('ungueltig', `Teil ${String(aenderung.id)} existiert nicht`);
        ziel = `teil:${e.teile[i].id}`;
        pruefeDarf(e, fachmann, ziel, teilBesitz[e.teile[i].art]);
        beschreibung = `${e.teile[i].baustein} entfernt`;
        e.teile.splice(i, 1);
        break;
      }
      default:
        throw new RechtFehler('ungueltig', `Unbekannte Änderung: ${String(aenderung.art)}`);
    }
    merkeSperre(e, ziel, fachmann);
    const eintrag = haengeAn(e, 'aenderung', { von: fachmann, ziel, beschreibung, art: aenderung.art });
    return { entwurf: e, eintrag };
  }

  /**
   * Jonah (oder der Bauleiter in seinem Auftrag) fixiert ein Feld: danach darf es kein Fachmann mehr ändern (Rang −1).
   * @returns {{entwurf: object, eintrag: object}}
   */
  function fixiere(entwurf, ziel, text) {
    const e = kopie(entwurf);
    merkeSperre(e, ziel, fixierer);
    const eintrag = haengeAn(e, 'fixierung', { von: fixierer, ziel, text });
    return { entwurf: e, eintrag };
  }

  return { reihenfolge, bauleiter, rang, hoeher, istFachmann, artVon, besitzer, aendere, fixiere, RechtFehler };
}

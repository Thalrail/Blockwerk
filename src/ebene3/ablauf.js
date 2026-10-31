// Ebene 3 – Ablauf: bringt die Fachleute in die Reihenfolge des Ebenenmodells (Vorlauf einmal, dann je Abschnitt die Schritte, am Ende die Gesamtprüfung),
// führt den Rückgriff auf fertige Abschnitte aus (Entscheidung des Bauleiters) und nimmt Jonahs Antworten auf Rückfragen entgegen.
// Der Ablauf ruft nur die vorhandenen Fachleute auf; der Bauleiter ändert nie selbst. Fester Algorithmus: gleiche Vorgabe = gleicher Entwurf.
// Regeln als Daten: data/regeln/planung.json (plan.ablauf, plan.rueckgriff, plan.abschluss).
import { neuerEntwurf, kopie } from './entwurf.js';
import { haengeAn } from './bericht.js';
import { stelleFrage } from './bauleiter.js';

/** Fehler des Ablaufs: Vorgabe oder Antwort sind unbrauchbar (kein Raten). */
export class AblaufFehler extends Error {
  constructor(nachricht) { super(`Ablauf: ${nachricht}`); this.name = 'AblaufFehler'; }
}

const istOffen = (r) => r.status === undefined || r.status === 'offen';

/**
 * @param {{regelwerk: object, fachleute: object, konstrukteur: object, techniker: object, grobdesigner: object, architekt: object, designer: object, einwaende: object}} quellen
 */
export function erzeugeAblauf({ regelwerk, fachleute, konstrukteur: K, techniker: T, grobdesigner: G, architekt: A, designer: D, einwaende, materialisierung }) {
  const maxRueckgriffe = regelwerk.parameter('plan.rueckgriff', 'maximum');
  const antwortOptionen = regelwerk.parameter('plan.rueckgriff', 'optionen');
  const aenderbar = regelwerk.parameter('plan.rueckgriff', 'aenderbar');

  /** Standard-Rückrufe der Fachleute für das Einwand-Protokoll (eigene lassen sich überschreiben). */
  const standardHandler = {
    grobdesigner: (ew, e) => {
      if (ew.regel !== 'plan.bedarf' || !ew.abschnitt) return null;
      try { return G.neuPlanenAenderungen(e, ew.abschnitt); } catch (f) { if (f.name === 'ZonenFehler') return null; throw f; }
    },
    konstrukteur: (ew, e) => {
      if (ew.regel !== 'plan.einspruch') return null;
      try { return K.abhaengigkeitAenderungen(e, ew.abschnitt, ew.braucht); } catch (f) { if (f.name === 'GliederungFehler') return null; throw f; }
    },
  };

  const offeneRueckfragen = (e) => e.rueckfragen.filter(istOffen);
  const ergebnis = (e, status) => ({ entwurf: e, status, rueckfragen: offeneRueckfragen(e), offeneAnfragen: (e.anfragen ?? []).filter((a) => a.status === 'offen') });

  /**
   * Hat jeder Abschnitt eine vollständige Palette (alle Rollen)? Wenn nicht, fragt der Bauleiter Jonah nach der Stimmung (Optionen: nur die unterstützten),
   * statt zu raten oder Testmaterial einzusetzen. Gibt den Entwurf mit der Rückfrage zurück oder null, wenn alles belegt ist.
   */
  function paletteFrage(e) {
    const luecken = materialisierung.paletteLuecken(e);
    if (!luecken.length) return null;
    const optionen = [...D.stimmungen()].sort().map((n) => ({ id: `stimmung:${n}`, text: `Stimmung „${n}“ für das ganze Bauwerk wählen` }));
    const wo = luecken.map((x) => `${x.abschnitt} (${x.rollen.join(', ')})`).join('; ');
    return stelleFrage(e, {
      regel: 'plan.palette', an: 'designer', ort: e.projekt.nullpunkt, art: 'palette', optionen,
      text: `Es gibt keine vollständige Palette: es fehlen Materialrollen bei ${wo}`,
      frage: `Für das Bauwerk ist keine vollständige Palette festgelegt (es fehlen Materialrollen bei ${wo}). Welche Stimmung soll gelten? Ich rate nicht und setze kein Testmaterial ein.`,
      schluessel: `plan.palette|${e.zaehler.einwand}`,
    }).entwurf;
  }

  /** Abschnitt und alle von ihm (auch mittelbar) abhängigen. */
  function abhaengige(e, id) {
    const menge = new Set([id]);
    for (let wachsen = true; wachsen;) {
      wachsen = false;
      for (const a of e.abschnitte) if (!menge.has(a.id) && (a.nach ?? []).some((n) => menge.has(n))) { menge.add(a.id); wachsen = true; }
    }
    return menge;
  }

  /** Entfernt von den Besitzern alles, was zu den Abschnitten der Menge gehört (Teile, Zonen, Sperrzonen, Prüfaufträge, Bedarf, Wünsche). */
  function bereinige(entwurf, menge) {
    let e = entwurf;
    const als = (wer, a) => { e = fachleute.aendere(e, wer, a).entwurf; };
    const entfernt = new Set();
    for (const t of [...e.teile].filter((x) => menge.has(x.abschnitt))) { als(fachleute.besitzer(t), { art: 'entferne-teil', id: t.id }); entfernt.add(t.id); }
    for (const z of [...e.zonen].filter((x) => menge.has(x.abschnitt))) als('grobdesigner', { art: 'entferne-zone', id: z.id });
    for (const s of [...e.sperrzonen].filter((x) => [...entfernt].some((t) => x.id === `SZ-${t}`))) als('techniker', { art: 'entferne-sperrzone', id: s.id });
    for (const p of [...e.pruefungen].filter((x) => menge.has(x.abschnitt) || menge.has(x.mit))) als('konstrukteur', { art: 'entferne-pruefung', id: p.id });
    // Bedarf und Wünsche werden beim neuen Ablauf aus der Vorgabe wieder aufgebaut; bis dahin soll kein Einwand gegen den noch leeren Abschnitt entstehen
    for (const b of [...(e.bedarf ?? [])].filter((x) => menge.has(x.abschnitt))) als('techniker', { art: 'entferne-bedarf', id: b.id });
    for (const w of [...(e.formwuensche ?? [])].filter((x) => menge.has(x.abschnitt))) als('architekt', { art: 'entferne-formwunsch', id: w.id });
    return e;
  }

  /**
   * Rückgriff: öffnet den Abschnitt, alle von ihm abhängigen und den gerade laufenden wieder. Teile, Zonen, Sperrzonen und Prüfaufträge werden
   * von ihren Besitzern entfernt (auch Bedarf und Wünsche, sie werden aus der Vorgabe neu aufgebaut). `aenderung` darf name, huelle, schnittstellen, vorgabe ändern.
   * @returns {object} neuer Entwurf
   */
  function rueckgriff(entwurf, id, { grund = '', aenderung = null, intern = false, zaehlen = true } = {}) {
    const ziel = entwurf.abschnitte.find((a) => a.id === id);
    if (!ziel) throw new AblaufFehler(`Abschnitt ${String(id)} gibt es nicht`);
    const erlaubt = intern ? [...aenderbar, 'nach'] : aenderbar;
    for (const k of Object.keys(aenderung ?? {})) if (!erlaubt.includes(k)) throw new AblaufFehler(`Am Abschnitt lässt sich „${k}“ nicht ändern (${aenderbar.join(', ')})`);
    const menge = abhaengige(entwurf, id);
    for (const a of entwurf.abschnitte) if (a.status === 'in-arbeit') menge.add(a.id);
    let e = bereinige(entwurf, menge);
    const als = (wer, a) => { e = fachleute.aendere(e, wer, a).entwurf; };
    for (const a of [...e.abschnitte].filter((x) => menge.has(x.id)).sort((x, y) => x.reihenfolge - y.reihenfolge)) {
      const neu = { ...a, status: 'offen', ...(a.id === id ? { rueckgriffe: (a.rueckgriffe ?? 0) + (zaehlen ? 1 : 0), ...(aenderung ?? {}) } : {}) };
      delete neu.aufgebaut;
      als('konstrukteur', { art: 'setze-abschnitt', abschnitt: neu });
    }
    e = kopie(e);
    const mit = [...menge].filter((x) => x !== id).sort();
    haengeAn(e, 'entscheidung', { von: 'bauleiter', text: `öffnet den Abschnitt ${id} wieder${mit.length ? ` (mit ${mit.join(', ')})` : ''}, sein Ablauf läuft neu${grund ? `: ${grund}` : ''}` });
    return e;
  }

  /**
   * Läuft das Einwand-Protokoll. Bleibt ein Einwand gegen einen anderen, schon fertigen Abschnitt offen, öffnet der Bauleiter diesen höchstens
   * `maximum`-mal wieder (art „neustart“); sonst bleibt die Rückfrage an Jonah offen (art „wartet“).
   */
  function pruefeUndLoese(entwurf, handler, aktuell) {
    const r = einwaende.laufe(entwurf, handler);
    let e = r.entwurf;
    for (const rf of r.rueckfragen) {
      const ew = e.einwaende.find((x) => x.id === rf.einwand);
      const a = ew?.abschnitt ? e.abschnitte.find((x) => x.id === ew.abschnitt) : null;
      if (a && a.id !== aktuell && a.status === 'fertig' && (a.rueckgriffe ?? 0) < maxRueckgriffe) {
        for (const x of r.rueckfragen) {
          e.rueckfragen.find((y) => y.id === x.id).status = 'rueckgriff';
          e.einwaende.find((y) => y.id === x.einwand).status = 'rueckgriff';
        }
        return { entwurf: rueckgriff(e, a.id, { grund: ew.text }), art: 'neustart' };
      }
    }
    return { entwurf: e, art: offeneRueckfragen(e).length ? 'wartet' : 'ok' };
  }

  // ---- Vorlauf ----
  const bedarfVon = (a) => (a.vorgabe?.bedarf ?? []).map((b, i) => ({ id: `${a.id}-B${i + 1}`, abschnitt: a.id, ...b }));

  /**
   * Vorlauf: gliedern, Einspruch des Technikers gegen die Reihenfolge, Gesamtpalette.
   * @param {{name: string, bauplatz?: object, nullpunkt?: object, stimmung?: string, abschnitte: object[]}} vorgabe
   * @returns {{entwurf: object, art: 'ok'|'wartet'}}
   */
  function vorlauf(vorgabe) {
    if (!vorgabe || !Array.isArray(vorgabe.abschnitte)) throw new AblaufFehler('die Vorgabe braucht eine Liste „abschnitte“');
    let e = neuerEntwurf({ name: vorgabe.name, bauplatz: vorgabe.bauplatz, nullpunkt: vorgabe.nullpunkt });
    e = K.gliedere(e, vorgabe.abschnitte.map((a) => ({
      id: a.id, name: a.name, huelle: a.huelle, nach: a.nach, schnittstellen: a.schnittstellen,
      vorgabe: { zonen: a.zonen, bedarf: a.bedarf, formen: a.formen, verbindungen: a.verbindungen, stimmung: a.stimmung },
    })));
    // Einspruch des Technikers: Bedarf mit „braucht“ gegen die Reihenfolge (auf einer Arbeitskopie mit dem ganzen Bedarf)
    for (let runde = 0; runde <= e.abschnitte.length; runde++) {
      const probe = T.setzeBedarf(e, e.abschnitte.flatMap(bedarfVon));
      const ew = T.einwaende(probe).find((x) => x.regel === 'plan.einspruch');
      if (!ew) break;
      let aenderungen;
      try { aenderungen = K.abhaengigkeitAenderungen(e, ew.abschnitt, ew.braucht); } catch (f) {
        if (f.name !== 'GliederungFehler') throw f;
        const frage = stelleFrage(e, { regel: ew.regel, an: 'konstrukteur', ort: ew.ort, text: `${ew.text}; der Konstrukteur kann es nicht lösen (${f.message})`, abschnitt: ew.abschnitt, schluessel: ew.schluessel });
        return { entwurf: frage.entwurf, art: 'wartet' };
      }
      const draft = { ...ew };
      delete draft.braucht;
      e = kopie(e);
      const id = `E${e.zaehler.einwand++}`;
      e.einwaende.push({ id, ...draft, runde: 0, status: 'erledigt' });
      haengeAn(e, 'einwand', { id, von: ew.von, an: ew.an, regel: ew.regel, ort: ew.ort, text: ew.text, ziel: ew.ziel, runde: 0 });
      for (const a of aenderungen) e = fachleute.aendere(e, 'konstrukteur', a).entwurf;
      e = kopie(e);
      haengeAn(e, 'erledigt', { einwand: id, regel: ew.regel, runde: 0 });
    }
    if (vorgabe.stimmung) e = D.setzePalette(e, vorgabe.stimmung);
    return { entwurf: e, art: 'ok' };
  }

  // ---- ein Abschnitt ----
  function abschnittLaufen(entwurf, id, handler) {
    let e = entwurf;
    const a = () => e.abschnitte.find((x) => x.id === id);
    const v = a().vorgabe ?? {};
    const weiter = (r) => { e = r.entwurf; return r.art; };
    if (!a().aufgebaut) {
      // 1. Grobdesigner: Zonenplan (bei Wiederaufnahme ist er schon da)
      if (v.zonen?.length && !e.zonen.some((z) => z.abschnitt === id)) {
        const r = G.zonenplan(e, id, v.zonen);
        e = r.entwurf;
        if (r.rueckfrage) return { entwurf: e, art: 'wartet' };
      }
      // 2. Techniker: Bedarf, Bedarfsprüfung, Module
      const bedarf = bedarfVon(a());
      if (bedarf.length) {
        e = T.setzeBedarf(e, bedarf);
        const art = weiter(pruefeUndLoese(e, handler, id));
        if (art !== 'ok') return { entwurf: e, art };
        e = T.setzeModule(e, id).entwurf;
      }
      // 3. Architekt: Formen
      if (v.formen?.length) {
        e = A.setzeFormwuensche(e, v.formen.map((f, i) => ({ id: `${id}-F${i + 1}`, abschnitt: id, ...f })));
        e = A.setzeFormen(e, id).entwurf;
      }
      // 4. Konstrukteur: Verbindungen
      for (const [i, vb] of (v.verbindungen ?? []).entries()) {
        const r = K.verlege(e, { abschnitt: id, von: vb.von, nach: vb.nach, art: vb.art, name: `${id}-V${i + 1}` });
        e = r.entwurf;
        if (r.rueckfrage) return { entwurf: e, art: 'wartet' };
      }
      // 5. Designer: Abschnittspalette
      if (v.stimmung) e = D.setzeAbschnittspalette(e, id, v.stimmung);
      e = fachleute.aendere(e, 'konstrukteur', { art: 'setze-abschnitt', abschnitt: { ...a(), aufgebaut: true } }).entwurf;
    }
    // 6. Prüfer aus Ebene 1 über den Abschnitt und seine fertigen Nachbarn
    let art = weiter(pruefeUndLoese(e, handler, id));
    if (art !== 'ok') return { entwurf: e, art };
    // 7. Konstrukteur: Abschnitt abschließen, Nähte zu fertigen Nachbarn prüfen
    e = K.schliesse(e, id);
    e = K.pruefeNaehte(e);
    art = weiter(pruefeUndLoese(e, handler, id));
    if (art !== 'ok') return { entwurf: e, art };
    // 8. Techniker: Bilanz
    e = T.bilanz(e).entwurf;
    return { entwurf: e, art: 'ok' };
  }

  // ---- Abschluss ----
  /** Gesamtprüfung: alle Nähte und Verbindungen, dann der vollständige Prüfer über das ganze Bauwerk. */
  function abschliessen(entwurf, optionen = {}) {
    const handler = { ...standardHandler, ...(optionen.handler ?? {}) };
    if (!entwurf.abschnitte.every((a) => a.status === 'fertig')) throw new AblaufFehler('Es sind noch nicht alle Abschnitte fertig');
    const ohnePalette = paletteFrage(entwurf);
    if (ohnePalette) return ergebnis(ohnePalette, 'wartet');
    let e = K.pruefeNaehte(entwurf);
    const fehlend = [...new Set(e.teile.filter((t) => t.weg).map((t) => t.weg))].filter((w) => !e.pruefungen.some((p) => p.weg === w));
    if (fehlend.length) {
      const f = stelleFrage(e, { regel: 'plan.abschluss', an: 'konstrukteur', ort: e.projekt.nullpunkt, text: `Die Verbindung ${fehlend[0]} hat keinen Prüfauftrag`, schluessel: `plan.abschluss|${fehlend[0]}` });
      return ergebnis(f.entwurf, 'wartet');
    }
    const r = pruefeUndLoese(e, handler, null);
    if (r.art === 'neustart') return fortsetzen(r.entwurf, optionen);
    if (r.art === 'wartet') return ergebnis(r.entwurf, 'wartet');
    e = T.bilanz(r.entwurf).entwurf;
    return ergebnis(e, 'fertig');
  }

  /** Läuft ab dem nächsten offenen (oder dem laufenden) Abschnitt weiter, bis alles fertig ist oder eine Rückfrage an Jonah offen bleibt. */
  function fortsetzen(entwurf, optionen = {}) {
    const handler = { ...standardHandler, ...(optionen.handler ?? {}) };
    let e = entwurf;
    for (let schutz = 0; schutz < 500; schutz++) {
      if (offeneRueckfragen(e).length) return ergebnis(e, 'wartet');
      const ohnePalette = paletteFrage(e);
      if (ohnePalette) return ergebnis(ohnePalette, 'wartet');
      let id = e.abschnitte.find((a) => a.status === 'in-arbeit')?.id;
      if (!id) {
        const n = K.naechster(e);
        if (!n.abschnitt) return abschliessen(e, optionen);
        e = n.entwurf;
        id = n.abschnitt.id;
      }
      const r = abschnittLaufen(e, id, handler);
      e = r.entwurf;
      if (r.art === 'wartet') return ergebnis(e, 'wartet');
    }
    throw new AblaufFehler('Der Ablauf kommt nicht zum Ende (zu viele Durchläufe)');
  }

  const norm = (w) => JSON.stringify(w ?? null, (k, v) => (Array.isArray(v) || v === null || typeof v !== 'object' ? v : Object.fromEntries(Object.keys(v).sort().filter((x) => v[x] !== undefined).map((x) => [x, v[x]]))));
  const inhalt = (a) => ({ name: a.name, huelle: a.huelle, nach: [...(a.nach ?? [])].sort(), schnittstellen: a.schnittstellen ?? [], vorgabe: a.vorgabe ?? {} });
  const vorgabeVon = (a) => ({ zonen: a.zonen, bedarf: a.bedarf, formen: a.formen, verbindungen: a.verbindungen, stimmung: a.stimmung });
  const abschnittAus = (a) => ({ id: a.id, name: a.name, huelle: a.huelle, nach: a.nach ?? [], schnittstellen: a.schnittstellen ?? [], vorgabe: vorgabeVon(a) });

  /**
   * Wendet eine neue Fassung der Vorgabe auf einen begonnenen oder fertigen Entwurf an. Der Konstrukteur entscheidet, was neu geplant wird:
   * geänderte Abschnitte (und die von ihnen abhängigen) werden über den Rückgriff geöffnet, neue ergänzt, weggefallene entfernt; unveränderte behalten ihre Teile.
   * Fixierungen und Zulassungen von Jonah bleiben bestehen. Danach läuft der Ablauf weiter.
   * @returns {{entwurf: object, status: string, rueckfragen: object[], offeneAnfragen: object[], geaendert: string[], neu: string[], entfernt: string[]}}
   */
  function aktualisiere(entwurf, vorgabe, optionen = {}) {
    if (!vorgabe || !Array.isArray(vorgabe.abschnitte)) throw new AblaufFehler('die Vorgabe braucht eine Liste „abschnitte“');
    const neu = new Map(vorgabe.abschnitte.map((a) => [a.id, abschnittAus(a)]));
    let e = entwurf;
    const alt = new Map(e.abschnitte.map((a) => [a.id, a]));
    const entfernt = [...alt.keys()].filter((id) => !neu.has(id)).sort();
    const hinzu = [...neu.keys()].filter((id) => !alt.has(id)).sort();
    const geaendert = [...neu.keys()].filter((id) => alt.has(id) && norm(inhalt(alt.get(id))) !== norm(inhalt(neu.get(id)))).sort((x, y) => alt.get(x).reihenfolge - alt.get(y).reihenfolge);
    // 0. Projektangaben und Gesamtpalette der neuen Fassung (die Welt wird beim Prüfen aus Entwurf und Palette gebaut, es muss nichts neu gebaut werden)
    e = kopie(e);
    e.projekt = { ...e.projekt, name: vorgabe.name ?? e.projekt.name, bauplatz: { ...(vorgabe.bauplatz ?? e.projekt.bauplatz) }, nullpunkt: { ...(vorgabe.nullpunkt ?? e.projekt.nullpunkt) } };
    if (vorgabe.stimmung) e = D.setzePalette(e, vorgabe.stimmung);
    else if (Object.keys(e.palette).length) e = fachleute.aendere(e, 'designer', { art: 'setze-palette', palette: {}, ersetze: true }).entwurf;
    // 1. weggefallene Abschnitte leeren (ihre Teile gehen von den Besitzern), geänderte über den Rückgriff öffnen
    if (entfernt.length) e = bereinige(e, new Set(entfernt));
    for (const id of geaendert) {
      const n = neu.get(id);
      e = rueckgriff(e, id, { grund: 'neue Fassung der Spezifikation', intern: true, zaehlen: false, aenderung: { name: n.name, huelle: n.huelle, nach: n.nach, schnittstellen: n.schnittstellen, vorgabe: n.vorgabe } });
    }
    // 2. weggefallene entfernen (jetzt hängt keiner mehr von ihnen ab), neue ergänzen, Reihenfolge neu
    for (const id of entfernt) e = K.entferneAbschnitt(e, id);
    for (const id of hinzu) e = K.ergaenzeAbschnitt(e, neu.get(id), { ordnen: false });
    if (entfernt.length || hinzu.length || geaendert.length) e = K.ordneNeu(e);
    if (entfernt.length || hinzu.length || geaendert.length) {
      e = kopie(e);
      haengeAn(e, 'entscheidung', { von: 'konstrukteur', text: `plant nach der neuen Fassung neu: ${[...geaendert.map((x) => `${x} geändert`), ...hinzu.map((x) => `${x} neu`), ...entfernt.map((x) => `${x} entfernt`)].join(', ')}` });
    }
    return { ...fortsetzen(e, optionen), geaendert, neu: hinzu, entfernt };
  }

  /** Startet den ganzen Ablauf aus einer Vorgabe. */
  function starte(vorgabe, optionen = {}) {
    const v = vorlauf(vorgabe);
    if (v.art === 'wartet') return ergebnis(v.entwurf, 'wartet');
    return fortsetzen(v.entwurf, optionen);
  }

  /**
   * Jonahs Antwort auf eine Rückfrage: `zulassen`, `abschnitt-neu` oder `aendern` (mit `aenderung` am Abschnitt). Danach `fortsetzen`.
   * @returns {object} neuer Entwurf
   */
  function antworte(entwurf, rueckfrageId, { option, aenderung = null }) {
    const r = entwurf.rueckfragen.find((x) => x.id === rueckfrageId);
    if (!r) throw new AblaufFehler(`Rückfrage ${String(rueckfrageId)} gibt es nicht`);
    if (!istOffen(r)) throw new AblaufFehler(`Rückfrage ${rueckfrageId} ist schon beantwortet`);
    if (r.art === 'palette') {
      const name = /^stimmung:(.+)$/.exec(String(option))?.[1];
      if (!name || !D.stimmungen().includes(name)) throw new AblaufFehler(`Option „${String(option)}“ unbekannt (${r.optionen.map((o) => o.id).join(', ')})`);
      const e = D.setzePalette(entwurf, name);
      e.rueckfragen.find((x) => x.id === rueckfrageId).status = 'beantwortet';
      e.einwaende.find((x) => x.id === r.einwand).status = 'beantwortet';
      haengeAn(e, 'entscheidung', { von: 'jonah', text: `wählt die Stimmung „${name}“ für die Gesamtpalette` });
      return e;
    }
    if (!antwortOptionen.includes(option)) throw new AblaufFehler(`Option „${String(option)}“ unbekannt (${antwortOptionen.join(', ')})`);
    const ew = entwurf.einwaende.find((x) => x.id === r.einwand);
    if (option !== 'zulassen' && !ew?.abschnitt) throw new AblaufFehler(`Der Einwand ${r.einwand} gehört zu keinem Abschnitt; er lässt sich nur zulassen`);
    if (option === 'aendern' && !aenderung) throw new AblaufFehler('„aendern“ braucht eine Änderung am Abschnitt');
    let e = kopie(entwurf);
    const rf = e.rueckfragen.find((x) => x.id === rueckfrageId), w = e.einwaende.find((x) => x.id === r.einwand);
    rf.status = 'beantwortet';
    w.status = option === 'zulassen' ? 'zugelassen' : 'beantwortet';
    if (option === 'zulassen') {
      e.zulassungen ??= [];
      if (!e.zulassungen.includes(w.schluessel)) e.zulassungen.push(w.schluessel);
      haengeAn(e, 'entscheidung', { von: 'jonah', text: `lässt den Einwand ${w.id} zu und baut weiter (${w.text})` });
      return e;
    }
    // alle übrigen offenen Rückfragen zu diesem Abschnitt erledigen sich mit dem neuen Ablauf von selbst
    for (const x of e.rueckfragen.filter((y) => istOffen(y))) {
      const z = e.einwaende.find((y) => y.id === x.einwand);
      if (z?.abschnitt === w.abschnitt) { x.status = 'beantwortet'; z.status = 'beantwortet'; }
    }
    haengeAn(e, 'entscheidung', { von: 'jonah', text: option === 'aendern' ? `ändert den Abschnitt ${w.abschnitt} wegen ${w.id} (${Object.keys(aenderung).join(', ')})` : `lässt den Abschnitt ${w.abschnitt} wegen ${w.id} neu planen` });
    return rueckgriff(e, w.abschnitt, { grund: w.text, aenderung: option === 'aendern' ? aenderung : null });
  }

  return { starte, fortsetzen, aktualisiere, abschliessen, rueckgriff, antworte, vorlauf, standardHandler, AblaufFehler };
}

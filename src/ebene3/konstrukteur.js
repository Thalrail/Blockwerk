// Ebene 3 – Konstrukteur: gliedert das Projekt in Abschnitte, sagt den nächsten an, verlegt Verbindungen (Gänge, Schienenwege) und prüft Nähte.
// Fester Algorithmus: gleiche Eingabe = gleiches Ergebnis. Schreibt nur seine eigenen Felder und nur über `fachleute.aendere`.
// Regeln als Daten: data/regeln/planung.json (plan.gliederung, plan.verbindung, plan.naht).
import { kopie } from './entwurf.js';
import { haengeAn } from './bericht.js';
import { rueckfrage } from './bauleiter.js';

const RICHTUNGEN = [{ x: 0, z: -1, name: 'north' }, { x: 1, z: 0, name: 'east' }, { x: 0, z: 1, name: 'south' }, { x: -1, z: 0, name: 'west' }];
const FACHMANN = 'konstrukteur';
const ganz = (n) => Number.isInteger(n);
const istPos = (p) => p && ganz(p.x) && ganz(p.y) && ganz(p.z);
const text = (p) => `(${p.x}, ${p.y}, ${p.z})`;
const gleich = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;

/** Fehler der Vorlage: die Eingabe ist unbrauchbar (kein Raten). */
export class GliederungFehler extends Error {
  constructor(nachricht) { super(`Gliederung: ${nachricht}`); this.name = 'GliederungFehler'; }
}

const imQuader = (p, h) => p.x >= h.von.x && p.x <= h.bis.x && p.y >= h.von.y && p.y <= h.bis.y && p.z >= h.von.z && p.z <= h.bis.z;
/** Rand = innerhalb und mindestens eine Koordinate auf der Außenfläche. */
const amRand = (p, h) => imQuader(p, h) && ['x', 'y', 'z'].some((a) => p[a] === h.von[a] || p[a] === h.bis[a]);
const ueberschneiden = (a, b) => ['x', 'y', 'z'].every((k) => a.von[k] <= b.bis[k] && b.von[k] <= a.bis[k]);
const nebeneinander = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) === 1;

/**
 * @param {{regelwerk: object, fachleute: object, ebene2: object}} quellen
 */
export function erzeugeKonstrukteur({ regelwerk, fachleute, ebene2 }) {
  const gang = regelwerk.parameter('plan.verbindung', 'gang');
  const schiene = regelwerk.parameter('plan.verbindung', 'schiene');
  const arten = regelwerk.parameter('plan.verbindung', 'arten');
  const aendere = (e, a) => fachleute.aendere(e, FACHMANN, a).entwurf;

  // ---- Gliederung ----
  function pruefeVorlage(vorlage) {
    if (!Array.isArray(vorlage) || !vorlage.length) throw new GliederungFehler('die Vorlage braucht mindestens einen Abschnitt');
    const ids = new Set();
    for (const a of vorlage) {
      if (typeof a?.id !== 'string' || !a.id) throw new GliederungFehler('Abschnitt ohne id');
      if (ids.has(a.id)) throw new GliederungFehler(`Abschnitt ${a.id} kommt doppelt vor`);
      ids.add(a.id);
      if (typeof a.name !== 'string' || !a.name) throw new GliederungFehler(`Abschnitt ${a.id} braucht einen Namen`);
      if (!istPos(a.huelle?.von) || !istPos(a.huelle?.bis) || ['x', 'y', 'z'].some((k) => a.huelle.von[k] > a.huelle.bis[k])) throw new GliederungFehler(`Abschnitt ${a.id}: huelle braucht von ≤ bis (ganze Zahlen)`);
    }
    for (const a of vorlage) {
      for (const n of a.nach ?? []) {
        if (!ids.has(n)) throw new GliederungFehler(`Abschnitt ${a.id} kommt nach ${n}, den es nicht gibt`);
        if (n === a.id) throw new GliederungFehler(`Abschnitt ${a.id} kann nicht nach sich selbst kommen`);
      }
      for (const s of a.schnittstellen ?? []) {
        if (typeof s.id !== 'string' || !ids.has(s.mit) || s.mit === a.id) throw new GliederungFehler(`Abschnitt ${a.id}: Schnittstelle braucht id und einen anderen Abschnitt in „mit“`);
        if (!istPos(s.an) || !istPos(s.gegen)) throw new GliederungFehler(`Abschnitt ${a.id}: Schnittstelle ${s.id} braucht „an“ und „gegen“ mit x, y, z`);
        if (s.art !== undefined && !['gang', 'schiene'].includes(s.art)) throw new GliederungFehler(`Abschnitt ${a.id}: Schnittstelle ${s.id} hat die unbekannte Art ${String(s.art)}`);
      }
    }
    for (let i = 0; i < vorlage.length; i++) for (let j = i + 1; j < vorlage.length; j++) {
      if (ueberschneiden(vorlage[i].huelle, vorlage[j].huelle)) throw new GliederungFehler(`die Hüllen von ${vorlage[i].id} und ${vorlage[j].id} überschneiden sich`);
    }
  }

  /** Ordnet nach Abhängigkeit; bei Gleichstand zuerst der Abschnitt nahe am Nullpunkt, dann die kleinere Id. Wirft bei einem Kreis. */
  function ordne(abschnitte, n0) {
    const abstand = (a) => ['x', 'y', 'z'].reduce((s, k) => s + (a.huelle.von[k] + a.huelle.bis[k] - 2 * n0[k]) ** 2, 0);
    const rest = [...abschnitte], reihenfolge = [], fertig = new Set();
    while (rest.length) {
      const kandidaten = rest.filter((a) => (a.nach ?? []).every((n) => fertig.has(n))).sort((a, b) => abstand(a) - abstand(b) || (a.id < b.id ? -1 : 1));
      if (!kandidaten.length) throw new GliederungFehler(`die Abhängigkeiten bilden einen Kreis (${rest.map((a) => a.id).sort().join(', ')})`);
      const a = kandidaten[0];
      rest.splice(rest.indexOf(a), 1);
      fertig.add(a.id);
      reihenfolge.push(a);
    }
    return reihenfolge;
  }

  /**
   * Teilt das Projekt in Abschnitte ein. Reihenfolge nach Abhängigkeit; bei Gleichstand der Abschnitt zuerst, dessen Hülle dem Nullpunkt am nächsten liegt, dann die Id.
   * @param {object} entwurf  ohne Abschnitte
   * @param {{id: string, name: string, huelle: {von: object, bis: object}, nach?: string[], schnittstellen?: object[]}[]} vorlage
   * @returns {object} neuer Entwurf
   */
  function gliedere(entwurf, vorlage) {
    if (entwurf.abschnitte.length) throw new GliederungFehler('der Entwurf ist schon gegliedert (Änderungen macht später der Rückgriff)');
    pruefeVorlage(vorlage);
    const reihenfolge = ordne(vorlage, entwurf.projekt.nullpunkt);
    let e = entwurf;
    reihenfolge.forEach((a, i) => {
      e = aendere(e, { art: 'setze-abschnitt', abschnitt: {
        id: a.id, name: a.name, reihenfolge: i + 1, huelle: { von: { ...a.huelle.von }, bis: { ...a.huelle.bis } },
        nach: [...(a.nach ?? [])].sort(), schnittstellen: (a.schnittstellen ?? []).map((s) => ({ ...s, an: { ...s.an }, gegen: { ...s.gegen } })),
      } });
    });
    return e;
  }

  /**
   * Die Änderungen, die `id` hinter `nach` stellen (zusätzliche Abhängigkeit, neue Reihenfolge aller Abschnitte). Wirft bei einem Kreis
   * oder wenn `id` schon in Arbeit oder fertig ist (das wäre ein Rückgriff).
   * @returns {object[]} Änderungen für `fachleute.aendere` (leer, wenn nichts zu tun ist)
   */
  function abhaengigkeitAenderungen(entwurf, id, nach) {
    const a = entwurf.abschnitte.find((x) => x.id === id), b = entwurf.abschnitte.find((x) => x.id === nach);
    if (!a || !b) throw new GliederungFehler(`Abschnitt ${String(!a ? id : nach)} gibt es nicht`);
    if (a.status !== 'offen') throw new GliederungFehler(`Abschnitt ${id} ist schon ${a.status}; das wäre ein Rückgriff`);
    const neu = entwurf.abschnitte.map((x) => (x.id === id ? { ...x, nach: [...new Set([...(x.nach ?? []), nach])].sort() } : x));
    const geordnet = ordne(neu, entwurf.projekt.nullpunkt);
    return geordnet.map((x, i) => ({ art: 'setze-abschnitt', abschnitt: { ...x, reihenfolge: i + 1 } })).filter((c, i) => {
      const alt = entwurf.abschnitte.find((y) => y.id === c.abschnitt.id);
      return alt.reihenfolge !== c.abschnitt.reihenfolge || alt.nach.length !== c.abschnitt.nach.length;
    });
  }

  /** Stellt `id` hinter `nach` (siehe abhaengigkeitAenderungen) und wendet die Änderungen an. */
  function ergaenzeAbhaengigkeit(entwurf, id, nach) {
    return abhaengigkeitAenderungen(entwurf, id, nach).reduce((e, c) => aendere(e, c), entwurf);
  }

  const nachReihenfolge = (e) => [...e.abschnitte].sort((a, b) => a.reihenfolge - b.reihenfolge);

  /** Sagt den nächsten Abschnitt an (offen, alle Vorgänger fertig); solange einer in Arbeit ist, keinen. */
  function naechster(entwurf) {
    if (entwurf.abschnitte.some((a) => a.status === 'in-arbeit')) return { entwurf, abschnitt: null, grund: 'in-arbeit' };
    const fertig = new Set(entwurf.abschnitte.filter((a) => a.status === 'fertig').map((a) => a.id));
    const a = nachReihenfolge(entwurf).find((x) => x.status === 'offen' && (x.nach ?? []).every((n) => fertig.has(n)));
    if (!a) return { entwurf, abschnitt: null, grund: entwurf.abschnitte.every((x) => x.status === 'fertig') ? 'alles-fertig' : 'blockiert' };
    const e = kopie(aendere(entwurf, { art: 'setze-abschnitt', abschnitt: { ...a, status: 'in-arbeit' } }));
    haengeAn(e, 'abschnitt', { abschnitt: a.id, text: `Der Konstrukteur sagt „${a.name}“ als Nummer ${a.reihenfolge} an` });
    return { entwurf: e, abschnitt: e.abschnitte.find((x) => x.id === a.id), grund: null };
  }

  /** Schließt einen Abschnitt in Arbeit ab. */
  function schliesse(entwurf, id) {
    const a = entwurf.abschnitte.find((x) => x.id === id);
    if (!a) throw new GliederungFehler(`Abschnitt ${String(id)} gibt es nicht`);
    if (a.status !== 'in-arbeit') throw new GliederungFehler(`Abschnitt ${id} ist nicht in Arbeit (Status ${a.status})`);
    const e = kopie(aendere(entwurf, { art: 'setze-abschnitt', abschnitt: { ...a, status: 'fertig' } }));
    haengeAn(e, 'abschnitt', { abschnitt: id, text: `Der Konstrukteur erklärt „${a.name}“ für fertig` });
    return e;
  }

  // ---- Verbindungen ----
  const dreh = (x, z, d) => { for (let i = 0; i < d; i++) [x, z] = [-z, x]; return { x, z }; };

  /** Wie weit reicht ein Gang der Länge n nach hinten (größtes lokales z)? Aus dem Baustein selbst, nicht geraten. */
  function gangSuedende(laenge) {
    const paket = ebene2.baue('bau.gang', { laenge, ...gang });
    return Math.max(...paket.bloecke.map((b) => b.z));
  }

  const teilJson = (baustein, parameter, start, d, weg, abschnitt, versatz = 0) => ({
    abschnitt, baustein, parameter, verbindung: true, weg,
    lage: { x: start.x - dreh(0, versatz, d).x, y: start.y, z: start.z - dreh(0, versatz, d).z, drehung: d },
  });
  const schritt = (p, d, n) => ({ x: p.x + RICHTUNGEN[d].x * n, y: p.y, z: p.z + RICHTUNGEN[d].z * n });

  /** Antriebsstrecke über n Zellen: volle Perioden (je 1 Antriebsschiene + bis zu 7 normale) und eine kürzere Rest-Periode. */
  function strecke(start, d, n, weg, abschnitt) {
    const teile = [];
    const periode = schiene.periode;
    let p = start, voll = Math.floor(n / periode);
    while (voll > 0) {
      const k = Math.min(voll, 64);
      teile.push(teilJson('tech.antriebsstrecke', { abschnitte: k, abstand: periode - 1 }, p, d, weg, abschnitt));
      p = schritt(p, d, k * periode);
      voll -= k;
    }
    if (n % periode) teile.push(teilJson('tech.antriebsstrecke', { abschnitte: 1, abstand: (n % periode) - 1 }, p, d, weg, abschnitt));
    return teile;
  }

  const richtungVon = (dx, dz) => RICHTUNGEN.findIndex((r) => r.x === Math.sign(dx) && r.z === Math.sign(dz));

  /** Wege planen (nur Daten, ändert nichts). Wirft Error('…') mit dem Grund, wenn der Weg nicht möglich ist. */
  function plane(art, von, nach, weg, abschnitt) {
    let dx = nach.x - von.x, dy = nach.y - von.y, dz = nach.z - von.z;
    const gerade = (dx === 0) !== (dz === 0);
    if (art === 'gang') {
      if (dy !== 0) throw new Error('Gänge werden nur waagerecht verlegt (Höhenunterschied; Treppen sind Bauelemente des Architekten)');
      if (!gerade) throw new Error('Gänge werden nur gerade verlegt (nicht schräg und nicht um die Ecke)');
      const d = richtungVon(dx, dz), laenge = Math.abs(dx + dz) + 1;
      try { return { teile: [teilJson('bau.gang', { laenge, ...gang }, von, d, weg, abschnitt, gangSuedende(laenge))], richtung: d, start: von }; } catch (f) { throw new Error(`Gang der Länge ${laenge} ist nicht baubar: ${f.message}`); }
    }
    if (art !== 'schiene') throw new Error(`Unbekannte Art der Verbindung: ${String(art)}`);
    let umgekehrt = false;
    if (dy < 0) { [von, nach] = [nach, von]; dx = -dx; dy = -dy; dz = -dz; umgekehrt = true; }
    if (dy > schiene.maxSteigung) throw new Error(`Höhenunterschied ${dy} ist größer als die geprüfte Steigung von ${schiene.maxSteigung} Blöcken`);
    if (dx === 0 && dz === 0) throw new Error('Start und Ziel sind derselbe Ort');
    if (gerade) {
      const d = richtungVon(dx, dz), zellen = Math.abs(dx + dz) + 1;
      if (zellen < dy + 1) throw new Error(`Die Rampe von ${dy} Blöcken braucht mindestens ${dy + 1} Zellen, es sind ${zellen}`);
      const teile = [];
      let p = von, rest = zellen;
      if (dy > 0) { teile.push(teilJson('tech.steigung', { hoehe: dy }, p, d, weg, abschnitt)); p = { ...schritt(p, d, dy + 1), y: p.y + dy }; rest -= dy + 1; }
      teile.push(...strecke(p, d, rest, weg, abschnitt));
      return { teile, richtung: d, start: von, umgekehrt };
    }
    if (dy !== 0) throw new Error('Eine Kurve mit gleichzeitigem Höhenunterschied wird nicht verlegt (erst Rampe, dann Kurve als getrennte Wege)');
    const d1 = richtungVon(0, dz), d2 = richtungVon(dx, 0), l1 = Math.abs(dz), l2 = Math.abs(dx);
    const s = Math.min(l1, l2, schiene.maxSchenkel);
    const rechts = d2 === (d1 + 1) % 4;
    const teile = [];
    if (l1 > s) teile.push(...strecke(von, d1, l1 - s, weg, abschnitt));
    const ks = schritt(von, d1, l1 - s);
    teile.push(teilJson('tech.kurve', { schenkel: s, drehsinn: rechts ? 1 : 0 }, ks, d1, weg, abschnitt));
    if (l2 > s) teile.push(...strecke(schritt(schritt(ks, d1, s), d2, s + 1), d2, l2 - s, weg, abschnitt));
    return { teile, richtung: d1, start: von, umgekehrt };
  }

  /**
   * Verlegt eine Verbindung von Zelle `von` nach Zelle `nach` (jeweils begehbare Zelle bzw. Schienenzelle) als Teile mit „verbindung“.
   * Ist der Weg nicht möglich, wird nichts geraten: Der Bauleiter stellt Jonah eine Rückfrage.
   * @returns {{entwurf: object, teile: string[], pruefung: string|null, rueckfrage: object|null}}
   */
  function verlege(entwurf, { abschnitt, von, nach, art }) {
    if (!entwurf.abschnitte.some((a) => a.id === abschnitt)) throw new GliederungFehler(`Abschnitt ${String(abschnitt)} gibt es nicht`);
    if (!istPos(von) || !istPos(nach)) throw new GliederungFehler('von und nach brauchen x, y, z');
    const wege = new Set(entwurf.teile.filter((t) => t.weg).map((t) => t.weg));
    const weg = `V${wege.size + 1}`;
    let plan;
    try { plan = plane(art, von, nach, weg, abschnitt); } catch (f) {
      const e = kopie(entwurf);
      const ew = { id: `E${e.zaehler.einwand++}`, von: 'bauleiter', an: FACHMANN, regel: 'plan.verbindung', ort: { ...von }, schwere: 'verstoss', ziel: null, abschnitt, text: `${art} von ${text(von)} nach ${text(nach)} ist nicht möglich: ${f.message}`, schluessel: `plan.verbindung|${weg}`, runde: 0, status: 'eskaliert' };
      e.einwaende.push(ew);
      return { entwurf: e, teile: [], pruefung: null, rueckfrage: rueckfrage(e, ew, { runden: 0 }) };
    }
    let e = entwurf;
    const ids = [];
    for (const t of plan.teile) {
      const r = fachleute.aendere(e, FACHMANN, { art: 'setze-teil', teil: t });
      e = r.entwurf;
      ids.push(e.teile.at(-1).id);
    }
    // Prüfauftrag: gehen bzw. fahren von Anfang bis Ende (eine Bahn nach unten wird vom unteren Ende aus geprüft)
    const pid = `P${weg}`;
    const pruefung = art === 'gang'
      ? { id: pid, art: 'begehbar', weg, start: { ...von }, ziele: arten.map((a) => ({ pos: { ...nach }, art: a })) }
      : { id: pid, art: 'lore', weg, start: { ...plan.start }, richtung: RICHTUNGEN[plan.richtung].name };
    e = aendere(e, { art: 'setze-pruefung', pruefung });
    return { entwurf: e, teile: ids, pruefung: pid, rueckfrage: null };
  }

  // ---- Nähte ----
  /** Alle Nähte zwischen zwei fertigen Abschnitten, jede mit ihren Befunden (leere Liste = in Ordnung). */
  function naehte(entwurf) {
    const fertig = new Map(entwurf.abschnitte.filter((a) => a.status === 'fertig').map((a) => [a.id, a]));
    const liste = [];
    for (const a of nachReihenfolge(entwurf)) {
      if (!fertig.has(a.id)) continue;
      for (const s of a.schnittstellen ?? []) {
        const b = fertig.get(s.mit);
        if (!b) continue;
        const befunde = [];
        if (!amRand(s.an, a.huelle)) befunde.push({ ort: { ...s.an }, text: `Naht ${s.id} zwischen ${a.id} und ${b.id}: ${text(s.an)} liegt nicht am Rand der Hülle von ${a.id}` });
        if (!amRand(s.gegen, b.huelle)) befunde.push({ ort: { ...s.gegen }, text: `Naht ${s.id} zwischen ${a.id} und ${b.id}: ${text(s.gegen)} liegt nicht am Rand der Hülle von ${b.id}` });
        if (!nebeneinander(s.an, s.gegen)) befunde.push({ ort: { ...s.an }, text: `Naht ${s.id} zwischen ${a.id} und ${b.id}: ${text(s.an)} und ${text(s.gegen)} liegen nicht Seite an Seite` });
        liste.push({ abschnitt: a.id, mit: b.id, schnittstelle: s, befunde });
      }
    }
    return liste;
  }

  /**
   * Legt für jede in Ordnung befundene Naht der Art Gang/Schiene einen Prüfauftrag an (Begehbarkeit bzw. Lorenfahrt über die Naht).
   * @returns {object} neuer Entwurf
   */
  function pruefeNaehte(entwurf) {
    let e = entwurf;
    for (const n of naehte(entwurf)) {
      const s = n.schnittstelle;
      if (n.befunde.length || !s.art) continue;
      const id = `PN-${n.abschnitt}-${s.id}`;
      const pruefung = s.art === 'gang'
        ? { id, art: 'begehbar', naht: s.id, start: { ...s.an }, ziele: arten.map((a) => ({ pos: { ...s.gegen }, art: a })) }
        : { id, art: 'lore', naht: s.id, start: { ...s.an }, richtung: RICHTUNGEN[richtungVon(s.gegen.x - s.an.x, s.gegen.z - s.an.z)]?.name ?? 'north' };
      e = aendere(e, { art: 'setze-pruefung', pruefung });
    }
    return e;
  }

  return { gliedere, abhaengigkeitAenderungen, ergaenzeAbhaengigkeit, naechster, schliesse, verlege, naehte, pruefeNaehte, GliederungFehler };
}

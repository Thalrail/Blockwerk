// Ebene 3 – Techniker: macht aus dem Bedarf eines Abschnitts Technikmodule (Ebene 2), prüft den Platz in der Technikzone, setzt Sperrzonen,
// führt die Gesamtbilanz und erhebt Einspruch gegen eine technisch unmögliche Reihenfolge. Für Bedarf ohne Modul stellt er eine Schaltungsanfrage.
// Fester Algorithmus: gleiche Eingabe = gleiches Ergebnis. Schreibt nur seine Felder und nur über `fachleute.aendere`.
// Regeln als Daten: data/regeln/planung.json (plan.bedarf, plan.bilanz, plan.einspruch).
import { kopie } from './entwurf.js';
import { haengeAn } from './bericht.js';

const FACHMANN = 'techniker';
const text = (p) => `(${p.x}, ${p.y}, ${p.z})`;

/** Fehler des Bedarfs: die Eingabe ist unbrauchbar (kein Raten). */
export class BedarfFehler extends Error {
  constructor(nachricht) { super(`Bedarf: ${nachricht}`); this.name = 'BedarfFehler'; }
}

/**
 * @param {{regelwerk: object, fachleute: object, ebene1: object, ebene2: object, materialisierung: object}} quellen
 */
export function erzeugeTechniker({ regelwerk, fachleute, ebene1, ebene2, materialisierung }) {
  const arten = regelwerk.parameter('plan.bedarf', 'arten');
  const umkreis = regelwerk.parameter('plan.bedarf', 'umkreis');
  const abstand = regelwerk.parameter('plan.bedarf', 'abstand');
  const zonenfunktion = regelwerk.parameter('plan.bedarf', 'zonenfunktion');
  const aendere = (e, a) => fachleute.aendere(e, FACHMANN, a).entwurf;

  const teilen = (liste, n) => { const r = []; for (let i = 0; i < liste.length; i += n) r.push(liste.slice(i, i + n)); return r; };

  /** Teilt einen bekannten Bedarf in Module (Bausteinparameter je Modul); höchstens `maximum` Einheiten je Modul. */
  function module(b) {
    const art = arten[b.art];
    if (art.menge) {
      if (!Number.isInteger(b[art.menge]) || b[art.menge] < 1) throw new BedarfFehler(`${b.id}: ${art.menge} braucht eine ganze Zahl ab 1`);
      const n = b[art.menge], teile = [];
      const bauart = b.bauart === undefined ? null : art.bauarten?.[b.bauart];
      if (b.bauart !== undefined && !bauart) throw new BedarfFehler(`${b.id}: Bauart „${b.bauart}“ gibt es nicht (${Object.keys(art.bauarten ?? {}).join(', ')})`);
      const { baustein, maximum } = bauart ?? art;
      for (let rest = n; rest > 0; rest -= maximum) teile.push({ [art.menge]: Math.min(rest, maximum), ...(b.beruf !== undefined ? { beruf: b.beruf } : {}) });
      return teile.map((parameter) => ({ baustein, parameter }));
    }
    if (!Array.isArray(b[art.liste]) || !b[art.liste].length) throw new BedarfFehler(`${b.id}: ${art.liste} braucht eine Liste mit mindestens einem Eintrag`);
    return teilen(b[art.liste], art.maximum).map((teil) => ({ baustein: art.baustein, parameter: { [art.liste]: teil } }));
  }

  /** Baut das Modul probeweise (prüft die Parameter) und liefert seine Hülle. */
  function huelleVon(m, b) {
    try { return ebene2.baue(m.baustein, m.parameter).platzbedarf.huelle; } catch (f) { throw new BedarfFehler(`${b.id}: ${f.message}`); }
  }

  const technikZone = (e, abschnitt) => e.zonen.find((z) => z.abschnitt === abschnitt && z.funktion === zonenfunktion) ?? null;
  const platziert = (e, b) => e.teile.some((t) => t.bedarf === b.id);

  /**
   * Nimmt den Bedarf in den Entwurf auf. Bedarf ohne Modul wird zur Schaltungsanfrage (kein Rateversuch).
   * @param {object[]} liste  {id, abschnitt, art, anzahl|sorten, beruf?, braucht?, forderung?}
   * @returns {object} neuer Entwurf
   */
  function setzeBedarf(entwurf, liste) {
    let e = entwurf;
    for (const b of liste) {
      if (arten[b.art]) for (const m of module(b)) huelleVon(m, b);
      e = aendere(e, { art: 'setze-bedarf', bedarf: b });
      if (!arten[b.art] && !(e.anfragen ?? []).some((a) => a.bedarf === b.id)) {
        const id = `S${(e.anfragen ?? []).length + 1}`;
        e = aendere(e, { art: 'setze-anfrage', anfrage: { id, bedarf: b.id, abschnitt: b.abschnitt, art: b.art } });
        e = kopie(e);
        haengeAn(e, 'anfrage', { id, bedarf: b.id, abschnitt: b.abschnitt, art: b.art });
      }
    }
    return e;
  }

  /** Alle noch nicht gesetzten Module eines Abschnitts mit Hülle, in der Reihenfolge des Bedarfs. */
  function offeneModule(e, abschnitt) {
    const liste = [];
    for (const b of (e.bedarf ?? []).filter((x) => x.abschnitt === abschnitt && arten[x.art] && !platziert(e, x))) {
      for (const m of module(b)) liste.push({ ...m, bedarf: b.id, huelle: huelleVon(m, b) });
    }
    return liste;
  }

  /**
   * Ordnet die Module in Reihen in der Zone an (erste freie Stelle, Reihen nacheinander, `abstand` dazwischen).
   * @returns {{lagen: object[]|null, mindest: {breite: number, tiefe: number, hoehe: number}}} mindest = Maß einer einzigen Reihe aller Module
   */
  function anordne(liste, zone) {
    const maße = liste.map((m) => ({ b: m.huelle.bis.x - m.huelle.von.x + 1, t: m.huelle.bis.z - m.huelle.von.z + 1, h: m.huelle.bis.y - m.huelle.von.y + 1 }));
    const mindest = {
      breite: maße.reduce((s, x) => s + x.b, 0) + abstand * (maße.length - 1),
      tiefe: Math.max(...maße.map((x) => x.t)),
      hoehe: Math.max(...maße.map((x) => x.h)),
    };
    const lagen = [];
    let cx = zone.von.x, rz = zone.von.z, reihe = 0;
    for (const [i, m] of liste.entries()) {
      const x = maße[i];
      if (x.h > zone.bis.y - zone.von.y + 1 || x.b > zone.bis.x - zone.von.x + 1) return { lagen: null, mindest };
      if (cx + x.b - 1 > zone.bis.x) { cx = zone.von.x; rz += reihe + abstand; reihe = 0; }
      if (rz + x.t - 1 > zone.bis.z) return { lagen: null, mindest };
      lagen.push({ x: cx - m.huelle.von.x, y: zone.von.y - m.huelle.von.y, z: rz - m.huelle.von.z });
      cx += x.b + abstand;
      reihe = Math.max(reihe, x.t);
    }
    return { lagen, mindest };
  }

  /** Probeanordnung für einen Abschnitt (ändert nichts): Module, Zone, passt es, Mindestmaß. */
  function plane(entwurf, abschnitt) {
    const liste = offeneModule(entwurf, abschnitt);
    const zone = technikZone(entwurf, abschnitt);
    if (!liste.length) return { liste, zone, passt: true, lagen: [], mindest: null };
    if (!zone) return { liste, zone, passt: false, lagen: null, mindest: anordne(liste, { von: { x: 0, y: 0, z: 0 }, bis: { x: 0, y: 0, z: 0 } }).mindest };
    const a = anordne(liste, zone);
    return { liste, zone, passt: a.lagen !== null, lagen: a.lagen, mindest: a.mindest };
  }

  const verschoben = (h, l) => ({ von: { x: h.von.x + l.x, y: h.von.y + l.y, z: h.von.z + l.z }, bis: { x: h.bis.x + l.x, y: h.bis.y + l.y, z: h.bis.z + l.z } });

  /**
   * Setzt alle Module des Abschnitts in die Technikzone, dazu Sperrzonen um die Handelsnischen und die Anschlüsse in Weltkoordinaten.
   * Passt der Bedarf nicht, bleibt der Entwurf unverändert (der Einwand an den Grobdesigner kommt aus `einwaende`).
   * @returns {{entwurf: object, teile: string[], passt: boolean, mindest: object|null}}
   */
  function setzeModule(entwurf, abschnitt) {
    if (!entwurf.abschnitte.some((a) => a.id === abschnitt)) throw new BedarfFehler(`Abschnitt ${String(abschnitt)} gibt es nicht`);
    const p = plane(entwurf, abschnitt);
    if (!p.passt) return { entwurf, teile: [], passt: false, mindest: p.mindest };
    let e = entwurf;
    const ids = [];
    p.liste.forEach((m, i) => {
      const lage = { ...p.lagen[i], drehung: 0 };
      const paket = ebene2.baue(m.baustein, m.parameter);
      const anschluesse = paket.anschluesse.map((a) => (Number.isInteger(a.x) ? { ...a, x: a.x + lage.x, y: a.y + lage.y, z: a.z + lage.z } : { ...a }));
      e = aendere(e, { art: 'setze-teil', teil: { abschnitt, baustein: m.baustein, parameter: m.parameter, lage, bedarf: m.bedarf, anschluesse } });
      const id = e.teile.at(-1).id;
      ids.push(id);
      if (m.baustein === 'tech.handelsnischen' || m.baustein === 'tech.handelsnischen-lore') {
        const h = verschoben(m.huelle, lage);
        e = aendere(e, { art: 'setze-sperrzone', sperrzone: {
          id: `SZ-${id}`, verbot: 'arbeitsblock',
          von: { x: h.von.x - umkreis.waagerecht, y: h.von.y - umkreis.senkrecht, z: h.von.z - umkreis.waagerecht },
          bis: { x: h.bis.x + umkreis.waagerecht, y: h.bis.y + umkreis.senkrecht, z: h.bis.z + umkreis.waagerecht },
        } });
      }
    });
    return { entwurf: e, teile: ids, passt: true, mindest: p.mindest };
  }

  /** Gesamtbilanz über alle fertigen Abschnitte; trägt sie in den Baubericht ein. */
  function bilanz(entwurf) {
    const fertig = new Set(entwurf.abschnitte.filter((a) => a.status === 'fertig').map((a) => a.id));
    const teil = { ...kopie(entwurf), teile: kopie(entwurf).teile.filter((t) => fertig.has(t.abschnitt)) };
    const welt = materialisierung.materialisiere(teil, { testmaterial: true }).welt;
    const d = ebene1.dorf;
    const werte = {
      abschnitte: fertig.size,
      betten: d.betten(welt).filter((b) => b.gueltig).length,
      dorfbewohner: d.dorfbewohner(welt).length,
      berufsbloecke: d.berufsbloecke(welt).length,
      golem: d.dorf(welt)?.golem ?? 'nein',
    };
    const e = kopie(entwurf);
    haengeAn(e, 'bilanz', werte);
    return { entwurf: e, werte };
  }

  /** Einwände des Technikers für das Einwand-Protokoll: Platz in der Zone, Reihenfolge, Forderungen an die Bilanz. */
  function einwaende(entwurf) {
    const liste = [];
    const abschnittVon = (id) => entwurf.abschnitte.find((a) => a.id === id);
    // Platz: Bedarf gegen Technikzone
    for (const a of entwurf.abschnitte) {
      const p = plane(entwurf, a.id);
      if (p.passt) continue;
      const m = p.mindest;
      const massText = `in einer Reihe mindestens ${m.breite} × ${m.tiefe} × ${m.hoehe} Blöcke (Breite × Tiefe × Höhe)`;
      if (!p.zone) {
        liste.push({ regel: 'plan.bedarf', von: FACHMANN, an: 'grobdesigner', ort: { ...a.huelle.von }, schwere: 'verstoss', ziel: `abschnitt:${a.id}`, abschnitt: a.id, text: `Der Abschnitt ${a.id} hat keine Technikzone, braucht aber ${massText}`, schluessel: `plan.bedarf|zone-fehlt|${a.id}` });
      } else {
        const z = p.zone;
        liste.push({ regel: 'plan.bedarf', von: FACHMANN, an: 'grobdesigner', ort: { ...z.von }, schwere: 'verstoss', ziel: `zone:${z.id}`, abschnitt: a.id, text: `Die Technikzone ${z.id} (${z.bis.x - z.von.x + 1} × ${z.bis.z - z.von.z + 1} × ${z.bis.y - z.von.y + 1}) reicht für den Bedarf nicht, nötig sind ${massText}`, schluessel: `plan.bedarf|zone-zu-klein|${z.id}` });
      }
    }
    // Einspruch gegen die Reihenfolge
    for (const b of entwurf.bedarf ?? []) {
      const a = abschnittVon(b.abschnitt);
      for (const n of b.braucht ?? []) {
        const v = abschnittVon(n);
        if (!v || !a || v.reihenfolge <= a.reihenfolge) continue;
        liste.push({ regel: 'plan.einspruch', von: FACHMANN, an: 'konstrukteur', ort: { ...a.huelle.von }, schwere: 'verstoss', ziel: `abschnitt:${a.id}`, abschnitt: a.id, text: `Der Bedarf ${b.id} im Abschnitt ${a.id} braucht zuerst den Abschnitt ${n}, der aber erst als Nummer ${v.reihenfolge} nach Nummer ${a.reihenfolge} kommt`, schluessel: `plan.einspruch|${b.id}|${n}`, braucht: n });
      }
    }
    // Forderungen an die Bilanz (nur wenn der Abschnitt des Bedarfs fertig ist)
    const fordernde = (entwurf.bedarf ?? []).filter((b) => b.forderung && abschnittVon(b.abschnitt)?.status === 'fertig');
    if (fordernde.length) {
      const { werte } = bilanz(entwurf);
      for (const b of fordernde) {
        const soll = b.forderung.golem;
        if (soll === undefined || (soll === true) === (werte.golem === 'ja')) continue;
        const a = abschnittVon(b.abschnitt);
        liste.push({ regel: 'plan.bilanz', von: 'bauleiter', an: FACHMANN, ort: { ...a.huelle.von }, schwere: 'verstoss', ziel: `bedarf:${b.id}`, abschnitt: a.id, text: `Der Bedarf ${b.id} fordert ${soll ? 'einen' : 'keinen'} Iron Golem, die Gesamtbilanz sagt aber „${werte.golem}“ (${werte.betten} Betten, ${werte.dorfbewohner} Dorfbewohner)`, schluessel: `plan.bilanz|${b.id}|golem` });
      }
    }
    return liste;
  }

  /**
   * Mindestmaß einer einzigen Reihe aller Module für einen Bedarf (ohne Entwurf): {breite, tiefe, hoehe} oder null, wenn kein Modul nötig ist.
   * @param {object[]} bedarf  {id, art, anzahl|sorten, …}
   */
  function mindestmass(bedarf) {
    const liste = [];
    for (const b of bedarf.filter((x) => arten[x.art])) for (const m of module(b)) liste.push({ ...m, huelle: huelleVon(m, b) });
    return liste.length ? anordne(liste, { von: { x: 0, y: 0, z: 0 }, bis: { x: 0, y: 0, z: 0 } }).mindest : null;
  }

  return { setzeBedarf, plane, setzeModule, bilanz, einwaende, mindestmass, BedarfFehler };
}

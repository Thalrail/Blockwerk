// Ebene 3 – Brücke zu den tieferen Ebenen: Entwurf → Welt (nur über Ebene 0) und Entwurf → Prüfer-Meldungen (Ebene 1).
// Jedes Teil wird mit Ebene 2 gebaut (`baue`), in einer eigenen Welt platziert, über den Vermesser gedreht und verschoben und dann in die
// Gesamtwelt eingefügt. Die Gesamtwelt wird nur über `welt.fuegeBauteilEin` beschrieben.
import { dreheRichtung } from '../ebene0/richtungen.js';
import { TESTPALETTE, aussparungsZellen, zellenInWelt } from '../ebene2/index.js';
import { erzeugeLagen } from './lagen.js';
import { erzeugeAenderungen } from './aenderungen.js';

const key = (x, y, z) => `${x},${y},${z}`;

/** Die Palette reicht für einen produktiven Bauplan nicht aus (Rollen fehlen oder eine Form fehlt). Es wird nie mit Testmaterial ergänzt. */
export class PaletteFehler extends Error {
  /** @param {string} nachricht @param {Array<{abschnitt: string, rollen: string[]}>} fehlend */
  constructor(nachricht, fehlend = []) { super(`Palette: ${nachricht}`); this.name = 'PaletteFehler'; this.fehlend = fehlend; }
}

/**
 * @param {{regelwerk: import('../ebene1/regelwerk.js').Regelwerk, ebene0: object, ebene1: object, ebene2: object}} quellen
 */
export function erzeugeMaterialisierung({ regelwerk, ebene0, ebene1, ebene2 }) {
  const pruefstart = regelwerk.parameter('plan.geometrie', 'pruefstart');
  const rollen = regelwerk.parameter('plan.palette', 'rollen');
  const lagen = erzeugeLagen({ ebene0, ebene2 });
  const aenderungsmodul = erzeugeAenderungen({ ebene0, ebene2 });

  /**
   * Palette eines Abschnitts: Gesamtpalette, darüber die Abschnittspalette (Rolle → Block oder Block je Form).
   * Die TESTPALETTE kommt nur dazu, wenn der Aufrufer es mit `testmaterial: true` ausdrücklich verlangt (Planungsgeometrie, Tests); ein Bauplan nie.
   */
  const paletteVon = (entwurf, abschnitt, { testmaterial = false } = {}) => ({ ...(testmaterial ? TESTPALETTE : {}), ...entwurf.palette, ...(entwurf.paletten?.[abschnitt] ?? {}) });

  /** Rollentausch eines Teils (z. B. Sockel eines Rezepts: Wand → Akzent): die Rolle bekommt den Block der anderen Rolle; ohne `rollen` bleibt die Palette unverändert. */
  const mitRollen = (palette, tausch) => (tausch ? { ...palette, ...Object.fromEntries(Object.entries(tausch).filter(([, nach]) => palette[nach] !== undefined).map(([von, nach]) => [von, palette[nach]])) } : palette);

  /** Rollen, die für den Abschnitt keinen Block haben (leer = vollständig belegt). */
  const fehlendeRollen = (entwurf, abschnitt) => {
    const p = paletteVon(entwurf, abschnitt);
    return rollen.filter((r) => !p[r]);
  };

  /** Abschnitte mit unvollständiger Palette: Abschnitte, die Teile haben (oder, ohne `nurMitTeilen`, alle). */
  function paletteLuecken(entwurf, { nurMitTeilen = false } = {}) {
    const ids = nurMitTeilen ? [...new Set(entwurf.teile.map((t) => t.abschnitt))] : entwurf.abschnitte.map((a) => a.id);
    return ids.map((abschnitt) => ({ abschnitt, rollen: fehlendeRollen(entwurf, abschnitt) })).filter((x) => x.rollen.length);
  }

  // Ein Teil ist eine reine Funktion von Baustein, Parametern, Lage und Palette: unveränderte Teile werden nicht in jeder Einwand-Runde neu gebaut
  // (bei der Zitadelle waren das mehrere hundert Wiederholungen). Die Einträge werden nur gelesen; der Speicher ist auf wenige Dutzend Teile begrenzt.
  const teilSpeicher = new Map();
  const TEIL_SPEICHER_MAX = 96;

  /** Baut ein Teil: Paket, gedrehte und verschobene Blöcke, Blockschlüssel, Hülle, Startpunkt für die Lorenprüfung. */
  function baueTeil(entwurf, teil, optionen) {
    const schluesselTeil = JSON.stringify([teil.baustein, teil.parameter, teil.lage, paletteVon(entwurf, teil.abschnitt, optionen), teil.rollen]);
    const gemerkt = teilSpeicher.get(schluesselTeil);
    if (gemerkt) { teilSpeicher.delete(schluesselTeil); teilSpeicher.set(schluesselTeil, gemerkt); return gemerkt; } // zuletzt benutzt nach hinten
    const t = baueTeilNeu(entwurf, teil, optionen);
    teilSpeicher.set(schluesselTeil, t);
    if (teilSpeicher.size > TEIL_SPEICHER_MAX) teilSpeicher.delete(teilSpeicher.keys().next().value);
    return t;
  }

  function baueTeilNeu(entwurf, teil, optionen) {
    const paket = ebene2.baue(teil.baustein, teil.parameter);
    const w = ebene0.neueWelt();
    try { ebene2.platziere(w, paket, mitRollen(paletteVon(entwurf, teil.abschnitt, optionen), teil.rollen)); } catch (f) {
      // fehlt dem Bauplan ein Block (Rolle oder Form), sagt die Meldung, bei welchem Teil; mit Testmaterial kann das nicht passieren
      if (!optionen.testmaterial && /^Palette kennt/.test(f.message)) throw new PaletteFehler(`Teil ${teil.id} (${teil.baustein}, Abschnitt ${teil.abschnitt}): ${f.message}`, [{ abschnitt: teil.abschnitt, rollen: [] }]);
      throw f;
    }
    const h = paket.platzbedarf.huelle;
    let bauteil = w.ausschnitt(h.von, h.bis);
    bauteil = ebene0.vermesser.drehe(bauteil, teil.lage.drehung);
    bauteil = ebene0.vermesser.verschiebe(bauteil, { x: teil.lage.x, y: teil.lage.y, z: teil.lage.z });
    const schluessel = new Set(bauteil.bloecke.map((b) => key(b.x, b.y, b.z)));
    const arbeitsbloecke = new Set(bauteil.bloecke.filter((b) => ebene0.register.bloecke.block(b.id).eigenschaften.arbeitsblock).map((b) => key(b.x, b.y, b.z)));
    let start = null;
    const s = pruefstart[teil.baustein];
    if (s) {
      let [x, z] = [s.x, s.z];
      let richtung = s.richtung;
      for (let i = 0; i < teil.lage.drehung; i++) { [x, z] = [-z, x]; richtung = dreheRichtung(richtung, 1); }
      start = { pos: { x: x + teil.lage.x, y: s.y + teil.lage.y, z: z + teil.lage.z }, richtung };
    }
    return { bauteil, schluessel, arbeitsbloecke, start, huelle: huelleVon(bauteil.bloecke) };
  }

  function huelleVon(bloecke) {
    if (!bloecke.length) return null;
    const von = { x: Infinity, y: Infinity, z: Infinity }, bis = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const b of bloecke) for (const a of ['x', 'y', 'z']) { if (b[a] < von[a]) von[a] = b[a]; if (b[a] > bis[a]) bis[a] = b[a]; }
    return { von, bis };
  }

  /** Reihenfolge der Teile: Abschnittsreihenfolge, dann Teil-Nummer (deterministisch). */
  function teileInReihenfolge(entwurf) {
    const reihenfolge = new Map(entwurf.abschnitte.map((a) => [a.id, a.reihenfolge]));
    const nummer = (id) => Number(String(id).replace(/\D/g, '')) || 0;
    return [...entwurf.teile].sort((a, b) => (reihenfolge.get(a.abschnitt) ?? 0) - (reihenfolge.get(b.abschnitt) ?? 0) || nummer(a.id) - nummer(b.id));
  }

  /**
   * Einbau (docs/architektur-einbau.md 3.3): Aussparungen der Kinder werden aus den Blöcken ihres Trägers entfernt (nur aus denen des direkten Trägers, nie aus
   * Fremden); Freihaltungen werden als Mengen mit Herkunft gemerkt (die Prüfung steht in einwand.js). Gibt zurück:
   *  - `schnitt`: Träger-ID → Zellenschlüssel, die dem Träger entfallen,
   *  - `kinder`: Kind-ID → { traeger, zone (Zellen der Einbauzone in der Welt), ersetzt (Blöcke des Trägers, die das Kind per Öffnung ersetzt) },
   *  - `freihaltung`: Zellenschlüssel → Menge der Kind-IDs, die die Zelle freihalten wollen,
   *  - `herkunft`: Zellenschlüssel der tatsächlich entfernten Trägerblöcke → { traeger, von: [{ kind, art }] } (für die Anzeige im Bauplan).
   * Der Ablauf ist je Träger gleich dem rekursiven Zusammenbau (Blöcke, dann Aussparungen der direkten Kinder); Ketten Raum → Wand → Tür ergeben sich daraus,
   * weil jedes Kind nur seinen eigenen Träger schneidet.
   */
  function einbauVon(entwurf, roh) {
    const nachRef = new Map(entwurf.teile.filter((t) => t.ref !== undefined).map((t) => [t.ref, t]));
    const schnitt = new Map(), kinder = new Map(), freihaltung = new Map(), herkunft = new Map();
    const merke = (c, tr, kind, art) => { if (!herkunft.has(c)) herkunft.set(c, { traeger: tr.id, von: [] }); herkunft.get(c).von.push({ kind: kind.id, art }); };
    const ks = (z) => key(z.x, z.y, z.z);
    for (const kind of [...entwurf.teile].filter((t) => t.traeger !== undefined).sort((a, b) => (a.ref < b.ref ? -1 : 1))) {
      const tr = nachRef.get(kind.traeger);
      const trBloecke = roh.get(tr.id).schluessel;
      const paketK = ebene2.baue(kind.baustein, kind.parameter ?? {}), paketT = ebene2.baue(tr.baustein, tr.parameter ?? {});
      const oeffnung = aussparungsZellen(ebene0, paketK, 'oeffnung', kind.lage).map(ks);
      const frei = aussparungsZellen(ebene0, paketK, 'freihaltung', kind.lage).map(ks);
      const cut = schnitt.get(tr.id) ?? new Set();
      const ersetzt = new Set();
      for (const c of oeffnung) if (trBloecke.has(c)) { cut.add(c); ersetzt.add(c); merke(c, tr, kind, 'oeffnung'); }
      for (const c of frei) {
        if (trBloecke.has(c)) { cut.add(c); merke(c, tr, kind, 'freihaltung'); }
        if (!freihaltung.has(c)) freihaltung.set(c, new Set());
        freihaltung.get(c).add(kind.id);
      }
      if (cut.size) schnitt.set(tr.id, cut);
      const zone = paketT.einbauzonen.find((z) => z.id === kind.einbau.zone);
      // Die Zone wird nicht als Zellenmenge aufgebaut (große Räume): ihre acht Eckpunkte laufen durch die Lage des Trägers, das Ergebnis ist wieder ein achsenparalleler Quader
      const ecken = [zone.von.x, zone.bis.x].flatMap((x) => [zone.von.y, zone.bis.y].flatMap((y) => [zone.von.z, zone.bis.z].map((z) => ({ x, y, z }))));
      const w = zellenInWelt(ebene0, ecken, tr.lage);
      const achse = (a) => [Math.min(...w.map((c) => c[a])), Math.max(...w.map((c) => c[a]))];
      const [x0, x1] = achse('x'), [y0, y1] = achse('y'), [z0, z1] = achse('z');
      kinder.set(kind.id, { traeger: tr.id, zone: { von: { x: x0, y: y0, z: z0 }, bis: { x: x1, y: y1, z: z1 } }, ersetzt });
    }
    return { schnitt, kinder, freihaltung, herkunft };
  }

  /** Teil ohne die Zellen, die ihm ein Kind ausspart (neues Objekt; der gemerkte Eintrag bleibt unverändert). */
  function ohneZellen(t, weg) {
    return {
      ...t,
      bauteil: { ...t.bauteil, bloecke: t.bauteil.bloecke.filter((b) => !weg.has(key(b.x, b.y, b.z))) },
      schluessel: new Set([...t.schluessel].filter((k) => !weg.has(k))),
      arbeitsbloecke: new Set([...t.arbeitsbloecke].filter((k) => !weg.has(k))),
    };
  }

  /**
   * Entwurf → Welt. Gibt die Welt und je Teil die belegten Blöcke zurück.
   * Ohne `testmaterial: true` verlangt sie, dass die Palette jedes Abschnitts mit Teilen alle Rollen belegt, und wirft sonst `PaletteFehler`, bevor etwas gebaut wird
   * (nie ein halber Bauplan, nie stilles Testmaterial). `testmaterial: true` ist nur für Planungsgeometrie und Tests: fehlende Rollen füllt dann die TESTPALETTE.
   * @param {object} entwurf
   * @param {{testmaterial?: boolean}} [optionen]
   * Hat der Entwurf Kinder (`traeger`), werden ihre Lagen vorher mit `loeseLagen` abgeleitet, die Aussparungen angewendet und `besitz` (Zelle → erstes Teil, das sie belegt)
   * sowie `einbau` (siehe `einbauVon`) mitgeliefert; ohne Kinder ist das Ergebnis wie zuvor.
   * Manuelle Änderungen (`entwurf.aenderungen`) werden danach angewendet; `aenderungen` (ID → { status, teil, ort, grund }) liefert ihren Stand (null ohne Änderungen).
   * @returns {{welt: object, teile: Map<string, {schluessel: Set<string>, arbeitsbloecke: Set<string>, start: object|null, huelle: object|null}>, besitz: Map<string, string>, einbau: object|null}}
   */
  function materialisiere(entwurf, optionen = {}) {
    optionen = { testmaterial: optionen.testmaterial === true };
    if (!optionen.testmaterial) {
      const luecken = paletteLuecken(entwurf, { nurMitTeilen: true });
      if (luecken.length) throw new PaletteFehler(`${luecken.map((x) => `Abschnitt „${x.abschnitt}“ ohne Block für die Rollen ${x.rollen.join(', ')}`).join('; ')}. Ein Bauplan entsteht nicht aus Testmaterial; zuerst eine Stimmung wählen.`, luecken);
    }
    const hatKinder = entwurf.teile.some((t) => t.traeger !== undefined);
    const eff = hatKinder ? lagen.loeseLagen(entwurf) : entwurf; // die Lage der Kinder ist abgeleitet
    const welt = ebene0.neueWelt();
    const teile = new Map();
    const reihe = teileInReihenfolge(eff);
    const roh = new Map(reihe.map((teil) => [teil.id, baueTeil(eff, teil, optionen)]));
    const einbau = hatKinder ? einbauVon(eff, roh) : null;
    const fertig = new Map(reihe.map((teil) => {
      const t = roh.get(teil.id), weg = einbau?.schnitt.get(teil.id);
      return [teil.id, weg ? ohneZellen(t, weg) : t];
    }));
    // manuelle Einzelblockänderungen (docs/architektur-einbau.md, Bearbeitungsmodell B): nach den Aussparungen der Kinder; gemerkte Teile bleiben unverändert
    const aenderungen = (eff.aenderungen ?? []).length ? aenderungsmodul.wendeAn(eff, reihe, fertig, einbau).status : null;
    for (const teil of reihe) {
      const t = fertig.get(teil.id);
      welt.fuegeBauteilEin(t.bauteil);
      teile.set(teil.id, { schluessel: t.schluessel, arbeitsbloecke: t.arbeitsbloecke, start: t.start, huelle: t.huelle });
    }
    // Besitzkarte erst beim ersten Zugriff aufbauen (Entwürfe ohne Kinder, z. B. die Zitadelle, brauchen sie bei Hunderten von Prüfläufen nicht)
    let besitz = null;
    return {
      welt, teile, einbau, aenderungen,
      get besitz() {
        if (!besitz) {
          besitz = new Map();
          for (const teil of reihe) for (const k of teile.get(teil.id).schluessel) if (!besitz.has(k)) besitz.set(k, teil.id);
        }
        return besitz;
      },
    };
  }

  /** Teil, in dessen Blöcken (oder Hülle) die Zelle liegt; sonst null. */
  function teilBei(mat, ort) {
    const k = key(ort.x, ort.y, ort.z);
    for (const [id, t] of mat.teile) if (t.schluessel.has(k)) return id;
    for (const [id, t] of mat.teile) {
      const h = t.huelle;
      if (h && ort.x >= h.von.x && ort.x <= h.bis.x && ort.y >= h.von.y && ort.y <= h.bis.y && ort.z >= h.von.z && ort.z <= h.bis.z) return id;
    }
    return null;
  }

  /**
   * Läuft die Prüfer aus Ebene 1 über die Welt und liefert ihre Meldungen (Verstöße und Hinweise), ohne Doppelte.
   * Prüfaufträge: automatisch die Lorenprüfung an jedem Lorenstrecken-Teil, dazu die Aufträge des Konstrukteurs (art „begehbar“ mit start und ziele).
   */
  function pruefeEntwurf(entwurf, mat) {
    const meldungen = [];
    const gesehen = new Set();
    const nimm = (liste) => { for (const m of liste) { const k = `${m.regel}|${key(m.ort.x, m.ort.y, m.ort.z)}|${m.meldung}`; if (!gesehen.has(k)) { gesehen.add(k); meldungen.push(m); } } };
    const hatNischen = entwurf.teile.some((t) => t.baustein === 'tech.handelsnischen' || t.baustein === 'tech.handelsnischen-lore');
    nimm(ebene1.pruefe(mat.welt, { schienen: ebene1.schienen, ...(hatNischen ? { dorf: ebene1.dorf, dorfPruefen: true } : {}) }));
    for (const t of mat.teile.values()) {
      // liegt am Start keine Schiene mehr (von einem anderen Teil überbaut), meldet das die Überschneidung
      if (t.start && ebene1.schienen.schieneBei(mat.welt, t.start.pos)) nimm(ebene1.pruefe(mat.welt, { schienen: ebene1.schienen, lore: ebene1.lore, loreStart: t.start }).filter((m) => m.regel === 'pruefer.lore-stillstand'));
    }
    for (const p of entwurf.pruefungen) {
      if (p.art === 'begehbar') nimm(ebene1.pruefe(mat.welt, { schienen: null, bewegung: ebene1.bewegung, begehbarkeit: { start: p.start, ziele: p.ziele } }).filter((m) => m.regel === 'pruefer.begehbar'));
      else if (p.art === 'lore') nimm(ebene1.pruefe(mat.welt, { schienen: ebene1.schienen, lore: ebene1.lore, loreStart: { pos: p.start, richtung: p.richtung } }).filter((m) => m.regel === 'pruefer.lore-stillstand'));
      else throw new Error(`Unbekannter Prüfauftrag: ${p.art}`);
    }
    return meldungen;
  }

  return { materialisiere, pruefeEntwurf, teilBei, paletteVon, paletteLuecken };
}

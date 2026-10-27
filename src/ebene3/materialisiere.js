// Ebene 3 – Brücke zu den tieferen Ebenen: Entwurf → Welt (nur über Ebene 0) und Entwurf → Prüfer-Meldungen (Ebene 1).
// Jedes Teil wird mit Ebene 2 gebaut (`baue`), in einer eigenen Welt platziert, über den Vermesser gedreht und verschoben und dann in die
// Gesamtwelt eingefügt. Die Gesamtwelt wird nur über `welt.fuegeBauteilEin` beschrieben.
import { dreheRichtung } from '../ebene0/richtungen.js';
import { TESTPALETTE } from '../ebene2/index.js';

const key = (x, y, z) => `${x},${y},${z}`;

/**
 * @param {{regelwerk: import('../ebene1/regelwerk.js').Regelwerk, ebene0: object, ebene1: object, ebene2: object}} quellen
 */
export function erzeugeMaterialisierung({ regelwerk, ebene0, ebene1, ebene2 }) {
  const pruefstart = regelwerk.parameter('plan.geometrie', 'pruefstart');

  /** Palette des Entwurfs über der Testpalette (Rolle → Block oder Block je Form). */
  const paletteVon = (entwurf, abschnitt) => ({ ...TESTPALETTE, ...entwurf.palette, ...(entwurf.paletten?.[abschnitt] ?? {}) });

  // Ein Teil ist eine reine Funktion von Baustein, Parametern, Lage und Palette: unveränderte Teile werden nicht in jeder Einwand-Runde neu gebaut
  // (bei der Zitadelle waren das mehrere hundert Wiederholungen). Die Einträge werden nur gelesen; der Speicher ist auf wenige Dutzend Teile begrenzt.
  const teilSpeicher = new Map();
  const TEIL_SPEICHER_MAX = 96;

  /** Baut ein Teil: Paket, gedrehte und verschobene Blöcke, Blockschlüssel, Hülle, Startpunkt für die Lorenprüfung. */
  function baueTeil(entwurf, teil) {
    const schluesselTeil = JSON.stringify([teil.baustein, teil.parameter, teil.lage, paletteVon(entwurf, teil.abschnitt)]);
    const gemerkt = teilSpeicher.get(schluesselTeil);
    if (gemerkt) { teilSpeicher.delete(schluesselTeil); teilSpeicher.set(schluesselTeil, gemerkt); return gemerkt; } // zuletzt benutzt nach hinten
    const t = baueTeilNeu(entwurf, teil);
    teilSpeicher.set(schluesselTeil, t);
    if (teilSpeicher.size > TEIL_SPEICHER_MAX) teilSpeicher.delete(teilSpeicher.keys().next().value);
    return t;
  }

  function baueTeilNeu(entwurf, teil) {
    const paket = ebene2.baue(teil.baustein, teil.parameter);
    const w = ebene0.neueWelt();
    ebene2.platziere(w, paket, paletteVon(entwurf, teil.abschnitt));
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
   * Entwurf → Welt. Gibt die Welt und je Teil die belegten Blöcke zurück.
   * @returns {{welt: object, teile: Map<string, {schluessel: Set<string>, arbeitsbloecke: Set<string>, start: object|null, huelle: object|null}>}}
   */
  function materialisiere(entwurf) {
    const welt = ebene0.neueWelt();
    const teile = new Map();
    for (const teil of teileInReihenfolge(entwurf)) {
      const t = baueTeil(entwurf, teil);
      welt.fuegeBauteilEin(t.bauteil);
      teile.set(teil.id, { schluessel: t.schluessel, arbeitsbloecke: t.arbeitsbloecke, start: t.start, huelle: t.huelle });
    }
    return { welt, teile };
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
    const hatNischen = entwurf.teile.some((t) => t.baustein === 'tech.handelsnischen');
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

  return { materialisiere, pruefeEntwurf, teilBei, paletteVon };
}

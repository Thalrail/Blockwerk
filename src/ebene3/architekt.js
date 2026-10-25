// Ebene 3 – Architekt: setzt Formen und Bauelemente aus Ebene 2 in die gewünschten Zonen, um die Technik herum, und misst sie gegen die Vorlage.
// Fester Algorithmus: gleiche Eingabe = gleiches Ergebnis. Schreibt nur Formwünsche und Teile der Art Form/Bauelement, nur über `fachleute.aendere`.
// Regeln als Daten: data/regeln/planung.json (plan.formen).

const FACHMANN = 'architekt';
const key = (x, y, z) => `${x},${y},${z}`;
const ueberschneiden = (a, b) => ['x', 'y', 'z'].every((k) => a.von[k] <= b.bis[k] && b.von[k] <= a.bis[k]);

/** Fehler des Architekten: die Eingabe ist unbrauchbar (kein Raten). */
export class FormFehler extends Error {
  constructor(nachricht) { super(`Form: ${nachricht}`); this.name = 'FormFehler'; }
}

/**
 * @param {{regelwerk: object, fachleute: object, ebene2: object, materialisierung: object}} quellen
 */
export function erzeugeArchitekt({ regelwerk, fachleute, ebene2, materialisierung }) {
  const standardToleranz = regelwerk.parameter('plan.formen', 'toleranz');
  const achsen = regelwerk.parameter('plan.formen', 'achsen');
  const aendere = (e, a) => fachleute.aendere(e, FACHMANN, a).entwurf;

  const huelleVon = (w) => {
    try { return ebene2.baue(w.baustein, w.parameter ?? {}).platzbedarf.huelle; } catch (f) { throw new FormFehler(`${w.id}: ${f.message}`); }
  };
  const maß = (h) => ({ breite: h.bis.x - h.von.x + 1, tiefe: h.bis.z - h.von.z + 1, hoehe: h.bis.y - h.von.y + 1 });

  /** Nimmt die Formwünsche auf (prüft die Bausteinparameter probeweise). */
  function setzeFormwuensche(entwurf, liste) {
    let e = entwurf;
    for (const w of liste) { e = aendere(e, { art: 'setze-formwunsch', formwunsch: w }); huelleVon({ parameter: {}, ...w }); } // erst die Rechte und Namen, dann die Parameter
    return e;
  }

  /** Startzelle (kleinste Ecke des Hüllquaders) am Anker der Zone und Laufrichtung der Suche. */
  function startAn(zone, m, anker) {
    const west = anker.endsWith('west'), ost = anker.endsWith('ost'), nord = anker.startsWith('nord'), sued = anker.startsWith('sued');
    const mitteX = zone.von.x + Math.floor((zone.bis.x - zone.von.x + 1 - m.breite) / 2);
    const mitteZ = zone.von.z + Math.floor((zone.bis.z - zone.von.z + 1 - m.tiefe) / 2);
    return {
      x: ost ? zone.bis.x - m.breite + 1 : west ? zone.von.x : mitteX,
      z: sued ? zone.bis.z - m.tiefe + 1 : nord ? zone.von.z : mitteZ,
      y: zone.von.y,
      sx: ost ? -1 : 1, sz: sued ? -1 : 1,
    };
  }

  /** Erste freie Stelle (Hüllquader) in der Zone, vom Anker aus; sonst null. Feste Reihenfolge: y, dann z, dann x. */
  function suche(zone, m, anker, belegt) {
    const maxX = zone.bis.x - m.breite + 1, maxZ = zone.bis.z - m.tiefe + 1, maxY = zone.bis.y - m.hoehe + 1;
    if (maxX < zone.von.x || maxZ < zone.von.z || maxY < zone.von.y) return null;
    const frei = (x, y, z) => {
      const box = { von: { x, y, z }, bis: { x: x + m.breite - 1, y: y + m.hoehe - 1, z: z + m.tiefe - 1 } };
      return !belegt.some((b) => ueberschneiden(box, b));
    };
    const s = startAn(zone, m, anker);
    // 1. vom Anker nach innen
    for (let y = s.y; y <= maxY; y++) {
      for (let dz = 0; ; dz++) {
        const z = s.z + s.sz * dz;
        if (z < zone.von.z || z > maxZ) break;
        for (let dx = 0; ; dx++) {
          const x = s.x + s.sx * dx;
          if (x < zone.von.x || x > maxX) break;
          if (frei(x, y, z)) return { x, y, z };
        }
      }
    }
    // 2. sonst die ganze Zone der Reihe nach
    for (let y = zone.von.y; y <= maxY; y++) for (let z = zone.von.z; z <= maxZ; z++) for (let x = zone.von.x; x <= maxX; x++) if (frei(x, y, z)) return { x, y, z };
    return null;
  }

  const gesetzt = (e, w) => e.teile.some((t) => t.wunsch === w.id);

  /**
   * Probeanordnung der noch offenen Formwünsche eines Abschnitts (ändert nichts).
   * @returns {{platzierungen: {wunsch: object, lage: object}[], fehler: {wunsch: object, grund: string, mindest: object, zone: object|null}[]}}
   */
  function plane(entwurf, abschnitt) {
    const offen = (entwurf.formwuensche ?? []).filter((w) => w.abschnitt === abschnitt && !gesetzt(entwurf, w));
    const platzierungen = [], fehler = [];
    if (!offen.length) return { platzierungen, fehler };
    const belegt = [];
    if (entwurf.teile.length) for (const t of materialisierung.materialisiere(entwurf).teile.values()) if (t.huelle) belegt.push(t.huelle);
    for (const w of offen) {
      const h = huelleVon(w), m = maß(h);
      const zone = entwurf.zonen.find((z) => z.abschnitt === abschnitt && z.funktion === w.zone) ?? null;
      const p = zone ? suche(zone, m, w.anker, belegt) : null;
      if (!p) { fehler.push({ wunsch: w, grund: zone ? 'kein-platz' : 'keine-zone', mindest: m, zone }); continue; }
      belegt.push({ von: { ...p }, bis: { x: p.x + m.breite - 1, y: p.y + m.hoehe - 1, z: p.z + m.tiefe - 1 } });
      platzierungen.push({ wunsch: w, lage: { x: p.x - h.von.x, y: p.y - h.von.y, z: p.z - h.von.z, drehung: 0 } });
    }
    return { platzierungen, fehler };
  }

  /**
   * Setzt alle Formwünsche des Abschnitts, die Platz finden. Die übrigen bleiben offen (Einwand an den Grobdesigner aus `einwaende`).
   * @returns {{entwurf: object, teile: string[], offen: string[]}}
   */
  function setzeFormen(entwurf, abschnitt) {
    if (!entwurf.abschnitte.some((a) => a.id === abschnitt)) throw new FormFehler(`Abschnitt ${String(abschnitt)} gibt es nicht`);
    const p = plane(entwurf, abschnitt);
    let e = entwurf;
    const ids = [];
    for (const { wunsch, lage } of p.platzierungen) {
      e = aendere(e, { art: 'setze-teil', teil: { abschnitt, baustein: wunsch.baustein, parameter: wunsch.parameter, lage, wunsch: wunsch.id, zone: wunsch.zone } });
      ids.push(e.teile.at(-1).id);
    }
    return { entwurf: e, teile: ids, offen: p.fehler.map((f) => f.wunsch.id) };
  }

  /**
   * Misst ein gesetztes Teil gegen die Vorlage seines Wunsches (`soll`): Symmetrie an den Mittelachsen und Verhältnis Höhe : Breite (Breite = Ausdehnung in x).
   * @returns {{breite: number, tiefe: number, hoehe: number, symmetrie: Record<string, boolean>, verhaeltnis: number, abweichungen: string[]}}
   */
  function miss(entwurf, teilId, mat = null) {
    const teil = entwurf.teile.find((t) => t.id === teilId);
    if (!teil) throw new FormFehler(`Teil ${String(teilId)} gibt es nicht`);
    const wunsch = (entwurf.formwuensche ?? []).find((w) => w.id === teil.wunsch);
    const soll = wunsch?.soll ?? {};
    const bloecke = [...(mat ?? materialisierung.materialisiere(entwurf)).teile.get(teilId).schluessel].map((k) => k.split(',').map(Number));
    const min = [0, 1, 2].map((i) => Math.min(...bloecke.map((b) => b[i]))), max = [0, 1, 2].map((i) => Math.max(...bloecke.map((b) => b[i])));
    const menge = new Set(bloecke.map((b) => key(...b)));
    const symmetrie = {};
    for (const [achse, i] of [['x', 0], ['z', 2]]) {
      symmetrie[achse] = bloecke.every((b) => { const c = [...b]; c[i] = min[i] + max[i] - b[i]; return menge.has(key(...c)); });
    }
    const m = { breite: max[0] - min[0] + 1, tiefe: max[2] - min[2] + 1, hoehe: max[1] - min[1] + 1 };
    const verhaeltnis = m.hoehe / m.breite;
    const abweichungen = [];
    for (const a of soll.symmetrie ?? []) {
      if (!achsen.includes(a)) throw new FormFehler(`Symmetrieachse „${a}“ unbekannt (${achsen.join(', ')})`);
      if (!symmetrie[a]) abweichungen.push(`${teil.baustein} ist nicht symmetrisch zur Mittelachse ${a}`);
    }
    if (soll.verhaeltnis) {
      const tol = soll.verhaeltnis.toleranz ?? standardToleranz;
      const sollHoehe = soll.verhaeltnis.hoehe_zu_breite * m.breite;
      if (Math.abs(m.hoehe - sollHoehe) > tol) abweichungen.push(`${teil.baustein}: Höhe ${m.hoehe} bei Breite ${m.breite} (Verhältnis ${verhaeltnis.toFixed(2)}), gefordert ${soll.verhaeltnis.hoehe_zu_breite} × Breite = ${sollHoehe.toFixed(1)} ± ${tol} Blöcke`);
    }
    return { ...m, symmetrie, verhaeltnis, abweichungen };
  }

  /** Einwände des Architekten für das Einwand-Protokoll: kein Platz in der Zone, Maß gegen die Vorlage verfehlt. */
  function einwaende(entwurf) {
    const liste = [];
    for (const a of entwurf.abschnitte) {
      for (const f of plane(entwurf, a.id).fehler) {
        const m = f.mindest, text = `${f.wunsch.baustein} (Wunsch ${f.wunsch.id}) braucht ${m.breite} × ${m.tiefe} × ${m.hoehe} Blöcke`;
        if (!f.zone) liste.push({ regel: 'plan.formen', von: FACHMANN, an: 'grobdesigner', ort: { ...a.huelle.von }, schwere: 'verstoss', ziel: `abschnitt:${a.id}`, abschnitt: a.id, text: `${text}, der Abschnitt ${a.id} hat aber keine Zone „${f.wunsch.zone}“`, schluessel: `plan.formen|zone-fehlt|${f.wunsch.id}` });
        else liste.push({ regel: 'plan.formen', von: FACHMANN, an: 'grobdesigner', ort: { ...f.zone.von }, schwere: 'verstoss', ziel: `zone:${f.zone.id}`, abschnitt: a.id, text: `${text}, die Zone ${f.zone.id} hat keinen freien Platz dafür`, schluessel: `plan.formen|kein-platz|${f.wunsch.id}` });
      }
    }
    const mitSoll = entwurf.teile.filter((t) => t.wunsch && (entwurf.formwuensche ?? []).find((w) => w.id === t.wunsch)?.soll);
    if (mitSoll.length) {
      const mat = materialisierung.materialisiere(entwurf);
      for (const t of mitSoll) {
        const r = miss(entwurf, t.id, mat);
        for (const text of r.abweichungen) liste.push({ regel: 'plan.mass', von: 'bauleiter', an: FACHMANN, ort: { ...mat.teile.get(t.id).huelle.von }, schwere: 'verstoss', ziel: `teil:${t.id}`, abschnitt: t.abschnitt, text, schluessel: `plan.mass|${t.id}|${text}` });
      }
    }
    return liste;
  }

  return { setzeFormwuensche, plane, setzeFormen, miss, einwaende, FormFehler };
}

// Ebene 1 – Mechanik „Dorfbewohner-Verhalten“ (Betten, Berufsblock-Suche, Dorf, Iron-Golem-Bedingung)
// Regeln: data/regeln/dorf.json (Quelle und Status je Regel; Bedrock nennt wenig → Java-Platzhalter, `ungeprüft`).
// Modell: reine Rechnung auf der Welt (keine Tickzeit). Dorfbewohner sind Wesen der Welt; ihre Fußzelle ist floor(x, y, z).
// Ein Bett ist gültig, wenn zwei Zellen darüber frei sind und ein Dorfbewohner es erreichen kann (Erreichbarkeit aus `bewegung.js`).
// Ein Dorfbewohner beansprucht das nächste erreichbare Bett und – nur mit Bett – den ersten unbeanspruchten Berufsblock der Liste im Umkreis
// (16 Blöcke waagerecht, 4 senkrecht), unabhängig davon, ob er ihn erreicht (dann zeigt er Ärger). Die Welt wird nur über Ebene 0 gelesen.

const NACHBARN = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // Nord, Ost, Süd, West (x, z)
const nachOrt = (a, b) => a.y - b.y || a.z - b.z || a.x - b.x;

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, register: object, bewegung: ReturnType<import('./bewegung.js').erzeugeBewegung>}} quellen
 */
export function erzeugeDorf({ regelwerk, register, bewegung }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  const reichH = P('dorf.berufsblock', 'horizontal');
  const reichV = P('dorf.berufsblock', 'vertikal');
  const golemDorfbewohner = P('dorf.golem', 'dorfbewohner');
  const golemBetten = P('dorf.golem', 'betten');
  const halbBreite = Math.floor(P('dorf.definition', 'breite') / 2);
  const halbHoehe = Math.floor(P('dorf.definition', 'hoehe') / 2);
  const dorfbewohnerIds = P('dorf.definition', 'dorfbewohnerIds');
  const golemIds = P('dorf.definition', 'golemIds');
  const eig = (id) => register.bloecke.block(id).eigenschaften;

  /** Alle Dorfbewohner der Welt (Fußzelle), nach Nummer. */
  function dorfbewohner(welt) {
    return welt.wesen().filter((w) => dorfbewohnerIds.includes(w.id))
      .map((w) => ({ nr: w.nr, baby: w.baby === true, pos: { x: Math.floor(w.x), y: Math.floor(w.y), z: Math.floor(w.z) } }));
  }

  /** Alle Berufsblöcke der Welt (Ebene-0-Eigenschaft `beruf`) in fester Reihenfolge (y, z, x). */
  function berufsbloecke(welt) {
    return welt.alleBloecke().filter((b) => eig(b.id).beruf).map((b) => ({ x: b.x, y: b.y, z: b.z, id: b.id, beruf: eig(b.id).beruf }));
  }

  const imUmkreis = (von, p) => Math.abs(p.x - von.x) <= reichH && Math.abs(p.z - von.z) <= reichH && Math.abs(p.y - von.y) <= reichV;

  function sucher(welt, bewohner) {
    const cache = new Map();
    return (b) => {
      if (!cache.has(b.nr)) cache.set(b.nr, bewegung.erreichbar(welt, b.pos, b.baby ? 'baby' : 'dorfbewohner'));
      return cache.get(b.nr);
    };
  }

  /** Kann der Dorfbewohner (Ergebnis von `erreichbar`) neben die Zelle (Nachbarn waagerecht, oder darauf) treten? */
  function erreichtNeben(erg, p) {
    if (!erg.start) return false;
    return NACHBARN.some(([dx, dz]) => erg.kann(p.x + dx, p.y, p.z + dz)) || erg.kann(p.x, p.y + 1, p.z);
  }

  /**
   * Alle Betten (Kopfhälften) mit Gültigkeit. Gültig: zwei freie Zellen darüber und von einem Dorfbewohner erreichbar.
   * @returns {{x:number,y:number,z:number,gueltig:boolean,grund?:string}[]}
   */
  function betten(welt) {
    const bewohner = dorfbewohner(welt);
    const erreich = sucher(welt, bewohner);
    const ids = new Set();
    for (const b of welt.alleBloecke()) if (eig(b.id).bett) ids.add(`${b.x},${b.y},${b.z}`);
    const istBett = (x, y, z) => ids.has(`${x},${y},${z}`);
    const liste = [];
    for (const b of welt.alleBloecke()) {
      if (!eig(b.id).bett || b.zustand.head_piece_bit !== true) continue;
      const p = { x: b.x, y: b.y, z: b.z };
      let grund = null;
      for (const dy of [1, 2]) {
        const c = welt.leseBlock(b.x, b.y + dy, b.z);
        const k = eig(c.id).kollision;
        if (k === null) { grund = `Block über dem Bett ist unklar (${c.id})`; break; }
        if (k !== 'keine') { grund = `Block über dem Bett (${c.id}): zwei freie Blöcke nötig`; break; }
      }
      if (!grund) {
        // Fußhälfte: ein waagerechter Nachbar, der selbst ein Bett ist (Kopf ↔ Fuß)
        const fuss = NACHBARN.map(([dx, dz]) => ({ x: b.x + dx, y: b.y, z: b.z + dz })).find((n) => istBett(n.x, n.y, n.z) && welt.leseBlock(n.x, n.y, n.z).zustand.head_piece_bit !== true);
        const felder = [p, ...(fuss ? [fuss] : [])];
        const sieht = bewohner.some((v) => felder.some((f) => erreichtNeben(erreich(v), f)));
        if (!bewohner.length) grund = 'kein Dorfbewohner, der das Bett erreichen könnte';
        else if (!sieht) grund = 'von keinem Dorfbewohner erreichbar';
      }
      liste.push({ ...p, gueltig: grund === null, ...(grund ? { grund } : {}) });
    }
    return liste.sort(nachOrt);
  }

  /** Berufsblöcke im Umkreis eines Dorfbewohners in der Reihenfolge der Liste (y, z, x). */
  function berufsblockListe(welt, bewohner) {
    return berufsbloecke(welt).filter((s) => imUmkreis(bewohner.pos, s));
  }

  /**
   * Wer beansprucht welches Bett und welchen Berufsblock? Dorfbewohner in Reihenfolge der Nummer; Babys nehmen kein Bett und keinen Beruf.
   * @returns {{nr:number, bett:object|null, beruf:{beruf:string,x:number,y:number,z:number,erreichbar:boolean}|null, hinweise:string[]}[]}
   */
  function zuordnung(welt) {
    const bewohner = dorfbewohner(welt);
    const erreich = sucher(welt, bewohner);
    const freieBetten = betten(welt).filter((b) => b.gueltig);
    const vergeben = new Set();
    const beansprucht = new Set();
    const ergebnis = [];
    for (const v of bewohner.filter((x) => !x.baby)) {
      const erg = erreich(v);
      const hinweise = [];
      const kandidaten = freieBetten.filter((b) => !vergeben.has(`${b.x},${b.y},${b.z}`) && erreichtNeben(erg, b))
        .sort((a, b) => (Math.abs(a.x - v.pos.x) + Math.abs(a.y - v.pos.y) + Math.abs(a.z - v.pos.z)) - (Math.abs(b.x - v.pos.x) + Math.abs(b.y - v.pos.y) + Math.abs(b.z - v.pos.z)) || nachOrt(a, b));
      const bett = kandidaten[0] ?? null;
      if (bett) vergeben.add(`${bett.x},${bett.y},${bett.z}`);
      else hinweise.push('kein freies, erreichbares Bett');
      let beruf = null;
      if (bett) {
        const frei = berufsblockListe(welt, v).find((s) => !beansprucht.has(`${s.x},${s.y},${s.z}`));
        if (frei) {
          beansprucht.add(`${frei.x},${frei.y},${frei.z}`);
          const kann = erreichtNeben(erg, frei);
          beruf = { beruf: frei.beruf, x: frei.x, y: frei.y, z: frei.z, id: frei.id, erreichbar: kann };
          if (!kann) hinweise.push(`erreicht seinen Berufsblock ${frei.id} bei (${frei.x}, ${frei.y}, ${frei.z}) nicht`);
        }
      }
      ergebnis.push({ nr: v.nr, pos: v.pos, bett: bett ? { x: bett.x, y: bett.y, z: bett.z } : null, beruf, hinweise });
    }
    return ergebnis;
  }

  /**
   * Dorf: Mittelpunkt (erstes gültiges Bett), Grenze, Höchstbevölkerung, Vermehrung, Iron Golem.
   * null, wenn es kein gültiges Bett oder keinen Dorfbewohner gibt.
   */
  function dorf(welt) {
    const gueltig = betten(welt).filter((b) => b.gueltig);
    const alle = dorfbewohner(welt);
    if (!gueltig.length || !alle.length) return null;
    const grenze = {
      von: { x: Math.min(...gueltig.map((b) => b.x)) - halbBreite, y: Math.min(...gueltig.map((b) => b.y)) - halbHoehe, z: Math.min(...gueltig.map((b) => b.z)) - halbBreite },
      bis: { x: Math.max(...gueltig.map((b) => b.x)) + halbBreite, y: Math.max(...gueltig.map((b) => b.y)) + halbHoehe, z: Math.max(...gueltig.map((b) => b.z)) + halbBreite },
    };
    const innen = (p) => p.x >= grenze.von.x && p.x <= grenze.bis.x && p.y >= grenze.von.y && p.y <= grenze.bis.y && p.z >= grenze.von.z && p.z <= grenze.bis.z;
    const bewohner = alle.filter((v) => innen(v.pos));
    if (!bewohner.length) return null;
    const golems = welt.wesen().filter((w) => golemIds.includes(w.id) && innen({ x: Math.floor(w.x), y: Math.floor(w.y), z: Math.floor(w.z) })).length;
    const erwachsene = bewohner.filter((v) => !v.baby).length;
    const hoechst = gueltig.length;
    let vermehrung;
    if (bewohner.length >= hoechst) vermehrung = 'nein';
    else if (erwachsene >= 2) vermehrung = 'unklar'; // braucht Futter und Erreichbarkeit zwischen zwei Dorfbewohnern, beides hier nicht modelliert
    else vermehrung = 'nein';
    let golem;
    if (bewohner.length < golemDorfbewohner || gueltig.length < golemBetten) golem = 'nein';
    else golem = golems === 0 ? 'ja' : 'unklar'; // mit vorhandenen Golems widersprechen sich die Wiki-Seiten (Anzahl je Dorfbewohner)
    return { mittelpunkt: { x: gueltig[0].x, y: gueltig[0].y, z: gueltig[0].z }, grenze, betten: gueltig.length, dorfbewohner: bewohner.length, erwachsene, eisengolems: golems, hoechstbevoelkerung: hoechst, vermehrung, golem };
  }

  return { imUmkreis, dorfbewohner, berufsbloecke, betten, berufsblockListe, zuordnung, dorf };
}

// Ebene 1 – Mechanik „Bewegung und Erreichbarkeit“ (Spieler, Dorfbewohner, Baby)
// Regeln: data/regeln/bewegung.json (Quelle und Status je Regel; Bedrock nennt kaum Zahlen → Java-Platzhalter, `ungeprüft`).
// Modell: reine Rechnung auf der Welt (keine Tickzeit). Höhen in Halbblöcken (HB): Zelle y reicht von 2·y bis 2·y + 2. Eine Stehstelle (x, Y, z) hat die Füße
// auf Höhe Y; sie braucht eine tragende Fläche genau bei Y und freien Platz für die Körperhöhe (aufgerundet auf Halbblöcke). Schritte zu den vier Nachbarn:
// gehen (Höhenunterschied ≤ 1 HB = 0,5 Blöcke), springen (+2 HB = 1 Block, Platz über dem Start), fallen (Fallhöhe, Schaden ab 3 Blöcke; Dorfbewohner nur bis 3),
// Lücke überspringen (nur Spieler, 1 Block breit), Leiter/Ranke (Spieler), schwimmen und durch Türen. Lava und unklare Blöcke sperren und werden als Grund genannt.
// Die Welt wird nur über Ebene 0 gelesen.
import { VEKTOR, HOEHE_MAX, HOEHE_MIN } from '../ebene0/richtungen.js';

const HORIZONTAL = ['north', 'east', 'south', 'west'];
const GEGEN = { north: 'south', south: 'north', east: 'west', west: 'east' };
const key = (x, Y, z) => `${x},${Y},${z}`;

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, register: {bloecke: object, wesen: import('../ebene0/wesenregister.js').Wesenregister}}} quellen
 */
export function erzeugeBewegung({ regelwerk, register }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  const artenDaten = P('bewegung.hitbox', 'arten');
  const stufeHB = P('bewegung.stufe', 'halbBloecke');
  const sprungHB = P('bewegung.sprung', 'halbBloecke');
  const fallDorf = P('bewegung.fallen', 'dorfbewohnerMaxBloecke');
  const schadenAb = P('bewegung.fallen', 'schadenAbBloecken');
  const lueckeBreite = P('bewegung.luecke', 'spielerBreite');
  const holzTuer = new RegExp(P('bewegung.tueren', 'oeffenbarMuster'));
  const eisenTuer = new RegExp(P('bewegung.tueren', 'eisenMuster'));
  const kosten = P('bewegung.kosten', 'werte');
  const eigenschaft = (id) => register.bloecke.block(id).eigenschaften;
  /** Höhenunterschiede (in Halbblöcken), die im Gehen genommen werden: 0, hinauf bis zur Stufenhöhe, hinunter bis zur Stufenhöhe. */
  const stufen = [0, ...Array.from({ length: stufeHB }, (_, i) => i + 1), ...Array.from({ length: stufeHB }, (_, i) => -(i + 1))];

  /** Bewegungsdaten einer Art: 'spieler' | 'dorfbewohner' | 'baby' (Option kriechen: nur Spieler, 0,6 hoch). */
  function wesenArt(name, { kriechen = false } = {}) {
    const d = artenDaten[name];
    if (!d) throw new Error(`Unbekannte Wesenart: ${String(name)}`);
    const box = register.wesen.hitbox(d.wesen, { baby: d.baby });
    const hoehe = kriechen ? 0.6 : box.hoehe;
    return {
      name, kriechen,
      breite: box.breite, hoehe,
      platzHB: Math.ceil(hoehe * 2),
      oeffnetHolz: true, // Holz- und Kupfertüren öffnen alle
      oeffnetFalltuerUndTor: name === 'spieler',
      oeffnetEisen: false,
      klettert: name === 'spieler',
      kannLuecke: name === 'spieler',
      maxFall: name === 'spieler' ? Infinity : fallDorf,
    };
  }

  /** Verhalten einer Zelle für die Bewegung: Hindernisse, tragende Flächen, Flags. Ergebnis wird je Suche zwischengespeichert. */
  function zellenProfil(welt, art, cache) {
    return (x, y, z) => {
      const k = `${x},${y},${z}`;
      const hit = cache.get(k);
      if (hit) return hit;
      const p = berechne(welt, art, x, y, z, cache);
      cache.set(k, p);
      return p;
    };
  }

  function eigenesProfil(welt, art, x, y, z) {
    if (y < HOEHE_MIN || y > HOEHE_MAX) return { belegt: [[2 * y, 2 * y + 2]], tops: [], flag: null };
    const b = welt.leseBlock(x, y, z);
    const k = eigenschaft(b.id).kollision;
    const lo = 2 * y;
    switch (k) {
      case 'keine': return { belegt: [], tops: [], flag: null };
      case 'voll': return { belegt: [[lo, lo + 2]], tops: [lo + 2], flag: null };
      case 'halbstufe': {
        const oben = b.zustand['minecraft:vertical_half'] === 'top';
        return oben ? { belegt: [[lo + 1, lo + 2]], tops: [lo + 2], flag: null } : { belegt: [[lo, lo + 1]], tops: [lo + 1], flag: null };
      }
      case 'treppe': {
        // untere Stufe (Hindernis nur die untere Hälfte, die obere Stufe ist eine zweite Standhöhe); kopfstehend wie eine obere Halbstufe
        return b.zustand.upside_down_bit === true ? { belegt: [[lo + 1, lo + 2]], tops: [lo + 2], flag: null } : { belegt: [[lo, lo + 1]], tops: [lo + 1, lo + 2], flag: null };
      }
      case 'hoch': return { belegt: [[lo, lo + 3]], tops: [], flag: null, ragtHoch: true };
      case 'tor': {
        const offen = b.zustand.open_bit === true || art.oeffnetFalltuerUndTor;
        return offen ? { belegt: [], tops: [], flag: null } : { belegt: [[lo, lo + 3]], tops: [], flag: null, ragtHoch: true };
      }
      case 'tuer': {
        const eisen = eisenTuer.test(b.id);
        const frei = b.zustand.open_bit === true || (!eisen && holzTuer.test(b.id) && art.oeffnetHolz) || (eisen && art.oeffnetEisen);
        return frei ? { belegt: [], tops: [], flag: null } : { belegt: [[lo, lo + 2]], tops: [], flag: null, tuer: true };
      }
      case 'falltuer': {
        const oben = b.zustand.upside_down_bit === true;
        return b.zustand.open_bit === true ? { belegt: [], tops: [], flag: null } : { belegt: [], tops: [oben ? lo + 2 : lo], flag: null };
      }
      case 'leiter': return { belegt: [], tops: [], flag: 'leiter' };
      case 'wasser': return { belegt: [], tops: [], flag: 'wasser' };
      case 'lava': return { belegt: [], tops: [], flag: 'lava' };
      default: return { belegt: [[lo, lo + 2]], tops: [], flag: 'unklar', unklarId: b.id };
    }
  }

  function berechne(welt, art, x, y, z, cache) {
    const eigen = eigenesProfil(welt, art, x, y, z);
    // Zaun/Mauer/Tor der Zelle darunter ragt 1,5 Blöcke hoch: eine halbe Zelle Hindernis und Standfläche bei 2y + 1
    const unten = y - 1 >= HOEHE_MIN ? eigenesProfil(welt, art, x, y - 1, z) : null;
    if (unten && unten.ragtHoch) return { ...eigen, belegt: [[2 * y, 2 * y + 1], ...eigen.belegt], tops: [2 * y + 1, ...eigen.tops] };
    return eigen;
  }

  /** Nach der Suche zur Auswertung: Eigenschaften der Welt/Art in eine Hilfsfunktion binden. */
  function werkzeug(welt, art) {
    const cache = new Map();
    const profil = zellenProfil(welt, art, cache);
    const H = art.platzHB;
    const zelleVon = (Y) => Math.floor(Y / 2);

    /** Freier Platz für den Körper bei Fußhöhe Y in der Säule (x, z)? Meldet sonst den Grund. */
    function raum(x, Y, z) {
      for (let c = zelleVon(Y); c <= zelleVon(Y + H - 1); c++) {
        const p = profil(x, c, z);
        if (p.flag === 'lava') return { ok: false, grund: 'Lava', ort: { x, y: c, z } };
        if (p.flag === 'unklar') return { ok: false, grund: `${p.unklarId} (Begehbarkeit unklar)`, ort: { x, y: c, z }, unklar: true };
        for (const [lo, hi] of p.belegt) if (lo < Y + H && hi > Y) return { ok: false, grund: p.tuer ? 'geschlossene Tür' : 'Hindernis', ort: { x, y: c, z } };
      }
      return { ok: true };
    }
    const frei = (x, Y, z) => raum(x, Y, z).ok;
    // Tragende Fläche genau bei Y: Oberseite eines Blocks darunter oder (dünne Falltür) Boden der Fußzelle selbst
    const tragend = (x, Y, z) => profil(x, zelleVon(Y - 1), z).tops.includes(Y) || profil(x, zelleVon(Y), z).tops.includes(Y);
    const fussZelle = (x, Y, z) => profil(x, zelleVon(Y), z);
    /** Gültige Stehstelle? art: 'boden' | 'leiter' | 'wasser' */
    function stelle(x, Y, z) {
      const r = raum(x, Y, z);
      if (!r.ok) return { ok: false, grund: r.grund, unklar: r.unklar };
      const f = fussZelle(x, Y, z);
      if (f.flag === 'wasser') return { ok: true, art: 'wasser' };
      if (tragend(x, Y, z)) return { ok: true, art: 'boden' };
      if (Y % 2 === 0 && f.flag === 'leiter' && art.klettert) return { ok: true, art: 'leiter' };
      return { ok: false, grund: 'kein Boden' };
    }
    return { profil, raum, frei, tragend, stelle, H, zelleVon };
  }

  /**
   * Dijkstra von einer Startstelle aus.
   * @returns {{start: object|null, zustaende: Map<string, object>, grund?: string}}
   */
  function suche(welt, start, art, { radius = 64, maxZustaende = 60000 } = {}) {
    const w = werkzeug(welt, art);
    const sicherStart = (() => {
      for (const Y of [2 * start.y, 2 * start.y + 1]) if (w.stelle(start.x, Y, start.z).ok) return Y;
      return null;
    })();
    if (sicherStart === null) {
      const r = w.stelle(start.x, 2 * start.y, start.z);
      return { start: null, zustaende: new Map(), grund: `Startstelle ungültig: ${r.grund}` };
    }
    const dist = new Map();
    const offen = [];
    const setze = (x, Y, z, kosten0, von, schritt, extra = {}) => {
      const k = key(x, Y, z);
      const alt = dist.get(k);
      if (alt && alt.kosten <= kosten0) return;
      const eintrag = { x, Y, z, kosten: kosten0, von, schritt, ...extra };
      dist.set(k, eintrag);
      offen.push(eintrag);
    };
    setze(start.x, sicherStart, start.z, 0, null, 'start');
    while (offen.length) {
      offen.sort((a, b) => a.kosten - b.kosten || (key(a.x, a.Y, a.z) < key(b.x, b.Y, b.z) ? -1 : 1));
      const s = offen.shift();
      if (dist.get(key(s.x, s.Y, s.z)) !== s) continue;
      if (dist.size > maxZustaende) break;
      const aktuell = w.stelle(s.x, s.Y, s.z);
      // Leiter / Wasser: senkrecht
      if (aktuell.art === 'leiter') {
        for (const dY of [2, -2]) {
          const Y2 = s.Y + dY;
          const t = w.stelle(s.x, Y2, s.z);
          const zielZelle = w.profil(s.x, w.zelleVon(Y2), s.z);
          if (t.ok && (zielZelle.flag === 'leiter' || t.art === 'boden' || t.art === 'wasser')) setze(s.x, Y2, s.z, s.kosten + kosten.leiter, key(s.x, s.Y, s.z), 'leiter');
        }
      }
      if (aktuell.art === 'wasser') {
        for (const dY of [2, -2]) {
          const Y2 = s.Y + dY;
          if (Y2 % 2 !== 0) continue;
          const t = w.stelle(s.x, Y2, s.z);
          if (t.ok && t.art === 'wasser') setze(s.x, Y2, s.z, s.kosten + kosten.schwimmen, key(s.x, s.Y, s.z), 'schwimmen');
        }
      }
      // Treppenstufen: innerhalb derselben Zelle eine Halbblock-Stufe hinauf oder hinunter
      if (aktuell.art === 'boden') {
        for (const dY of [1, -1]) {
          const t = w.stelle(s.x, s.Y + dY, s.z);
          if (t.ok && t.art === 'boden' && w.frei(s.x, Math.max(s.Y, s.Y + dY), s.z)) setze(s.x, s.Y + dY, s.z, s.kosten + kosten.stufe, key(s.x, s.Y, s.z), 'stufe');
        }
      }
      for (const d of HORIZONTAL) {
        const tx = s.x + VEKTOR[d].x, tz = s.z + VEKTOR[d].z;
        if (Math.abs(tx - start.x) > radius || Math.abs(tz - start.z) > radius) continue;
        const von = key(s.x, s.Y, s.z);
        // 1. gehen / Stufe / schwimmen
        let gefunden = false;
        for (const dY of stufen) {
          const Y2 = s.Y + dY;
          const t = w.stelle(tx, Y2, tz);
          if (!t.ok) continue;
          if (dY !== 0 && !w.frei(s.x, Math.max(s.Y, Y2), s.z)) continue; // genug Kopffreiheit am Start für den Schritt
          if (dY !== 0 && !w.frei(tx, Math.max(s.Y, Y2), tz)) continue;
          const wasser = t.art === 'wasser' || aktuell.art === 'wasser';
          setze(tx, Y2, tz, s.kosten + (wasser ? kosten.schwimmen : dY === 0 ? kosten.gehen : kosten.stufe), von, wasser ? 'schwimmen' : dY === 0 ? 'gehen' : 'stufe');
          gefunden = true;
        }
        // 2. springen: +1 Block (2 HB) bei Platz über dem Start
        if (aktuell.art === 'boden') {
          const Y2 = s.Y + sprungHB;
          const t = w.stelle(tx, Y2, tz);
          if (t.ok && w.frei(s.x, Y2, s.z)) { setze(tx, Y2, tz, s.kosten + (art.name === 'spieler' ? kosten.sprung : kosten.sprungDorfbewohner), von, 'springen'); gefunden = true; }
        }
        // 3. fallen: über die Kante in eine freie Säule ohne Boden bei gleicher Höhe
        if (aktuell.art !== 'leiter' && w.frei(tx, s.Y, tz) && !w.stelle(tx, s.Y, tz).ok) {
          for (let Y2 = s.Y - 1; Y2 >= s.Y - 2 * 64 && Y2 >= 2 * HOEHE_MIN; Y2--) {
            const t = w.stelle(tx, Y2, tz);
            if (t.ok) {
              const bloecke = (s.Y - Y2) / 2;
              if (bloecke > art.maxFall) break;
              if (Y2 === s.Y - 1) break; // 0,5 Block Abstieg ist ein normaler Schritt (oben behandelt)
              setze(tx, Y2, tz, s.kosten + kosten.fallen + kosten.fallenProBlock * bloecke, von, 'fallen', { fallBloecke: t.art === 'wasser' ? 0 : bloecke }); // Wasser fängt den Sturz ab
              gefunden = true;
              break;
            }
            if (!w.frei(tx, Y2, tz)) break;
          }
        }
        // 4. Lücke überspringen (nur Spieler): 1 Block breit, gleiche Höhe oder tiefer
        if (art.kannLuecke && aktuell.art === 'boden' && !gefunden) {
          const mx = tx, mz = tz;
          if (w.frei(mx, s.Y, mz) && !w.stelle(mx, s.Y, mz).ok) {
            const lx = mx + VEKTOR[d].x, lz = mz + VEKTOR[d].z;
            for (const Y2 of [s.Y, s.Y - 1, s.Y - 2]) {
              if (Math.abs(lx - start.x) > radius || Math.abs(lz - start.z) > radius) continue;
              const t = w.stelle(lx, Y2, lz);
              if (t.ok && t.art === 'boden' && w.frei(lx, s.Y, lz) && lueckeBreite >= 1) { setze(lx, Y2, lz, s.kosten + kosten.luecke, von, 'luecke'); break; }
            }
          }
        }
      }
    }
    return { start: { x: start.x, Y: sicherStart, z: start.z }, zustaende: dist, werkzeug: w };
  }

  /** Beste Stehstelle in der Zelle (x, y, z) (Füße in dieser Zelle) oder null. */
  function besteInZelle(ergebnis, x, y, z) {
    let best = null;
    for (const Y of [2 * y, 2 * y + 1]) {
      const e = ergebnis.zustaende.get(key(x, Y, z));
      if (e && (!best || e.kosten < best.kosten)) best = e;
    }
    return best;
  }

  /** Alle von `start` (Zelle der Füße) erreichbaren Stehstellen. */
  function erreichbar(welt, start, artName, optionen = {}) {
    const art = typeof artName === 'string' ? wesenArt(artName, optionen) : artName;
    const erg = suche(welt, start, art, optionen);
    return {
      art, start: erg.start, grund: erg.grund ?? null,
      zustaende: erg.zustaende,
      kann: (x, y, z) => besteInZelle(erg, x, y, z) !== null,
      kosten: (x, y, z) => besteInZelle(erg, x, y, z)?.kosten ?? null,
      anzahl: erg.zustaende.size,
    };
  }

  function fallschaden(bloecke) {
    return Math.max(0, Math.ceil(bloecke - schadenAb));
  }

  /**
   * Weg von einer Zelle zur anderen.
   * @returns {{ok:true, kosten:number, schritte:object[], fallschaden:number, springt:boolean} | {ok:false, grund:string, naechste?:object}}
   */
  function weg(welt, von, nach, artName, optionen = {}) {
    const art = typeof artName === 'string' ? wesenArt(artName, optionen) : artName;
    const erg = suche(welt, von, art, optionen);
    if (!erg.start) return { ok: false, grund: erg.grund };
    const ziel = besteInZelle(erg, nach.x, nach.y, nach.z);
    if (ziel) {
      const schritte = [];
      let e = ziel;
      while (e) { schritte.unshift({ x: e.x, y: Math.floor(e.Y / 2), z: e.z, hoehe: e.Y / 2, art: e.schritt, fallBloecke: e.fallBloecke ?? 0 }); e = e.von ? erg.zustaende.get(e.von) : null; }
      const schaden = schritte.reduce((s, x) => s + fallschaden(x.fallBloecke), 0);
      return { ok: true, kosten: ziel.kosten, schritte, fallschaden: schaden, springt: schritte.some((x) => x.art === 'springen' || x.art === 'luecke'), faellt: schritte.some((x) => x.fallBloecke > 0) };
    }
    // Grund: Ziel selbst ungültig? sonst nächste erreichbare Stelle beschreiben
    const werk = erg.werkzeug;
    for (const Y of [2 * nach.y, 2 * nach.y + 1]) {
      const t = werk.stelle(nach.x, Y, nach.z);
      if (t.ok) {
        const naechste = [...erg.zustaende.values()].sort((a, b) => (Math.abs(a.x - nach.x) + Math.abs(a.z - nach.z) + Math.abs(a.Y - Y) / 2) - (Math.abs(b.x - nach.x) + Math.abs(b.z - nach.z) + Math.abs(b.Y - Y) / 2))[0];
        const dy = naechste ? (Y - naechste.Y) / 2 : 0;
        const grund = dy > 1 ? `zu hoch: ${dy} Blöcke Höhenunterschied ab (${naechste.x}, ${Math.floor(naechste.Y / 2)}, ${naechste.z})` : dy < -art.maxFall ? `Fallhöhe über ${art.maxFall} Blöcke` : `Weg versperrt (Tür, Engstelle oder Lücke) ab (${naechste?.x}, ${naechste ? Math.floor(naechste.Y / 2) : '?'}, ${naechste?.z})`;
        return { ok: false, grund, naechste: naechste ? { x: naechste.x, y: Math.floor(naechste.Y / 2), z: naechste.z } : null };
      }
    }
    const t = werk.stelle(nach.x, 2 * nach.y, nach.z);
    return { ok: false, grund: `Ziel nicht begehbar: ${t.grund}` };
  }

  /**
   * Freier Fall senkrecht von einer Stelle aus: wo kommt das Wesen an, wie tief fällt es, welchen Schaden nimmt es?
   * `von` = Zelle, in der die Füße stehen (Fußhöhe = Unterkante der Zelle). Wasser fängt den Sturz ab (Schaden 0), Lava und unklare Blöcke werden als Grund genannt.
   * @returns {{ok: true, ziel: {x:number,y:number,z:number}, Y: number, hoehe: number, art: 'boden'|'wasser', schaden: number} | {ok: false, grund: string, unklar?: boolean}}
   */
  function faellt(welt, von, artName) {
    const art = wesenArt(artName);
    const w = werkzeug(welt, art);
    const Y0 = 2 * von.y;
    for (let Y = Y0; Y >= 2 * HOEHE_MIN; Y--) {
      const r = w.raum(von.x, Y, von.z);
      if (!r.ok && (r.grund === 'Lava' || r.unklar)) return { ok: false, grund: r.grund, unklar: r.unklar };
      const s = w.stelle(von.x, Y, von.z);
      if (!s.ok) { if (s.unklar) return { ok: false, grund: s.grund, unklar: true }; continue; }
      const hoehe = s.art === 'wasser' ? 0 : (Y0 - Y) / 2;
      return { ok: true, ziel: { x: von.x, y: Math.floor(Y / 2), z: von.z }, Y, hoehe, art: s.art, schaden: s.art === 'wasser' ? 0 : fallschaden(hoehe) };
    }
    return { ok: false, grund: 'kein Boden unter der Stelle' };
  }

  /** Ist an der Stelle (Fußzelle, Fußhöhe in Halbblöcken Y) Platz für den Körper und trägt dort etwas? Für die Wahl von Austrittszellen. */
  function stehstelle(welt, ort, artName) {
    const art = wesenArt(artName);
    const w = werkzeug(welt, art);
    const Y = 2 * ort.y;
    const r = w.raum(ort.x, Y, ort.z);
    return { platz: r.ok, grund: r.ok ? null : r.grund, unklar: r.unklar === true, traegt: r.ok ? w.stelle(ort.x, Y, ort.z).ok : false };
  }

  return { wesenArt, erreichbar, weg, fallschaden, faellt, stehstelle };
}

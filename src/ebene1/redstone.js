// Ebene 1 – Mechanik „Redstone-Strom“ (Gleichgewicht, ohne Zeitverhalten)
// Regeln: data/regeln/redstone.json (Quelle und Status je Regel; vieles ist im Wiki nicht als Bedrock gekennzeichnet → Java-Platzhalter, `ungeprüft`).
// Modell: Quellen (Redstone-Block, Hebel, Knopf, Redstonefackel, Detektorschiene) bestromen ihre Nachbarzellen schwach und einen Block stark
// (Hebel/Knopf: den Befestigungsblock, Fackel: den Block darüber, Detektorschiene: den Block darunter). Staub verteilt Strom (−1 je Block),
// wird von Quellen und stark bestromten Blöcken gespeist und bestromt den Block darunter und die Blöcke, auf die er zeigt, schwach.
// Fackeln invertieren ihren Befestigungsblock. Die Berechnung wiederholt sich bis zum stabilen Zustand; schwingt eine Schaltung (Fackeluhr),
// werden die beteiligten Fackeln als `instabil` gemeldet. Verzögerungen, Brennen, Repeater, Komparator und Knopfdauer sind nicht dabei (Teil 2f-2).
// Die Welt wird nur über Ebene 0 gelesen.
import { VEKTOR } from '../ebene0/richtungen.js';

const key = (p) => `${p.x},${p.y},${p.z}`;
const plus = (p, r) => ({ x: p.x + VEKTOR[r].x, y: p.y + VEKTOR[r].y, z: p.z + VEKTOR[r].z });
const HORIZONTAL = ['north', 'east', 'south', 'west'];
const SECHS = [...HORIZONTAL, 'up', 'down'];
const GEGEN = { north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up' };
const MAX_RUNDEN = 64;

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, register: object, richtungVon: (zustandName:string, wert:any) => string|null}} quellen
 */
export function erzeugeRedstone({ regelwerk, register, richtungVon }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  const abnahme = P('redstone.staub-abnahme', 'abnahme');
  const maximum = P('redstone.staub-abnahme', 'maximum');
  const staubId = P('redstone.staub-verbindung', 'staub');
  const verbindbar = new RegExp(P('redstone.staub-verbindung', 'verbindbarMuster'));
  const redstoneBlock = P('redstone.quelle-block', 'block');
  const hebel = { block: P('redstone.hebel', 'block'), befestigtAn: P('redstone.hebel', 'befestigtAn') };
  const knopf = new RegExp(P('redstone.knopf', 'muster'));
  const fackelAn = P('redstone.fackel-invertiert', 'an');
  const fackelAus = P('redstone.fackel-invertiert', 'aus');
  const detektor = P('redstone.detektorschiene', 'block');
  const leitet = (id) => register.bloecke.block(id).eigenschaften.leitet === true;
  const unklarLeitet = (id) => register.bloecke.block(id).eigenschaften.leitet === null;

  /**
   * Stabiler Stromzustand der Welt.
   * @param {import('../ebene0/welt.js').Welt} welt
   * @param {{loren?: {x:number,y:number,z:number}[]}} [optionen] Zellen, in denen eine Lore steht (für Detektorschienen)
   */
  function stromkarte(welt, { loren = [] } = {}) {
    const lore = new Set(loren.map(key));
    const lies = (p) => welt.leseBlock(p.x, p.y, p.z);
    const alle = welt.alleBloecke();

    // Bauteile einsammeln (einmal)
    const staub = [], fackeln = [], dauerQuellen = [];
    for (const b of alle) {
      const pos = { x: b.x, y: b.y, z: b.z };
      if (b.id === staubId) staub.push(pos);
      else if (b.id === fackelAn || b.id === fackelAus) {
        const r = b.zustand.torch_facing_direction === 'top' ? 'down' : richtungVon('torch_facing_direction', b.zustand.torch_facing_direction);
        fackeln.push({ pos, an: b.id === fackelAn, befestigt: r ? plus(pos, r) : null });
      } else if (b.id === redstoneBlock) dauerQuellen.push({ pos, art: 'block' });
      else if (b.id === hebel.block) {
        if (b.zustand.open_bit === true) dauerQuellen.push({ pos, art: 'schalter', befestigt: plus(pos, hebel.befestigtAn[b.zustand.lever_direction] ?? 'down'), unbekannt: hebel.befestigtAn[b.zustand.lever_direction] === undefined });
      } else if (knopf.test(b.id)) {
        if (b.zustand.button_pressed_bit === true) {
          const r = richtungVon('facing_direction', b.zustand.facing_direction);
          dauerQuellen.push({ pos, art: 'schalter', befestigt: r ? plus(pos, GEGEN[r]) : null });
        }
      } else if (b.id === detektor) {
        if (b.zustand.rail_data_bit === true || lore.has(key(pos))) dauerQuellen.push({ pos, art: 'detektor' });
      }
    }
    const staubSet = new Set(staub.map(key));
    const istStaub = (p) => staubSet.has(key(p));

    // Verbindungen der Staubzellen (unabhängig vom Stromzustand)
    const verbindung = new Map(); // Staubzelle → { staub: [Zelle…], horizontal: [Richtung…] }
    for (const d of staub) {
      const obenFrei = !leitet(lies(plus(d, 'up')).id);
      const nachbarn = [], horizontal = [];
      for (const h of HORIZONTAL) {
        const n = plus(d, h);
        const bn = lies(n);
        if (istStaub(n)) { nachbarn.push(n); horizontal.push(h); continue; }
        if (verbindbar.test(bn.id) || bn.id === fackelAn || bn.id === fackelAus) { horizontal.push(h); continue; }
        if (leitet(bn.id)) {
          const oben = plus(n, 'up');
          if (obenFrei && istStaub(oben)) { nachbarn.push(oben); horizontal.push(h); }
        } else {
          const unten = plus(n, 'down');
          if (istStaub(unten)) { nachbarn.push(unten); horizontal.push(h); }
        }
      }
      verbindung.set(key(d), { staub: nachbarn, horizontal });
    }
    const zeigtAuf = (d, h) => {
      const v = verbindung.get(key(d)).horizontal;
      return v.includes(h) || v.length === 0 || (v.length === 1 && GEGEN[v[0]] === h);
    };

    const zustandFackel = new Map(fackeln.map((f) => [key(f.pos), f.an]));
    let letzte = null, vorletzte = null, ergebnis = null;
    const wechsel = new Set();
    for (let runde = 0; runde < MAX_RUNDEN; runde++) {
      // 1. Ausgaben der Quellen
      const schwach = new Set(), stark = new Set();
      const gib = (zelle, istStark) => { const k = key(zelle); schwach.add(k); if (istStark) stark.add(k); };
      for (const q of dauerQuellen) {
        for (const r of SECHS) gib(plus(q.pos, r), q.art === 'schalter' ? false : q.art === 'detektor' ? r === 'down' : false);
        if (q.art === 'schalter' && q.befestigt) gib(q.befestigt, true);
      }
      for (const f of fackeln) {
        if (!zustandFackel.get(key(f.pos))) continue;
        for (const r of SECHS) {
          const z = plus(f.pos, r);
          if (f.befestigt && key(z) === key(f.befestigt)) continue;
          gib(z, r === 'up');
        }
      }
      // 2. Staub
      const stufe = new Map();
      const setze = (p, v) => { const k = key(p); if (v > (stufe.get(k) ?? 0)) { stufe.set(k, v); return true; } return false; };
      const offen = [];
      for (const d of staub) {
        let v = 0;
        const k = key(d);
        if (schwach.has(k)) v = maximum;
        else {
          for (const r of SECHS) { const n = plus(d, r); if (stark.has(key(n)) && leitet(lies(n).id)) { v = maximum; break; } }
        }
        if (v > 0) { stufe.set(k, v); offen.push(d); }
      }
      while (offen.length) {
        const d = offen.shift();
        const v = stufe.get(key(d));
        if (v <= abnahme) continue;
        for (const n of verbindung.get(key(d)).staub) if (setze(n, v - abnahme)) offen.push(n);
      }
      // 3. Blöcke: Staub bestromt den Block darunter und die Blöcke, auf die er zeigt (schwach)
      const durchStaub = new Set();
      for (const d of staub) {
        if ((stufe.get(key(d)) ?? 0) === 0) continue;
        durchStaub.add(key(plus(d, 'down')));
        for (const h of HORIZONTAL) if (zeigtAuf(d, h)) durchStaub.add(key(plus(d, h)));
      }
      const bestromt = (p) => { const k = key(p); return leitet(lies(p).id) && (schwach.has(k) || stark.has(k) || durchStaub.has(k)); };
      // 4. Fackeln invertieren
      let geaendert = false;
      const neu = new Map();
      for (const f of fackeln) {
        const an = !(f.befestigt && bestromt(f.befestigt));
        neu.set(key(f.pos), an);
        if (an !== zustandFackel.get(key(f.pos))) { geaendert = true; wechsel.add(key(f.pos)); }
      }
      ergebnis = { stufe, schwach, stark, durchStaub, bestromt, zustand: new Map(zustandFackel), runde };
      if (!geaendert) { ergebnis.stabil = true; break; }
      vorletzte = letzte; letzte = new Map(zustandFackel);
      for (const [k, v] of neu) zustandFackel.set(k, v);
      ergebnis.stabil = false;
    }
    void vorletzte;
    const instabil = ergebnis.stabil ? [] : fackeln.filter((f) => wechsel.has(key(f.pos))).map((f) => ({ ...f.pos }));

    const unklar = [];
    for (const d of staub) for (const r of SECHS) { const n = plus(d, r); if (unklarLeitet(lies(n).id)) unklar.push(n); }

    return {
      stabil: ergebnis.stabil,
      runden: ergebnis.runde,
      instabil,
      /** Staubstärke 0–15 an der Zelle (0 bei Nicht-Staub) */
      staub: (x, y, z) => ergebnis.stufe.get(key({ x, y, z })) ?? 0,
      /** Ist der Block bei (x, y, z) ein bestromter, leitender Block (schwach oder stark)? */
      blockBestromt: (x, y, z) => ergebnis.bestromt({ x, y, z }),
      /** Stark bestromt? (Hebel/Knopf am Block, Fackel darunter, Detektorschiene darunter) */
      blockStark: (x, y, z) => leitet(lies({ x, y, z }).id) && ergebnis.stark.has(key({ x, y, z })),
      /** Brennt die Fackel? (null, wenn dort keine Fackel steht) */
      fackelAn: (x, y, z) => ergebnis.zustand.get(key({ x, y, z })) ?? null,
      /** Zellen mit Staub, der auf eine Schiene zeigt, die in `ids` steht: Quellen für antrieb.aktive(). */
      staubQuellenFuer: (ids) => {
        const set = new Set(ids);
        const ergebnisListe = [];
        for (const d of staub) {
          if ((ergebnis.stufe.get(key(d)) ?? 0) === 0) continue;
          if (HORIZONTAL.some((h) => zeigtAuf(d, h) && set.has(lies(plus(d, h)).id))) ergebnisListe.push({ ...d });
        }
        return ergebnisListe;
      },
      /** Staubzellen mit Stärke 0, die an eine Zelle mit Stärke 1 grenzen: die Leitung ist hier zu lang (ohne Verstärker). */
      abgeschnitten: staub.filter((d) => (ergebnis.stufe.get(key(d)) ?? 0) === 0 && verbindung.get(key(d)).staub.some((n) => (ergebnis.stufe.get(key(n)) ?? 0) === 1)).map((d) => ({ ...d })),
      /** Je eine Zelle der Staubgruppen, die nie Strom bekommen (alle Zellen der Gruppe haben Stärke 0 und kein Nachbar-Staub ist bestromt). */
      ohneQuelle: (() => {
        const gesehen = new Set(), liste = [];
        for (const d of staub) {
          if (gesehen.has(key(d))) continue;
          const gruppe = [d]; gesehen.add(key(d));
          for (let i = 0; i < gruppe.length; i++) for (const n of verbindung.get(key(gruppe[i])).staub) if (!gesehen.has(key(n))) { gesehen.add(key(n)); gruppe.push(n); }
          if (gruppe.every((g) => (ergebnis.stufe.get(key(g)) ?? 0) === 0)) liste.push({ ...d });
        }
        return liste;
      })(),
      /** Blöcke neben Staub mit unbekannter Leitfähigkeit (für den Prüfer) */
      unklar,
      staubZellen: staub.map((d) => ({ ...d })),
    };
  }

  const enthaeltRedstone = (welt) => welt.alleBloecke().some((b) => b.id === staubId || b.id === fackelAn || b.id === fackelAus);

  return { stromkarte, enthaeltRedstone };
}

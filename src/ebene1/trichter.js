// Ebene 1 – Mechanik „Trichter & Blockinhalte“
// Regeln: data/regeln/trichter.json (Quelle und Status je Regel; Bedrock nennt wenig → Java-Platzhalter, `ungeprüft`).
// Modell: Jeder Trichter wartet nach einem Vorgang 8 Spielticks (Cooldown). Ist er bereit und nicht bestromt (toggle_bit), schiebt er zuerst
// einen Gegenstand aus seinem ersten passenden Slot in den Behälter, zu dem er zeigt, und zieht dann einen Gegenstand aus dem Behälter über sich.
// Gelegt wird in den am weitesten links liegenden Slot mit gleichem Gegenstand und Platz, sonst in den ersten leeren Slot. Stapelgrößen kommen aus Ebene 0.
// Sonderbehälter (Ofen, Braustand, Komposter, Plattenspieler, Pult …) werden nicht bewegt, sondern als „unklar“ gemeldet.
// Dazu: `lesewert` = Signalstärke, die ein Komparator an einem Behälter liest. Die Welt wird nur über Ebene 0 gelesen und geschrieben.
import { VEKTOR } from '../ebene0/richtungen.js';
import { Sandkasten } from './sandkasten.js';
import { Taktgeber } from './taktgeber.js';

const plus = (p, r) => ({ x: p.x + VEKTOR[r].x, y: p.y + VEKTOR[r].y, z: p.z + VEKTOR[r].z });
const key = (p) => `${p.x},${p.y},${p.z}`;

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, register: object, richtungVon: (zustandName:string, wert:any) => string|null}} quellen
 */
export function erzeugeTrichter({ regelwerk, register, richtungVon }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  const cooldown = P('trichter.cooldown', 'ticks');
  const behaelterMuster = P('trichter.behaelter', 'muster').map((m) => new RegExp(m));
  const nichtInSich = new RegExp(P('trichter.behaelter', 'nichtInSich'));
  const hopperId = P('trichter.behaelter', 'trichter');
  const komparatorBasis = P('trichter.komparator', 'basis');
  const komparatorFaktor = P('trichter.komparator', 'faktor');
  const leerzeit = P('trichter.cooldown', 'ruheTicks');
  const sperrZustand = P('trichter.sperre', 'zustand');

  const slotsVon = (id) => register.bloecke.slots(id);
  /** 'ok' (wird bewegt) | 'sonder' (Behälter mit Sonderregeln) | null (kein Behälter) */
  function behaelterArt(id) {
    if (slotsVon(id) === 0) return null;
    return behaelterMuster.some((m) => m.test(id)) ? 'ok' : 'sonder';
  }
  const lies = (welt, p) => { const b = welt.leseBlock(p.x, p.y, p.z); return { ...b, inhalt: b.inhalt ?? [] }; };
  const schreibe = (welt, p, inhalt) => welt.setzeInhalt(p.x, p.y, p.z, inhalt.filter((s) => s.anzahl > 0));

  /** In welchen Slot käme ein Gegenstand? (links zuerst: gleicher Gegenstand mit Platz, sonst erster leerer Slot) Gibt −1 zurück, wenn kein Platz. */
  function zielSlot(block, gegenstand) {
    if (nichtInSich.test(block.id) && nichtInSich.test(gegenstand)) return -1;
    const n = slotsVon(block.id);
    const stapel = register.stapel(gegenstand);
    for (let s = 0; s < n; s++) {
      const e = block.inhalt.find((x) => x.slot === s);
      if (e && e.gegenstand === gegenstand && e.anzahl < stapel) return s;
    }
    for (let s = 0; s < n; s++) if (!block.inhalt.some((x) => x.slot === s)) return s;
    return -1;
  }
  function legeEin(welt, p, block, gegenstand, slot) {
    const inh = block.inhalt.map((x) => ({ ...x }));
    const e = inh.find((x) => x.slot === slot);
    if (e) e.anzahl += 1; else inh.push({ slot, gegenstand, anzahl: 1 });
    schreibe(welt, p, inh);
  }
  function nimmEin(welt, p, block, slot) {
    const inh = block.inhalt.map((x) => ({ ...x }));
    inh.find((x) => x.slot === slot).anzahl -= 1;
    schreibe(welt, p, inh);
  }
  /** Ein Gegenstand von `quelle` nach `ziel`: der erste Slot der Quelle (von links), dessen Gegenstand ins Ziel passt. */
  function bewege(welt, quellePos, zielPos) {
    const quelle = lies(welt, quellePos);
    const ziel = lies(welt, zielPos);
    for (const s of [...quelle.inhalt].sort((a, b) => a.slot - b.slot)) {
      const slot = zielSlot(ziel, s.gegenstand);
      if (slot < 0) continue;
      nimmEin(welt, quellePos, quelle, s.slot);
      legeEin(welt, zielPos, lies(welt, zielPos), s.gegenstand, slot);
      return s.gegenstand;
    }
    return null;
  }

  /** Richtung, in die der Trichter zeigt (north/east/south/west/down) oder null. */
  function zielRichtung(block) {
    return richtungVon('facing_direction', block.zustand.facing_direction);
  }

  function mechanik() {
    const ereignisse = [];
    const bereitAb = new Map(); // Trichter → Tick, ab dem er wieder arbeitet
    let letzteBewegung = 0;
    let positionen = null; // Trichter der Welt (einmal gesammelt, sortiert nach y, z, x)
    const merke = (ktx, was, pos, extra = {}) => ereignisse.push({ tick: ktx.tick, was, pos: { ...pos }, ...extra });
    const gemeldet = new Set();

    function trichterTick(ktx, pos) {
      const welt = ktx.welt;
      const k = key(pos);
      if ((bereitAb.get(k) ?? 0) > ktx.tick) return;
      const trichter = lies(welt, pos);
      if (trichter.zustand[sperrZustand] === true) {
        if (!gemeldet.has(`sperre:${k}`)) { gemeldet.add(`sperre:${k}`); merke(ktx, 'gesperrt', pos); }
        return;
      }
      gemeldet.delete(`sperre:${k}`);
      let bewegt = false;
      // 1. schieben
      const r = zielRichtung(trichter);
      if (r) {
        const ziel = plus(pos, r);
        const art = behaelterArt(welt.leseBlock(ziel.x, ziel.y, ziel.z).id);
        if (art === 'ok') {
          const g = bewege(welt, pos, ziel);
          if (g) { bewegt = true; merke(ktx, 'geschoben', pos, { ziel, gegenstand: g }); }
        } else if (art === 'sonder' && !gemeldet.has(`u:${k}`)) {
          gemeldet.add(`u:${k}`); merke(ktx, 'unklar', pos, { ziel, grund: welt.leseBlock(ziel.x, ziel.y, ziel.z).id });
        }
      }
      // 2. ziehen
      const quelle = plus(pos, 'up');
      const art = behaelterArt(welt.leseBlock(quelle.x, quelle.y, quelle.z).id);
      if (art === 'ok') {
        const g = bewege(welt, quelle, pos);
        if (g) { bewegt = true; merke(ktx, 'gezogen', pos, { quelle, gegenstand: g }); }
      } else if (art === 'sonder' && !gemeldet.has(`uq:${k}`)) {
        gemeldet.add(`uq:${k}`); merke(ktx, 'unklar', pos, { quelle, grund: welt.leseBlock(quelle.x, quelle.y, quelle.z).id });
      }
      if (bewegt) { bereitAb.set(k, ktx.tick + cooldown); letzteBewegung = ktx.tick; }
    }

    return {
      id: 'trichter',
      tickart: 'spieltick',
      ereignisse,
      get letzteBewegung() { return letzteBewegung; },
      schritt(ktx) {
        // feste Reihenfolge: sortiert nach (y, z, x) – die Reihenfolge innerhalb eines Ticks ist in Bedrock nicht dokumentiert
        positionen ??= ktx.welt.alleBloecke().filter((b) => b.id === hopperId).map((b) => ({ x: b.x, y: b.y, z: b.z }));
        for (const pos of positionen) trichterTick(ktx, pos);
      },
    };
  }

  /**
   * Läuft in einer Kopie der Welt, bis 16 Ticks lang nichts mehr bewegt wurde (oder maxTicks erreicht sind).
   * @returns {{welt: import('../ebene0/welt.js').Welt, ereignisse: object[], ticks: number, stabil: boolean}}
   */
  function simuliere(welt, { maxTicks = 5000, seed = 1 } = {}) {
    const sk = new Sandkasten(welt);
    const t = new Taktgeber(sk, { seed });
    const m = mechanik();
    t.registriere(m);
    while (t.tick < maxTicks && t.tick - m.letzteBewegung < leerzeit) t.schritt();
    return { welt: sk.welt, ereignisse: m.ereignisse, ticks: t.tick, stabil: t.tick - m.letzteBewegung >= leerzeit };
  }

  /**
   * Signalstärke, die ein Komparator an dem Behälter bei `pos` liest: 0 (leer) bis 15.
   * floor(1 + (Σ Füllgrad ÷ Slotzahl) × 14), Füllgrad = Anzahl ÷ Stapelgröße. Sonderbehälter und Nicht-Behälter: null.
   */
  function lesewert(welt, pos) {
    const b = lies(welt, pos);
    if (behaelterArt(b.id) !== 'ok') return null;
    const n = slotsVon(b.id);
    let summe = 0;
    for (const s of b.inhalt) summe += s.anzahl / register.stapel(s.gegenstand);
    if (summe === 0) return 0;
    return Math.min(15, Math.floor(komparatorBasis + (summe / n) * komparatorFaktor));
  }

  /** Die Trichter der Welt mit ihrem Ziel: {pos, ziel, art} (art: 'ok' | 'sonder' | 'kein-behaelter' | 'ohne-richtung'). */
  function trichterListe(welt) {
    const liste = [];
    for (const b of welt.alleBloecke()) {
      if (b.id !== hopperId) continue;
      const r = zielRichtung(b);
      if (!r) { liste.push({ pos: { x: b.x, y: b.y, z: b.z }, ziel: null, art: 'ohne-richtung' }); continue; }
      const ziel = plus(b, r);
      const art = behaelterArt(welt.leseBlock(ziel.x, ziel.y, ziel.z).id);
      liste.push({ pos: { x: b.x, y: b.y, z: b.z }, ziel, art: art ?? 'kein-behaelter', zielId: welt.leseBlock(ziel.x, ziel.y, ziel.z).id });
    }
    return liste;
  }

  const enthaeltTrichter = (welt) => welt.alleBloecke().some((b) => b.id === hopperId);

  return { mechanik, simuliere, lesewert, trichterListe, enthaeltTrichter, behaelterArt };
}

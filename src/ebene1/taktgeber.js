// Ebene 1 – Taktgeber (Bedrock-Ticklogik)
// Alle Mechaniken laufen über den Taktgeber und melden an, in welcher Tickart und Phase sie arbeiten.
//   Spieltick: 20/s. Redstone-Tick = 2 Spielticks, Phasen: ungerader Spieltick = P-Tick (Produce),
//   gerader Spieltick = C-Tick (Consume). Quelle: https://minecraft.wiki/w/Tick (Bedrock-Abschnitt).
// Tickarten einer Mechanik:
//   'spieltick'  – schritt() in jedem Spieltick (z. B. Wasserfluss, fallende Blöcke)
//   'staub'      – schritt() in jedem Spieltick (Redstone-Staub)
//   'uebertrager'– lesen() im P-Tick; das Ergebnis wird nach `verzoegerung` Redstone-Ticks im C-Tick geschrieben
//                  (schreiben(): Spieltick = Lesetick + 2·Verzögerung − 1, ABGELEITET, ungeprüft)
//   'mechanismus'– schritt() nur im C-Tick (Kolben, Lampe, Tür …)
//   'wesen'      – schritt() im P- und im C-Tick (Trichterlore, TNT-Lore, Rüstungsständer)
// Die Arbeitsreihenfolge innerhalb eines Spielticks ist in Bedrock nicht dokumentiert: sie steht als Daten in
// data/regeln/takt.json (Regel `takt.arbeitsreihenfolge`, UNGEPRÜFT). Gleiche Eingabe + gleicher Seed = gleicher Ablauf.
import { GeplanteTicks } from './geplante-ticks.js';
import { Zufall } from './zufall.js';

export const TICKARTEN = Object.freeze(['spieltick', 'staub', 'uebertrager', 'mechanismus', 'wesen']);
export const STANDARD_REIHENFOLGE = Object.freeze(['geplante-ticks', 'zufallsticks', 'spieltick', 'staub', 'uebertrager', 'mechanismus', 'wesen']);

export const phaseVon = (tick) => (tick % 2 === 1 ? 'P' : 'C');

export class Taktgeber {
  /**
   * @param {import('./sandkasten.js').Sandkasten} sandkasten
   * @param {{seed?: number, reihenfolge?: string[], tickbereich?: import('./tickbereich.js').Tickbereich, aufzeichnen?: boolean}} [optionen]
   */
  constructor(sandkasten, { seed = 1, reihenfolge = [...STANDARD_REIHENFOLGE], tickbereich = null, aufzeichnen = false } = {}) {
    const unbekannt = reihenfolge.filter((r) => r !== 'geplante-ticks' && r !== 'zufallsticks' && !TICKARTEN.includes(r));
    if (unbekannt.length) throw new Error(`Unbekannte Stufe in der Arbeitsreihenfolge: ${unbekannt.join(', ')}`);
    if (new Set(reihenfolge).size !== reihenfolge.length) throw new Error('Arbeitsreihenfolge enthält Doppelte');
    this.sandkasten = sandkasten;
    this.reihenfolge = [...reihenfolge];
    this.tickbereich = tickbereich;
    this.zufall = new Zufall(seed);
    this.geplant = new GeplanteTicks();
    this.tick = 0;
    this.protokoll = aufzeichnen ? [] : null;
    this._mechaniken = [];
    this._schreibVorgaenge = [];
  }

  /** Meldet eine Mechanik an. Reihenfolge der Anmeldung = Reihenfolge innerhalb ihrer Tickart. */
  registriere(mechanik) {
    if (!mechanik || typeof mechanik.id !== 'string' || !mechanik.id) throw new Error('Mechanik braucht eine id');
    if (!TICKARTEN.includes(mechanik.tickart)) throw new Error(`${mechanik.id}: unbekannte Tickart ${String(mechanik.tickart)}`);
    if (this._mechaniken.some((m) => m.id === mechanik.id)) throw new Error(`Mechanik ${mechanik.id} ist schon angemeldet`);
    if (mechanik.tickart === 'uebertrager' && !(typeof mechanik.lesen === 'function' && typeof mechanik.schreiben === 'function')) {
      throw new Error(`${mechanik.id}: Übertrager brauchen lesen() und schreiben()`);
    }
    if (mechanik.tickart !== 'uebertrager' && typeof mechanik.schritt !== 'function') throw new Error(`${mechanik.id}: schritt() fehlt`);
    this._mechaniken.push(mechanik);
  }

  _kontext(phase) {
    return {
      tick: this.tick,
      phase,
      sandkasten: this.sandkasten,
      welt: this.sandkasten.welt,
      zufall: this.zufall,
      tickbereich: this.tickbereich,
      plane: (e) => this.geplant.plane(e),
    };
  }

  _notiere(id, art, aktion) {
    if (this.protokoll) this.protokoll.push({ tick: this.tick, phase: phaseVon(this.tick), id, art, aktion });
  }

  /** Ein Spieltick. Gibt die Nummer des Ticks zurück. */
  schritt() {
    this.tick += 1;
    const phase = phaseVon(this.tick);
    const ktx = this._kontext(phase);
    for (const stufe of this.reihenfolge) {
      if (stufe === 'geplante-ticks') this._geplanteTicks(ktx);
      else if (stufe === 'zufallsticks') continue; // Mechaniken kommen später; die Stufe ist als Platzhalter in der Reihenfolge vorgesehen
      else this._stufe(stufe, ktx);
    }
    return this.tick;
  }

  /** n Spielticks. */
  laufe(n) {
    if (!Number.isInteger(n) || n < 0) throw new Error('n muss eine ganze Zahl >= 0 sein');
    for (let i = 0; i < n; i++) this.schritt();
    return this.tick;
  }

  _geplanteTicks(ktx) {
    const tickt = this.tickbereich ? (cx, cz) => this.tickbereich.tickt(cx, cz) : undefined;
    for (const e of this.geplant.faellige(this.tick, tickt)) {
      const m = this._mechaniken.find((x) => x.id === e.mechanik);
      if (!m) throw new Error(`Geplanter Tick für unbekannte Mechanik ${e.mechanik}`);
      if (typeof m.geplanterTick !== 'function') throw new Error(`${m.id}: geplanterTick() fehlt`);
      this._notiere(m.id, 'geplanter-tick', `${e.x},${e.z}`);
      m.geplanterTick(ktx, e);
    }
  }

  _stufe(art, ktx) {
    const phase = ktx.phase;
    const gruppe = this._mechaniken.filter((m) => m.tickart === art);
    if (art === 'uebertrager') {
      // Erst fällige Schreibvorgänge (C-Tick), dann lesen (P-Tick)
      if (phase === 'C') {
        const faellig = this._schreibVorgaenge.filter((s) => s.tick === this.tick);
        this._schreibVorgaenge = this._schreibVorgaenge.filter((s) => s.tick !== this.tick);
        for (const s of faellig) {
          this._notiere(s.mechanik.id, art, 'schreiben');
          s.mechanik.schreiben(ktx, s.wert);
        }
      } else {
        for (const m of gruppe) {
          const r = m.lesen(ktx);
          this._notiere(m.id, art, 'lesen');
          if (!r) continue;
          const d = r.verzoegerung ?? 1;
          if (!Number.isInteger(d) || d < 1) throw new Error(`${m.id}: Verzögerung muss eine ganze Zahl >= 1 sein (Redstone-Ticks)`);
          this._schreibVorgaenge.push({ tick: this.tick + 2 * d - 1, mechanik: m, wert: r.wert });
        }
      }
      return;
    }
    if (art === 'mechanismus' && phase !== 'C') return;
    for (const m of gruppe) {
      this._notiere(m.id, art, 'schritt');
      m.schritt(ktx);
    }
  }
}

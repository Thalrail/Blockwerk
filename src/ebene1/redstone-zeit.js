// Ebene 1 – Mechanik „Redstone-Zeit“ (Fackel, Repeater, Komparator, Knopf und Staub Tick für Tick)
// Regeln: data/regeln/redstone-zeit.json (Quelle und Status je Regel; Bedrock nennt wenig → Java-Platzhalter, `ungeprüft`).
// Modell: Der Staub wird in jedem Spielstick neu berechnet (Tickart `staub`) und in die Welt geschrieben (redstone_signal).
// Fackel, Repeater und Komparator sind `uebertrager`: sie lesen im P-Tick (ungerade) und schreiben nach ihrer Verzögerung im C-Tick (gerade),
// Verzögerung d Redstone-Ticks ⇒ Schreibtick = Lesetick + 2·d − 1 (Taktgeber). Knöpfe lösen sich nach 20 (Stein) bzw. 30 (Holz) Ticks.
// Die Fackel brennt aus, wenn sie mehr als 8 Wechsel in 60 Ticks macht (Java-Platzhalter). Die Zustände stehen in der Welt:
// Fackel an/aus als Block-ID, Repeater powered_/unpowered_, Komparator output_lit_bit; die Komparator-Stärke (0–15) steht nur im Gedächtnis der Simulation.
// Die Welt wird nur über Ebene 0 gelesen und geschrieben (Simulation im Sandkasten, Original bleibt unberührt).
import { VEKTOR } from '../ebene0/richtungen.js';
import { Sandkasten } from './sandkasten.js';
import { Taktgeber } from './taktgeber.js';

const key = (p) => `${p.x},${p.y},${p.z}`;
const plus = (p, r) => ({ x: p.x + VEKTOR[r].x, y: p.y + VEKTOR[r].y, z: p.z + VEKTOR[r].z });
const GEGEN = { north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up' };
const SEITEN_VON = { north: ['east', 'west'], south: ['east', 'west'], east: ['north', 'south'], west: ['north', 'south'] };

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, register: object, richtungVon: Function, redstone: ReturnType<typeof import('./redstone.js').erzeugeRedstone>, trichter: ReturnType<typeof import('./trichter.js').erzeugeTrichter>}} quellen
 */
export function erzeugeRedstoneZeit({ regelwerk, register, richtungVon, redstone, trichter }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  const staubId = P('redstone.staub-verbindung', 'staub');
  const fackelAn = P('redstone.fackel-invertiert', 'an');
  const fackelAus = P('redstone.fackel-invertiert', 'aus');
  const fackelDelay = P('zeit.fackel-verzoegerung', 'redstoneTicks');
  const brennGrenze = P('zeit.fackel-brennen', 'wechsel');
  const brennFenster = P('zeit.fackel-brennen', 'ticks');
  const repeaterIds = P('zeit.repeater-verzoegerung', 'ids');
  const komparatorIds = P('zeit.komparator-modi', 'ids');
  const eingangSeite = P('zeit.repeater-verzoegerung', 'cardinalDirectionIstEingang');
  const knopfStein = new RegExp(P('zeit.knopf-dauer', 'steinMuster'));
  const knopfDauer = { stein: P('zeit.knopf-dauer', 'steinTicks'), holz: P('zeit.knopf-dauer', 'holzTicks') };
  const knopf = new RegExp(P('redstone.knopf', 'muster'));
  const redstoneBlock = P('redstone.quelle-block', 'block');
  const ruhe = P('zeit.staub-sofort', 'ruheTicks');
  const istRepeater = (id) => repeaterIds.includes(id);
  const istKomparator = (id) => komparatorIds.includes(id);

  /** Front (Ausgang) und Rücken (Eingang) eines Repeaters/Komparators aus cardinal_direction. */
  function seiten(zustand) {
    const d = zustand['minecraft:cardinal_direction'];
    const eingang = eingangSeite ? d : GEGEN[d];
    return { eingang, front: GEGEN[eingang] };
  }

  /**
   * Baut die Mechaniken für eine Welt (im Sandkasten) und gibt Steuerung zurück.
   * @param {import('../ebene0/welt.js').Welt} welt
   * @param {{loren?: {x:number,y:number,z:number}[], seed?: number}} [optionen]
   */
  function erzeuge(welt, { loren = [], seed = 1 } = {}) {
    const sk = new Sandkasten(welt);
    const t = new Taktgeber(sk, { seed });
    const ereignisse = [];
    const merke = (ktx, was, pos, extra = {}) => ereignisse.push({ tick: ktx.tick, was, pos: { ...pos }, ...extra });
    const w = sk.welt;
    const lies = (p) => w.leseBlock(p.x, p.y, p.z);

    // Bauteile der Welt einsammeln
    const fackeln = [], repeater = [], komparatoren = [], knoepfe = [];
    for (const b of w.alleBloecke()) {
      const pos = { x: b.x, y: b.y, z: b.z };
      if (b.id === fackelAn || b.id === fackelAus) fackeln.push(pos);
      else if (istRepeater(b.id)) repeater.push(pos);
      else if (istKomparator(b.id)) komparatoren.push(pos);
      else if (knopf.test(b.id)) knoepfe.push(pos);
    }
    // Gedächtnis (nicht in der Welt gespeichert)
    const komparatorStufe = new Map(komparatoren.map((p) => [key(p), lies(p).zustand.output_lit_bit ? 15 : 0]));

    // Stromkarte je Tick (einmal rechnen, von allen Bauteilen im selben Tick benutzt)
    let karteTick = -1, karteWert = null;
    function karte(ktx) {
      if (karteTick === ktx.tick) return karteWert;
      const fest = { fackel: new Map(), ausgaben: [] };
      for (const p of fackeln) fest.fackel.set(key(p), lies(p).id === fackelAn);
      for (const p of repeater) {
        const b = lies(p);
        if (b.id === repeaterIds[1]) fest.ausgaben.push({ von: p, zelle: plus(p, seiten(b.zustand).front), stufe: 15 });
      }
      for (const p of komparatoren) {
        const stufe = komparatorStufe.get(key(p)) ?? 0;
        if (stufe > 0) fest.ausgaben.push({ von: p, zelle: plus(p, seiten(lies(p).zustand).front), stufe });
      }
      karteWert = redstone.stromkarte(w, { loren, fest });
      karteTick = ktx.tick;
      return karteWert;
    }

    // ---- Knöpfe: nach 20 (Stein) bzw. 30 (Holz) Ticks los ----
    const ablauf = new Map();
    const knopfMechanik = {
      id: 'zeit-knoepfe', tickart: 'spieltick',
      schritt(ktx) {
        for (const p of knoepfe) {
          const b = lies(p), k = key(p);
          if (b.zustand.button_pressed_bit === true && !ablauf.has(k)) ablauf.set(k, ktx.tick + (knopfStein.test(b.id) ? knopfDauer.stein : knopfDauer.holz));
          if (ablauf.has(k) && ktx.tick >= ablauf.get(k)) {
            ablauf.delete(k);
            w.setzeBlock(p.x, p.y, p.z, b.id, { ...b.zustand, button_pressed_bit: false });
            merke(ktx, 'knopf-los', p);
          }
        }
      },
    };

    // ---- Staub: jeden Spielstick ----
    const staubMechanik = {
      id: 'zeit-staub', tickart: 'staub',
      schritt(ktx) {
        const k = karte(ktx);
        for (const d of k.staubZellen) {
          const stufe = k.staub(d.x, d.y, d.z);
          const b = lies(d);
          if (b.zustand.redstone_signal !== stufe) w.setzeBlock(d.x, d.y, d.z, staubId, { redstone_signal: stufe });
        }
      },
    };

    // ---- Fackeln ----
    const fackelMechaniken = fackeln.map((pos) => {
      const k = key(pos);
      let ziel = lies(pos).id === fackelAn;
      let brennt = false;
      const wechsel = [];
      const befestigt = () => {
        const z = lies(pos).zustand.torch_facing_direction;
        const r = z === 'top' ? 'down' : richtungVon('torch_facing_direction', z);
        return r ? plus(pos, r) : null;
      };
      return {
        id: `zeit-fackel:${k}`, tickart: 'uebertrager',
        lesen(ktx) {
          while (wechsel.length && wechsel[0] <= ktx.tick - brennFenster) wechsel.shift();
          if (brennt) {
            if (wechsel.length < brennGrenze) { brennt = false; merke(ktx, 'brennt-wieder', pos); }
            else return null;
          }
          const b = befestigt();
          const gewollt = !(b && karte(ktx).blockBestromt(b.x, b.y, b.z));
          if (gewollt === ziel) return null;
          ziel = gewollt;
          return { verzoegerung: fackelDelay, wert: gewollt };
        },
        schreiben(ktx, wert) {
          const aktuell = lies(pos);
          wechsel.push(ktx.tick);
          while (wechsel.length && wechsel[0] <= ktx.tick - brennFenster) wechsel.shift();
          if (wechsel.length > brennGrenze) {
            brennt = true; ziel = false;
            w.setzeBlock(pos.x, pos.y, pos.z, fackelAus, aktuell.zustand);
            merke(ktx, 'brennt-aus', pos);
            return;
          }
          w.setzeBlock(pos.x, pos.y, pos.z, wert ? fackelAn : fackelAus, aktuell.zustand);
          merke(ktx, wert ? 'fackel-an' : 'fackel-aus', pos);
        },
      };
    });

    // ---- Repeater ----
    const repeaterMechaniken = repeater.map((pos) => {
      const k = key(pos);
      let ziel = lies(pos).id === repeaterIds[1];
      let fruehestAus = 0;
      const gesperrt = () => {
        const { front } = seiten(lies(pos).zustand);
        return SEITEN_VON[front].some((s) => {
          const n = plus(pos, s);
          const b = lies(n);
          if (b.id !== repeaterIds[1] && !(istKomparator(b.id) && (komparatorStufe.get(key(n)) ?? 0) > 0)) return false;
          return key(plus(n, seiten(b.zustand).front)) === k;
        });
      };
      return {
        id: `zeit-repeater:${k}`, tickart: 'uebertrager',
        lesen(ktx) {
          if (gesperrt()) return null;
          const b = lies(pos);
          const { eingang } = seiten(b.zustand);
          const gewollt = karte(ktx).signalVon(plus(pos, eingang), pos) > 0;
          if (gewollt === ziel) return null;
          ziel = gewollt;
          const d = b.zustand.repeater_delay + 1;
          let verz = d;
          if (!gewollt) {
            // eine eingeschaltete Phase dauert mindestens so lange wie die Verzögerung
            const schreibTick = Math.max(ktx.tick + 2 * d - 1, fruehestAus);
            verz = (schreibTick - ktx.tick + 1) / 2;
          } else fruehestAus = ktx.tick + 2 * d - 1 + 2 * d;
          return { verzoegerung: verz, wert: gewollt };
        },
        schreiben(ktx, wert) {
          if (wert === false && ziel !== false) return; // kurzer Aus-Impuls, der schon wieder aufgehoben wurde: unterdrückt (An-Impulse werden nie verschluckt, nur verlängert)
          const b = lies(pos);
          const id = wert ? repeaterIds[1] : repeaterIds[0];
          if (b.id === id) return;
          w.setzeBlock(pos.x, pos.y, pos.z, id, b.zustand);
          merke(ktx, wert ? 'repeater-an' : 'repeater-aus', pos);
        },
      };
    });

    // ---- Komparatoren ----
    const komparatorMechaniken = komparatoren.map((pos) => {
      const k = key(pos);
      let ziel = komparatorStufe.get(k);
      const istSeitenQuelle = (id) => id === staubId || istRepeater(id) || istKomparator(id) || id === redstoneBlock;
      return {
        id: `zeit-komparator:${k}`, tickart: 'uebertrager',
        lesen(ktx) {
          const b = lies(pos);
          const { eingang, front } = seiten(b.zustand);
          const km = karte(ktx);
          const hinten = plus(pos, eingang);
          let rueck = km.signalVon(hinten, pos);
          const behaelter = (p) => trichter.lesewert(w, p);
          const direkt = behaelter(hinten);
          if (direkt !== null) rueck = Math.max(rueck, direkt);
          else if (register.bloecke.block(lies(hinten).id).eigenschaften.leitet === true) {
            const dahinter = behaelter(plus(hinten, eingang));
            if (dahinter !== null) rueck = Math.max(rueck, dahinter);
          }
          const seite = Math.max(0, ...SEITEN_VON[front].map((s) => {
            const n = plus(pos, s);
            return istSeitenQuelle(lies(n).id) ? km.signalVon(n, pos) : 0;
          }));
          const gewollt = b.zustand.output_subtract_bit === true ? Math.max(rueck - seite, 0) : (seite <= rueck ? rueck : 0);
          if (gewollt === ziel) return null;
          ziel = gewollt;
          return { verzoegerung: 1, wert: gewollt };
        },
        schreiben(ktx, wert) {
          const b = lies(pos);
          komparatorStufe.set(k, wert);
          const an = wert > 0;
          w.setzeBlock(pos.x, pos.y, pos.z, an ? komparatorIds[1] : komparatorIds[0], { ...b.zustand, output_lit_bit: an });
          merke(ktx, 'komparator', pos, { stufe: wert });
        },
      };
    });

    t.registriere(knopfMechanik);
    t.registriere(staubMechanik);
    for (const m of [...fackelMechaniken, ...repeaterMechaniken, ...komparatorMechaniken]) t.registriere(m);

    const zustandsabdruck = () => {
      const teile = [];
      for (const b of w.alleBloecke()) if (b.id === staubId || b.id === fackelAn || b.id === fackelAus || istRepeater(b.id) || istKomparator(b.id) || knopf.test(b.id)) teile.push(`${b.x},${b.y},${b.z}:${b.id}:${JSON.stringify(b.zustand)}`);
      return teile.join('|') + '|' + [...komparatorStufe].join(',');
    };
    return {
      sandkasten: sk, taktgeber: t, welt: w, ereignisse,
      /** n Spielticks laufen lassen. */
      laufe(n) { t.laufe(n); return t.tick; },
      /** Läuft, bis sich `ruheTicks` Ticks lang nichts mehr ändert (oder maxTicks erreicht sind). */
      bisRuhe(maxTicks = 2000) {
        let letzter = zustandsabdruck(), still = 0;
        while (t.tick < maxTicks && still < ruhe) {
          t.schritt();
          const neu = zustandsabdruck();
          still = neu === letzter ? still + 1 : 0;
          letzter = neu;
        }
        return { ticks: t.tick, stabil: still >= ruhe };
      },
      /** Zustandsabdruck der Redstone-Bauteile (für Perioden-Erkennung). */
      abdruck: zustandsabdruck,
      komparatorStufe: (x, y, z) => komparatorStufe.get(key({ x, y, z })) ?? null,
      /** Stromkarte des aktuellen Ticks (für Auswertungen in Tests und Prüfer). */
      karte: () => karteWert,
    };
  }

  const enthaeltZeitbauteile = (welt) => welt.alleBloecke().some((b) => b.id === fackelAn || b.id === fackelAus || istRepeater(b.id) || istKomparator(b.id) || knopf.test(b.id));

  return { erzeuge, enthaeltZeitbauteile };
}

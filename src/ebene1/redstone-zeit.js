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
export function erzeugeRedstoneZeit({ regelwerk, register, richtungVon, redstone, trichter, licht }) {
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
  const lampeIds = P('mech.lampe', 'ids');
  const lampeAusTicks = P('mech.lampe', 'ausTicks');
  const tuerMuster = new RegExp(P('mech.tueren', 'muster'));
  const beobachterId = P('mech.beobachter', 'block');
  const beobachterImpuls = P('mech.beobachter', 'impulsTicks');
  const tagIds = P('mech.tagessensor', 'ids');
  const tagIntervall = P('mech.tagessensor', 'intervallTicks');
  const regenFaktor = P('mech.tagessensor', 'regenFaktor');
  const tagTicks = P('mech.tagessensor', 'ticksProTag');
  const istRepeater = (id) => repeaterIds.includes(id);
  const istKomparator = (id) => komparatorIds.includes(id);

  /** Front (Ausgang) und Rücken (Eingang) eines Repeaters/Komparators aus cardinal_direction. */
  function seiten(zustand) {
    const d = zustand['minecraft:cardinal_direction'];
    const eingang = eingangSeite ? d : GEGEN[d];
    return { eingang, front: GEGEN[eingang] };
  }

  /** Himmelsverdunkelung 0–11 aus Tageszeit und Wetter (Java-Formel, Bedrock nicht belegt). */
  const zeitwert = (dayTime) => {
    const d = ((((dayTime / tagTicks) - 0.25) % 1) + 1) % 1;
    const e = 0.5 - Math.cos(d * Math.PI) / 2;
    return (d * 2 + e) / 3; // 0 = Mittag, 0,5 = Mitternacht
  };
  function verdunkelung(dayTime, wetter) {
    const f = zeitwert(dayTime);
    let f1 = Math.min(1, Math.max(0, 1 - (Math.cos(f * 2 * Math.PI) * 2 + 0.2)));
    f1 = 1 - f1;
    if (wetter !== 'klar') f1 *= 1 - regenFaktor;
    if (wetter === 'gewitter') f1 *= 1 - regenFaktor;
    return Math.floor((1 - f1) * 11);
  }
  /** Signalstärke eines Tagessensors bei gegebenem rohem Himmelslicht (0–15). */
  function tagessensorStaerke({ dayTime, wetter, himmel, invertiert }) {
    let i = himmel - verdunkelung(dayTime, wetter);
    if (invertiert) i = 15 - i;
    else if (i > 0) {
      let winkel = zeitwert(dayTime) * 2 * Math.PI;
      const ziel = winkel < Math.PI ? 0 : 2 * Math.PI;
      winkel += (ziel - winkel) * 0.2;
      i = Math.round(i * Math.cos(winkel));
    }
    return Math.max(0, Math.min(15, i));
  }

  /**
   * Baut die Mechaniken für eine Welt (im Sandkasten) und gibt Steuerung zurück.
   * @param {import('../ebene0/welt.js').Welt} welt
   * @param {{loren?: {x:number,y:number,z:number}[], seed?: number, wetter?: 'klar'|'regen'|'gewitter', startzeit?: number}} [optionen]
   *   startzeit: Tageszeit in Ticks beim ersten Tick (0 = Sonnenaufgang, 6000 = Mittag, 18000 = Mitternacht)
   */
  function erzeuge(welt, { loren = [], seed = 1, wetter = 'klar', startzeit = 0 } = {}) {
    const sk = new Sandkasten(welt);
    const t = new Taktgeber(sk, { seed });
    const ereignisse = [];
    const merke = (ktx, was, pos, extra = {}) => ereignisse.push({ tick: ktx.tick, was, pos: { ...pos }, ...extra });
    const w = sk.welt;
    const lies = (p) => w.leseBlock(p.x, p.y, p.z);

    // Bauteile der Welt einsammeln
    const fackeln = [], repeater = [], komparatoren = [], knoepfe = [], lampen = [], tueren = [], beobachter = [], tagesSensoren = [];
    for (const b of w.alleBloecke()) {
      const pos = { x: b.x, y: b.y, z: b.z };
      if (b.id === fackelAn || b.id === fackelAus) fackeln.push(pos);
      else if (istRepeater(b.id)) repeater.push(pos);
      else if (istKomparator(b.id)) komparatoren.push(pos);
      else if (knopf.test(b.id)) knoepfe.push(pos);
      else if (lampeIds.includes(b.id)) lampen.push(pos);
      else if (tuerMuster.test(b.id)) tueren.push(pos);
      else if (b.id === beobachterId) beobachter.push(pos);
      else if (tagIds.includes(b.id)) tagesSensoren.push(pos);
    }
    // Gedächtnis (nicht in der Welt gespeichert)
    const komparatorStufe = new Map(komparatoren.map((p) => [key(p), lies(p).zustand.output_lit_bit ? 15 : 0]));

    const impuls = new Map(beobachter.map((p) => [key(p), lies(p).zustand.powered_bit === true]));
    const sensorStufe = new Map(tagesSensoren.map((p) => [key(p), lies(p).zustand.redstone_signal ?? 0]));

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
      for (const p of beobachter) {
        if (!impuls.get(key(p))) continue;
        const hinten = GEGEN[lies(p).zustand['minecraft:facing_direction']];
        if (hinten) fest.ausgaben.push({ von: p, zelle: plus(p, hinten), stufe: 15 });
      }
      for (const p of tagesSensoren) {
        const stufe = sensorStufe.get(key(p)) ?? 0;
        if (stufe > 0) for (const r of ['north', 'east', 'south', 'west', 'up', 'down']) fest.ausgaben.push({ von: p, zelle: plus(p, r), stufe, schwach: true });
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

    // ---- Lampen (nur im C-Tick): sofort an, nach lampeAusTicks Ticks ohne Strom aus ----
    const lampeAus = new Map();
    const lampenMechanik = {
      id: 'mech-lampen', tickart: 'mechanismus',
      schritt(ktx) {
        const km = karte(ktx);
        for (const p of lampen) {
          const b = lies(p), k = key(p);
          const an = b.id === lampeIds[1];
          if (km.bestromtAn(p.x, p.y, p.z)) {
            lampeAus.delete(k);
            if (!an) { w.setzeBlock(p.x, p.y, p.z, lampeIds[1]); merke(ktx, 'lampe-an', p); }
          } else if (an) {
            if (!lampeAus.has(k)) lampeAus.set(k, ktx.tick + lampeAusTicks);
            if (ktx.tick >= lampeAus.get(k)) { lampeAus.delete(k); w.setzeBlock(p.x, p.y, p.z, lampeIds[0]); merke(ktx, 'lampe-aus', p); }
          }
        }
      },
    };
    // ---- Türen, Falltüren, Zauntore (nur im C-Tick): offen, solange bestromt ----
    const tuerenMechanik = {
      id: 'mech-tueren', tickart: 'mechanismus',
      schritt(ktx) {
        const km = karte(ktx);
        for (const p of tueren) {
          const b = lies(p);
          if (!tuerMuster.test(b.id)) continue;
          if (b.zustand.upper_block_bit === true) continue; // obere Türhälfte folgt der unteren
          const zelle = b.zustand.upper_block_bit === false;
          const oben = plus(p, 'up');
          const bestromt = km.bestromtAn(p.x, p.y, p.z) || (zelle && km.bestromtAn(oben.x, oben.y, oben.z));
          if ((b.zustand.open_bit === true) === bestromt) continue;
          w.setzeBlock(p.x, p.y, p.z, b.id, { ...b.zustand, open_bit: bestromt });
          if (zelle) { const ob = lies(oben); if (tuerMuster.test(ob.id)) w.setzeBlock(oben.x, oben.y, oben.z, ob.id, { ...ob.zustand, open_bit: bestromt }); }
          merke(ktx, bestromt ? 'tuer-auf' : 'tuer-zu', p);
        }
      },
    };
    // ---- Beobachter (P-Tick lesen, C-Tick schreiben): Impuls von beobachterImpuls Ticks bei einer Änderung der Zelle davor ----
    const beobachterMechaniken = beobachter.map((pos) => {
      const k = key(pos);
      let letzte = null;
      const davor = () => plus(pos, lies(pos).zustand['minecraft:facing_direction']);
      const signatur = (p) => { const b = lies(p); return b.id + JSON.stringify(b.zustand); };
      return {
        id: `mech-beobachter:${k}`, tickart: 'uebertrager',
        lesen(ktx) {
          const jetzt = signatur(davor());
          const geaendert = letzte !== null && jetzt !== letzte;
          letzte = jetzt;
          if (impuls.get(k)) return { verzoegerung: beobachterImpuls / 2, wert: false };
          return geaendert ? { verzoegerung: 1, wert: true } : null;
        },
        schreiben(ktx, wert) {
          impuls.set(k, wert);
          const b = lies(pos);
          w.setzeBlock(pos.x, pos.y, pos.z, b.id, { ...b.zustand, powered_bit: wert });
          letzte = signatur(davor());
          if (wert) merke(ktx, 'beobachter-impuls', pos);
        },
      };
    });
    // ---- Tagessensoren: alle tagIntervall Ticks neu rechnen ----
    const sensorMechanik = {
      id: 'mech-tagessensor', tickart: 'spieltick',
      schritt(ktx) {
        if (ktx.tick !== 1 && ktx.tick % tagIntervall !== 0) return;
        for (const p of tagesSensoren) {
          const b = lies(p);
          // Der Sensor liest das Himmelslicht der Zelle über sich (er selbst ist ein flacher Block mit unbekanntem Lichtfilter)
          const lk = licht.lichtkarte(w, { von: p, bis: { x: p.x, y: p.y + 1, z: p.z } }, { himmel: 'tag' }).himmelRoh(p.x, p.y + 1, p.z);
          if (lk.min !== lk.max) merke(ktx, 'tagessensor-unklar', p, { himmel: lk });
          const stufe = tagessensorStaerke({ dayTime: startzeit + ktx.tick, wetter, himmel: lk.min, invertiert: b.id === tagIds[1] });
          sensorStufe.set(key(p), stufe);
          if (b.zustand.redstone_signal !== stufe) { w.setzeBlock(p.x, p.y, p.z, b.id, { ...b.zustand, redstone_signal: stufe }); merke(ktx, 'tagessensor', p, { stufe }); }
        }
      },
    };

    t.registriere(knopfMechanik);
    t.registriere(sensorMechanik);
    t.registriere(staubMechanik);
    for (const m of [...fackelMechaniken, ...repeaterMechaniken, ...komparatorMechaniken, ...beobachterMechaniken]) t.registriere(m);
    t.registriere(lampenMechanik);
    t.registriere(tuerenMechanik);

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

  const enthaeltZeitbauteile = (welt) => welt.alleBloecke().some((b) => b.id === fackelAn || b.id === fackelAus || istRepeater(b.id) || istKomparator(b.id) || knopf.test(b.id) || lampeIds.includes(b.id) || tuerMuster.test(b.id) || b.id === beobachterId || tagIds.includes(b.id));

  return { erzeuge, enthaeltZeitbauteile, tagessensorStaerke, verdunkelung };
}

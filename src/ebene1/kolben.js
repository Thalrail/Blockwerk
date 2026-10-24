// Ebene 1 – Mechanik „Kolben“ (Schieben, Ziehen, Grenzen)
// Regeln: data/regeln/kolben.json (Quelle und Status je Regel; vieles ist im Wiki nicht als Bedrock gekennzeichnet → Java-Platzhalter, `ungeprüft`).
// Modell: Ein Kolben schiebt die Kette der Blöcke vor seinem Kopf um eine Zelle weiter (höchstens 12 Blöcke). Unbewegliche Blöcke (Ebene-0-Eigenschaft
// `schiebung`), Behälter und mehr als 12 Blöcke verhindern das Ausfahren; ein zerstörbarer Block am Ende der Kette (Fackel, Pflanze, Staub …) wird
// entfernt, Luft und Flüssigkeit machen Platz. Ausgefahren steht in der Kopfzelle ein Armblock (`piston_arm_collision`). Der klebrige Kolben zieht beim
// Einfahren den Block vor dem Kopf in die Kopfzelle. Zeitverhalten (Start 2 Ticks, Dauer 2 Ticks, nur im C-Tick) liegt in `redstone-zeit.js`.
// Die Welt wird nur über Ebene 0 gelesen und geschrieben.
import { VEKTOR, HOEHE_MAX, HOEHE_MIN } from '../ebene0/richtungen.js';

const plus = (p, r) => ({ x: p.x + VEKTOR[r].x, y: p.y + VEKTOR[r].y, z: p.z + VEKTOR[r].z });
const FREI = /^minecraft:(air|water|flowing_water|lava|flowing_lava|fire|soul_fire)$/;

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, register: object, richtungVon: (zustandName:string, wert:any) => string|null}} quellen
 */
export function erzeugeKolben({ regelwerk, register, richtungVon }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  const limit = P('kolben.limit', 'bloecke');
  const kolbenIds = P('kolben.start', 'kolbenIds');
  const armIds = P('kolben.start', 'armIds');
  const klebrig = P('kolben.klebrig', 'block');
  const klebrigBloecke = P('kolben.klebrig', 'anzahl');
  const schiebung = (id) => register.bloecke.block(id).eigenschaften.schiebung;
  const istKolbenId = (id) => kolbenIds.includes(id);

  const richtungVonBlock = (b) => richtungVon('facing_direction', b.zustand.facing_direction);

  /** Ist der Kolben bei `pos` ausgefahren (in der Kopfzelle steht sein Armblock)? */
  function istAusgefahren(welt, pos) {
    const b = welt.leseBlock(pos.x, pos.y, pos.z);
    if (!istKolbenId(b.id)) return false;
    const r = richtungVonBlock(b);
    if (!r) return false;
    const kopf = plus(pos, r);
    const h = welt.leseBlock(kopf.x, kopf.y, kopf.z);
    return armIds.includes(h.id) && h.zustand.facing_direction === b.zustand.facing_direction;
  }

  /**
   * Was passiert, wenn der Kolben bei `pos` ausfährt? Sammelt die Kette ab der Kopfzelle.
   * @returns {{ok:boolean, richtung:string|null, bloecke:{pos:object,id:string,zustand:object}[], zerstoert:{pos:object,id:string}|null, grund:string|null, ort?:object}}
   */
  function schiebeplan(welt, pos) {
    const kolben = welt.leseBlock(pos.x, pos.y, pos.z);
    const r = richtungVonBlock(kolben);
    if (!istKolbenId(kolben.id) || !r) return { ok: false, richtung: null, bloecke: [], zerstoert: null, grund: 'kein Kolben oder ohne gültige Richtung' };
    const bloecke = [];
    let c = plus(pos, r);
    for (;;) {
      if (c.y < HOEHE_MIN || c.y > HOEHE_MAX) return { ok: false, richtung: r, bloecke, zerstoert: null, grund: 'die Weltgrenze (Höhe) ist im Weg', ort: c };
      const b = welt.leseBlock(c.x, c.y, c.z);
      if (FREI.test(b.id)) return { ok: true, richtung: r, bloecke, zerstoert: null, grund: null };
      if (armIds.includes(b.id)) return { ok: false, richtung: r, bloecke, zerstoert: null, grund: `${b.id} (Kolbenkopf) ist unbeweglich`, ort: c };
      if (istKolbenId(b.id) && istAusgefahren(welt, c)) return { ok: false, richtung: r, bloecke, zerstoert: null, grund: `${b.id} (ausgefahren) ist unbeweglich`, ort: c };
      const s = schiebung(b.id);
      if (s === 'zerstoert') return { ok: true, richtung: r, bloecke, zerstoert: { pos: c, id: b.id }, grund: null };
      if (s === 'unbeweglich') return { ok: false, richtung: r, bloecke, zerstoert: null, grund: `${b.id} ist unbeweglich`, ort: c };
      if (s !== 'beweglich') return { ok: false, richtung: r, bloecke, zerstoert: null, grund: `${b.id}: ob Kolben ihn schieben können, ist nicht belegt (unklar)`, ort: c };
      bloecke.push({ pos: c, id: b.id, zustand: b.zustand });
      if (bloecke.length > limit) return { ok: false, richtung: r, bloecke, zerstoert: null, grund: `mehr als ${limit} Blöcke`, ort: c };
      c = plus(c, r);
    }
  }

  /** Führt das Ausfahren aus: zerstörten Block entfernen, Kette um eins schieben, Armblock in die Kopfzelle. */
  function fahreAus(welt, pos, plan) {
    const kolben = welt.leseBlock(pos.x, pos.y, pos.z);
    const r = plan.richtung;
    if (plan.zerstoert) welt.setzeBlock(plan.zerstoert.pos.x, plan.zerstoert.pos.y, plan.zerstoert.pos.z, 'minecraft:air');
    for (let i = plan.bloecke.length - 1; i >= 0; i--) {
      const b = plan.bloecke[i];
      const ziel = plus(b.pos, r);
      welt.setzeBlock(ziel.x, ziel.y, ziel.z, b.id, b.zustand);
    }
    const kopf = plus(pos, r);
    welt.setzeBlock(kopf.x, kopf.y, kopf.z, kolben.id === klebrig ? armIds[1] : armIds[0], { facing_direction: kolben.zustand.facing_direction });
  }

  /** Führt das Einfahren aus; der klebrige Kolben zieht den Block vor dem Kopf nach. Gibt zurück, was gezogen wurde (oder null). */
  function fahreEin(welt, pos) {
    const kolben = welt.leseBlock(pos.x, pos.y, pos.z);
    const r = richtungVonBlock(kolben);
    const kopf = plus(pos, r);
    welt.setzeBlock(kopf.x, kopf.y, kopf.z, 'minecraft:air');
    if (kolben.id !== klebrig || klebrigBloecke < 1) return null;
    const davor = plus(kopf, r);
    if (davor.y < HOEHE_MIN || davor.y > HOEHE_MAX) return null;
    const b = welt.leseBlock(davor.x, davor.y, davor.z);
    if (FREI.test(b.id) || schiebung(b.id) !== 'beweglich' || armIds.includes(b.id) || (istKolbenId(b.id) && istAusgefahren(welt, davor))) return null;
    welt.setzeBlock(kopf.x, kopf.y, kopf.z, b.id, b.zustand);
    welt.setzeBlock(davor.x, davor.y, davor.z, 'minecraft:air');
    return { id: b.id, von: davor, nach: kopf };
  }

  const enthaeltKolben = (welt) => welt.alleBloecke().some((b) => istKolbenId(b.id));

  return { schiebeplan, fahreAus, fahreEin, istAusgefahren, enthaeltKolben, istKolbenId, armIds, kolbenIds, limit, richtungVonBlock };
}

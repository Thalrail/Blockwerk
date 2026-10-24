// Ebene 0 – Vermesser: Verschieben, Drehen, Spiegeln
// Arbeitet auf Bauteilen ({bloecke:[{x,y,z,id,zustand,inhalt?}], wesen:[{id,x,y,z,yaw,baby,name?}]}).
// Drehpunkt/Spiegelebene ist der Nullpunkt (Block 0,0,0 bleibt bei Drehen auf sich selbst). Alle Richtungswerte
// (facing, Treppen, Schienen, Türscharniere …) werden nach der Regeltabelle data/drehregeln.json automatisch mitgedreht.
// Drehen = im Uhrzeigersinn von oben: Ost → Süd → West → Nord. Spiegeln 'x': Ost↔West, 'z': Nord↔Süd.
import { HORIZONTAL, dreheRichtung, modulo, normalisiereYaw, spiegleRichtung } from './richtungen.js';

const bloeckeSortiert = (liste) => liste.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
const nullFrei = (n) => (n === 0 ? 0 : n); // -0 → 0 (sonst sind Vergleiche und JSON uneinheitlich)
const gleicheArt = (original, schluessel) => (typeof original === 'number' ? Number(schluessel) : schluessel);

function permutationen(liste) {
  if (liste.length <= 1) return [liste];
  return liste.flatMap((t, i) => permutationen([...liste.slice(0, i), ...liste.slice(i + 1)]).map((r) => [t, ...r]));
}

/**
 * @param {{regeln: object, register: import('./blockregister.js').Blockregister}} quellen
 */
export function erzeugeVermesser({ regeln, register }) {
  // Tippfehler in den Regeln früh finden
  for (const name of Object.keys(regeln.zustaende)) register.zustandsart(name);
  for (const f of regeln.familien) for (const n of Object.values(f.seiten)) register.zustandsart(n);
  for (const name of Object.keys(regeln.unbehandelt)) register.zustandsart(name);
  // Ausnahmen je Block: dieselbe Zustandsart kann bei einem Block etwas anderes bedeuten (z. B. direction beim Bett) und hat dann eine eigene Regel
  const ausnahmen = regeln.ausnahmen ?? {};
  for (const [id, zustaende] of Object.entries(ausnahmen)) {
    const definiert = register.block(id).zustaende;
    for (const name of Object.keys(zustaende)) if (!Object.hasOwn(definiert, name)) throw new Error(`Ausnahmeregel: ${id} hat keinen Zustand ${name}`);
  }
  /** Regel für einen Zustand; eine Ausnahme für den Block hat Vorrang vor der allgemeinen Regel. */
  const regelFuer = (name, blockId) => (blockId && ausnahmen[blockId]?.[name]) || regeln.zustaende[name];

  const richtungOp = (op, label) => (op.typ === 'drehen' ? dreheRichtung(label, 1) : spiegleRichtung(label, op.achse));

  /** Einzelner Zustandswert nach einem Schritt (Drehung um 90° oder Spiegelung). */
  function wert(name, w, op, regel) {
    switch (regel.art) {
      case 'richtung': {
        const label = regel.abbildung[String(w)];
        if (label === null || label === undefined) return w;
        const neu = richtungOp(op, label);
        const schluessel = Object.keys(regel.abbildung).find((k) => regel.abbildung[k] === neu);
        if (schluessel === undefined) throw new Error(`${name}: keine Entsprechung für ${neu}`);
        return gleicheArt(w, schluessel);
      }
      case 'achse': {
        if (op.typ !== 'drehen') return w;
        const label = regel.abbildung[String(w)];
        if (label !== 'x' && label !== 'z') return w;
        const neu = label === 'x' ? 'z' : 'x';
        return gleicheArt(w, Object.keys(regel.abbildung).find((k) => regel.abbildung[k] === neu));
      }
      case 'ecke':
        return op.typ === 'spiegeln' && regel.tausch[w] ? regel.tausch[w] : w;
      case 'umschalten-beim-spiegeln':
        return op.typ === 'spiegeln' ? !w : w;
      case 'sechzehntel':
        if (op.typ === 'drehen') return modulo(w + 4, 16);
        return op.achse === 'x' ? modulo(16 - w, 16) : modulo(8 - w, 16);
      case 'woerter': {
        const tokens = String(w).split('_').map((t) => (HORIZONTAL.includes(t) ? richtungOp(op, t) : t));
        const erlaubt = register.zustandsart(name).werte;
        const treffer = permutationen(tokens).map((p) => p.join('_')).find((s) => erlaubt.includes(s));
        if (!treffer) throw new Error(`${name}: ${w} lässt sich nicht transformieren`);
        return treffer;
      }
      case 'bitmaske': {
        let neu = 0;
        for (const [label, bit] of Object.entries(regel.bits)) {
          if (w & bit) neu |= regel.bits[richtungOp(op, label)] ?? 0;
        }
        return neu;
      }
      case 'tabelle': {
        const tab = op.typ === 'drehen' ? regel.drehen : regel.spiegeln[op.achse];
        const neu = tab[String(w)];
        if (neu === undefined) throw new Error(`${name}: Wert ${w} fehlt in der Tabelle`);
        return neu;
      }
      default:
        throw new Error(`Unbekannte Regelart ${regel.art} bei ${name}`);
    }
  }

  /** Zustand einmal drehen/spiegeln. */
  function zustandSchritt(zustand, op, blockId) {
    const neu = {};
    const verarbeitet = new Set();
    for (const f of regeln.familien) {
      for (const [seite, name] of Object.entries(f.seiten)) {
        verarbeitet.add(name);
        if (Object.hasOwn(zustand, name)) neu[f.seiten[richtungOp(op, seite)]] = zustand[name];
      }
    }
    for (const [name, w] of Object.entries(zustand)) {
      if (verarbeitet.has(name)) continue;
      const regel = regelFuer(name, blockId);
      neu[name] = regel ? wert(name, w, op, regel) : w;
    }
    return Object.fromEntries(Object.entries(neu).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }

  function transformiereZustand(zustand, op, anzahl = 1, blockId = null) {
    let z = zustand;
    for (let i = 0; i < anzahl; i++) z = zustandSchritt(z, op, blockId);
    return z;
  }

  /**
   * Fehlt einem Block ein Zustand, der beim Drehen/Spiegeln seine Richtung ändern würde, wäre das Ergebnis still falsch
   * (unbekannt, in welche Richtung der Block zeigt). Darum: lieber ein klarer Fehler.
   */
  function pruefeVollstaendig(b, op) {
    const definiert = register.block(b.id).zustaende;
    for (const name of Object.keys(definiert)) {
      const regel = regelFuer(name, b.id);
      if (!regel || Object.hasOwn(b.zustand, name)) continue;
      const wirkungslos = (op.typ === 'drehen' && (regel.art === 'ecke' || regel.art === 'umschalten-beim-spiegeln'))
        || (op.typ === 'spiegeln' && regel.art === 'achse');
      if (!wirkungslos) {
        throw new Error(`${b.id} bei ${b.x}, ${b.y}, ${b.z}: Zustand "${name}" fehlt – ohne ihn lässt sich der Block nicht richtig ${op.typ === 'drehen' ? 'drehen' : 'spiegeln'}`);
      }
    }
  }

  const pruefeVersatz = (d) => {
    if (![d?.x, d?.y, d?.z].every(Number.isInteger)) throw new Error('Versatz muss ganze Zahlen x, y, z enthalten');
  };

  function verschiebe(bauteil, d) {
    pruefeVersatz(d);
    return {
      bloecke: bloeckeSortiert(bauteil.bloecke.map((b) => ({ ...b, x: b.x + d.x, y: b.y + d.y, z: b.z + d.z }))),
      wesen: bauteil.wesen.map((w) => ({ ...w, x: w.x + d.x, y: w.y + d.y, z: w.z + d.z })),
    };
  }

  function drehe(bauteil, viertel = 1) {
    if (!Number.isInteger(viertel)) throw new Error('viertel muss eine ganze Zahl sein');
    const k = modulo(viertel, 4);
    const op = { typ: 'drehen' };
    const bloecke = bauteil.bloecke.map((b) => {
      if (k > 0) pruefeVollstaendig(b, op);
      let { x, z } = b;
      for (let i = 0; i < k; i++) [x, z] = [-z, x];
      return { ...b, x: nullFrei(x), z: nullFrei(z), zustand: transformiereZustand(b.zustand, op, k, b.id) };
    });
    const wesen = bauteil.wesen.map((w) => {
      let { x, z } = w;
      for (let i = 0; i < k; i++) [x, z] = [1 - z, x];
      return { ...w, x: nullFrei(x), z: nullFrei(z), yaw: normalisiereYaw(w.yaw + 90 * k) };
    });
    return { bloecke: bloeckeSortiert(bloecke), wesen };
  }

  function spiegle(bauteil, achse) {
    if (achse !== 'x' && achse !== 'z') throw new Error(`Unbekannte Spiegelachse: ${String(achse)}`);
    const op = { typ: 'spiegeln', achse };
    const bloecke = bauteil.bloecke.map((b) => (pruefeVollstaendig(b, op), {
      ...b,
      ...(achse === 'x' ? { x: nullFrei(-b.x) } : { z: nullFrei(-b.z) }),
      zustand: transformiereZustand(b.zustand, op, 1, b.id),
    }));
    const wesen = bauteil.wesen.map((w) => ({
      ...w,
      ...(achse === 'x' ? { x: nullFrei(1 - w.x) } : { z: nullFrei(1 - w.z) }),
      yaw: normalisiereYaw(achse === 'x' ? -w.yaw : 180 - w.yaw),
    }));
    return { bloecke: bloeckeSortiert(bloecke), wesen };
  }

  /**
   * Himmelsrichtung, für die ein Zahlen-/Textwert eines Richtungszustands steht (z. B. weirdo_direction 0 → 'east'),
   * oder null, wenn der Zustand keine Richtung beschreibt oder der Wert keine hat.
   */
  function richtungVon(zustandName, wert, blockId = null) {
    const regel = regelFuer(zustandName, blockId);
    if (regel?.art !== 'richtung') return null;
    return regel.abbildung[String(wert)] ?? null;
  }

  return { verschiebe, drehe, spiegle, transformiereZustand, richtungVon };
}

/**
 * Zustände im Register, die nach Richtung/Achse/Drehung aussehen, aber weder eine Regel noch einen
 * ausdrücklichen Vermerk haben. Soll leer sein (wird getestet) – so geht beim Bedrock-Update nichts unbemerkt verloren.
 */
export function ungedeckteRichtungszustaende(register, regeln) {
  const bekannt = new Set([
    ...Object.keys(regeln.zustaende),
    ...Object.keys(regeln.unbehandelt),
    ...regeln.familien.flatMap((f) => Object.values(f.seiten)),
  ]);
  const verdaechtig = /(direction|axis|rotation|orientation|corner|hinge|connection|_side_|vine_|facing|_bits$)/;
  const ausgenommen = new Set(['minecraft:multi_block_part', 'wall_post_bit', 'upside_down_bit']);
  const genutzt = new Set(register.ids().flatMap((id) => Object.keys(register.block(id).zustaende)));
  return [...genutzt].filter((n) => verdaechtig.test(n) && !bekannt.has(n) && !ausgenommen.has(n)).sort();
}

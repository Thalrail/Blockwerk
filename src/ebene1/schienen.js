// Ebene 1 – Mechanik „Schienen: Form und Verbindung“
// Eine Schiene stellt sich im Spiel beim Platzieren selbst ein (Form aus den Nachbarn). Dieses Modul bildet das nach,
// damit der Plan weiß, welche Form entsteht, wenn man die Schienen in einer bestimmten Reihenfolge legt.
// Alles stützt sich auf die Regeln in data/regeln/schiene.json (Quelle und Status je Regel); Annahmen sind dort als
// `ungeprüft` mit Testanleitung markiert. Die Welt wird nur über Ebene 0 gelesen und geschrieben.
//
// Begriffe: Jede Schiene hat zwei Enden { richtung, dy }. dy = +1 bedeutet: das Ende liegt einen Block höher (hohes Ende
// einer Steigung). Zwei Schienen sind verbunden, wenn ihre Enden aufeinander zeigen:
//   Ende (d, 0)  ↔  Nachbar auf gleicher Höhe mit Ende (gegen d, 0)   oder   Nachbar eine Ebene tiefer mit Ende (gegen d, +1)
//   Ende (d, +1) ↔  Nachbar eine Ebene höher mit Ende (gegen d, 0)
import { GEGENRICHTUNG, VEKTOR } from '../ebene0/richtungen.js';

const gegen = (r) => GEGENRICHTUNG[r];
const plus = (p, richtung, dy = 0) => ({ x: p.x + VEKTOR[richtung].x, y: p.y + dy, z: p.z + VEKTOR[richtung].z });
const gleichesEnde = (a, b) => a.richtung === b.richtung && a.dy === b.dy;
const schluessel = (e) => `${e.richtung}:${e.dy}`;

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, register: {bloecke: import('../ebene0/blockregister.js').Blockregister}}} quellen
 */
export function erzeugeSchienen({ regelwerk, register }) {
  const tabelle = regelwerk.parameter('schiene.zustandswerte', 'enden');
  const bevorzugung = regelwerk.parameter('schiene.bevorzugung', 'bevorzugung');
  const belegtGerade = new Set(regelwerk.parameter('schiene.antriebsschiene-gerade', 'nurGerade'));
  const nurGerade = new Set([...belegtGerade, ...regelwerk.parameter('schiene.detektor-aktivierung-gerade', 'nurGerade')]);

  const endenJeWert = new Map(Object.entries(tabelle).map(([wert, paar]) => [Number(wert), paar.map(([richtung, dy]) => ({ richtung, dy }))]));
  const wertJeEnden = new Map([...endenJeWert].map(([wert, paar]) => [paar.map(schluessel).sort().join('|'), wert]));

  const schienenIds = new Set(register.bloecke.ids().filter((id) => Object.hasOwn(register.bloecke.block(id).zustaende, 'rail_direction')));
  const istSchienenId = (id) => schienenIds.has(id);

  /** Die zwei Enden einer Schiene; null, wenn rail_direction fehlt. */
  function enden(zustand) {
    const w = zustand?.rail_direction;
    return w === undefined ? null : endenJeWert.get(w) ?? null;
  }

  /** rail_direction für ein Paar Enden; null, wenn es keine solche Form gibt (oder nurGerade verletzt wird). */
  function formAus(paar, { gerade = false } = {}) {
    const wert = wertJeEnden.get(paar.map(schluessel).sort().join('|'));
    if (wert === undefined) return null;
    if (gerade && wert > 5) return null;
    return wert;
  }

  function schieneBei(welt, p) {
    const b = welt.leseBlock(p.x, p.y, p.z);
    return istSchienenId(b.id) ? { pos: { x: p.x, y: p.y, z: p.z }, id: b.id, zustand: b.zustand } : null;
  }

  const hatEnde = (schiene, ende) => (enden(schiene.zustand) ?? []).some((e) => gleichesEnde(e, ende));

  /** Gegenstellen für ein Ende: wo müsste eine Schiene liegen und welches Ende müsste sie haben? */
  function kandidaten(pos, ende) {
    const d = ende.richtung;
    if (ende.dy === 1) return [{ pos: plus(pos, d, 1), verlangt: { richtung: gegen(d), dy: 0 } }];
    return [
      { pos: plus(pos, d, 0), verlangt: { richtung: gegen(d), dy: 0 } },
      { pos: plus(pos, d, -1), verlangt: { richtung: gegen(d), dy: 1 } },
    ];
  }

  /**
   * Was liegt am Ende einer Schiene?
   * @returns {{art: 'verbunden'|'einseitig'|'leer', partner?: object}}
   */
  function gegenstelle(welt, pos, ende) {
    let einseitig = null;
    for (const k of kandidaten(pos, ende)) {
      const s = schieneBei(welt, k.pos);
      if (!s) continue;
      if (hatEnde(s, k.verlangt)) return { art: 'verbunden', partner: s };
      einseitig ??= s;
    }
    return einseitig ? { art: 'einseitig', partner: einseitig } : { art: 'leer' };
  }

  /** Enden einer Schiene, die gegenseitig mit einer anderen Schiene (außer `ausser`) verbunden sind. */
  function besetzteEnden(welt, schiene, ausser = null) {
    return (enden(schiene.zustand) ?? []).filter((e) => {
      const g = gegenstelle(welt, schiene.pos, e);
      if (g.art !== 'verbunden') return false;
      return !(ausser && g.partner.pos.x === ausser.x && g.partner.pos.y === ausser.y && g.partner.pos.z === ausser.z);
    });
  }

  /**
   * Kann sich `partner` auf `verlangt` einstellen (ein Ende zur neuen Schiene)? Liefert seine neuen Enden oder null.
   * Ist schon ein Ende passend, ändert sich nichts. Sonst bleiben seine bereits verbundenen Enden erhalten.
   */
  function neueEnden(welt, partner, verlangt, neuePos) {
    const aktuell = enden(partner.zustand);
    if (aktuell && aktuell.some((e) => gleichesEnde(e, verlangt))) return aktuell;
    const behalten = besetzteEnden(welt, partner, neuePos);
    if (behalten.length >= 2) return null;
    const gerade = nurGerade.has(partner.id);
    let ziel;
    if (behalten.length === 1) ziel = [verlangt, behalten[0]];
    else ziel = [verlangt, { richtung: gegen(verlangt.richtung), dy: 0 }];
    return formAus(ziel, { gerade }) === null ? null : ziel;
  }

  /**
   * Platziert eine Schiene so, wie das Spiel sie einstellt, und stellt Nachbarschienen mit freiem Ende darauf ein.
   * @returns {{geaendert: {pos:{x:number,y:number,z:number}, id:string, rail_direction:number, vorher:number|null}[], verbundenMit: {x:number,y:number,z:number}[]}}
   *   geaendert: die gesetzte und alle umgestellten Schienen; verbundenMit: Positionen der Schienen, mit denen die neue verbunden ist
   */
  function platziere(welt, pos, id) {
    if (!istSchienenId(id)) throw new Error(`${id} ist keine Schiene`);
    const gerade = nurGerade.has(id);
    // Mögliche Verbindungen je Himmelsrichtung (gleich, hoch, tief), in der Reihenfolge der Bevorzugung
    const optionen = [];
    for (const d of bevorzugung) {
      for (const art of ['gleich', 'hoch', 'tief']) {
        const dy = art === 'hoch' ? 1 : art === 'tief' ? -1 : 0;
        const partner = schieneBei(welt, plus(pos, d, dy));
        if (!partner) continue;
        const verlangt = { richtung: gegen(d), dy: art === 'tief' ? 1 : 0 };
        const neu = neueEnden(welt, partner, verlangt, pos);
        if (!neu) continue;
        optionen.push({ richtung: d, art, partner, neu, ende: { richtung: d, dy: art === 'hoch' ? 1 : 0 } });
        break; // je Richtung höchstens eine Verbindung
      }
    }
    const darstellbar = (paar) => formAus(paar.map((o) => o.ende), { gerade }) !== null;
    let gewaehlt = [];
    if (optionen.length >= 2) {
      const paare = [];
      for (let i = 0; i < optionen.length; i++) for (let j = i + 1; j < optionen.length; j++) paare.push([optionen[i], optionen[j]]);
      const gegenueber = paare.filter(([a, b]) => a.ende.richtung === gegen(b.ende.richtung));
      const eckig = paare.filter((p) => !gegenueber.includes(p));
      // Zwei Möglichkeiten: gegenüberliegend → gerade, sonst Kurve. Ab drei (T-Stelle, Kreuzung) beschreibt Bedrock nur „wird zur Kurve“:
      // dann zuerst das erste darstellbare Eck-Paar in der Reihenfolge der Bevorzugung, erst danach ein gerades Paar.
      const reihenfolge = optionen.length >= 3 ? [...eckig, ...gegenueber] : paare;
      gewaehlt = reihenfolge.find(darstellbar) ?? [];
    }
    if (!gewaehlt.length && optionen.length) gewaehlt = [optionen[0]];

    let paar;
    if (gewaehlt.length === 2) paar = gewaehlt.map((o) => o.ende);
    else if (gewaehlt.length === 1) paar = [gewaehlt[0].ende, { richtung: gegen(gewaehlt[0].ende.richtung), dy: 0 }];
    else paar = endenJeWert.get(0);
    const wert = formAus(paar, { gerade });
    if (wert === null) throw new Error('Interner Fehler: keine Schienenform für ' + JSON.stringify(paar));

    const aenderungen = [];
    const hatRailDataBit = Object.hasOwn(register.bloecke.block(id).zustaende, 'rail_data_bit');
    const vorherBlock = welt.leseBlock(pos.x, pos.y, pos.z);
    welt.setzeBlock(pos.x, pos.y, pos.z, id, { rail_direction: wert, ...(hatRailDataBit ? { rail_data_bit: false } : {}) });
    aenderungen.push({ pos: { ...pos }, id, rail_direction: wert, vorher: istSchienenId(vorherBlock.id) ? vorherBlock.zustand.rail_direction ?? null : null });

    for (const o of gewaehlt) {
      const alt = o.partner.zustand.rail_direction;
      const neuerWert = formAus(o.neu, { gerade: nurGerade.has(o.partner.id) });
      if (neuerWert !== alt) {
        welt.setzeBlock(o.partner.pos.x, o.partner.pos.y, o.partner.pos.z, o.partner.id, { ...o.partner.zustand, rail_direction: neuerWert });
        aenderungen.push({ pos: o.partner.pos, id: o.partner.id, rail_direction: neuerWert, vorher: alt ?? null });
      }
    }
    return { geaendert: aenderungen, verbundenMit: gewaehlt.map((o) => ({ ...o.partner.pos })) };
  }

  return { enden, formAus, istSchienenId, schieneBei, gegenstelle, platziere, nurGerade, belegtGerade };
}

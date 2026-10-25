// Ebene 3 – Grobdesigner: legt je Abschnitt den Zonenplan fest (Funktionszonen als Streifen entlang x). Bestimmt WO etwas hinkommt, nicht WIE.
// Fester Algorithmus: gleiche Eingabe = gleiches Ergebnis. Schreibt nur Zonen und nur über `fachleute.aendere`.
// Regeln als Daten: data/regeln/planung.json (plan.zonenplan).
import { stelleFrage } from './bauleiter.js';

const FACHMANN = 'grobdesigner';

/** Fehler des Zonenplans: die Eingabe ist unbrauchbar (kein Raten). */
export class ZonenFehler extends Error {
  constructor(nachricht) { super(`Zonenplan: ${nachricht}`); this.name = 'ZonenFehler'; }
}

/**
 * @param {{regelwerk: object, fachleute: object, techniker: object}} quellen
 */
export function erzeugeGrobdesigner({ regelwerk, fachleute, techniker }) {
  const funktionen = regelwerk.parameter('plan.zonenplan', 'funktionen');
  const aendere = (e, a) => fachleute.aendere(e, FACHMANN, a).entwurf;
  const abschnittVon = (e, id) => {
    const a = e.abschnitte.find((x) => x.id === id);
    if (!a) throw new ZonenFehler(`Abschnitt ${String(id)} gibt es nicht`);
    if (!a.huelle) throw new ZonenFehler(`Abschnitt ${id} hat keine Hülle (erst gliedern)`);
    return a;
  };
  const zonenId = (abschnitt, funktion) => `Z-${abschnitt}-${funktion}`;

  function pruefeAnteile(anteile) {
    if (!Array.isArray(anteile) || !anteile.length) throw new ZonenFehler('die Anteile brauchen mindestens eine Funktion');
    const gesehen = new Set();
    for (const a of anteile) {
      if (!funktionen.includes(a?.funktion)) throw new ZonenFehler(`Funktion „${String(a?.funktion)}“ unbekannt (${funktionen.join(', ')})`);
      if (gesehen.has(a.funktion)) throw new ZonenFehler(`Funktion ${a.funktion} kommt doppelt vor`);
      gesehen.add(a.funktion);
      if (!Number.isInteger(a.anteil) || a.anteil < 1) throw new ZonenFehler(`Anteil von ${a.funktion} braucht eine ganze Zahl ab 1`);
    }
    if (anteile.reduce((s, a) => s + a.anteil, 0) !== 100) throw new ZonenFehler('die Anteile ergeben zusammen nicht 100');
  }

  /** Teilt `breite` Blöcke nach Anteilen (ganze Blöcke, Rest an den letzten). */
  const teile = (breite, liste) => {
    const summe = liste.reduce((s, a) => s + a.anteil, 0);
    const w = liste.map((a) => Math.floor((breite * a.anteil) / summe));
    w[w.length - 1] += breite - w.reduce((s, x) => s + x, 0);
    return w;
  };

  /** Der Plan als Daten: {zonen} oder {grund}. */
  function plane(entwurf, id, anteile) {
    pruefeAnteile(anteile);
    const a = abschnittVon(entwurf, id);
    if (entwurf.teile.some((t) => t.abschnitt === id && t.bedarf)) throw new ZonenFehler(`Im Abschnitt ${id} stehen schon Module; ein neuer Zonenplan wäre ein Rückgriff`);
    const h = a.huelle;
    const [W, D, H] = [h.bis.x - h.von.x + 1, h.bis.z - h.von.z + 1, h.bis.y - h.von.y + 1];
    const mind = techniker.plane(entwurf, id).mindest;
    let breiten = teile(W, anteile);
    const tech = anteile.findIndex((x) => x.funktion === 'technik');
    if (mind) {
      if (tech < 0) return { grund: `Der Abschnitt ${id} hat Bedarf, aber der Zonenplan sieht keine Technikzone vor` };
      if (mind.tiefe > D || mind.hoehe > H) return { grund: `Die Hülle des Abschnitts ${id} (${W} × ${D} × ${H}) ist für die Technik zu klein, nötig sind ${mind.breite} × ${mind.tiefe} × ${mind.hoehe} (Breite × Tiefe × Höhe)` };
      if (mind.breite > breiten[tech]) {
        const rest = anteile.filter((_, i) => i !== tech);
        const uebrig = W - mind.breite;
        if (rest.length && uebrig < rest.length) return { grund: `Neben der Technikzone (mindestens ${mind.breite} Blöcke breit) bleibt in der Hülle des Abschnitts ${id} (${W} Blöcke breit) kein Platz für die anderen Zonen` };
        if (!rest.length && uebrig < 0) return { grund: `Die Hülle des Abschnitts ${id} (${W} Blöcke breit) ist für die Technikzone zu schmal, nötig sind ${mind.breite}` };
        const andere = rest.length ? teile(uebrig, rest) : [];
        let k = 0;
        breiten = anteile.map((_, i) => (i === tech ? (rest.length ? mind.breite : W) : andere[k++]));
      }
    }
    if (breiten.some((b) => b < 1)) return { grund: `Die Hülle des Abschnitts ${id} ist nur ${W} Blöcke breit, das reicht nicht für ${anteile.length} Zonen` };
    let x = h.von.x;
    const zonen = anteile.map((an, i) => {
      const z = { id: zonenId(id, an.funktion), abschnitt: id, funktion: an.funktion, anteil: an.anteil, von: { x, y: h.von.y, z: h.von.z }, bis: { x: x + breiten[i] - 1, y: h.bis.y, z: h.bis.z } };
      x += breiten[i];
      return z;
    });
    return { zonen };
  }

  /** Die Änderungen, die den Zonenplan ersetzen (alte Zonen des Abschnitts entfernen, neue setzen), oder null mit Grund. */
  function aenderungen(entwurf, id, anteile) {
    const p = plane(entwurf, id, anteile);
    if (!p.zonen) return { aenderungen: null, grund: p.grund };
    const neu = new Set(p.zonen.map((z) => z.id));
    const weg = entwurf.zonen.filter((z) => z.abschnitt === id && !neu.has(z.id)).map((z) => ({ art: 'entferne-zone', id: z.id }));
    return { aenderungen: [...weg, ...p.zonen.map((zone) => ({ art: 'setze-zone', zone }))], grund: null };
  }

  /**
   * Legt den Zonenplan eines Abschnitts fest. Geht es nicht (Hülle zu klein), bleibt der Entwurf unverändert und der Bauleiter fragt Jonah.
   * @returns {{entwurf: object, zonen: string[], rueckfrage: object|null}}
   */
  function zonenplan(entwurf, id, anteile) {
    const r = aenderungen(entwurf, id, anteile);
    if (!r.aenderungen) {
      const a = abschnittVon(entwurf, id);
      const f = stelleFrage(entwurf, { regel: 'plan.zonenplan', an: FACHMANN, ort: a.huelle.von, text: r.grund, abschnitt: id, schluessel: `plan.zonenplan|${id}` });
      return { entwurf: f.entwurf, zonen: [], rueckfrage: f.rueckfrage };
    }
    const e = r.aenderungen.reduce((x, c) => aendere(x, c), entwurf);
    return { entwurf: e, zonen: e.zonen.filter((z) => z.abschnitt === id).map((z) => z.id), rueckfrage: null };
  }

  /** Anteile des bisherigen Zonenplans eines Abschnitts (von links nach rechts). */
  function anteileVon(entwurf, id) {
    const zonen = entwurf.zonen.filter((z) => z.abschnitt === id).sort((a, b) => a.von.x - b.von.x);
    if (!zonen.length || zonen.some((z) => !Number.isInteger(z.anteil))) throw new ZonenFehler(`Der Abschnitt ${id} hat keinen Zonenplan des Grobdesigners`);
    return zonen.map((z) => ({ funktion: z.funktion, anteil: z.anteil }));
  }

  /** Änderungen für das Einwand-Protokoll: derselbe Zonenplan, die Technikzone auf das Mindestmaß erweitert (oder null, wenn es nicht geht). */
  function neuPlanenAenderungen(entwurf, id) {
    return aenderungen(entwurf, id, anteileVon(entwurf, id)).aenderungen;
  }

  return { zonenplan, plane, aenderungen, neuPlanenAenderungen, anteileVon, ZonenFehler };
}

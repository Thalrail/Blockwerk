// Ebene 3 – Zellenwahl (Paket U2 der Oberfläche zum Bearbeiten, docs/plan-oberflaeche-bearbeiten.md):
// welche Zelle in der Welt gehört zu welchem Teil, und wie heißt sie im Referenzrahmen dieses Teils? Das ist die Umkehrung der Kette
// Rahmen → Paket → Lage (Drehung, Verschiebung), die eine manuelle Änderung (`aenderungen.js`) von der Rahmenzelle in die Welt führt:
//   Welt = drehe(Paket, drehung) + Lage,   Rahmen = Paket − Ursprung (Ecke Nordwest unten der Blöcke, `ebene2/zellen.js`).
// Reine Auskunft über einen Entwurf, ohne Zufall und ohne Änderung; die Oberfläche (Ebene 5) zeigt das Ergebnis nur an und schickt daraus eine Änderung nach unten.
import { huelleVon } from '../ebene2/baustein.js';
import { paketZuRahmen } from '../ebene2/zellen.js';

const istGanz = (z) => z !== null && typeof z === 'object' && [z.x, z.y, z.z].every(Number.isSafeInteger);
const nf = (n) => n + 0; // kein -0

export class ZellenwahlFehler extends Error {
  constructor(nachricht) { super(`Zellenwahl: ${nachricht}`); this.name = 'ZellenwahlFehler'; }
}

/** @param {{ebene2: object, lagen: object, materialisierung: object}} quellen */
export function erzeugeZellenwahl({ ebene2, lagen, materialisierung }) {
  /** Umkehrung von `zellenInWelt` für eine Zelle: erst die Lage abziehen, dann zurückdrehen (viertel Drehungen: x' = −z, z' = x vorwärts, hier die übrigen). */
  function weltZuPaket(w, lage) {
    let x = w.x - lage.x, z = w.z - lage.z;
    const vorwaerts = ((lage.drehung % 4) + 4) % 4;
    for (let i = 0; i < (4 - vorwaerts) % 4; i++) [x, z] = [-z, x];
    return { x: nf(x), y: nf(w.y - lage.y), z: nf(z) };
  }

  /**
   * @param {object} entwurf  geplanter Entwurf (mit seinen manuellen Änderungen)
   * @param {{x: number, y: number, z: number}} weltzelle
   * @param {{mat?: object, testmaterial?: boolean}} [optionen]  schon berechnete Materialisierung desselben Entwurfs (spart Rechenzeit); `testmaterial` nur für Tests
   * @returns {{zelle: object, block: {id: string, zustand: object}|null, gewaehlt: object|null, kandidaten: object[], hinweis: string|null}}
   *   `gewaehlt`: das Teil, dem die Zelle für eine Änderung zugeordnet wird – zuerst das Teil, das dort einen Block hat, sonst das innerste Teil, in dessen Hülle sie liegt;
   *   `kandidaten`: alle Teile, in deren Hülle die Zelle liegt (gewählt zuerst), je mit `teil` (ref), Rahmenzelle `zelle` und `besitzt` (hat dort einen Block).
   */
  function waehle(entwurf, weltzelle, { mat, testmaterial = false } = {}) {
    if (!istGanz(weltzelle)) throw new ZellenwahlFehler('die Zelle braucht ganze Zahlen x, y, z');
    const m = mat ?? materialisierung.materialisiere(entwurf, { testmaterial }); // ohne vollständige Palette wirft das wie überall (nur Tests dürfen testmaterial)
    const eff = entwurf.teile.some((t) => t.traeger !== undefined) ? lagen.loeseLagen(entwurf) : entwurf; // die Lage der Kinder ist abgeleitet
    const k = `${weltzelle.x},${weltzelle.y},${weltzelle.z}`;
    const kandidaten = [];
    eff.teile.forEach((t, reihenfolge) => {
      const paket = ebene2.baue(t.baustein, t.parameter ?? {});
      const h = huelleVon(paket.bloecke);
      if (!h || !t.lage) return;
      const pz = weltZuPaket(weltzelle, t.lage);
      if (pz.x < h.von.x || pz.x > h.bis.x || pz.y < h.von.y || pz.y > h.bis.y || pz.z < h.von.z || pz.z > h.bis.z) return;
      const volumen = (h.bis.x - h.von.x + 1) * (h.bis.y - h.von.y + 1) * (h.bis.z - h.von.z + 1);
      kandidaten.push({ teil: t.ref ?? t.id, id: t.id, baustein: t.baustein, name: t.name ?? t.baustein, abschnitt: t.abschnitt ?? null, zelle: paketZuRahmen(paket, pz), drehung: t.lage.drehung, besitzt: !!m.teile.get(t.id)?.schluessel.has(k), volumen, reihenfolge });
    });
    // gewählt wird, wer einen Block dort hat; sonst das kleinste (innerste) Teil; bei Gleichstand die Reihenfolge im Entwurf
    kandidaten.sort((a, b) => Number(b.besitzt) - Number(a.besitzt) || a.volumen - b.volumen || a.reihenfolge - b.reihenfolge);
    const liste = kandidaten.map(({ volumen, reihenfolge, ...rest }) => rest);
    const gewaehlt = liste[0] ? { ...liste[0], grund: liste[0].besitzt ? 'block' : 'huelle' } : null;
    const luft = m.welt.istLuft(weltzelle.x, weltzelle.y, weltzelle.z);
    const b = luft ? null : m.welt.leseBlock(weltzelle.x, weltzelle.y, weltzelle.z);
    // eine schon vorhandene manuelle Änderung an dieser Zelle (damit die Oberfläche „zurücknehmen“ statt „zweite Änderung“ anbietet)
    const vorhanden = gewaehlt ? (entwurf.aenderungen ?? []).find((a) => a.teil === gewaehlt.teil && a.zelle.x === gewaehlt.zelle.x && a.zelle.y === gewaehlt.zelle.y && a.zelle.z === gewaehlt.zelle.z) : null;
    const besitzer = liste.filter((x) => x.besitzt);
    const hinweis = !gewaehlt ? 'Diese Zelle liegt in keinem Teil des Bauplans; hier lässt sich nichts ändern.'
      : besitzer.length > 1 ? `Diese Zelle belegen ${besitzer.length} Teile gleichzeitig (${besitzer.map((x) => x.teil).join(', ')}); gewählt ist ${gewaehlt.teil}.` : null;
    return {
      zelle: { x: weltzelle.x, y: weltzelle.y, z: weltzelle.z },
      block: b ? { id: b.id, zustand: { ...(b.zustand ?? {}) } } : null,
      gewaehlt: gewaehlt ? { ...gewaehlt, aenderung: vorhanden ? { id: vorhanden.id, op: vorhanden.op, status: m.aenderungen?.get(vorhanden.id)?.status ?? 'angewandt' } : null } : null,
      kandidaten: liste, hinweis,
    };
  }

  return { waehle, weltZuPaket };
}

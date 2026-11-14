// Ebene 3 – Bestätigung technischer Anlagen (Paket P9 der Einbau-Architektur, docs/architektur-einbau.md Abschnitt 7, Entscheidung 2 des Bearbeitungsmodells).
// Ein Technikteil gilt erst als „bestätigt“, wenn die Prüfer aus Ebene 1 für seinen Prüfbereich keinen Verstoß melden UND sich seitdem im Prüfbereich nichts verändert hat.
// Prüfbereich = Hülle des Teils (vor Aussparungen) plus Umkreis (Regel plan.technik) plus seine Sperrzone: dort zählen alle Blöcke und alle Leerzellen,
// auch die Blöcke anderer Teile und Wesen. Der Abdruck (FNV-1a über die Blöcke im Prüfbereich in fester Reihenfolge, Leerzellen sind die Lücken) ändert sich, sobald
// eine Aussparung, eine Änderung von Jonah oder ein anderes Teil dort etwas verändert, auch nur in der Umgebung; dann steht das Teil auf „nicht bestätigt“, und die
// Oberfläche zeigt die Funktion nicht als funktionsfähig, bis der Abschluss sie neu geprüft hat. Deterministisch, ohne Uhr und Zufall.
import { kopie } from './entwurf.js';
import { haengeAn } from './bericht.js';

const CHUNK = 16;
const key = (x, y, z) => `${x},${y},${z}`;
const fnv = (text, start = 0x811c9dc5) => { let h = start; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
const hex8 = (n) => n.toString(16).padStart(8, '0');
const sortiert = (w) => (Array.isArray(w) ? w.map(sortiert) : w && typeof w === 'object' ? Object.fromEntries(Object.keys(w).sort().map((k) => [k, sortiert(w[k])])) : w);
const imKasten = (c, b) => c.x >= b.von.x && c.x <= b.bis.x && c.y >= b.von.y && c.y <= b.bis.y && c.z >= b.von.z && c.z <= b.bis.z;
const refVon = (t) => t.ref ?? t.id;

/** @param {{regelwerk: object, ebene0: object, materialisierung: object}} quellen */
export function erzeugeBestaetigung({ regelwerk, materialisierung }) {
  const umkreis = regelwerk.parameter('plan.technik', 'umkreis');

  /** Prüfbereich eines Technikteils: Hülle + Umkreis, vereinigt mit seiner Sperrzone (Kasten). */
  function bereich(entwurf, teil, huelle) {
    const k = { von: { ...huelle.von }, bis: { ...huelle.bis } };
    for (const a of ['x', 'y', 'z']) { k.von[a] -= umkreis; k.bis[a] += umkreis; }
    for (const sz of entwurf.sperrzonen ?? []) {
      if (sz.id !== `SZ-${teil.id}`) continue;
      for (const a of ['x', 'y', 'z']) { k.von[a] = Math.min(k.von[a], sz.von[a]); k.bis[a] = Math.max(k.bis[a], sz.bis[a]); }
    }
    return k;
  }

  /** Räumlicher Index (Chunk → Blöcke) der fertigen Welt, einmal je Auswertung. */
  function index(welt) {
    const chunks = new Map();
    for (const b of welt.alleBloecke()) {
      const ck = key(Math.floor(b.x / CHUNK), Math.floor(b.y / CHUNK), Math.floor(b.z / CHUNK));
      if (!chunks.has(ck)) chunks.set(ck, []);
      chunks.get(ck).push(b);
    }
    return chunks;
  }
  function blockImKasten(chunks, kasten) {
    const aus = [];
    const lo = (a) => Math.floor(kasten.von[a] / CHUNK), hi = (a) => Math.floor(kasten.bis[a] / CHUNK);
    for (let cx = lo('x'); cx <= hi('x'); cx++) for (let cy = lo('y'); cy <= hi('y'); cy++) for (let cz = lo('z'); cz <= hi('z'); cz++) {
      for (const b of chunks.get(key(cx, cy, cz)) ?? []) if (imKasten(b, kasten)) aus.push(b);
    }
    return aus.sort((p, q) => p.y - q.y || p.z - q.z || p.x - q.x);
  }

  /** Technikteile mit Prüfbereich und Abdruck: [{ id, ref, name, abschnitt, baustein, kasten, abdruck }] (nur Teile mit Blöcken). */
  function abdruecke(entwurf, mat) {
    const technik = entwurf.teile.filter((t) => t.art === 'technik' && mat.teile.get(t.id)?.huelle);
    if (!technik.length) return [];
    const chunks = index(mat.welt), wesen = mat.welt.wesen();
    return technik.map((t) => {
      const kasten = bereich(entwurf, t, mat.teile.get(t.id).huelle);
      let h = fnv(JSON.stringify([t.baustein, sortiert(t.parameter ?? {}), kasten]));
      for (const b of blockImKasten(chunks, kasten)) {
        h = fnv(`;${b.x},${b.y},${b.z},${b.id},${JSON.stringify(sortiert(b.zustand ?? {}))}${b.inhalt?.length ? JSON.stringify(sortiert(b.inhalt)) : ''}`, h);
      }
      // Wesen im Prüfbereich: alle Daten außer der laufenden Nummer (`nr`, `sitztIn` hängen von der Einfügereihenfolge ab), mit exakter Position; die abgerundete Zelle dient nur der Zuordnung
      const dort = wesen.filter((x) => imKasten({ x: Math.floor(x.x), y: Math.floor(x.y), z: Math.floor(x.z) }, kasten)).map(({ nr, sitztIn, ...rest }) => JSON.stringify(sortiert(rest))).sort();
      for (const w of dort) h = fnv(`#${w}`, h);
      return { id: t.id, ref: refVon(t), name: t.name ?? t.baustein, abschnitt: t.abschnitt, baustein: t.baustein, kasten, abdruck: hex8(h) };
    });
  }

  /**
   * Stand der Bestätigung je Technikteil: `bestaetigt` (Abdruck stimmt), `nicht-bestaetigt` (es gab eine Bestätigung, im Prüfbereich hat sich seitdem etwas geändert
   * oder das Teil ist ein anderes), `ungeprueft` (noch nie bestätigt).
   * @returns {{ref: string, id: string, name: string, abschnitt: string, status: string}[]}
   */
  function status(entwurf, mat) {
    const liste = entwurf.bestaetigungen ?? [];
    return abdruecke(entwurf, mat).map((x) => {
      const b = liste.find((y) => y.teil === x.ref);
      return { ref: x.ref, id: x.id, name: x.name, abschnitt: x.abschnitt, status: !b ? 'ungeprueft' : b.ergebnis !== 'abgelehnt' && b.abdruck === x.abdruck && b.baustein === x.baustein ? 'bestaetigt' : 'nicht-bestaetigt' };
    });
  }

  /**
   * Neue Prüfung durch Ebene 1 und Bestätigung: Für jedes Technikteil ohne Verstoß im Prüfbereich wird der aktuelle Abdruck gespeichert, die übrigen verlieren
   * ihre alte Bestätigung (sie sind „nicht bestätigt“ und werden mit den Verstößen gemeldet). Bestätigungen von Teilen, die es nicht mehr gibt, werden entfernt.
   * `testmaterial: true` nur für Tests ohne vollständige Palette (der Abdruck gilt dann nur für diese Welt).
   * @returns {{entwurf: object, bestaetigt: string[], abgelehnt: {ref: string, meldungen: object[]}[]}}
   */
  function bestaetige(entwurf, { testmaterial = false } = {}) {
    const e = kopie(entwurf);
    const mat = materialisierung.materialisiere(e, { testmaterial });
    const meldungen = materialisierung.pruefeEntwurf(e, mat).filter((m) => m.schwere === 'verstoss');
    const bestaetigt = [], abgelehnt = [];
    const neu = [];
    for (const x of abdruecke(e, mat)) {
      const hier = meldungen.filter((m) => imKasten(m.ort, x.kasten));
      if (hier.length) { abgelehnt.push({ ref: x.ref, meldungen: hier }); neu.push({ teil: x.ref, baustein: x.baustein, abdruck: null, ergebnis: 'abgelehnt', umkreis, von: 'ebene1' }); continue; }
      neu.push({ teil: x.ref, baustein: x.baustein, abdruck: x.abdruck, ergebnis: 'bestaetigt', umkreis, von: 'ebene1' });
      bestaetigt.push(x.ref);
    }
    e.bestaetigungen = neu;
    if (bestaetigt.length || abgelehnt.length) {
      haengeAn(e, 'entscheidung', { von: 'bauleiter', text: `bestätigt die Funktion von ${bestaetigt.length} Technikteilen nach der Prüfung durch Ebene 1${abgelehnt.length ? `; nicht bestätigt: ${abgelehnt.map((a) => `${a.ref} (${a.meldungen.length} Verstöße)`).join(', ')}` : ''}` });
    }
    return { entwurf: e, bestaetigt, abgelehnt };
  }

  return { abdruecke, status, bestaetige };
}

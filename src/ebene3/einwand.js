// Ebene 3 – Einwand-Protokoll: Verstoß → maschinenlesbarer Einwand mit Koordinate → der Zuständige ändert → erneut prüfen.
// Nach höchstens N Runden (plan.runden) greift der Bauleiter ein. Jeder Einwand und jede Änderung landet im Baubericht.
// Quellen: Meldungen der Prüfer aus Ebene 1 (Zuständigkeitstabelle plan.zustaendigkeit) und die eigenen Geometrieregeln (plan.geometrie).
import { kopie } from './entwurf.js';
import { haengeAn } from './bericht.js';
import { rueckfrage } from './bauleiter.js';
import { RechtFehler } from './fachleute.js';

const key = (x, y, z) => `${x},${y},${z}`;
const ortKey = (o) => (o ? key(o.x, o.y, o.z) : '-');
const zelleVon = (s) => { const [x, y, z] = s.split(',').map(Number); return { x, y, z }; };
const kleinste = (menge) => [...menge].sort((a, b) => { const p = zelleVon(a), q = zelleVon(b); return p.y - q.y || p.z - q.z || p.x - q.x; })[0];
const imQuader = (z, q) => z.x >= q.von.x && z.x <= q.bis.x && z.y >= q.von.y && z.y <= q.bis.y && z.z >= q.von.z && z.z <= q.bis.z;

/**
 * @param {{regelwerk: object, fachleute: ReturnType<typeof import('./fachleute.js').erzeugeFachleute>, materialisierung: object}} quellen
 */
export function erzeugeEinwaende({ regelwerk, fachleute, materialisierung, naehte = () => [], zusaetze = () => [] }) {
  const tabelle = regelwerk.parameter('plan.zustaendigkeit', 'tabelle');
  const standard = regelwerk.parameter('plan.zustaendigkeit', 'standard');
  const maximum = regelwerk.parameter('plan.runden', 'maximum');

  /** Geometrieregeln der Planung: Überschneidung, Sperrzone, Zone. */
  function geometrie(entwurf, mat) {
    const liste = [];
    const teilVon = new Map(entwurf.teile.map((t) => [t.id, t]));
    // Überschneidung: jeder Block höchstens einem Teil
    const belegt = new Map();
    const treffer = new Map(); // "idA|idB" → gemeinsame Blöcke
    for (const t of entwurf.teile) {
      for (const k of mat.teile.get(t.id).schluessel) {
        const vorher = belegt.get(k);
        if (vorher !== undefined && vorher !== t.id) {
          const paar = `${vorher}|${t.id}`;
          if (!treffer.has(paar)) treffer.set(paar, new Set());
          treffer.get(paar).add(k);
        } else belegt.set(k, t.id);
      }
    }
    for (const [paar, bloecke] of treffer) {
      const [a, b] = paar.split('|').map((id) => teilVon.get(id));
      const besitzerA = fachleute.besitzer(a), besitzerB = fachleute.besitzer(b);
      let von, an, ziel;
      if (besitzerA === besitzerB) { von = 'bauleiter'; an = besitzerA; ziel = b.id; }
      else if (fachleute.hoeher(besitzerA, besitzerB)) { von = besitzerA; an = besitzerB; ziel = b.id; }
      else { von = besitzerB; an = besitzerA; ziel = a.id; }
      liste.push({ regel: 'plan.geometrie', von, an, ort: zelleVon(kleinste(bloecke)), schwere: 'verstoss', ziel: `teil:${ziel}`, abschnitt: teilVon.get(ziel).abschnitt, text: `${a.baustein} (${a.id}) und ${b.baustein} (${b.id}) belegen ${bloecke.size} gemeinsame Blöcke`, schluessel: `plan.geometrie|ueberschneidung|${a.id}|${b.id}` });
    }
    // Sperrzonen des Technikers
    for (const sz of entwurf.sperrzonen) {
      for (const t of entwurf.teile) {
        if (t.art === 'technik') continue;
        const m = mat.teile.get(t.id);
        const kandidaten = sz.verbot === 'alles' ? m.schluessel : m.arbeitsbloecke;
        const drin = [...kandidaten].filter((k) => imQuader(zelleVon(k), sz));
        if (!drin.length) continue;
        liste.push({ regel: 'plan.geometrie', von: 'techniker', an: fachleute.besitzer(t), ort: zelleVon(kleinste(drin)), schwere: 'verstoss', ziel: `teil:${t.id}`, abschnitt: t.abschnitt, text: `${t.baustein} (${t.id}) liegt in der Sperrzone ${sz.id} (${sz.verbot === 'alles' ? 'nur Technik erlaubt' : 'keine Arbeitsblöcke'})`, schluessel: `plan.geometrie|sperrzone|${sz.id}|${t.id}` });
      }
    }
    // Zonen des Grobdesigners: Teile eines Abschnitts bleiben in dessen Zone
    for (const z of entwurf.zonen) {
      if (!z.abschnitt) continue;
      // Zone ohne Funktion: für alle Teile des Abschnitts; Technikzone: nur für Technikteile; andere Funktionszone: nur für Teile, die in dieser Zone stehen sollen
      for (const t of entwurf.teile.filter((x) => x.abschnitt === z.abschnitt && (z.funktion === undefined || (z.funktion === 'technik' ? x.art === 'technik' : x.zone === z.funktion)))) {
        const draussen = [...mat.teile.get(t.id).schluessel].filter((k) => !imQuader(zelleVon(k), z));
        if (!draussen.length) continue;
        liste.push({ regel: 'plan.geometrie', von: 'grobdesigner', an: fachleute.besitzer(t), ort: zelleVon(kleinste(draussen)), schwere: 'verstoss', ziel: `teil:${t.id}`, abschnitt: t.abschnitt, text: `${t.baustein} (${t.id}) ragt aus der Zone ${z.id} des Abschnitts ${z.abschnitt}`, schluessel: `plan.geometrie|zone|${z.id}|${t.id}` });
      }
    }
    // Nähte zwischen fertigen Abschnitten (Konstrukteur)
    for (const n of naehte(entwurf)) {
      for (const b of n.befunde) liste.push({ regel: 'plan.naht', von: 'bauleiter', an: 'konstrukteur', ort: b.ort, schwere: 'verstoss', ziel: `abschnitt:${n.abschnitt}`, abschnitt: n.abschnitt, text: b.text, schluessel: `plan.naht|${n.schnittstelle.id}|${b.text}` });
    }
    liste.push(...zusaetze(entwurf));
    return liste;
  }

  /** Sammelt alle Einwände (nur Verstöße) und die Hinweise des Prüfers. Sortiert nach Rang des Erhebenden, dann nach Schlüssel. */
  function sammle(entwurf) {
    const mat = materialisierung.materialisiere(entwurf);
    const einwaende = [], hinweise = [];
    for (const m of materialisierung.pruefeEntwurf(entwurf, mat)) {
      if (m.schwere !== 'verstoss') { hinweise.push(m); continue; }
      const teil = materialisierung.teilBei(mat, m.ort);
      einwaende.push({
        regel: m.regel, von: 'bauleiter', an: tabelle[m.regel] ?? standard, ort: { ...m.ort }, schwere: 'verstoss', ziel: teil ? `teil:${teil}` : null,
        abschnitt: teil ? entwurf.teile.find((t) => t.id === teil).abschnitt : null, text: m.meldung, schluessel: `${m.regel}|${ortKey(m.ort)}|${m.meldung}`,
      });
    }
    einwaende.push(...geometrie(entwurf, mat));
    einwaende.sort((a, b) => fachleute.rang(a.von) - fachleute.rang(b.von) || (a.schluessel < b.schluessel ? -1 : a.schluessel > b.schluessel ? 1 : 0));
    return { einwaende, hinweise, mat };
  }

  /** Legt den Einwand im Entwurf an (oder aktualisiert die Runde) und gibt ihn zurück; schreibt jede Runde in den Baubericht. */
  function registriere(e, draft, runde) {
    let ew = e.einwaende.find((x) => x.schluessel === draft.schluessel && x.status === 'offen');
    if (!ew) {
      ew = { id: `E${e.zaehler.einwand++}`, ...draft, runde, status: 'offen' };
      e.einwaende.push(ew);
    } else ew.runde = runde;
    haengeAn(e, 'einwand', { id: ew.id, von: ew.von, an: ew.an, regel: ew.regel, ort: ew.ort, text: ew.text, ziel: ew.ziel, runde });
    return ew;
  }

  /**
   * Lässt das Protokoll laufen.
   * @param {object} entwurf
   * @param {Record<string, (einwand: object, entwurf: object) => (object|null)>} handler  je Fachmann: liefert eine Änderung (für `aendere`) oder null
   * @returns {{entwurf: object, erledigt: string[], eskaliert: string[], rueckfragen: object[], hinweise: object[], runden: number}}
   */
  function laufe(entwurf, handler, { maxRunden = maximum } = {}) {
    let e = kopie(entwurf);
    const offen = new Map(); // Schlüssel → Einwand-ID
    const erledigt = [];
    let hinweise = [];
    let runden = 0;
    const schliesse = (jetzt, runde) => {
      for (const [k, id] of offen) {
        if (jetzt.has(k)) continue;
        offen.delete(k);
        const ew = e.einwaende.find((x) => x.id === id);
        ew.status = 'erledigt';
        erledigt.push(id);
        haengeAn(e, 'erledigt', { einwand: id, regel: ew.regel, runde });
      }
    };
    for (let runde = 1; runde <= maxRunden; runde++) {
      const { einwaende, hinweise: h } = sammle(e);
      hinweise = h;
      schliesse(new Set(einwaende.map((x) => x.schluessel)), runde - 1);
      if (!einwaende.length) break;
      runden = runde;
      const geaendert = new Set();
      for (const draft of einwaende) {
        const ew = registriere(e, draft, runde);
        offen.set(ew.schluessel, ew.id);
        if (ew.ziel && geaendert.has(ew.ziel)) { haengeAn(e, 'abgelehnt', { einwand: ew.id, ziel: ew.ziel, grund: 'ein höherrangiger Einwand hat dieses Teil in dieser Runde schon geändert (Rangfolge)' }); continue; }
        const f = handler[ew.an];
        if (!f) continue;
        const aenderung = f(ew, e);
        if (!aenderung) continue;
        try {
          for (const a of Array.isArray(aenderung) ? aenderung : [aenderung]) e = fachleute.aendere(e, ew.an, a).entwurf;
          if (ew.ziel) geaendert.add(ew.ziel);
        } catch (fehler) {
          if (!(fehler instanceof RechtFehler)) throw fehler;
          haengeAn(e, 'abgelehnt', { einwand: ew.id, ziel: ew.ziel ?? 'Plan', grund: fehler.message });
        }
      }
    }
    // nach der letzten Runde noch einmal prüfen: was bleibt, wird eskaliert
    const { einwaende: rest, hinweise: h } = sammle(e);
    hinweise = h;
    schliesse(new Set(rest.map((x) => x.schluessel)), runden);
    const eskaliert = [], rueckfragen = [];
    for (const draft of rest) {
      const bekannt = e.einwaende.find((x) => x.schluessel === draft.schluessel && x.status === 'offen');
      const ew = bekannt ?? registriere(e, draft, runden + 1);
      ew.status = 'eskaliert';
      eskaliert.push(ew.id);
      rueckfragen.push(rueckfrage(e, ew, { runden: maxRunden }));
    }
    return { entwurf: e, erledigt, eskaliert, rueckfragen, hinweise, runden };
  }

  return { sammle, laufe, geometrie, zustaendig: (regel) => tabelle[regel] ?? standard, maximum };
}

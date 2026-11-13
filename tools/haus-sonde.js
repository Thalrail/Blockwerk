// Haus-Sonde (13.11.2026): Kann Blockwerk mit den vorhandenen Schnittstellen und Bausteinen ein frei beschriebenes, zweigeschossiges Wohnhaus modellieren?
// Aufruf:  node tools/haus-sonde.js      Sie erzeugt je Größenvariante eine Spezifikation, lässt sie durch Prüfer, Planung und Bauplan laufen und druckt die
// Ergebnisse als JSON (Bericht: docs/haus-sonde.md). Die Sonde ändert nichts in der Engine und nutzt nur öffentliche Schnittstellen
// (ebene4.pruefe/freigeben/baue, ebene5.bauplan). Die Freigabe ist technisch; die echte Freigabe gibt Jonah in der Oberfläche.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ladeEngine, erzeugeEbene5 } from '../src/ebene5/index.js';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const holeJson = async (pfad) => JSON.parse(readFileSync(join(wurzel, pfad), 'utf8'));

/** Außenmaße des Hauses in Blöcken (breite = x, tiefe = z), lichte Höhe je Geschoss, Dachneigung (Höhe ÷ halbe Breite). */
export const VARIANTEN = {
  klein: { breite: 9, tiefe: 7, geschoss: 3, neigung: 1 },
  mittel: { breite: 13, tiefe: 11, geschoss: 4, neigung: 1 },
  gross: { breite: 21, tiefe: 15, geschoss: 5, neigung: 0.8 },
};

/**
 * Die natürliche Beschreibung eines Wohnhauses mit den vorhandenen Begriffen: je Geschoss ein Hohlkasten (`bau.gang`: Boden, zwei Seitenwände, Decke;
 * die lichte Breite ist die Innenbreite, die Wandstärke kommt je Seite dazu), darauf das Satteldach. `mit` schaltet die Teile zu, die ein Wohnhaus
 * zusätzlich bräuchte: Tür, Fenster, Treppe im Haus. Alle Maße kommen aus der Variante.
 */
export function hausSpezifikation({ breite, tiefe, geschoss, neigung }, mit = {}) {
  const geschossForm = { baustein: 'bau.gang', groesse: { laenge: tiefe, breite: breite - 2, hoehe: geschoss, wandstaerke: 1 } };
  const teile = [
    { id: 'erdgeschoss', name: 'Erdgeschoss', art: 'halle', wichtigkeit: 'muss', form: geschossForm, lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'hell-nordisch' } },
    { id: 'obergeschoss', name: 'Obergeschoss', art: 'halle', wichtigkeit: 'muss', form: geschossForm, lage: { bezug: 'erdgeschoss', relation: 'ueber' } },
    { id: 'dach', name: 'Dach', art: 'halle', wichtigkeit: 'muss', form: { baustein: 'form.satteldach', groesse: { breite, laenge: tiefe, neigung } }, lage: { bezug: 'obergeschoss', relation: 'ueber' } },
  ];
  if (mit.tuer) teile.push({ id: 'haustuer', name: 'Haustür', art: 'tor', wichtigkeit: 'soll', form: { baustein: 'bau.tuer', groesse: { fluegel: 1 } }, lage: { bezug: 'erdgeschoss', relation: 'neben-sueden' } });
  if (mit.fenster) teile.push({ id: 'fenster', name: 'Fenster', art: 'tor', wichtigkeit: 'kann', form: { baustein: 'bau.fenster', groesse: { breite: 3, hoehe: 2 } }, lage: { bezug: 'erdgeschoss', relation: 'neben-osten' } });
  if (mit.treppe) teile.push({ id: 'treppe', name: 'Treppe', art: 'anlage', wichtigkeit: 'muss', form: { baustein: 'bau.treppe', groesse: { stufen: geschoss + 1, breite: 2 } }, lage: { bezug: 'erdgeschoss', relation: 'innen' } });
  const rand = 30; // großzügiger Bauplatz, damit nicht der Platz die Antwort bestimmt
  return { schema: 1, version: 1, projekt: { name: `Wohnhaus ${breite}×${tiefe}`, bauplatz: { breite: breite + rand, hoehe: 2 * (geschoss + 2) + breite, tiefe: tiefe + rand }, massstab: 1 }, teile };
}

/** Feste Blöcke aus dem Bauplan als Menge „x,y,z“. */
export function feste(plan) {
  const s = new Set();
  for (const a of plan.abschnitte) for (const sch of a.schichten) for (let i = 0; i < sch.n; i++) s.add(`${sch.x[i]},${sch.y},${sch.z[i]}`);
  return s;
}

/** Ist ein Luftblock innen vom Außenraum aus über Luft erreichbar? (6er-Nachbarschaft, Quader um das Bauwerk plus 1 Block Rand.) */
export function luftZugang(plan, start) {
  const fest = feste(plan);
  const pos = [...fest].map((k) => k.split(',').map(Number));
  const von = [0, 1, 2].map((i) => Math.min(...pos.map((p) => p[i])) - 1), bis = [0, 1, 2].map((i) => Math.max(...pos.map((p) => p[i])) + 1);
  const gesehen = new Set(), stapel = [[von[0], von[1], von[2]]];
  gesehen.add(stapel[0].join(','));
  while (stapel.length) {
    const p = stapel.pop();
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const q = [p[0] + dx, p[1] + dy, p[2] + dz], k = q.join(',');
      if (q.some((v, i) => v < von[i] || v > bis[i]) || gesehen.has(k) || fest.has(k)) continue;
      gesehen.add(k); stapel.push(q);
    }
  }
  return { startIstLuft: !fest.has(start.join(',')), vonAussenErreichbar: gesehen.has(start.join(',')) };
}

export async function laufe(spec, e, e5) {
  const t0 = Date.now();
  const pr = e.ebene4.pruefe(spec);
  const aus = { rueckfragenPruefer: pr.rueckfragen.map((q) => `${q.id} ${q.pfad}: ${q.frage}`), hinweisePruefer: pr.hinweise.map((h) => `${h.pfad}: ${h.text}`) };
  if (pr.rueckfragen.length) return { ...aus, status: 'rueckfragen-vor-freigabe' };
  const frei = e.ebene4.freigeben(spec, 'haus-sonde-technisch');
  const r = e.ebene4.baue(frei);
  aus.status = r.status; aus.dauerMs = Date.now() - t0;
  aus.rueckfragenBau = (r.rueckfragen ?? []).map((q) => `${q.id}: ${q.frage}`);
  if (r.status !== 'fertig') return aus;
  const plan = e5.bauplan(r.entwurf);
  const h = (a) => `${a.huelle.bis.x - a.huelle.von.x + 1}×${a.huelle.bis.y - a.huelle.von.y + 1}×${a.huelle.bis.z - a.huelle.von.z + 1}`;
  aus.huellen = r.entwurf.abschnitte.map((a) => `${a.id} ${h(a)}`);
  aus.bloecke = plan.bloecke;
  aus.einwaende = r.entwurf.einwaende.map((w) => `${w.regel}: ${w.text ?? ''}`);
  aus.offeneAnfragen = (r.offeneAnfragen ?? []).map((q) => `${q.abschnitt}:${q.art}`);
  aus.material = e5.material(plan).gesamt.slice(0, 6).map((m) => `${m.name} ${m.anzahl}`);
  return { ...aus, entwurf: r.entwurf, plan };
}

/** Innenpunkt des Erdgeschosses: Mitte des Hohlkastens, eine Schicht über dem Boden. */
export function innenpunkt(entwurf) {
  const t = entwurf.teile.find((x) => x.baustein === 'bau.gang');
  return t ? [t.lage.x, t.lage.y, t.lage.z] : null;
}

export async function engine() {
  const e = await ladeEngine(holeJson);
  const e5 = erzeugeEbene5({ ebene0: e.ebene0, ebene3: e.ebene3, darstellungsdaten: await holeJson('data/darstellung.json'), texturen: await holeJson('data/texturen.json').catch(() => null) });
  return { e, e5 };
}

/** Umschließender Quader der festen Blöcke je Abschnitt: `{ id, von: [x, y, z], bis: [x, y, z] }`. */
export function umfang(plan) {
  return plan.abschnitte.map((a) => {
    const m = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const s of a.schichten) for (let i = 0; i < s.n; i++) for (const [k, v] of [[0, s.x[i]], [1, s.y], [2, s.z[i]]]) { m[k] = Math.min(m[k], v); m[k + 3] = Math.max(m[k + 3], v); }
    return { id: a.id, von: m.slice(0, 3), bis: m.slice(3) };
  });
}

/** Zusatzfragen der Sonde: Abstand zur Wand, Maße nachträglich ändern, Grenzen der Parameter, Wirkung des Stils. */
export async function fragen(e, e5) {
  const aus = {};
  const kurz = (q) => ({ status: q.status, rueckfragen: [...(q.rueckfragenPruefer ?? []), ...(q.rueckfragenBau ?? [])].map((x) => x.slice(0, 150)), bloecke: q.bloecke });
  aus.tuerAbstand = {};
  for (const ab of [undefined, 0, 1]) {
    const s = hausSpezifikation(VARIANTEN.klein, { tuer: true });
    if (ab !== undefined) s.teile.find((x) => x.id === 'haustuer').lage.abstand = ab;
    const q = await laufe(s, e, e5);
    aus.tuerAbstand[ab ?? 'Standard'] = { ...kurz(q), umfang: q.plan ? umfang(q.plan).map((u) => `${u.id} ${u.von}..${u.bis}`).filter((x) => /haustuer|erdgeschoss/.test(x)) : null };
  }
  const a = e.ebene4.baue(e.ebene4.freigeben(hausSpezifikation(VARIANTEN.mittel), 'sonde'));
  const neu = hausSpezifikation(VARIANTEN.gross); neu.version = 2;
  const t0 = Date.now(); const u = e.ebene4.aktualisiereBau(a.entwurf, e.ebene4.freigeben(neu, 'sonde')); const dauer = Date.now() - t0;
  const frisch = await laufe(hausSpezifikation(VARIANTEN.gross), e, e5);
  const abdruecke = (p) => JSON.stringify(p.abschnitte.map((x) => x.schichten.map((s) => s.abdruck)));
  aus.masseAendern = { status: u.status, geaendert: u.geaendert, dauerMs: dauer, gleichWieFrischerLauf: u.entwurf ? abdruecke(e5.bauplan(u.entwurf)) === abdruecke(frisch.plan) : null };
  aus.grenzen = {};
  for (const [n, v] of [['breite 34 (Maximum)', { breite: 34, tiefe: 9, geschoss: 3, neigung: 1 }], ['breite 35', { breite: 35, tiefe: 9, geschoss: 3, neigung: 1 }], ['Geschoss 1', { breite: 9, tiefe: 7, geschoss: 1, neigung: 1 }], ['3 × 3', { breite: 3, tiefe: 3, geschoss: 3, neigung: 1 }], ['34 × 60', { breite: 34, tiefe: 60, geschoss: 3, neigung: 1 }]]) aus.grenzen[n] = kurz(await laufe(hausSpezifikation(v), e, e5));
  const stil = async (stil) => { const s = hausSpezifikation(VARIANTEN.klein); s.teile[2].stil = stil; return (await laufe(s, e, e5)).material; };
  aus.stil = { dachDunkel: await stil({ stimmung: 'dunkel-industriell' }), dachDunkelMitFarbwunsch: await stil({ stimmung: 'dunkel-industriell', farben: ['rot'] }), dachGlanz: await stil({ stimmung: 'glanz' }) };
  return aus;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { e, e5 } = await engine();
  const ausgabe = { varianten: {} };
  for (const [name, v] of Object.entries(VARIANTEN)) {
    for (const [stufe, mit] of [['huelle', {}], ['mit-allem', { tuer: true, fenster: true, treppe: true }]]) {
      const { entwurf, plan, ...rest } = await laufe(hausSpezifikation(v, mit), e, e5);
      if (entwurf) { const p = innenpunkt(entwurf); rest.umfang = umfang(plan).map((u) => `${u.id} ${u.von}..${u.bis}`); rest.luftZugang = luftZugang(plan, p); }
      ausgabe.varianten[`${name}/${stufe}`] = rest;
    }
  }
  ausgabe.fragen = await fragen(e, e5);
  console.log(JSON.stringify(ausgabe, null, 1));
}

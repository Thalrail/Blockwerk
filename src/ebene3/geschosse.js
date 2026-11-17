// Ebene 3 – Geschosse und Treppen eines Rezepts (D4): Decken im Abstand der Etagenhöhe und eine durchgehende Treppe (Wendel, gerade im Zickzack oder Leiter) vom Erdgeschoss bis zur obersten nutzbaren Ebene.
// Die Regeln stehen als Daten im Rezept (rezepte.<name>, parameter.merkmale.geschosse); hier steht nur die feste, deterministische Auswertung gegen die ECHTE Geometrie des Turms:
// der lichte Innenraum jeder Schicht (eingeschlossene freie Zellen des geschlossenen Rohrs), nie eine Schätzung. Gleiche Eingabe = gleiches Ergebnis, nie ein stiller Wechsel der Treppenform.
//
// Aufbau: Jede Etage ist ein Treppenlauf (oder eine Leiter). Die Blöcke eines Kinds müssen innerhalb seines Trägerglieds liegen; überspannt ein Lauf eine Gliedgrenze, wird er an der Grenze in
// Segmente zerlegt (ein Kind je Glied). Die Öffnungen in den Decken sind Teil des Glieds (Parameter deckenLoecher); die Kinder melden zusätzlich die Kopffreiheit als Freihaltung (Konflikt statt stillem Zumauern).
import { huelleVon } from '../ebene2/baustein.js';

// Leiter: Seite der Wand → Drehung des Kinds (das Paket blickt nach Norden und hängt an der Wand im Süden)
const LEITER_DREHUNG = { sued: 0, west: 1, nord: 2, ost: 3 };
const WAND = { sued: [0, 1], nord: [0, -1], west: [-1, 0], ost: [1, 0] };
const LEITER_SEITEN = ['sued', 'west', 'ost', 'nord'];
const SEITE_INNEN = { sued: [0, -1], nord: [0, 1], west: [1, 0], ost: [-1, 0] }; // von der Außenseite nach innen (dx, dz)
/** Drehung um Viertel im Uhrzeigersinn (x, z) → (-z, x), wie die Lage eines Kinds (siehe lagen.js und test/ebene2/zellen.test.js). */
const dreheViertel = (c, v) => { let x = c.x, z = c.z; for (let i = 0; i < ((v % 4) + 4) % 4; i++) [x, z] = [-z, x]; return { x, z }; };
const nf = (n) => 0 - (0 - n); // kein −0 in Ergebnissen
const key = (x, y, z) => `${x},${y},${z}`;

/** @param {{ebene2: object}} quellen */
export function erzeugeGeschosse({ ebene2 }) {
  /** Geschlossenes Rohr aus den Gliedern (ohne Decken und Öffnungen): lichte Zellen je Schicht (Flutfüllung von außen, 4er-Nachbarschaft). */
  function masken(teile) {
    const belegt = new Set();
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, hoehe = 0;
    for (const t of teile) {
      for (const b of ebene2.baue(t.baustein, t.parameter).bloecke) {
        belegt.add(key(b.x, b.y + t.versatz.y, b.z));
        x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x); z0 = Math.min(z0, b.z); z1 = Math.max(z1, b.z); hoehe = Math.max(hoehe, b.y + t.versatz.y + 1);
      }
    }
    const innen = new Map();
    const schicht = (y) => {
      if (innen.has(y)) return innen.get(y);
      const aussen = new Set(), stapel = [];
      for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0 - 1; z <= z1 + 1; z++) if (x === x0 - 1 || x === x1 + 1 || z === z0 - 1 || z === z1 + 1) { aussen.add(`${x},${z}`); stapel.push([x, z]); }
      while (stapel.length) {
        const [x, z] = stapel.pop();
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz, k = `${nx},${nz}`;
          if (nx < x0 - 1 || nx > x1 + 1 || nz < z0 - 1 || nz > z1 + 1 || aussen.has(k) || belegt.has(key(nx, y, nz))) continue;
          aussen.add(k); stapel.push([nx, nz]);
        }
      }
      const frei = new Set();
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (!belegt.has(key(x, y, z)) && !aussen.has(`${x},${z}`)) frei.add(`${x},${z}`);
      innen.set(y, frei);
      return frei;
    };
    const mitte = { x: x0 + Math.floor((x1 - x0) / 2), z: z0 + Math.floor((z1 - z0) / 2) };
    const ausdehnung = (y) => { let a = Infinity, b = -Infinity; for (const k of schicht(y)) { const x = Number(k.split(',')[0]); a = Math.min(a, x); b = Math.max(b, x); } return b < a ? 0 : b - a + 1; };
    return { x0, x1, z0, z1, hoehe, mitte, ausdehnung, block: (x, y, z) => belegt.has(key(x, y, z)), frei: (x, y, z) => y >= 0 && y < hoehe && schicht(y).has(`${x},${z}`) };
  }

  /** Zellen eines Quaders (von/bis in Paketkoordinaten), gedreht und um den Ursprung verschoben. */
  function quaderZellen(a, drehung, ur) {
    const zellen = [];
    for (let y = a.von.y; y <= a.bis.y; y++) for (let x = a.von.x; x <= a.bis.x; x++) for (let z = a.von.z; z <= a.bis.z; z++) {
      const c = dreheViertel({ x, z }, drehung);
      zellen.push([nf(c.x + ur.x), y + ur.y, nf(c.z + ur.z)]);
    }
    return zellen;
  }

  /**
   * @param {object} p
   * @param {string} p.name Rezeptname (für Meldungen)
   * @param {object} p.form Daten der Geschossform (rezepte.<name>.parameter.merkmale.geschosse.formen.<form>)
   * @param {string} p.wahl 'auto' oder der Name einer Treppenform
   * @param {{glied: string, ref: string, baustein: string, parameter: object, versatz: {x:number,y:number,z:number}}[]} p.teile Glieder des Rezepts (ohne Decken)
   * @param {string} p.praefix Vorsatz der Kennungen
   * @param {{seite: string, breite: number}|null} p.eingang gewählter Eingang (für den freien Vorraum)
   * @param {(pfad: string, text: string) => never} p.fehler wirft die Rückfrage
   */
  function plane({ name, form, wahl, teile, praefix, eingang, fehler }) {
    const etage = form.etage, mind = form.obersteMindestlicht;
    const m = masken(teile);
    const treppen = form.treppen;
    const kandidaten = wahl === 'auto' ? treppen.auto : [wahl];
    const reichweite = teile.map((t) => { const h = huelleVon(ebene2.baue(t.baustein, t.parameter).bloecke); return { t, von: t.versatz.y + h.von.y, bis: t.versatz.y + h.bis.y }; });
    const gliedBei = (y) => reichweite.find((r) => y >= r.von && y <= r.bis)?.t;

    // Freier Vorraum hinter der Tür (zwei Zellen tief, Höhe 0 bis 2): dort darf keine Treppe stehen
    const vorraum = new Set();
    if (eingang) {
      const quer = eingang.seite === 'nord' || eingang.seite === 'sued';
      const [dx, dz] = SEITE_INNEN[eingang.seite];
      const mitteAchse = quer ? m.mitte.x : m.mitte.z;
      for (let c = 0; c < eingang.breite; c++) {
        let x = quer ? mitteAchse + c : { west: m.x0, ost: m.x1 }[eingang.seite], z = quer ? { nord: m.z0, sued: m.z1 }[eingang.seite] : mitteAchse + c;
        for (let s = 0; s < 40 && !m.frei(x, 0, z); s++) { x += dx; z += dz; }
        for (let t = 0; t < 2; t++) for (let y = 0; y <= 2; y++) vorraum.add(key(x + t * dx, y, z + t * dz));
      }
    }
    const alleFrei = (zellen) => zellen.every(([x, y, z]) => m.frei(x, y, z));
    const stoertVorraum = (zellen) => zellen.some(([x, y, z]) => vorraum.has(key(x, y, z)));

    /** Eine Treppenform planen: so viele Etagen wie möglich. Liefert { n, fluege, grund }. */
    function planeForm(art, daten) {
      let beste = { n: 0, fluege: [], grund: null };
      for (const r of art === 'wendel' ? daten.radien : [null]) {
        const lauf = []; let wieso = null;
        for (let k = 0; k < 200; k++) {
          const yk = k * etage;
          let flug = null;
          if (art === 'wendel') {
            const umlauf = ebene2.baue(daten.baustein, { radius: r, stufen: etage + 1, start: 0, aussparung: 1 }).anschluesse[0].stufenProUmdrehung;
            const start = (k * etage) % umlauf;
            const paket = ebene2.baue(daten.baustein, { radius: r, stufen: etage, start, aussparung: 1 });
            const podest = ebene2.baue(daten.baustein, { radius: r, stufen: etage + 1, start }).bloecke[etage];
            const zellen = paket.aussparungen.flatMap((a) => quaderZellen(a, 0, { x: 0, y: yk, z: 0 }));
            const loecher = zellen.filter(([, y]) => y === yk + etage - 1);
            for (let h = 0; h < mind; h++) zellen.push([podest.x, yk + etage + h, podest.z]);
            // Segment der Stufen i0..i1 dieser Etage
            const segment = (i0, i1) => ({ baustein: daten.baustein, parameter: { radius: r, stufen: i1 - i0 + 1, start: (start + i0) % umlauf, aussparung: 1 }, drehung: 0, ur: { x: 0, y: yk + i0, z: 0 } });
            flug = { zellen, loecher, segment };
          } else if (art === 'gerade') {
            const paket = ebene2.baue(daten.baustein, { stufen: etage, breite: 1 });
            const z0 = m.mitte.z + Math.floor((etage + 1) / 2) - 1, nachNorden = k % 2 === 0;
            const drehung = nachNorden ? 0 : 2;
            const ur0 = nachNorden ? { x: m.mitte.x - 1, y: yk, z: z0 } : { x: m.mitte.x, y: yk, z: z0 - etage };
            const zellen = paket.aussparungen.flatMap((a) => quaderZellen(a, drehung, ur0));
            const loecher = zellen.filter(([, y]) => y === yk + etage - 1);
            const e = dreheViertel({ x: 0, z: -etage }, drehung);
            for (let h = 0; h < mind; h++) zellen.push([nf(ur0.x + e.x), yk + etage + h, nf(ur0.z + e.z)]);
            const segment = (i0, i1) => {
              const s = dreheViertel({ x: 0, z: -i0 }, drehung); // die Stufe i0 liegt i0 Blöcke vom Fuß entfernt in Laufrichtung
              return { baustein: daten.baustein, parameter: { stufen: i1 - i0 + 1, breite: 1 }, drehung, ur: { x: nf(ur0.x + s.x), y: yk + i0, z: nf(ur0.z + s.z) } };
            };
            flug = { zellen, loecher, segment };
          } else { // leiter: je Etage eine Säule an der Wand (hinter jedem Leiterblock steht ein Wandblock), benachbarte Etagen nie in derselben Spalte
            const vorige = lauf.at(-1)?.spalte;
            const belegtVorher = new Set(lauf.flatMap((q) => q.bloecke)); // Blöcke früherer Etagen (Leiter und Stützen): nie dieselbe Zelle
            for (const seite of LEITER_SEITEN) {
              const [wx, wz] = WAND[seite], [ix, iz] = SEITE_INNEN[seite];
              const quer = seite === 'nord' || seite === 'sued';
              const aussen = { nord: m.z0, sued: m.z1, west: m.x0, ost: m.x1 }[seite];
              for (let t = 0; t <= 40 && !flug; t++) {
                const x = quer ? m.mitte.x : aussen + t * ix, z = quer ? aussen + t * iz : m.mitte.z;
                const zellen = [], stuetzen = []; let ok = true;
                for (let h = 0; h <= etage && ok; h++) { // etage + 1 Leiterblöcke: der oberste steht auf Höhe des Fußbodens der nächsten Etage (so steigt man aus; Bewegungsmodell Ebene 1)
                  if (!m.frei(x, yk + h, z)) { ok = false; break; }
                  zellen.push([x, yk + h, z]);
                  if (m.block(x + wx, yk + h, z + wz)) continue; // feste Wand dahinter
                  if (h === etage - 1) continue; // in der Deckenschicht trägt die Decke selbst
                  if (m.frei(x + wx, yk + h, z + wz)) { stuetzen.push(h); zellen.push([x + wx, yk + h, z + wz]); } else ok = false; // freier Raum dahinter: ein Stützblock; sonst kein Halt
                }
                const loecher = zellen.filter(([, y]) => y === yk + etage - 1);
                // Austritt: vor der Leiter (zur Mitte hin) drei freie Zellen auf Geschosshöhe der nächsten Etage; über der Leiter bleibt die Spalte frei
                const ax = x + ix, az = z + iz;
                for (let h = 0; h < mind && ok; h++) { if (!m.frei(ax, yk + etage + h, az)) ok = false; zellen.push([ax, yk + etage + h, az]); }
                if (ok && !m.frei(x, yk + etage, z)) ok = false;
                if (ok && stoertVorraum(zellen)) ok = false; // nicht in den Raum hinter der Tür: eine andere Wand nehmen
                const bloecke = zellen.filter(([zx, zy, zz]) => (zx === x && zz === z) || stuetzen.some((hh) => zx === x + wx && zz === z + wz && zy === yk + hh)).map(([zx, zy, zz]) => key(zx, zy, zz));
                if (ok && bloecke.some((q) => belegtVorher.has(q))) ok = false;
                if (ok && vorige && vorige.x === x && vorige.z === z) ok = false;
                if (ok) {
                  const segment = (i0, i1) => ({ baustein: daten.baustein, parameter: { hoehe: i1 - i0 + 1, stuetzen: stuetzen.filter((h) => h >= i0 && h <= i1).map((h) => String(h - i0)) }, drehung: LEITER_DREHUNG[seite], ur: { x, y: yk + i0, z } });
                  flug = { zellen, loecher, segment, spalte: { x, z }, bloecke };
                }
              }
              if (flug) break;
            }
          }
          if (!flug) { wieso = wieso ?? `Etage ${k + 1} (Höhe ${yk} bis ${yk + etage}) hat dafür keinen Platz`; break; }
          if (!alleFrei(flug.zellen)) { wieso = `Etage ${k + 1} (Höhe ${yk} bis ${yk + etage}): der lichte Querschnitt ist dort zu schmal (höchstens ${Math.min(...Array.from({ length: etage + 1 }, (_, i) => m.ausdehnung(Math.min(yk + i, m.hoehe - 1))))} Blöcke breit)`; break; }
          if (k === 0 && stoertVorraum(flug.zellen)) { wieso = 'die Treppe würde den Raum hinter der Tür versperren'; break; }
          lauf.push({ ...flug, bloecke: flug.bloecke ?? [] });
        }
        if (lauf.length > beste.n || (lauf.length === beste.n && !beste.fluege.length)) beste = { n: lauf.length, fluege: lauf, grund: wieso };
      }
      return beste;
    }

    const ergebnisse = new Map(Object.entries(treppen.formen).map(([f, daten]) => [f, planeForm(daten.art, daten)]));
    const waehlbar = kandidaten.find((f) => ergebnisse.get(f).n >= 1);
    if (waehlbar === undefined) {
      const andere = [...ergebnisse.entries()].filter(([f, e]) => !kandidaten.includes(f) && e.n >= 1).map(([f, e]) => `${treppen.formen[f].titel} (${e.n} ${e.n === 1 ? 'Etage' : 'Etagen'})`);
      const grund = kandidaten.map((f) => `${treppen.formen[f].titel}: ${ergebnisse.get(f).grund ?? 'passt nicht'}`).join('; ');
      const ringMin = Math.min(...(treppen.formen.wendel?.radien ?? [1]));
      fehler('merkmale.treppe', `„${name}“: Mit ${wahl === 'auto' ? 'den Treppenformen von „auto“' : `der Treppenform „${wahl}“`} ist in diesem Turm keine einzige Etage möglich (${grund}). Die Wendeltreppe braucht einen freien Ring (Radius ${ringMin} oder mehr, also mindestens ${2 * ringMin + 1} Blöcke Querschnitt), die gerade Treppe einen Lauf von ${etage + 1} Blöcken Länge und zwei Spuren Breite. ${andere.length ? `Möglich wäre: ${andere.join(', ')}. ` : ''}Entweder den Turm größer machen, eine andere Treppenform wählen oder die Geschosse weglassen.`);
    }
    const daten = treppen.formen[waehlbar], gewaehlt = ergebnisse.get(waehlbar);
    const n = gewaehlt.n;

    // ---- Decken je Glied (mit Öffnungen), Kinder (je Etage und Glied ein Segment) ----
    const decken = new Map();
    for (let k = 0; k < n; k++) {
      const y = k * etage + etage - 1, g = gliedBei(y);
      const eintrag = decken.get(g.glied) ?? { anzahl: 0, erste: y - g.versatz.y, loecher: [] };
      eintrag.anzahl++;
      for (const [x, yy, z] of gewaehlt.fluege[k].loecher) eintrag.loecher.push(`${yy - g.versatz.y},${x},${z}`);
      decken.set(g.glied, eintrag);
    }
    const kinder = [], traegerGlieder = new Set();
    gewaehlt.fluege.forEach((flug, k) => {
      const anzahl = daten.art === 'leiter' ? etage + 1 : etage; // Zellen dieser Etage: Stufen bzw. Leiterblöcke
      let i0 = 0;
      while (i0 < anzahl) {
        const g = gliedBei(k * etage + i0);
        let i1 = i0;
        while (i1 + 1 < anzahl && gliedBei(k * etage + i1 + 1) === g) i1++;
        const seg = flug.segment(i0, i1), paket = ebene2.baue(seg.baustein, seg.parameter);
        const zone = ebene2.baue(g.baustein, { ...g.parameter, innenzone: 1 }).einbauzonen.find((z) => z.id === 'innenraum');
        const ziel = { x: zone.von.x + Math.floor((zone.bis.x - zone.von.x) / 2), y: zone.von.y, z: zone.von.z + Math.floor((zone.bis.z - zone.von.z) / 2) };
        const gedreht = huelleVon(paket.bloecke.map((b) => ({ ...dreheViertel(b, seg.drehung), y: b.y })));
        const ecke = { x: gedreht.von.x + Math.floor((gedreht.bis.x - gedreht.von.x) / 2), y: gedreht.von.y, z: gedreht.von.z + Math.floor((gedreht.bis.z - gedreht.von.z) / 2) };
        kinder.push({
          ref: `${praefix}.${daten.art === 'leiter' ? 'leiter' : 'treppe'}-${k + 1}-${g.glied}`, name: daten.art === 'leiter' ? 'Leiter' : 'Treppe', baustein: seg.baustein, parameter: seg.parameter, traeger: g.ref,
          einbau: { zone: 'innenraum', anker: 'mitte', versatz: { x: nf(seg.ur.x - ziel.x + ecke.x), y: seg.ur.y - g.versatz.y - ziel.y + ecke.y, z: nf(seg.ur.z - ziel.z + ecke.z) }, drehung: seg.drehung },
        });
        traegerGlieder.add(g.glied);
        i0 = i1 + 1;
      }
    });
    const hinweise = [`Geschosse: ${n} ${n === 1 ? 'Etage' : 'Etagen'} über dem Erdgeschoss (Fußboden der obersten Ebene auf Höhe ${n * etage}), erreichbar über ${daten.titel}.`];
    if (!daten.begehbar.includes('dorfbewohner')) hinweise.push('Die Leiter ist nur für den Spieler begehbar; Dorfbewohner und Baby kommen nicht hinauf.');
    hinweise.push('Die Begehbarkeit der Treppen und Leitern stützt sich auf eine Annahme aus Java (ungeprüft); der Spieltest steht aus.');
    return { n, form: waehlbar, art: daten.art, etage, decken, traegerGlieder, kinder, hinweise, obersteEbene: n * etage, begehbar: [...daten.begehbar] };
  }

  return { plane, masken };
}

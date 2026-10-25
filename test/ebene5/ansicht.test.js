import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matrix as M, kamera as K, baueNetz, ARTEN } from '../../src/ebene5/index.js';
import { beispiel, zufall } from './hilfe5.js';

const nahe = (a, b, eps = 1e-5, was = '') => assert.ok(Math.abs(a - b) < eps, `${was} ${a} ≠ ${b}`);

/** Plan aus Zellen {x, y, z, art?, abschnitt?}: eine Schicht je Höhe, Farbe je Abschnitt. */
function miniPlan(zellen) {
  const ids = [...new Set(zellen.map((c) => c.abschnitt ?? 0))].sort((a, b) => a - b);
  return {
    abschnitte: ids.map((id, ai) => {
      const meine = zellen.filter((c) => (c.abschnitt ?? 0) === id);
      const hoehen = [...new Set(meine.map((c) => c.y))].sort((a, b) => a - b);
      return {
        id: `a${id}`, legende: [{ farbe: ['#c83232', '#3232c8', '#32c832'][ai % 3], symbol: 'A', name: 'x', id: 'minecraft:stone' }],
        schichten: hoehen.map((y) => {
          const l = meine.filter((c) => c.y === y);
          return { y, n: l.length, x: Int32Array.from(l.map((c) => c.x)), z: Int32Array.from(l.map((c) => c.z)), b: new Uint16Array(l.length), r: new Uint8Array(l.length), t: Uint8Array.from(l.map((c) => c.art ?? 0)) };
        }),
      };
    }),
  };
}
const bruteForce = (zellen) => { const s = new Set(zellen.map((c) => `${c.x},${c.y},${c.z}`)); let n = 0; for (const c of zellen) for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (!s.has(`${c.x + dx},${c.y + dy},${c.z + dz}`)) n++; return n; };
const wuerfel = (n) => { const l = []; for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) l.push({ x, y, z }); return l; };

test('Ansicht: Matrizen und Kamera', () => {
  // Matrizen gegen von Hand gerechnete Werte
  assert.deepEqual([...M.multipliziere(M.identitaet(), M.identitaet())], [...M.identitaet()]);
  const verschiebung = Float32Array.of(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 7, 1);
  const skalierung = Float32Array.of(2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1);
  assert.deepEqual(M.transformiere(verschiebung, [1, 1, 1]), [6, 7, 8, 1]);
  assert.deepEqual(M.transformiere(M.multipliziere(verschiebung, skalierung), [1, 1, 1]), [7, 9, 11, 1], 'erst skalieren, dann verschieben');
  assert.deepEqual(M.transformiere(M.multipliziere(skalierung, verschiebung), [1, 1, 1]), [12, 21, 32, 1], 'erst verschieben, dann skalieren');
  // Ansicht: das Ziel liegt vor der Kamera in der Mitte, das Auge im Ursprung des Kamerasystems
  const a = M.blickAuf([0, 0, 10], [0, 0, 0], [0, 1, 0]);
  const imZiel = M.transformiere(a, [0, 0, 0]);
  nahe(imZiel[0], 0); nahe(imZiel[1], 0); nahe(imZiel[2], -10, 1e-5, 'Ziel 10 vor dem Auge');
  nahe(M.transformiere(a, [0, 0, 10])[2], 0, 1e-5, 'das Auge');
  assert.ok(M.transformiere(a, [1, 0, 0])[0] > 0, 'Osten ist rechts, wenn man nach Norden schaut');
  // Perspektive: Mitte bleibt Mitte, Punkt am Rand des Blickfelds liegt auf dem Bildrand
  const p = M.perspektive(Math.PI / 2, 2, 1, 100);
  nahe(M.zuNdc(p, [0, 0, -10]).x, 0); nahe(M.zuNdc(p, [0, 0, -10]).y, 0);
  nahe(M.zuNdc(p, [10, 0, -10]).x, 0.5, 1e-5, 'halbe Breite bei Seitenverhältnis 2');
  nahe(M.zuNdc(p, [0, 10, -10]).y, 1, 1e-5, 'oberer Bildrand bei 90° Öffnung');
  nahe(M.zuNdc(p, [0, 0, -1]).z, -1, 1e-5, 'nahe Ebene'); nahe(M.zuNdc(p, [0, 0, -100]).z, 1, 1e-4, 'ferne Ebene');
  assert.ok(M.zuNdc(p, [0, 0, 5]).w < 0, 'hinter der Kamera');

  // Orbit: Neigung ist begrenzt (kein Überschlag), Zoom ist begrenzt, 360° kehren zurück
  let k = K.neueKamera();
  k = K.drehen(k, 0, 100);
  assert.equal(k.neigung, K.NEIGUNG_MAX);
  k = K.drehen(k, 0, -1000);
  assert.equal(k.neigung, -K.NEIGUNG_MAX);
  assert.ok(Math.cos(K.NEIGUNG_MAX) > 0.05 && K.NEIGUNG_MAX < Math.PI / 2, 'die Grenze liegt vor dem Zenit: kein Überschlag, Kamera bleibt aufrecht');
  for (const grenze of [K.NEIGUNG_MAX, -K.NEIGUNG_MAX]) { const g = { ziel: [0, 0, 0], azimut: 0.3, neigung: grenze, abstand: 50 }; const e = K.auge(g); assert.ok(Math.hypot(e[0], e[2]) > 1, 'das Auge steht nie senkrecht über dem Ziel'); assert.ok(M.zuNdc(K.matrizen(g, 1).mvp, [0, 10, 0]).y > 0, 'oben bleibt oben'); }
  let r = K.neueKamera();
  for (let i = 0; i < 8; i++) r = K.drehen(r, Math.PI / 4, 0);
  nahe(r.azimut, K.neueKamera().azimut, 1e-9, '360° gedreht');
  for (let i = 0; i < 50; i++) r = K.zoomen(r, 0.5);
  assert.equal(r.abstand, 2);
  for (let i = 0; i < 80; i++) r = K.zoomen(r, 3);
  assert.equal(r.abstand, 20000);
  assert.equal(K.neueKamera().abstand, 60, 'die Funktionen verändern nichts am Original');
  // das Auge liegt im Abstand um das Ziel; Verschieben ändert nur das Ziel, nicht Abstand und Winkel
  const q = { ziel: [10, 5, -3], azimut: 1, neigung: 0.4, abstand: 50 };
  nahe(Math.hypot(...K.auge(q).map((v, i) => v - q.ziel[i])), 50, 1e-9, 'Abstand zum Ziel');
  const v = K.verschieben(q, 0.1, 0);
  assert.deepEqual([v.azimut, v.neigung, v.abstand], [q.azimut, q.neigung, q.abstand]);
  nahe(Math.hypot(...v.ziel.map((x, i) => x - q.ziel[i])), 0.1 * 2 * 50 * Math.tan(K.FOV / 2), 1e-9, 'Weg entspricht dem Bildanteil');
  // verschieben bewegt das Ziel in der Bildebene (senkrecht zur Blickrichtung)
  const blick = K.auge(q).map((x, i) => x - q.ziel[i]);
  const dv = v.ziel.map((x, i) => x - q.ziel[i]);
  nahe(blick.reduce((s, x, i) => s + x * dv[i], 0), 0, 1e-9, 'senkrecht zur Blickrichtung');

  // Einpassen: alle acht Ecken beliebiger Hüllvolumen liegen im Bild, bei vielen Größen, Seitenverhältnissen und Blickwinkeln
  const rnd = zufall(4711);
  for (let lauf = 0; lauf < 200; lauf++) {
    const von = [rnd() * 200 - 100, rnd() * 100 - 50, rnd() * 200 - 100];
    const bis = von.map((x) => x + 1 + rnd() * 300);
    const aspekt = 0.4 + rnd() * 2.6;
    let kam = { ziel: [0, 0, 0], azimut: rnd() * 6.28, neigung: (rnd() - 0.5) * 2.4, abstand: 10 };
    kam = K.einpassen(kam, { von, bis }, aspekt);
    const m = K.matrizen(kam, aspekt);
    for (const ex of [von[0], bis[0]]) for (const ey of [von[1], bis[1]]) for (const ez of [von[2], bis[2]]) {
      const n = M.zuNdc(m.mvp, [ex, ey, ez]);
      assert.ok(n.w > 0 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1 && Math.abs(n.z) <= 1, `Lauf ${lauf}: Ecke ${ex},${ey},${ez} → ${n.x.toFixed(2)}, ${n.y.toFixed(2)}`);
    }
    nahe(kam.ziel[0], (von[0] + bis[0]) / 2, 1e-9);
  }
});

test('Ansicht: Netz nur aus sichtbaren Flächen', async () => {
  // einfache Körper
  const flaechen = (zellen, sicht) => baueNetz(miniPlan(zellen), sicht).flaechen;
  assert.equal(flaechen([{ x: 0, y: 0, z: 0 }]), 6);
  assert.equal(flaechen([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }]), 10);
  assert.equal(flaechen(wuerfel(3)), 54);
  assert.equal(flaechen(wuerfel(3).filter((c) => !(c.x === 1 && c.y === 1 && c.z === 1))), 54 + 6, 'hohl: innen kommen die Flächen des Hohlraums dazu');
  assert.equal(flaechen(wuerfel(3).filter((c) => !(c.x === 1 && c.y === 1 && c.z === 1)), { ausgeblendet: [] }), 60);
  assert.equal(flaechen(Array.from({ length: 9 }, (_, i) => ({ x: i % 3, y: 0, z: Math.floor(i / 3) }))), 9 * 2 + 12, 'Ebene 3×3: oben, unten, vier Ränder');
  assert.equal(baueNetz(miniPlan([])).flaechen, 0);
  // Zahl der Flächen = Zählung Zelle × Richtung ohne Nachbar, bei zufälligen Zellmengen
  const rnd = zufall(31337);
  for (let lauf = 0; lauf < 40; lauf++) {
    const set = new Map();
    for (let i = 0; i < 20 + Math.floor(rnd() * 200); i++) { const c = { x: Math.floor(rnd() * 8) - 4, y: Math.floor(rnd() * 6), z: Math.floor(rnd() * 8) - 4 }; set.set(`${c.x},${c.y},${c.z}`, c); }
    const zellen = [...set.values()];
    const netz = baueNetz(miniPlan(zellen));
    assert.equal(netz.flaechen, bruteForce(zellen), `Lauf ${lauf}`);
    assert.equal(netz.bloecke, zellen.length);
    assert.equal(netz.positionen.length, netz.flaechen * 12);
    assert.equal(netz.indizes.length, netz.flaechen * 6);
    assert.equal(netz.farben.length, netz.flaechen * 12);
  }

  // jedes Dreieck zeigt nach außen und liegt auf dem Rand genau eines Würfels
  const pruefeAussen = (netz, zellen) => {
    const p = netz.positionen, ix = netz.indizes;
    for (let t = 0; t < ix.length; t += 3) {
      const a = [0, 1, 2].map((k) => p[ix[t] * 3 + k]), b = [0, 1, 2].map((k) => p[ix[t + 1] * 3 + k]), c = [0, 1, 2].map((k) => p[ix[t + 2] * 3 + k]);
      const u = b.map((x, i) => x - a[i]), w = c.map((x, i) => x - a[i]);
      const normale = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const mitte = [0, 1, 2].map((i) => (a[i] + b[i] + c[i]) / 3);
      // Würfel, zu dem das Dreieck gehört: der, dessen Mitte der Fläche am nächsten liegt (± 0,5 in der Normalen)
      const n = normale.map((x) => Math.sign(Math.round(x * 1000) / 1000));
      assert.equal(n.filter((x) => x !== 0).length, 1, 'Normale zeigt genau auf eine Achse');
      const achse = n.findIndex((x) => x !== 0);
      const zelle = zellen.find((z) => { const m = [z.x + 0.5, z.y + 0.5, z.z + 0.5]; return [0, 1, 2].every((i) => (i === achse ? Math.abs(mitte[i] - (m[i] + 0.5 * n[i])) < 1e-6 : Math.abs(mitte[i] - m[i]) <= 0.5 + 1e-6)); });
      assert.ok(zelle, `Dreieck gehört zu keinem Würfel (Mitte ${mitte})`);
    }
  };
  const klein = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 0, y: 0, z: 2 }];
  pruefeAussen(baueNetz(miniPlan(klein)), klein);
  pruefeAussen(baueNetz(miniPlan(wuerfel(3))), wuerfel(3));

  // Etagenschnitt: Säule aus 5, Schnitt bei Höhe 2 → Säule aus 3 (4 Seiten × 3 + oben + unten = 14)
  const saeule = Array.from({ length: 5 }, (_, y) => ({ x: 0, y, z: 0 }));
  assert.equal(flaechen(saeule), 4 * 5 + 2);
  assert.equal(flaechen(saeule, { maxY: 2 }), 14);
  assert.equal(flaechen(saeule, { maxY: -1 }), 0);
  assert.deepEqual(baueNetz(miniPlan(saeule), { maxY: 2 }).huelle, { von: [0, 0, 0], bis: [1, 3, 1] });
  // Technik ausblenden: die Flächen der Nachbarn zum Technikblock werden frei, die des Technikblocks entfallen
  const mitTechnik = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0, art: 2 }, { x: 2, y: 0, z: 0 }];
  assert.equal(flaechen(mitTechnik), 4 * 3 + 2);
  assert.equal(flaechen(mitTechnik, { ausgeblendet: [2] }), 12, 'zwei einzelne Würfel');
  assert.equal(flaechen(mitTechnik, { ausgeblendet: [3] }), 14, 'Verbindungen ausblenden trifft die Technik nicht');
  assert.deepEqual(ARTEN, ['form', 'bauelement', 'technik', 'verbindung']);
  // Abschnittsfilter: alle, nur der gewählte, bis einschließlich
  const drei = [{ x: 0, y: 0, z: 0, abschnitt: 0 }, { x: 5, y: 0, z: 0, abschnitt: 1 }, { x: 9, y: 0, z: 0, abschnitt: 2 }];
  assert.deepEqual(['alle', 'nur', 'bis'].map((m) => baueNetz(miniPlan(drei), { abschnitte: m, gewaehlt: 1 }).bloecke), [3, 1, 2]);
  assert.equal(baueNetz(miniPlan(drei), { abschnitte: 'bis', gewaehlt: 0 }).bloecke, 1);
  assert.equal(baueNetz(miniPlan(drei), { abschnitte: 'nur', gewaehlt: 2 }).bloecke, 1);

  // Farben: Flächenschattierung (oben hell, unten dunkel), Fortschritt und Hervorhebung ändern die Farbe
  const eins = baueNetz(miniPlan([{ x: 0, y: 0, z: 0 }]));
  const farbeOben = [...eins.farben.slice(0, 12)]; // erste Fläche je nach Reihenfolge; Helligkeiten der sechs Flächen vergleichen
  const helligkeit = (netz) => { const l = []; for (let f = 0; f < netz.flaechen; f++) l.push(netz.farben[f * 12]); return l.sort((a, b) => a - b); };
  assert.deepEqual(helligkeit(eins), [Math.round(200 * 0.5), Math.round(200 * 0.65), Math.round(200 * 0.65), Math.round(200 * 0.8), Math.round(200 * 0.8), 200]);
  assert.ok(farbeOben.length === 12);
  const grundFarbe = (sicht) => helligkeit(baueNetz(miniPlan([{ x: 0, y: 0, z: 0 }]), sicht)).at(-1);
  const gruenKanal = (sicht) => { const n = baueNetz(miniPlan([{ x: 0, y: 0, z: 0 }]), sicht); return Math.max(...Array.from({ length: n.flaechen }, (_, f) => n.farben[f * 12 + 1])); };
  assert.equal(grundFarbe({}), 200);
  assert.ok(gruenKanal({ fortschritt: () => 1 }) > gruenKanal({}), 'fertige Schichten sind grünlich');
  assert.ok(grundFarbe({ fortschritt: () => 2 }) < 200 || gruenKanal({ fortschritt: () => 2 }) > gruenKanal({}), 'die aktuelle Schicht ist heller');
  assert.ok(gruenKanal({ fortschritt: () => 2 }) > gruenKanal({ fortschritt: () => 1 }));
  assert.equal(grundFarbe({ hervorheben: true, gewaehlt: 0 }), 200, 'der gewählte Abschnitt bleibt');
  const zweiFarben = miniPlan([{ x: 0, y: 0, z: 0, abschnitt: 0 }, { x: 4, y: 0, z: 0, abschnitt: 1 }]);
  const gedimmt = baueNetz(zweiFarben, { hervorheben: true, gewaehlt: 0 }), normal = baueNetz(zweiFarben, {});
  const summe = (n) => n.farben.reduce((s, x) => s + x, 0);
  assert.ok(summe(gedimmt) < summe(normal), 'der andere Abschnitt wird gedimmt');
  assert.equal(baueNetz(zweiFarben, { hervorheben: true, gewaehlt: 0, abschnitte: 'nur' }).bloecke, 1);
  // Fortschritt wird je Abschnitt und Schicht erfragt
  const gefragt = [];
  baueNetz(miniPlan(saeule), { fortschritt: (a, s) => { gefragt.push([a, s]); return 0; } });
  assert.deepEqual(gefragt, [0, 1, 2, 3, 4].map((s) => [0, s]));

  // das Beispielprojekt: Flächenzahl wie die Zählung, nach außen, schnell, deterministisch, Filter wirken
  const { plan } = await beispiel();
  const alle = []; plan.abschnitte.forEach((a) => a.schichten.forEach((s) => { for (let i = 0; i < s.n; i++) alle.push({ x: s.x[i], y: s.y, z: s.z[i] }); }));
  const t0 = Date.now();
  const netz = baueNetz(plan);
  assert.ok(Date.now() - t0 < 1000, `Netz in ${Date.now() - t0} ms`);
  assert.equal(netz.bloecke, plan.bloecke);
  assert.equal(netz.flaechen, bruteForce(alle));
  pruefeAussen(netz, alle);
  assert.deepEqual([...baueNetz(plan).positionen.slice(0, 600)], [...netz.positionen.slice(0, 600)], 'deterministisch');
  const technik = plan.abschnitte.flatMap((a) => a.schichten).reduce((s, sc) => s + sc.t.filter((x) => x === 2).length, 0);
  assert.ok(technik > 0, 'das Beispiel hat Technik (Lager, Nischen)');
  assert.equal(baueNetz(plan, { ausgeblendet: [2] }).bloecke, plan.bloecke - technik);
  const verb = plan.abschnitte.flatMap((a) => a.schichten).reduce((s, sc) => s + sc.t.filter((x) => x === 3).length, 0);
  assert.equal(baueNetz(plan, { ausgeblendet: [2, 3] }).bloecke, plan.bloecke - technik - verb);
  assert.ok(baueNetz(plan, { maxY: 0 }).bloecke < plan.bloecke);
  assert.equal(baueNetz(plan, { abschnitte: 'nur', gewaehlt: 1 }).bloecke, plan.abschnitte[1].bloecke);
});

test('Ansicht: Art des Teils im Bauplan stimmt mit dem Entwurf überein', async () => {
  const { plan, entwurf, e } = await beispiel();
  const mat = e.ebene3.materialisiere(entwurf);
  const nachArt = [0, 0, 0, 0];
  for (const t of entwurf.teile) for (const k of mat.teile.get(t.id).schluessel) {
    const [x, y, z] = k.split(',').map(Number);
    if (mat.welt.leseBlock(x, y, z).id !== 'minecraft:air') nachArt[Math.max(0, ARTEN.indexOf(t.art))]++;
  }
  const imPlan = [0, 0, 0, 0];
  for (const a of plan.abschnitte) for (const s of a.schichten) for (const x of s.t) imPlan[x]++;
  assert.deepEqual(imPlan, nachArt);
  assert.ok(imPlan[2] > 0 && imPlan[3] > 0, 'Technik und Verbindungen kommen im Beispiel vor');
  assert.equal(imPlan.reduce((s, n) => s + n, 0), plan.bloecke);
});

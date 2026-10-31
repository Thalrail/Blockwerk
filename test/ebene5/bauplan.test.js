import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ladeEngine, umrechnen, umrechnungsText, erzeugeDarstellung } from '../../src/ebene5/index.js';
import { ebene4 } from '../hilfe.js';
import { engine, beispiel, holeJson, regeldateien, alsText } from './hilfe5.js';

test('Daten-Lader: die Engine entsteht per fetch wie unter Node', async () => {
  const geholt = [];
  const e = await ladeEngine(async (pfad) => { geholt.push(pfad); return holeJson(pfad); });
  const t = ebene4();
  assert.equal(e.ebene0.register.bloecke.ids().length, t.ebene0.register.bloecke.ids().length);
  assert.equal(e.ebene1.regelwerk.alle().length, t.ebene1.regelwerk.alle().length);
  assert.deepEqual([...e.ebene2.bausteine.keys()], [...t.ebene2.bausteine.keys()]);
  assert.ok(e.ebene4.baue && e.ebene3.ablauf.starte, 'Ebene 3 und 4 sind vollständig');
  // die Liste der Regeldateien stimmt mit dem Ordner überein (sonst fehlen im Browser Regeln)
  assert.deepEqual(await holeJson('data/regeldateien.json'), await regeldateien());
  assert.ok(geholt.includes('data/bloecke.json') && geholt.includes('data/regeln/planung.json'));
  // fehlt eine Datei, kommt der Fehler an (die Oberfläche zeigt ihn)
  await assert.rejects(() => ladeEngine(async (pfad) => { if (pfad.includes('wesen')) throw new Error(`${pfad} konnte nicht geladen werden (404)`); return holeJson(pfad); }), /wesen\.json konnte nicht geladen werden/);
  // dieselbe Spezifikation ergibt hier denselben Entwurf wie mit den Node-Ladern
  const b = await beispiel();
  const mitNode = t.baue(b.spezifikation);
  assert.equal(alsText(mitNode.entwurf), alsText(b.entwurf));
});

test('Bauplan: Schichten, Legende und Summen', async () => {
  const { entwurf, plan, e, spezifikation } = await beispiel();
  assert.equal(plan.projekt.name, 'Zitadelle (klein)');
  // nichts verloren, nichts doppelt: alle Blöcke der Welt stehen genau einmal im Plan
  const welt = e.ebene3.materialisiere(entwurf).welt;
  assert.equal(plan.bloecke, welt.anzahlBloecke());
  assert.equal(Object.values(plan.summe).reduce((s, n) => s + n, 0), plan.bloecke);
  const gesehen = new Set();
  for (const a of plan.abschnitte) for (const s of a.schichten) for (let i = 0; i < s.n; i++) {
    const k = `${s.x[i]},${s.y},${s.z[i]}`;
    assert.equal(gesehen.has(k), false, `Zelle ${k} doppelt`);
    gesehen.add(k);
    assert.equal(welt.leseBlock(s.x[i], s.y, s.z[i]).id, a.legende[s.b[i]].id);
  }
  assert.equal(gesehen.size, plan.bloecke);
  // Bau-Reihenfolge des Konstrukteurs (Keller vor dem Turm, Turm vor der Halle)
  assert.deepEqual(plan.abschnitte.map((a) => a.id), ['lagerkeller', 'zentralturm', 'markthalle']);
  assert.deepEqual(plan.abschnitte.map((a) => a.id), [...entwurf.abschnitte].sort((p, q) => p.reihenfolge - q.reihenfolge).map((a) => a.id));
  for (const a of plan.abschnitte) {
    // Schichten von unten nach oben, Zellen zeilenweise, Summen und Legende stimmen
    assert.deepEqual(a.schichten.map((s) => s.y), [...a.schichten.map((s) => s.y)].sort((p, q) => p - q));
    assert.equal(new Set(a.schichten.map((s) => s.y)).size, a.schichten.length);
    assert.equal(new Set(a.legende.map((l) => l.symbol)).size, a.legende.length, 'Symbole eindeutig');
    assert.deepEqual(a.legende.map((l) => l.anzahl), [...a.legende.map((l) => l.anzahl)].sort((p, q) => q - p), 'häufigste Blöcke zuerst');
    for (const s of a.schichten) {
      assert.equal(Object.values(s.summe).reduce((m, n) => m + n, 0), s.n);
      for (let i = 1; i < s.n; i++) assert.ok(s.z[i] > s.z[i - 1] || (s.z[i] === s.z[i - 1] && s.x[i] > s.x[i - 1]), 'Zellen zeilenweise');
      assert.ok(s.x.every((x) => x >= s.bereich.x0 && x <= s.bereich.x1) && s.z.every((zz) => zz >= s.bereich.z0 && zz <= s.bereich.z1));
      assert.match(s.abdruck, /^[0-9a-f]{8}$/);
    }
    assert.equal(a.bloecke, a.schichten.reduce((m, s) => m + s.n, 0));
    for (const l of a.legende) assert.equal(l.anzahl, a.schichten.reduce((m, s) => m + (s.summe[l.id] ?? 0), 0));
  }
  // der Abdruck gehört zum Inhalt: eine andere Fassung ergibt für unveränderte Schichten denselben Abdruck, für geänderte einen anderen
  const hoeher = e.ebene4.neueVersion(spezifikation, (s) => { s.teile[0].form.groesse.hoehe = 44; delete s.teile[0].form.proportionen; });
  const frei = e.ebene4.freigeben(hoeher);
  const neu = e.e5.bauplan(e.ebene4.baue(frei).entwurf);
  const abdruecke = (p, id) => p.abschnitte.find((a) => a.id === id).schichten.map((s) => `${s.y}:${s.abdruck}`);
  assert.deepEqual(abdruecke(neu, 'lagerkeller'), abdruecke(plan, 'lagerkeller'), 'der Keller ist unverändert, seine Schichten auch');
  assert.notDeepEqual(abdruecke(neu, 'zentralturm'), abdruecke(plan, 'zentralturm'));
  assert.deepEqual(abdruecke(neu, 'zentralturm').slice(0, 41), abdruecke(plan, 'zentralturm'), 'die ersten Schichten des höheren Turms sind gleich geblieben');
  // anderes Material an gleicher Stelle: gleiche Zellen, aber jede Schicht des Turms hat einen anderen Abdruck
  const anders = e.ebene4.freigeben(e.ebene4.neueVersion(spezifikation, (x) => { x.teile[0].stil.stimmung = 'hell-nordisch'; }));
  const planAnders = e.e5.bauplan(e.ebene4.baue(anders).entwurf);
  const turmAlt = abdruecke(plan, 'zentralturm'), turmAnders = abdruecke(planAnders, 'zentralturm');
  assert.equal(turmAnders.length, turmAlt.length);
  turmAlt.forEach((x, i) => assert.notEqual(x, turmAnders[i], `Schicht ${i}`));
  // die Bau-Reihenfolge kommt aus der Nummer des Konstrukteurs, nicht aus der Lage in der Liste (nach einer Aktualisierung steht Neues hinten)
  const durcheinander = structuredClone(entwurf);
  durcheinander.abschnitte.reverse();
  assert.deepEqual(e.e5.bauplan(durcheinander).abschnitte.map((x) => x.id), ['lagerkeller', 'zentralturm', 'markthalle']);
  // deterministisch
  assert.equal(alsText(e.e5.bauplan(entwurf)), alsText(plan));
  // Dorfbewohner stehen bei der Halle, nicht als Block
  assert.equal(plan.abschnitte[2].wesen.length, 6);
  assert.ok(plan.abschnitte[2].wesen.every((w) => w.id.includes('villager')));
  assert.equal(plan.abschnitte[0].wesen.length + plan.abschnitte[1].wesen.length, 0);
  // Behälter mit Inhalt (Filtertrichter im Lager) werden mitgeführt
  const inhalte = plan.abschnitte[0].schichten.flatMap((s) => s.inhalte);
  assert.ok(inhalte.length >= 3 && inhalte.every((i) => i.inhalt.length > 0));
});

test('Bauplan: Blickrichtungen drehen mit dem Bauteil', async () => {
  const { e } = await beispiel();
  const t = e.ebene3;
  // ein Entwurf mit einer Treppe, in vier Drehungen
  const { neuerEntwurf } = await import('../../src/ebene3/index.js');
  const richtungen = (drehung) => {
    let en = t.konstrukteur.gliedere(neuerEntwurf({ name: 'Treppe' }), [{ id: 'a', name: 'A', huelle: { von: { x: -20, y: -2, z: -20 }, bis: { x: 20, y: 20, z: 20 } } }]);
    en = t.designer.setzePalette(en, 'glanz'); // ein Bauplan braucht eine vollständige Palette (kein stilles Testmaterial)
    en = t.aendere(en, 'architekt', { art: 'setze-teil', teil: { abschnitt: 'a', baustein: 'bau.treppe', parameter: { stufen: 4, breite: 3 }, lage: { x: 0, y: 0, z: 0, drehung } } }).entwurf;
    const p = e.e5.bauplan(en);
    const gezaehlt = {};
    for (const s of p.abschnitte[0].schichten) for (let i = 0; i < s.n; i++) if (s.r[i]) gezaehlt[s.r[i]] = (gezaehlt[s.r[i]] ?? 0) + 1;
    return gezaehlt;
  };
  const basis = richtungen(0);
  assert.ok(Object.keys(basis).length >= 1, 'die Treppenstufen haben eine Blickrichtung');
  for (let d = 1; d < 4; d++) {
    const erwartet = {};
    for (const [r, n] of Object.entries(basis)) { const rr = Number(r); const v = rr <= 4 ? ((rr - 1 + d) % 4) + 1 : rr; erwartet[v] = n; }
    assert.deepEqual(richtungen(d), erwartet, `Drehung ${d * 90}°`);
  }
});

test('Material: Kisten, Stacks und Reste', async () => {
  // Grenzfälle der Umrechnung (Stapel 64, 16 und 1; Kiste = 27 Plätze)
  assert.deepEqual(umrechnen(0, 64), { kisten: 0, stacks: 0, rest: 0, stacksGesamt: 0 });
  assert.deepEqual(umrechnen(63, 64), { kisten: 0, stacks: 0, rest: 63, stacksGesamt: 0 });
  assert.deepEqual(umrechnen(64, 64), { kisten: 0, stacks: 1, rest: 0, stacksGesamt: 1 });
  assert.deepEqual(umrechnen(65, 64), { kisten: 0, stacks: 1, rest: 1, stacksGesamt: 1 });
  assert.deepEqual(umrechnen(27 * 64, 64), { kisten: 1, stacks: 0, rest: 0, stacksGesamt: 27 });
  assert.deepEqual(umrechnen(27 * 64 + 1, 64), { kisten: 1, stacks: 0, rest: 1, stacksGesamt: 27 });
  assert.deepEqual(umrechnen(2 * 27 * 64 + 5 * 64 + 12, 64), { kisten: 2, stacks: 5, rest: 12, stacksGesamt: 59 });
  assert.deepEqual(umrechnen(16, 16), { kisten: 0, stacks: 1, rest: 0, stacksGesamt: 1 });
  assert.deepEqual(umrechnen(27 * 16 + 15, 16), { kisten: 1, stacks: 0, rest: 15, stacksGesamt: 27 });
  assert.deepEqual(umrechnen(27, 1), { kisten: 1, stacks: 0, rest: 0, stacksGesamt: 27 });
  assert.deepEqual(umrechnen(28, 1), { kisten: 1, stacks: 1, rest: 0, stacksGesamt: 28 });
  assert.equal(umrechnungsText(0, 64), '0');
  assert.equal(umrechnungsText(1, 64), '1');
  assert.equal(umrechnungsText(64, 64), '1 Stack');
  assert.equal(umrechnungsText(2 * 27 * 64 + 5 * 64 + 12, 64), '2 Kisten + 5 Stacks + 12');
  assert.equal(umrechnungsText(27 * 64 + 64, 64), '1 Kiste + 1 Stack');

  // die Materialliste des Beispiels stimmt mit dem Plan überein
  const { plan, e } = await beispiel();
  const m = e.e5.material(plan);
  assert.equal(m.gesamt.reduce((s, x) => s + x.anzahl, 0), plan.bloecke);
  assert.deepEqual(m.gesamt.map((x) => x.anzahl), [...m.gesamt.map((x) => x.anzahl)].sort((p, q) => q - p));
  for (const x of m.gesamt) assert.equal(x.text, umrechnungsText(x.anzahl, e.ebene0.register.stapel(x.id)));
  m.abschnitte.forEach((a, i) => {
    assert.equal(a.liste.reduce((s, x) => s + x.anzahl, 0), plan.abschnitte[i].bloecke);
    for (const s of a.schichten) assert.equal(s.liste.reduce((q, x) => q + x.anzahl, 0), plan.abschnitte[i].schichten.find((p) => p.y === s.y).n);
  });
  // Behälterinhalte (Füller im Filtertrichter) stehen getrennt, mit den Mengen aus der Welt
  const welt = e.ebene3.materialisiere((await beispiel()).entwurf).welt;
  let ausWelt = 0;
  for (const b of welt.alleBloecke()) for (const g of b.inhalt ?? []) ausWelt += g.anzahl;
  assert.equal(m.abschnitte.flatMap((a) => a.inhalte).reduce((s, x) => s + x.anzahl, 0), ausWelt);
  assert.ok(ausWelt > 0);
});

test('Darstellung: Farbe und Name für jeden Block, Ersatz ist markiert', async () => {
  const { plan, e } = await beispiel();
  const ids = Object.keys(plan.summe);
  const ersatz = ids.filter((id) => e.e5.darstellung.block(id).ersatz);
  assert.deepEqual(ersatz, [], `Blöcke des Beispiels ohne Farbzuordnung: ${ersatz.join(', ')}`);
  for (const id of ids) {
    const b = e.e5.darstellung.block(id);
    assert.match(b.farbe, /^#[0-9a-f]{6}$/);
    assert.ok(b.name.length > 2);
  }
  const d = erzeugeDarstellung(e.darstellungsdaten);
  // spezifische Regeln gehen vor allgemeinen
  assert.equal(d.block('minecraft:dark_oak_planks').farbe, '#42301a');
  assert.equal(d.block('minecraft:oak_planks').farbe, '#a2824f');
  assert.equal(d.block('minecraft:light_blue_wool').farbe, '#3aafd9');
  assert.equal(d.block('minecraft:blue_wool').farbe, '#35399d');
  assert.equal(d.block('minecraft:polished_blackstone').farbe, '#35323b');
  assert.equal(d.block('minecraft:stone_bricks').name, 'Steinziegel');
  assert.equal(d.block('minecraft:acacia_button').name, 'Acacia Button', 'ohne deutschen Namen: lesbarer Block-Name');
  // unbekannte Blöcke: deterministische Ersatzfarbe, deutlich markiert
  const u = d.block('minecraft:zzz_unbekannt');
  assert.equal(u.ersatz, true);
  assert.match(u.farbe, /^#[0-9a-f]{6}$/);
  assert.equal(d.block('minecraft:zzz_unbekannt').farbe, erzeugeDarstellung(e.darstellungsdaten).block('minecraft:zzz_unbekannt').farbe);
  assert.notEqual(d.block('minecraft:zzz_anders').farbe, u.farbe);
  assert.equal(d.block('minecraft:stone').ersatz, false);
  // Farben der Daten sind alle gültig, jede Regel ist ein gültiger Ausdruck
  for (const r of e.darstellungsdaten.farben) { assert.match(r.farbe, /^#[0-9a-f]{6}$/); assert.doesNotThrow(() => new RegExp(r.muster)); }
  // alle Blöcke der Palette-Stimmungen haben eine Zuordnung
  const stimmungen = e.ebene1.regelwerk.parameter('plan.palette', 'stimmungen');
  for (const p of Object.values(stimmungen)) for (const w of Object.values(p)) for (const eintrag of typeof w === 'string' ? [w] : (w.id ? [w.id] : Object.values(w).map((x) => x.id ?? x))) assert.equal(d.block(eintrag).ersatz, false, eintrag);
});

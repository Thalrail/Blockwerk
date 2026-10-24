// Ebene 1 – Prüfer: findet Verstöße gegen die Regeln und meldet sie maschinenlesbar mit Koordinate.
// Meldung: { regel, ort: {x,y,z}, schwere: 'verstoss' | 'hinweis', meldung }.
//   'verstoss' = in Bedrock falsch (fehlender Block oder Block, der nachweislich nicht hält),
//   'hinweis'  = unklar (Eigenschaft in Ebene 0 unbekannt oder Zustand nicht angegeben).
// Was ein Block trägt (fackelOben, fackelSeiten, schiene), ist ein Fakt aus Ebene 0; der Prüfer wendet ihn nur an.
// Der Prüfer liest die Welt nur über Ebene 0 und ändert sie nie.
import { GEGENRICHTUNG, VEKTOR } from '../ebene0/richtungen.js';
import { LUFT } from '../ebene0/blockregister.js';

const SEITEN = { west: 'west', east: 'east', north: 'north', south: 'south', top: 'down' };

function sortiert(liste) {
  return liste.sort((a, b) => a.ort.y - b.ort.y || a.ort.z - b.ort.z || a.ort.x - b.ort.x || (a.regel < b.regel ? -1 : a.regel > b.regel ? 1 : 0));
}

/** Urteil über den Block, an/auf dem etwas hängt: 'ok' | 'nein' (hält nachweislich nicht) | 'fehlt' (Luft) | 'unklar'. */
function haltUrteil(art, block, register, richtungVon, zurFackel) {
  if (block.id === LUFT) return 'fehlt';
  const e = register.bloecke.block(block.id).eigenschaften;
  if (art === 'schiene') {
    if (e.schiene === true) return 'ok';
    if (e.schiene === false) return 'nein';
    if (e.schiene === 'wenn-oben') {
      // Halbstufe: obere Hälfte, Treppe: kopfstehend. Die normale Lage trägt nachweislich nicht, die umgekehrte schon
      // (Spieltests Jonah, 20./21.10.2026).
      const oben = block.zustand['minecraft:vertical_half'] ?? (block.zustand.upside_down_bit === undefined ? undefined : block.zustand.upside_down_bit ? 'top' : 'bottom');
      return oben === undefined ? 'unklar' : oben === 'top' ? 'ok' : 'nein';
    }
    return 'unklar';
  }
  if (art === 'fackel-oben') {
    if (e.fackelOben === true) return 'ok';
    if (e.fackelOben === false) return 'nein';
    if (e.fackelOben === 'obere-haelfte') {
      const h = block.zustand['minecraft:vertical_half'];
      return h === undefined ? 'unklar' : h === 'top' ? 'ok' : 'nein';
    }
    return 'unklar';
  }
  // fackel-seite: zurFackel = Richtung vom Haltblock zur Fackel
  if (e.fackelSeiten === 'alle') return 'ok';
  if (e.fackelSeiten === 'keine') return 'nein';
  if (e.fackelSeiten === 'grosse-seite') {
    const w = block.zustand.weirdo_direction;
    if (w === undefined) return 'unklar';
    return richtungVon('weirdo_direction', w) === zurFackel ? 'ok' : 'nein';
  }
  return 'unklar';
}

function pruefeHalt(welt, register, richtungVon, bloecke) {
  const hatZustand = (id, name) => Object.hasOwn(register.bloecke.block(id).zustaende, name);
  const fackeln = new Set(register.bloecke.ids().filter((id) => hatZustand(id, 'torch_facing_direction')));
  const schienen = new Set(register.bloecke.ids().filter((id) => hatZustand(id, 'rail_direction')));
  const meldungen = [];
  const melde = (regel, ort, schwere, meldung) => meldungen.push({ regel, ort, schwere, meldung });
  for (const b of bloecke) {
    const ort = { x: b.x, y: b.y, z: b.z };
    if (fackeln.has(b.id)) {
      const seite = b.zustand.torch_facing_direction;
      const richtung = SEITEN[seite];
      if (!richtung) {
        melde('pruefer.braucht-halt-fackel', ort, 'hinweis', `${b.id}: Haltseite ist nicht angegeben (${seite ?? 'kein Zustand'})`);
        continue;
      }
      const v = VEKTOR[richtung];
      const halt = welt.leseBlock(b.x + v.x, b.y + v.y, b.z + v.z);
      const art = seite === 'top' ? 'fackel-oben' : 'fackel-seite';
      const urteil = haltUrteil(art, halt, register, richtungVon, GEGENRICHTUNG[richtung]);
      if (urteil === 'fehlt') melde('pruefer.braucht-halt-fackel', ort, 'verstoss', `${b.id} ohne Haltblock (${seite}): sie springt ab`);
      else if (urteil === 'nein') melde('pruefer.braucht-halt-fackel', ort, 'verstoss', `${b.id}: ${halt.id} hält keine Fackel (${seite}): sie springt ab`);
      else if (urteil === 'unklar') melde('pruefer.braucht-halt-fackel', ort, 'hinweis', `${b.id}: ob ${halt.id} die Fackel hält (${seite}), ist noch nicht belegt – im Spiel prüfen`);
    } else if (schienen.has(b.id)) {
      const halt = welt.leseBlock(b.x, b.y - 1, b.z);
      const urteil = haltUrteil('schiene', halt, register, richtungVon, null);
      if (urteil === 'fehlt') melde('pruefer.braucht-halt-schiene', ort, 'verstoss', `${b.id} ohne Boden: sie springt ab`);
      else if (urteil === 'nein') melde('pruefer.braucht-halt-schiene', ort, 'verstoss', `${b.id}: ${halt.id} trägt keine Schiene: sie springt ab`);
      else if (urteil === 'unklar') melde('pruefer.braucht-halt-schiene', ort, 'hinweis', `${b.id}: ob ${halt.id} die Schiene trägt, ist noch nicht belegt – im Spiel prüfen`);
    }
  }
  return meldungen;
}

/** Antriebsschienen, die von keiner Stromquelle in Reichweite erreicht werden. */
function pruefeAntrieb(welt, antrieb, stromQuellen, bloecke) {
  const aktiv = antrieb.aktive(welt, stromQuellen);
  return bloecke
    .filter((b) => antrieb.istAntriebsschiene(b.id) && !aktiv.has(`${b.x},${b.y},${b.z}`))
    .map((b) => ({
      regel: 'pruefer.antrieb-ohne-quelle',
      ort: { x: b.x, y: b.y, z: b.z },
      schwere: 'hinweis',
      meldung: `${b.id} wird von keiner Stromquelle erreicht (höchstens ${antrieb.reichweite} Schienen von einer versorgten Antriebsschiene entfernt): sie bleibt unbestromt und bremst die Lore`,
    }));
}

/** Lässt vorhandenes Wasser/Lava in einer Kopie fließen und meldet, was zerstört oder gemischt wird. */
function pruefeFluessigkeit(welt, fluessigkeit, maxTicks) {
  if (!fluessigkeit.enthaeltFluessigkeit(welt)) return [];
  const lauf = fluessigkeit.simuliere(welt, { maxTicks });
  const meldungen = [];
  const erster = welt.alleBloecke().find((x) => fluessigkeit.artVon(x.id));
  const ersterOrt = { x: erster.x, y: erster.y, z: erster.z };
  for (const e of lauf.ereignisse) {
    if (e.was === 'weggespuelt') meldungen.push({ regel: 'pruefer.wasser-zerstoert', ort: e.pos, schwere: 'verstoss', meldung: `${e.von} wird von ${e.art === 'wasser' ? 'Wasser' : 'Lava'} weggespült` });
    else if (e.was === 'gemischt') meldungen.push({ regel: 'pruefer.wasser-zerstoert', ort: e.pos, schwere: 'hinweis', meldung: `Wasser und Lava mischen sich bei diesem Block: ${e.von} wird zu ${e.nach}` });
  }
  if (!lauf.stabil) meldungen.push({ regel: 'pruefer.wasser-zerstoert', ort: ersterOrt, schwere: 'hinweis', meldung: `Die Flüssigkeit war nach ${maxTicks} Ticks noch in Bewegung; die Meldungen sind unvollständig` });
  return meldungen;
}

/** Lässt fallende Blöcke in einer Kopie fallen und meldet jeden, der sich bewegt, zum Gegenstand wird oder auf Unbekanntem liegt. */
function pruefeFallen(welt, fallen) {
  if (!fallen.enthaeltFallende(welt)) return [];
  const lauf = fallen.simuliere(welt);
  const ursprung = new Map(); // aktuelle Zelle → Ausgangszelle des Blocks
  const von = (p) => ursprung.get(`${p.x},${p.y},${p.z}`) ?? { x: p.x, y: p.y, z: p.z };
  const meldungen = [];
  const ort = (p) => `(${p.x}, ${p.y}, ${p.z})`;
  for (const e of lauf.ereignisse) {
    const start = von(e.pos);
    if (e.was === 'faellt') {
      ursprung.delete(`${e.pos.x},${e.pos.y},${e.pos.z}`);
      ursprung.set(`${e.nach.x},${e.nach.y},${e.nach.z}`, start);
    } else if (e.was === 'gelandet' && (start.x !== e.pos.x || start.y !== e.pos.y || start.z !== e.pos.z)) {
      meldungen.push({ regel: 'pruefer.faellt', ort: start, schwere: 'verstoss', meldung: `${e.block} fällt und landet bei ${ort(e.pos)}` });
    } else if (e.was === 'zu-gegenstand') {
      meldungen.push({ regel: 'pruefer.faellt', ort: start, schwere: 'verstoss', meldung: `${e.block} fällt und wird bei ${ort(e.pos)} zum Gegenstand (${e.grund})` });
    } else if (e.was === 'unklar') {
      meldungen.push({ regel: 'pruefer.faellt', ort: start, schwere: 'hinweis', meldung: `${e.block} liegt bei ${ort(e.pos)} auf ${e.grund}; ob er dort hält, ist nicht belegt` });
    } else if (e.was === 'zu-beton') {
      meldungen.push({ regel: 'pruefer.faellt', ort: start, schwere: 'hinweis', meldung: `${e.block} wird bei ${ort(e.pos)} zu ${e.nach}` });
    }
  }
  return meldungen;
}

/** Trichter ohne Ziel, im Kreis oder verstopft (nach der Simulation). */
function pruefeTrichter(welt, trichter) {
  if (!trichter.enthaeltTrichter(welt)) return [];
  const liste = trichter.trichterListe(welt);
  const meldungen = [];
  const ort = (p) => `(${p.x}, ${p.y}, ${p.z})`;
  const nachKey = new Map(liste.map((t) => [`${t.pos.x},${t.pos.y},${t.pos.z}`, t]));
  for (const t of liste) {
    if (t.art === 'ohne-richtung') meldungen.push({ regel: 'pruefer.trichter', ort: t.pos, schwere: 'hinweis', meldung: 'Der Trichter zeigt nach oben oder hat keine gültige Richtung und schiebt nichts' });
    else if (t.art === 'kein-behaelter') meldungen.push({ regel: 'pruefer.trichter', ort: t.pos, schwere: 'hinweis', meldung: `Der Trichter zeigt auf ${t.zielId} bei ${ort(t.ziel)}: kein Behälter, es wird nichts geschoben` });
    else if (t.art === 'sonder') meldungen.push({ regel: 'pruefer.trichter', ort: t.pos, schwere: 'hinweis', meldung: `Der Trichter zeigt auf ${t.zielId} bei ${ort(t.ziel)}: Sonderbehälter, Blockwerk kennt die Regeln dafür noch nicht (unklar)` });
    // Kreis: dem Ziel folgen, solange es wieder ein Trichter ist; kommt man zum Ausgangstrichter zurück, ist es ein Kreis
    const start = `${t.pos.x},${t.pos.y},${t.pos.z}`;
    const gesehen = new Set();
    let aktuell = t;
    while (aktuell && aktuell.art === 'ok') {
      const nk = `${aktuell.ziel.x},${aktuell.ziel.y},${aktuell.ziel.z}`;
      if (nk === start) { meldungen.push({ regel: 'pruefer.trichter', ort: t.pos, schwere: 'hinweis', meldung: 'Dieser Trichter liegt in einem Kreis aus Trichtern, Gegenstände laufen im Kreis' }); break; }
      if (gesehen.has(nk)) break;
      gesehen.add(nk);
      aktuell = nachKey.get(nk) ?? null;
    }
  }
  const lauf = trichter.simuliere(welt);
  for (const t of liste) {
    const b = lauf.welt.leseBlock(t.pos.x, t.pos.y, t.pos.z);
    if (t.art === 'ok' && (b.inhalt ?? []).length > 0 && lauf.stabil && b.zustand.toggle_bit !== true) {
      meldungen.push({ regel: 'pruefer.trichter', ort: t.pos, schwere: 'hinweis', meldung: 'Der Trichter hält am Ende noch Gegenstände (Ziel voll oder nimmt sie nicht an); er staut' });
    }
  }
  return meldungen;
}

/** Redstone-Leitungen: Staub ohne Quelle, zu lange Leitung, schwingende Schaltung, unbekannte Leitfähigkeit. */
function pruefeRedstone(welt, redstone, loren) {
  if (!redstone.enthaeltRedstone(welt)) return [];
  const karte = redstone.stromkarte(welt, { loren });
  const meldungen = [];
  for (const p of karte.instabil) meldungen.push({ regel: 'pruefer.redstone', ort: p, schwere: 'hinweis', meldung: 'Diese Fackel findet kein Gleichgewicht (Schaltung schwingt); Blockwerk rechnet ohne Verzögerung und kann hier keinen Zustand nennen' });
  for (const p of karte.ohneQuelle) meldungen.push({ regel: 'pruefer.redstone', ort: p, schwere: 'hinweis', meldung: 'Dieser Redstone-Staub bekommt nie Strom (keine Quelle in der Leitung)' });
  for (const p of karte.abgeschnitten) meldungen.push({ regel: 'pruefer.redstone', ort: p, schwere: 'hinweis', meldung: 'Hier ist die Leitung ausgegangen (Stärke 0 nach 15 Blöcken); ein Verstärker würde fehlen' });
  const gesehen = new Set();
  for (const p of karte.unklar) {
    const k = `${p.x},${p.y},${p.z}`;
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    meldungen.push({ regel: 'pruefer.redstone', ort: { x: p.x, y: p.y, z: p.z }, schwere: 'hinweis', meldung: `Ob ${welt.leseBlock(p.x, p.y, p.z).id} Strom leitet, ist nicht belegt (unklar)` });
  }
  return meldungen;
}

/** Lässt die Schaltung im Sandkasten ablaufen: ausgebrannte Fackeln, Uhren (Periode) und Schaltungen, die nie zur Ruhe kommen. */
function pruefeRedstoneZeit(welt, rz, loren, maxTicks) {
  if (!rz.enthaeltZeitbauteile(welt)) return [];
  const lauf = rz.erzeuge(welt, { loren });
  const ruhe = lauf.bisRuhe(maxTicks);
  const meldungen = [];
  for (const e of lauf.ereignisse) {
    if (e.was === 'brennt-aus') meldungen.push({ regel: 'pruefer.redstone-zeit', ort: e.pos, schwere: 'hinweis', meldung: `Diese Fackel brennt im Tick ${e.tick} aus (mehr als 8 Wechsel in 60 Ticks)` });
  }
  // Mechanismen, die in der ganzen Laufzeit nie geschaltet haben und am Ende aus sind
  for (const [was, wasEnde] of [['lampe-an', 'minecraft:redstone_lamp']]) {
    void was;
    for (const b of lauf.welt.alleBloecke().filter((x) => x.id === wasEnde)) {
      if (!lauf.ereignisse.some((e) => e.was === 'lampe-an' && e.pos.x === b.x && e.pos.y === b.y && e.pos.z === b.z)) {
        meldungen.push({ regel: 'pruefer.mechanismus', ort: { x: b.x, y: b.y, z: b.z }, schwere: 'hinweis', meldung: 'Diese Lampe wird in der Simulation nie bestromt' });
      }
    }
  }
  for (const b of lauf.welt.alleBloecke().filter((x) => /_door$|_trapdoor$|_fence_gate$|^minecraft:(trapdoor|fence_gate)$/.test(x.id) && x.zustand.upper_block_bit !== true)) {
    if (b.zustand.open_bit !== true && !lauf.ereignisse.some((e) => e.was === 'tuer-auf' && e.pos.x === b.x && e.pos.y === b.y && e.pos.z === b.z)) {
      meldungen.push({ regel: 'pruefer.mechanismus', ort: { x: b.x, y: b.y, z: b.z }, schwere: 'hinweis', meldung: 'Diese Tür/Falltür/dieses Tor wird in der Simulation nie bestromt (bleibt geschlossen)' });
    }
  }
  for (const e of lauf.ereignisse.filter((x) => x.was === 'tagessensor-unklar')) {
    meldungen.push({ regel: 'pruefer.mechanismus', ort: e.pos, schwere: 'hinweis', meldung: 'Der Tagessensor sieht den Himmel nur teilweise (Lichtfilter über ihm unbekannt): Stärke unklar' });
  }
  if (!ruhe.stabil) {
    // Periode suchen: die kleinste Länge, nach der sich der Zustand wiederholt
    const abdruecke = [];
    for (let i = 0; i < 400; i++) { lauf.laufe(1); abdruecke.push(lauf.abdruck()); }
    let periode = null;
    for (let p = 1; p <= 200 && periode === null; p++) if (abdruecke.slice(-200).every((a, i, arr) => i + p >= arr.length || a === arr[i + p])) periode = p;
    const erster = lauf.ereignisse.find((e) => e.was !== 'brennt-aus' && e.pos);
    meldungen.push({ regel: 'pruefer.redstone-zeit', ort: erster ? erster.pos : { x: 0, y: 0, z: 0 }, schwere: 'hinweis', meldung: periode ? `Die Schaltung läuft als Uhr (Periode ${periode} Ticks) und kommt nicht zur Ruhe` : `Die Schaltung kommt nach ${maxTicks} Ticks nicht zur Ruhe` });
  }
  return meldungen;
}

/** Sind alle Ziele vom Start aus erreichbar (Spieler, Dorfbewohner, Baby)? */
function pruefeBegehbarkeit(welt, bewegung, { start, ziele }) {
  const meldungen = [];
  const ort = (p) => `(${p.x}, ${p.y}, ${p.z})`;
  for (const z of ziele) {
    const art = z.art ?? 'spieler';
    const w = bewegung.weg(welt, start, z.pos, art);
    if (!w.ok) meldungen.push({ regel: 'pruefer.begehbar', ort: { ...z.pos }, schwere: 'verstoss', meldung: `${art} erreicht ${ort(z.pos)} nicht: ${w.grund}` });
    else if (w.springt || w.faellt) meldungen.push({ regel: 'pruefer.begehbar', ort: { ...z.pos }, schwere: 'hinweis', meldung: `${art} erreicht ${ort(z.pos)} nur mit ${w.springt ? 'Sprüngen' : ''}${w.springt && w.faellt ? ' und ' : ''}${w.faellt ? `Stürzen (Schaden ${w.fallschaden} Herzhälften)` : ''}` });
  }
  return meldungen;
}

/** Betten, Berufsblöcke und Iron Golems eines Dorfs (Dorfbewohner stehen als Wesen in der Welt). */
function pruefeDorf(welt, dorfmodell) {
  const meldungen = [];
  const ort = (p) => `(${p.x}, ${p.y}, ${p.z})`;
  for (const b of dorfmodell.betten(welt)) if (!b.gueltig) meldungen.push({ regel: 'pruefer.dorf', ort: { x: b.x, y: b.y, z: b.z }, schwere: 'hinweis', meldung: `Bett bei ${ort(b)} zählt nicht: ${b.grund}` });
  const zu = dorfmodell.zuordnung(welt);
  for (const z of zu) {
    if (z.beruf && !z.beruf.erreichbar) meldungen.push({ regel: 'pruefer.dorf', ort: { x: z.beruf.x, y: z.beruf.y, z: z.beruf.z }, schwere: 'verstoss', meldung: `Dorfbewohner ${z.nr} beansprucht ${z.beruf.id} bei ${ort(z.beruf)}, erreicht ihn aber nicht (Ärger-Partikel, kein Beruf)` });
    else if (!z.bett) meldungen.push({ regel: 'pruefer.dorf', ort: { ...z.pos }, schwere: 'hinweis', meldung: `Dorfbewohner ${z.nr} bei ${ort(z.pos)} findet kein freies, erreichbares Bett und bekommt keinen Beruf` });
  }
  const bewohner = dorfmodell.dorfbewohner(welt);
  for (const s of dorfmodell.berufsbloecke(welt)) {
    if (!bewohner.some((v) => !v.baby && dorfmodell.imUmkreis(v.pos, s))) meldungen.push({ regel: 'pruefer.dorf', ort: { x: s.x, y: s.y, z: s.z }, schwere: 'hinweis', meldung: `${s.id} bei ${ort(s)}: kein Dorfbewohner in Reichweite` });
  }
  const d = dorfmodell.dorf(welt);
  if (d) {
    if (d.dorfbewohner > d.betten) meldungen.push({ regel: 'pruefer.dorf', ort: { ...d.mittelpunkt }, schwere: 'hinweis', meldung: `Mehr Dorfbewohner (${d.dorfbewohner}) als gültige Betten (${d.betten}): kein Nachwuchs, ohne Bett keine Arbeit` });
    if (d.golem !== 'nein') meldungen.push({ regel: 'pruefer.dorf', ort: { ...d.mittelpunkt }, schwere: 'hinweis', meldung: d.golem === 'ja' ? `Iron Golems können im Dorf spawnen (${d.dorfbewohner} Dorfbewohner, ${d.betten} Betten)` : `Iron Golems könnten spawnen (${d.eisengolems} vorhanden; Anzahl je Dorfbewohner nicht belegt)` });
  }
  return meldungen;
}

/** Kolben, die nicht ausfahren können oder dabei etwas zerstören (jeweils im aktuellen Zustand der Welt). */
function pruefeKolben(welt, kolben) {
  if (!kolben.enthaeltKolben(welt)) return [];
  const meldungen = [];
  for (const b of welt.alleBloecke().filter((x) => kolben.istKolbenId(x.id))) {
    const pos = { x: b.x, y: b.y, z: b.z };
    if (kolben.istAusgefahren(welt, pos)) continue;
    const plan = kolben.schiebeplan(welt, pos);
    if (!plan.ok) meldungen.push({ regel: 'pruefer.kolben', ort: pos, schwere: 'hinweis', meldung: `Dieser Kolben kann nicht ausfahren: ${plan.grund}` });
    else if (plan.zerstoert) meldungen.push({ regel: 'pruefer.kolben', ort: pos, schwere: 'hinweis', meldung: `Dieser Kolben zerstört beim Ausfahren ${plan.zerstoert.id}` });
  }
  return meldungen;
}

/** Stellen im Bereich, an denen Monster spawnen können (Verstoß) oder vielleicht können (Hinweis). */
function pruefeSpawn(welt, spawn, spawnBereich, himmel) {
  return spawn.spawnstellen(welt, spawnBereich, { himmel }).map((s) => ({
    regel: 'pruefer.spawn-moeglich',
    ort: { x: s.x, y: s.y, z: s.z },
    schwere: s.urteil === 'moeglich' ? 'verstoss' : 'hinweis',
    meldung: s.urteil === 'moeglich' ? 'Hier können Monster spawnen (dunkel, fester Boden, genug Platz)' : `Hier können vielleicht Monster spawnen; unklar wegen: ${s.gruende.join(', ')}`,
  }));
}

/** Läuft die Bahn ab der Startschiene ab und meldet, wo die Lore (nach Jonahs Messungen) stehen bleibt. */
function pruefeLore(welt, lore, start) {
  const bahn = lore.bahn(welt, start.pos, start.richtung, { aktiv: start.aktiv ?? null });
  return lore.analysiere(bahn).map((b) => ({
    regel: 'pruefer.lore-stillstand',
    ort: { ...b.pos },
    schwere: b.urteil === 'nein' ? 'verstoss' : 'hinweis',
    meldung: b.meldung,
  }));
}

/** Lichtquellen, deren Stärke vom Zustand abhängt (licht = null in Ebene 0). */
function pruefeLicht(register, bloecke) {
  return bloecke
    .filter((b) => register.bloecke.block(b.id).eigenschaften.licht === null)
    .map((b) => ({ regel: 'pruefer.licht-unklar', ort: { x: b.x, y: b.y, z: b.z }, schwere: 'hinweis', meldung: `${b.id}: Die Lichtstärke hängt vom Zustand ab und ist noch nicht erfasst (Licht 0–15 möglich)` }));
}

function pruefeTickbereich(welt, bloecke, tickbereich) {
  const ersteProChunk = new Map();
  const merke = (x, y, z, was) => {
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    if (tickbereich.tickt(cx, cz)) return;
    const k = `${cx},${cz}`;
    const e = ersteProChunk.get(k);
    if (e) e.anzahl += 1;
    else ersteProChunk.set(k, { cx, cz, ort: { x, y, z }, anzahl: 1, was });
  };
  for (const b of bloecke) merke(b.x, b.y, b.z, 'Block');
  for (const w of welt.wesen()) merke(Math.floor(w.x), Math.floor(w.y), Math.floor(w.z), 'Wesen');
  return [...ersteProChunk.values()].map((e) => ({
    regel: 'pruefer.tickbereich',
    ort: e.ort,
    schwere: 'verstoss',
    meldung: `Chunk ${e.cx}, ${e.cz} liegt außerhalb des Tickbereichs (${e.anzahl} Einträge): dort läuft nichts`,
  }));
}

function pruefeSchienen(welt, schienen, bloecke) {
  const meldungen = [];
  const melde = (regel, ort, schwere, meldung) => meldungen.push({ regel, ort, schwere, meldung });
  for (const b of bloecke) {
    if (!schienen.istSchienenId(b.id)) continue;
    const ort = { x: b.x, y: b.y, z: b.z };
    const ende = schienen.enden(b.zustand);
    if (!ende) {
      melde('pruefer.schiene-verbindung', ort, 'hinweis', `${b.id}: Form (rail_direction) ist nicht angegeben, Verbindungen nicht prüfbar`);
      continue;
    }
    const wert = b.zustand.rail_direction;
    if (wert > 5 && schienen.nurGerade.has(b.id)) {
      melde('pruefer.antriebsschiene-kurve', ort, schienen.belegtGerade.has(b.id) ? 'verstoss' : 'hinweis',
        `${b.id} als Kurve (${wert}): Antriebsschienen sind gerade${schienen.belegtGerade.has(b.id) ? '' : ' (für diese Schiene nicht belegt)'}`);
    }
    for (const e of ende) {
      const g = schienen.gegenstelle(welt, ort, e);
      const wohin = `${e.richtung}${e.dy ? ' (hoch)' : ''}`;
      if (g.art === 'einseitig') melde('pruefer.schiene-verbindung', ort, 'hinweis', `${b.id}: Ende ${wohin} zeigt auf ${g.partner.id} bei ${g.partner.pos.x}, ${g.partner.pos.y}, ${g.partner.pos.z}, das nicht zurückzeigt (Abzweig oder Lücke) – im Spiel prüfen`);
      else if (g.art === 'leer') melde('pruefer.schiene-verbindung', ort, 'hinweis', `${b.id}: Ende ${wohin} führt ins Leere (Sackgasse)`);
    }
  }
  return meldungen;
}

/**
 * @param {import('../ebene0/welt.js').Welt} welt
 * @param {{register: object, richtungVon: (zustandName:string, wert:any) => string|null, tickbereich?: import('./tickbereich.js').Tickbereich, schienen?: ReturnType<typeof import('./schienen.js').erzeugeSchienen>, antrieb?: ReturnType<typeof import('./antrieb.js').erzeugeAntrieb>, stromQuellen?: Iterable<{x:number,y:number,z:number}>}} optionen
 *   Die Antriebs-Prüfung läuft nur, wenn `stromQuellen` übergeben wird (auch leer)
 *   richtungVon kommt vom Vermesser aus Ebene 0
 * @returns {{regel:string, ort:{x:number,y:number,z:number}, schwere:string, meldung:string}[]}
 */
export function pruefe(welt, { register, richtungVon, tickbereich = null, schienen = null, antrieb = null, lore = null, loreStart = null, stromQuellen = undefined, fluessigkeit = null, fallen = null, trichter = null, redstone = null, redstoneZeit = null, kolben = null, bewegung = null, begehbarkeit = null, dorf = null, dorfPruefen = false, loren = [], spawn = null, spawnBereich = null, himmel = 'nacht' }) {
  const bloecke = welt.alleBloecke();
  const meldungen = pruefeHalt(welt, register, richtungVon, bloecke);
  meldungen.push(...pruefeLicht(register, bloecke));
  if (schienen) meldungen.push(...pruefeSchienen(welt, schienen, bloecke));
  if (lore && loreStart) meldungen.push(...pruefeLore(welt, lore, loreStart));
  if (antrieb && stromQuellen !== undefined) meldungen.push(...pruefeAntrieb(welt, antrieb, stromQuellen, bloecke));
  if (fluessigkeit) meldungen.push(...pruefeFluessigkeit(welt, fluessigkeit, 400));
  if (fallen) meldungen.push(...pruefeFallen(welt, fallen));
  if (trichter) meldungen.push(...pruefeTrichter(welt, trichter));
  if (redstone) meldungen.push(...pruefeRedstone(welt, redstone, loren));
  if (kolben) meldungen.push(...pruefeKolben(welt, kolben));
  if (dorf && dorfPruefen) meldungen.push(...pruefeDorf(welt, dorf));
  if (bewegung && begehbarkeit) meldungen.push(...pruefeBegehbarkeit(welt, bewegung, begehbarkeit));
  if (redstoneZeit) meldungen.push(...pruefeRedstoneZeit(welt, redstoneZeit, loren, 600));
  if (spawn && spawnBereich) meldungen.push(...pruefeSpawn(welt, spawn, spawnBereich, himmel));
  if (tickbereich) meldungen.push(...pruefeTickbereich(welt, bloecke, tickbereich));
  return sortiert(meldungen);
}

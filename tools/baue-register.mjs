// Erzeugt data/bloecke.json, data/gegenstaende.json und data/wesen.json aus den offiziellen Mojang-Daten
// (https://github.com/Mojang/bedrock-samples) plus data/quellen/eigenschaften.json.
// Braucht Internet, ist NICHT Teil von `npm test`. Aufruf: node tools/baue-register.mjs [Version-Tag]
// Rohdaten werden in tools/.cache/ zwischengespeichert (nicht im Repo).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(wurzel, 'tools', '.cache');
const REF = process.argv[2] ?? 'main';
const BASIS = `https://raw.githubusercontent.com/Mojang/bedrock-samples/${REF}`;
const DATENSTAND = '1.26.50.4';

async function hole(pfad) {
  const ziel = join(cache, REF, pfad.replaceAll('/', '__'));
  if (existsSync(ziel)) return readFile(ziel, 'utf8');
  const antwort = await fetch(`${BASIS}/${pfad}`);
  if (antwort.status === 404) return null;
  if (!antwort.ok) throw new Error(`${pfad}: HTTP ${antwort.status}`);
  const text = await antwort.text();
  await mkdir(dirname(ziel), { recursive: true });
  await writeFile(ziel, text);
  return text;
}

// JSON mit Kommentaren (Mojang-Entitäten) → Objekt
export function jsonOhneKommentare(text) {
  let aus = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      aus += c;
      if (c === '\\') aus += text[++i];
      else if (c === '"') inString = false;
    } else if (c === '"') { inString = true; aus += c; }
    else if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; aus += '\n'; }
    else if (c === '/' && text[i + 1] === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i++; }
    else aus += c;
  }
  return JSON.parse(aus.replace(/,(\s*[}\]])/g, '$1'));
}

const sortiert = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

async function bloecke(eig) {
  const roh = JSON.parse(await hole('metadata/vanilladata_modules/mojang-blocks.json'));
  const zustandsarten = {};
  for (const p of roh.block_properties) {
    zustandsarten[p.name] = { typ: p.type, werte: p.values.map((w) => w.value) };
  }
  const regeln = eig.regeln.map((r) => ({ ...r, re: new RegExp(r.muster), ausser: r.ausser ? new RegExp(r.ausser) : null }));
  const arbeits = new Set(eig.arbeitsbloecke);
  const ergebnis = {};
  for (const b of roh.data_items) {
    const e = { vollblock: null, durchsichtig: null, licht: 0, faellt: false, brauchtHalt: false, arbeitsblock: arbeits.has(b.name) };
    for (const r of regeln) if (r.re.test(b.name) && !(r.ausser && r.ausser.test(b.name))) Object.assign(e, r.setze);
    if (b.name in eig.lichtstaerke) e.licht = eig.lichtstaerke[b.name];
    const namen = b.properties.map((p) => p.name).sort();
    for (const n of namen) if (!zustandsarten[n]) throw new Error(`${b.name}: unbekannter Zustand ${n}`);
    const eintrag = { zustaende: namen, eigenschaften: e };
    if (b.name in eig.behaelter) eintrag.behaelter = eig.behaelter[b.name];
    ergebnis[b.name] = eintrag;
  }
  for (const id of [...Object.keys(eig.behaelter), ...eig.arbeitsbloecke, ...Object.keys(eig.lichtstaerke)]) {
    if (!ergebnis[id]) console.warn(`Warnung: kuratierter Block fehlt im Mojang-Register: ${id}`);
  }
  return {
    datenstand: DATENSTAND,
    quelle: 'https://github.com/Mojang/bedrock-samples (metadata/vanilladata_modules/mojang-blocks.json) + data/quellen/eigenschaften.json',
    eigenschaftenStatus: 'ungeprüft',
    zustandsarten: sortiert(zustandsarten),
    bloecke: sortiert(ergebnis),
  };
}

async function gegenstaende() {
  const roh = JSON.parse(await hole('metadata/vanilladata_modules/mojang-items.json'));
  return {
    datenstand: DATENSTAND,
    quelle: 'https://github.com/Mojang/bedrock-samples (metadata/vanilladata_modules/mojang-items.json)',
    gegenstaende: roh.data_items.map((i) => i.name).sort(),
  };
}

function kollisionsbox(komp) {
  const k = komp?.['minecraft:collision_box'];
  return k && typeof k.width === 'number' && typeof k.height === 'number' ? { breite: k.width, hoehe: k.height } : null;
}

async function wesen() {
  const roh = JSON.parse(await hole('metadata/vanilladata_modules/mojang-entities.json'));
  const ergebnis = {};
  // "Item" (Gegenstand am Boden) steht nicht in der Mojang-Wesenliste, wird aber von Ebene 0 gebraucht.
  const namen = [...roh.data_items.map((e) => e.name), 'minecraft:item'];
  for (const name of namen) {
    const e = { name };
    const datei = e.name.replace('minecraft:', '');
    const text = await hole(`behavior_pack/entities/${datei}.json`);
    const eintrag = { hitbox: null, baby: null, quelle: text ? `behavior_pack/entities/${datei}.json` : null };
    if (text) {
      const def = jsonOhneKommentare(text)['minecraft:entity'] ?? {};
      eintrag.hitbox = kollisionsbox(def.components);
      const baby = def.component_groups?.baby ?? def.component_groups?.['minecraft:baby'];
      if (baby) {
        const box = kollisionsbox(baby);
        const skala = baby['minecraft:scale']?.value;
        if (box) eintrag.baby = { breite: box.breite, hoehe: box.hoehe, skalierung: skala ?? 1 };
        else if (skala && eintrag.hitbox) eintrag.baby = { breite: eintrag.hitbox.breite, hoehe: eintrag.hitbox.hoehe, skalierung: skala };
      }
    }
    ergebnis[e.name] = eintrag;
  }
  if (!ergebnis['minecraft:item'].hitbox) {
    ergebnis['minecraft:item'].hitbox = { breite: 0.25, hoehe: 0.25 };
    ergebnis['minecraft:item'].quelle = 'https://minecraft.wiki/w/Item_(entity) (ungeprüft)';
  }
  return {
    datenstand: DATENSTAND,
    quelle: 'https://github.com/Mojang/bedrock-samples (mojang-entities.json, behavior_pack/entities)',
    hinweis: 'hitbox = collision_box der Mojang-Definition; baby.skalierung wird laut Mojang-Kommentar auf die Box angewendet (ungeprüft, im Spiel messen).',
    wesen: sortiert(ergebnis),
  };
}

function schreibe(datei, objekt, zeilenweiseKey) {
  // Lesbar und diff-freundlich: ein Eintrag pro Zeile
  const teile = Object.entries(objekt).map(([k, v]) =>
    k === zeilenweiseKey
      ? `  ${JSON.stringify(k)}: {\n${Object.entries(v).map(([a, b]) => `    ${JSON.stringify(a)}: ${JSON.stringify(b)}`).join(',\n')}\n  }`
      : `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return writeFile(join(wurzel, 'data', datei), `{\n${teile.join(',\n')}\n}\n`);
}

const eig = JSON.parse(await readFile(join(wurzel, 'data', 'quellen', 'eigenschaften.json'), 'utf8'));
const b = await bloecke(eig);
await schreibe('bloecke.json', b, 'bloecke');
const g = await gegenstaende();
await writeFile(join(wurzel, 'data', 'gegenstaende.json'), JSON.stringify(g, null, 1) + '\n');
const w = await wesen();
await schreibe('wesen.json', w, 'wesen');
console.log(`Blöcke: ${Object.keys(b.bloecke).length}, Zustandsarten: ${Object.keys(b.zustandsarten).length}, Gegenstände: ${g.gegenstaende.length}, Wesen: ${Object.keys(w.wesen).length}`);

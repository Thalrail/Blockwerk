// Zieht aus einem entpackten Faithful-32x-Bedrock-Pack genau die Texturen heraus, die Blockwerk braucht (Lizenz: nur Benötigtes).
// Aufruf:  node tools/texturen-extrahieren.js <Ordner des Packs> [--version <Name>] [--quelle <Text>]
//          node tools/texturen-extrahieren.js --liste      (nur die benötigten Dateinamen ausgeben, z. B. zum gezielten Herunterladen)
// Ein .mcpack ist eine Zip-Datei: vorher entpacken. Das Pack selbst gehört nicht ins Repo, nur das Ergebnis (data/texturen/ und data/texturen.json).
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ladeEbene0 } from '../src/ebene0/daten-node.js';
import { benoetigteBloecke, erzeugeIndex, loeseAuf } from '../src/ebene5/texturen.js';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv.slice(2);
const wert = (name) => { const i = arg.indexOf(name); return i >= 0 ? arg[i + 1] : null; };

const ebene0 = ladeEbene0();
const texte = readdirSync(join(wurzel, 'src/ebene2')).filter((n) => n.endsWith('.js')).map((n) => readFileSync(join(wurzel, 'src/ebene2', n), 'utf8'));
texte.push(readFileSync(join(wurzel, 'data/regeln/planung.json'), 'utf8'));
const zusaetzlich = JSON.parse(readFileSync(join(wurzel, 'data/texturen-zusatz.json'), 'utf8')).bloecke;
const ids = benoetigteBloecke({ register: ebene0.register.bloecke, texte, zusaetzlich });
const tabelle = JSON.parse(readFileSync(join(wurzel, 'data/texturen-regeln.json'), 'utf8'));

if (arg.includes('--liste')) {
  const namen = new Set();
  for (const id of ids) { const a = loeseAuf(id, tabelle); if (a) for (const f of ['oben', 'unten', 'seite']) namen.add(a[f]); }
  console.log([...namen].sort().join('\n'));
  process.exit(0);
}

const packOrdner = arg.find((a) => !a.startsWith('--') && a !== wert('--version') && a !== wert('--quelle'));
if (!packOrdner || !existsSync(join(packOrdner, 'textures/blocks'))) {
  console.error('Bitte den entpackten Pack-Ordner angeben (mit textures/blocks). Aufruf: node tools/texturen-extrahieren.js <Ordner>');
  process.exit(1);
}
const datei = (name) => join(packOrdner, 'textures/blocks', `${name}.png`);
const manifest = JSON.parse(readFileSync(join(packOrdner, 'manifest.json'), 'utf8'));
const pack = {
  name: manifest.header?.name ?? 'Faithful 32x',
  version: wert('--version') ?? (manifest.header?.version ?? []).join('.'),
  autoren: manifest.metadata?.authors ?? [],
  url: 'https://faithfulpack.net',
  lizenz: 'https://faithfulpack.net/license',
  quelle: wert('--quelle') ?? 'https://github.com/Faithful-Resource-Pack/Faithful-32x-Bedrock',
  ausschnitt: 'Nur die von Blockwerk benötigten Block-Texturen (Lizenz), unverändert übernommen.',
};
const index = erzeugeIndex({ ids, tabelle, vorhanden: (n) => existsSync(datei(n)), pack });

const ziel = join(wurzel, 'data/texturen');
mkdirSync(ziel, { recursive: true });
const behalten = new Set(index.kacheln.map((n) => `${n}.png`));
const alle = (ordner, vor = '') => readdirSync(ordner).flatMap((n) => (statSync(join(ordner, n)).isDirectory() ? alle(join(ordner, n), `${vor}${n}/`) : [`${vor}${n}`]));
for (const d of alle(ziel)) if (d.endsWith('.png') && !behalten.has(d)) rmSync(join(ziel, d));
for (const n of index.kacheln) { mkdirSync(dirname(join(ziel, `${n}.png`)), { recursive: true }); copyFileSync(datei(n), join(ziel, `${n}.png`)); }
if (existsSync(join(packOrdner, 'LICENSE.txt'))) copyFileSync(join(packOrdner, 'LICENSE.txt'), join(ziel, 'FAITHFUL-LICENSE.txt'));
writeFileSync(join(ziel, 'LIZENZ.md'), `# Texturen: Faithful 32x (Bedrock)

Die PNG-Dateien in diesem Ordner stammen aus dem Texturpaket **${pack.name}** (${pack.autoren.join(', ') || 'Faithful Team'}), ${pack.url}.
Herkunft: ${pack.quelle} (Stand: ${pack.version}).

- Lizenz: ${pack.lizenz} (eine unveränderte Kopie liegt als \`FAITHFUL-LICENSE.txt\` bei).
- Es sind nur die Texturen enthalten, die Blockwerk für die Darstellung braucht; sie sind unverändert.
- Blockwerk ist kostenlos, nicht offiziell und nicht von Faithful, Mojang oder Microsoft; die Texturen werden nicht für KI-Training verwendet.
- Neu erzeugen: \`node tools/texturen-extrahieren.js <entpackter Pack-Ordner>\`.
`);
writeFileSync(join(wurzel, 'data/texturen.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(`${index.kacheln.length} Texturen für ${Object.keys(index.bloecke).length} Blöcke übernommen; ohne Textur: ${index.fehlend.length}`);
for (const f of index.fehlend) console.log(`  ohne Textur: ${f.id} (${f.grund})`);

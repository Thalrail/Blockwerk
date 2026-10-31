// Architektur-Grundsätze aus CLAUDE.md als automatische Tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');

function dateien(ordner, endung = '.js') {
  return readdirSync(ordner).flatMap((n) => {
    const p = join(ordner, n);
    // Worktree-Kopien und Laufzustand der Orchestrierung gehören nicht zum Repository-Inhalt (sonst sähe der Test die Texturen jeder Kopie)
    if (p === join(wurzel, '.claude', 'worktrees') || p === join(wurzel, '.claude', 'orchestrierung')) return [];
    return statSync(p).isDirectory() ? dateien(p, endung) : p.endsWith(endung) ? [p] : [];
  });
}

const ebeneVon = (pfad) => {
  const m = relative(join(wurzel, 'src'), pfad).replaceAll('\\', '/').match(/^ebene(\d)\//);
  return m ? Number(m[1]) : null;
};

test('Ebenen importieren nur aus gleicher oder tieferer Ebene', () => {
  const importRe = /(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const datei of dateien(join(wurzel, 'src'))) {
    const meine = ebeneVon(datei);
    assert.notEqual(meine, null, `${datei} liegt in keinem Ebenenordner`);
    const text = readFileSync(datei, 'utf8');
    for (const m of text.matchAll(importRe)) {
      const ziel = m[1] ?? m[2];
      if (!ziel.startsWith('.')) continue; // node:-Module
      const aufgeloest = resolve(dirname(datei), ziel);
      const andere = ebeneVon(aufgeloest + '.js');
      assert.notEqual(andere, null, `${datei} importiert ${ziel} außerhalb von src/`);
      assert.ok(andere <= meine, `${relative(wurzel, datei)} (Ebene ${meine}) importiert höhere Ebene ${andere}: ${ziel}`);
    }
  }
});

test('Die Engine (src/) nutzt weder Dateisystem noch Zufall noch Uhrzeit – außer daten-node.js', () => {
  for (const datei of dateien(join(wurzel, 'src'))) {
    if (datei.endsWith('daten-node.js')) continue;
    const text = readFileSync(datei, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1'); // Kommentare zählen nicht (URLs mit „https://“ bleiben stehen)
    assert.doesNotMatch(text, /node:fs|node:path|Math\.random|Date\.now|new Date\(|crypto\./, relative(wurzel, datei));
  }
});

test('Höhere Ebenen greifen nur über Ebene 0 in die Welt ein (keine eigenen Weltzugriffe auf Ebene-0-Interna)', () => {
  for (const datei of dateien(join(wurzel, 'src'))) {
    if ((ebeneVon(datei) ?? 0) === 0) continue;
    const text = readFileSync(datei, 'utf8');
    assert.doesNotMatch(text, /\._chunks|\._wesen|\._naechsteNr/, relative(wurzel, datei));
  }
});

test('package.json: keine Abhängigkeiten, nur npm test, Node >= 22, ES-Module', () => {
  const pkg = JSON.parse(readFileSync(join(wurzel, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
  assert.equal(pkg.type, 'module');
  assert.match(pkg.engines.node, />=\s*22/);
  assert.ok(pkg.scripts.test);
});

test('Alle Daten sind gültiges JSON mit Datenstand 1.26.50', () => {
  for (const d of ['bloecke.json', 'wesen.json', 'gegenstaende.json']) {
    const j = JSON.parse(readFileSync(join(wurzel, 'data', d), 'utf8'));
    assert.match(j.datenstand, /^1\.26\.50/, d);
    assert.ok(j.quelle, `${d}: Quelle fehlt`);
  }
  JSON.parse(readFileSync(join(wurzel, 'data', 'drehregeln.json'), 'utf8'));
});

test('CI-Workflow und README (mit Faithful-Nennung) sind vorhanden', () => {
  const ci = readFileSync(join(wurzel, '.github', 'workflows', 'test.yml'), 'utf8');
  assert.match(ci, /node-version: 22/);
  assert.match(ci, /npm test/);
  const readme = readFileSync(join(wurzel, 'README.md'), 'utf8');
  assert.match(readme, /Faithful 32x/);
  assert.match(readme, /faithfulpack\.net/);
  assert.match(readme, /faithfulpack\.net\/license/);
});

test('Keine Original-Mojang-Texturen im Repo: Bilder nur als benötigte Faithful-Texturen mit Lizenz und Nennung', () => {
  const bilder = [...dateien(wurzel, '.png'), ...dateien(wurzel, '.tga')].filter((p) => !p.includes('node_modules') && !p.includes(`${join(wurzel, '.git')}`));
  const erlaubt = join(wurzel, 'data', 'texturen');
  assert.deepEqual(bilder.filter((p) => !p.startsWith(erlaubt)), []);
  if (!bilder.length) return;
  // Faithful-Lizenz: nur benötigte Texturen, deutliche Nennung, Lizenz (Kopie oder Link) liegt bei
  const index = JSON.parse(readFileSync(join(wurzel, 'data', 'texturen.json'), 'utf8'));
  const vorhanden = bilder.map((p) => p.slice(erlaubt.length + 1).split(sep).join('/').replace(/\.png$/, '')).sort();
  assert.deepEqual(vorhanden, [...index.kacheln].sort());
  const nutzer = new Set(Object.values(index.bloecke).flatMap((b) => [b.oben, b.unten, b.seite]));
  assert.deepEqual([...nutzer].sort(), [...index.kacheln].sort(), 'jede Textur wird von mindestens einem Block gebraucht');
  assert.match(index.pack.name, /Faithful 32x/);
  assert.equal(index.pack.url, 'https://faithfulpack.net');
  assert.equal(index.pack.lizenz, 'https://faithfulpack.net/license');
  const lizenz = readFileSync(join(erlaubt, 'LIZENZ.md'), 'utf8');
  assert.ok(lizenz.includes('https://faithfulpack.net/license'));
  assert.match(readFileSync(join(erlaubt, 'FAITHFUL-LICENSE.txt'), 'utf8'), /FAITHFUL LICENSE/);
  assert.ok(readFileSync(join(wurzel, 'index.html'), 'utf8').includes('https://faithfulpack.net/license'));
});

test('Dienst (dienst/): nur Verdrahtung – importiert nur die Live-Logik, hat keine Schlüssel oder Konto-Angaben im Repo', () => {
  const importRe = /(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g;
  const erlaubt = new Set([join(wurzel, 'src', 'ebene5', 'live.js'), join(wurzel, 'dienst', 'raum.js')]);
  for (const datei of [...dateien(join(wurzel, 'dienst')), join(wurzel, 'dienst', 'wrangler.toml')]) {
    const text = readFileSync(datei, 'utf8');
    if (datei.endsWith('.js')) for (const m of text.matchAll(importRe)) {
      const ziel = m[1];
      if (!ziel.startsWith('.')) { assert.equal(ziel, 'cloudflare:workers', `${datei} importiert ${ziel}`); continue; }
      assert.ok(erlaubt.has(resolve(dirname(datei), ziel)), `${relative(wurzel, datei)} importiert ${ziel}`);
    }
    assert.doesNotMatch(text, /(api[_-]?key|secret|token|password|account_id|zone_id)\s*[=:]/i, relative(wurzel, datei));
  }
});

test('Live-Logik (src/ebene5/live.js) hat feste Grenzen und kennt weder Netz noch Uhr', () => {
  const text = readFileSync(join(wurzel, 'src', 'ebene5', 'live.js'), 'utf8');
  assert.doesNotMatch(text, /WebSocket|fetch\(|setTimeout|setInterval|Date|Math\.random/);
});

test('Keine lokalen Cache- oder Konto-Dateien von Werkzeugen im Repo (.wrangler enthält Konto-Kennung und E-Mail)', async () => {
  const { execFileSync } = await import('node:child_process');
  const getrackt = execFileSync('git', ['ls-files'], { cwd: wurzel, encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.deepEqual(getrackt.filter((p) => /(^|\/)\.wrangler\//.test(p)), []);
  assert.match(readFileSync(join(wurzel, '.gitignore'), 'utf8'), /\.wrangler\//);
});

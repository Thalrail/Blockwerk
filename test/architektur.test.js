// Architektur-Grundsätze aus CLAUDE.md als automatische Tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');

function dateien(ordner, endung = '.js') {
  return readdirSync(ordner).flatMap((n) => {
    const p = join(ordner, n);
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

test('Keine Original-Mojang-Texturen im Repo', () => {
  const bilder = [...dateien(wurzel, '.png'), ...dateien(wurzel, '.tga')].filter((p) => !p.includes('node_modules') && !p.includes(`${join(wurzel, '.git')}`));
  assert.deepEqual(bilder, []);
});

// Wächter für die schlanke Dokumentation (Token-Effizienz): was automatisch geladen wird, bleibt klein und deckt sich mit den Volltexten.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (p) => fs.readFileSync(path.join(wurzel, p), 'utf8');
const BUDGET = { 'CLAUDE.md': 8000, 'docs/stand.md': 9000, 'docs/kurz/ebenen-kurz.md': 8000, 'docs/kurz/entscheidungen-kurz.md': 9000 };

test('CLAUDE.md importiert nur die Kurzfassungen und stand.md', () => {
  const importe = [...lies('CLAUDE.md').matchAll(/^- @(\S+)/gm)].map((m) => m[1]).sort();
  assert.deepEqual(importe, ['docs/kurz/ebenen-kurz.md', 'docs/kurz/entscheidungen-kurz.md', 'docs/stand.md']);
  for (const i of importe) assert.ok(fs.existsSync(path.join(wurzel, i)), i);
});

test('Größenbudgets der automatisch geladenen Dateien (Zeichen)', () => {
  for (const [datei, max] of Object.entries(BUDGET)) assert.ok(lies(datei).length <= max, `${datei}: ${lies(datei).length} > ${max} – Ausführliches nach docs/referenz/ auslagern`);
});

test('Entscheidungen: jede Zeile des Volltexts hat ihre Kurzzeile mit gleichem Schlüssel', () => {
  const schluessel = (text) => text.split('\n').filter((z) => z.startsWith('- ')).map((z) => z.slice(2).split(':')[0].trim());
  assert.deepEqual(schluessel(lies('docs/kurz/entscheidungen-kurz.md')), schluessel(lies('docs/entscheidungen.md')));
});

test('Ebenenmodell: Kurzfassung spiegelt alle Ebenen-Überschriften samt Status', () => {
  const ueberschriften = (text) => text.split('\n').filter((z) => /^## Ebene \d/.test(z));
  const voll = ueberschriften(lies('docs/ebenen.md'));
  assert.equal(voll.length, 6);
  assert.deepEqual(ueberschriften(lies('docs/kurz/ebenen-kurz.md')), voll);
});

test('Referenz-Index listet jede Datei in docs/referenz und nur existierende', () => {
  const index = lies('docs/referenz/README.md');
  const vorhanden = fs.readdirSync(path.join(wurzel, 'docs/referenz')).filter((f) => f !== 'README.md');
  for (const f of vorhanden) assert.ok(index.includes(`\`${f}\``), `${f} fehlt im Index`);
  for (const m of index.matchAll(/^\| `([^`]+\.md)`/gm)) assert.ok(vorhanden.includes(m[1]), `Index nennt fehlende Datei ${m[1]}`);
});

test('CLAUDE.md behält die Sicherheits- und Architekturregeln', () => {
  const t = lies('CLAUDE.md');
  for (const s of [/Commit/, /Push/, /Freigabe/, /Bedrock/, /geprüft/, /deterministisch/, /Opus/, /Zugangs|Token, Passwörter/, /Ebene 0/, /nur WAS|nie WIE/, /keine Abhängigkeiten/, /Faithful/]) assert.match(t, s, String(s));
});

test('Verwiesene Dateien in den geladenen Dokumenten existieren', () => {
  for (const d of Object.keys(BUDGET)) {
    for (const m of lies(d).matchAll(/`((?:docs|tools|test|data|src)\/[A-Za-z0-9_./-]+\.(?:md|js|json))`/g)) {
      if (m[1].includes('*') || m[1].includes('<')) continue;
      assert.ok(fs.existsSync(path.join(wurzel, m[1])), `${d} verweist auf fehlende Datei ${m[1]}`);
    }
  }
});

test('Modell-Routing (Jonah, 31.10.2026) steht in CLAUDE.md und in beiden Entscheidungsdateien', () => {
  const claude = lies('CLAUDE.md');
  for (const wort of ['rein mechanische Änderungen ohne eigene Entscheidungslogik', 'Heuristik', 'Korrektheitsgarantie', 'zu Sonnet wechseln']) assert.ok(claude.includes(wort), `CLAUDE.md nennt „${wort}“`);
  assert.ok(lies('docs/entscheidungen.md').includes('- Modell-Routing (Jonah, 31.10.2026):') && lies('docs/kurz/entscheidungen-kurz.md').includes('- Modell-Routing (Jonah, 31.10.2026):'));
});

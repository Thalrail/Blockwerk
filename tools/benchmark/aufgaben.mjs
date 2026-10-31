// Die drei Benchmark-Aufgaben: Vorbereitung (Fehler einbauen), Auftrag, Abnahme. Alles deterministisch; läuft in einer Kopie.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MUTATION = ['.filter((x) => x.rollen.length);', '.filter((x) => x.rollen.length > 1);'];
const lies = (d, p) => fs.readFileSync(path.join(d, p), 'utf8');
const schreibe = (d, p, t) => fs.writeFileSync(path.join(d, p), t);
const node = (d, args) => spawnSync(process.execPath, args, { cwd: d, encoding: 'utf8', timeout: 300000 });
const gitDiff = (d) => spawnSync('git', ['diff', '--stat', 'HEAD'], { cwd: d, encoding: 'utf8' }).stdout;

export const AUFGABEN = {
  T1: {
    name: 'Kleiner Bugfix',
    vorbereiten(d) {
      const t = lies(d, 'src/ebene3/materialisiere.js');
      if (!t.includes(MUTATION[0])) throw new Error('Mutationsstelle fehlt');
      schreibe(d, 'src/ebene3/materialisiere.js', t.replace(MUTATION[0], MUTATION[1]));
    },
    auftrag: 'Der Test test/ebene3/palette.test.js schlägt fehl. Finde die Ursache im Code (nicht im Test) und behebe sie mit der kleinsten Änderung. Kein Commit.',
    abnehmen(d) {
      const t = node(d, ['--test', 'test/ebene3/palette.test.js']);
      const diff = gitDiff(d);
      const dateien = [...diff.matchAll(/^ (\S+)\s+\|/gm)].map((m) => m[1]);
      const ok = t.status === 0 && dateien.length === 1 && dateien[0].endsWith('materialisiere.js');
      return { ok, hinweis: `Test ${t.status === 0 ? 'grün' : 'ROT'}, geänderte Dateien: ${dateien.join(', ') || 'keine'}` };
    },
  },
  T2: {
    name: 'Neue Funktion mit Tests',
    vorbereiten() {},
    auftrag: 'Erweitere globZuRegex in tools/orchestrierung/tore.js um Alternativen in geschweiften Klammern: "src/{a,b}/*.js" soll src/a/x.js und src/b/x.js treffen, aber nicht src/c/x.js; "*" bleibt innerhalb eines Ordners. Schreibe Tests dazu in test/orchestrierung/tore.orchestrierung.js und führe diese Datei aus. Kein Commit.',
    abnehmen(d) {
      const probe = `import { globZuRegex as g } from './tools/orchestrierung/tore.js';
const r = g('src/{a,b}/*.js'); const s = g('x/{p,q}.md'); const alt = g('docs/*.md'); const dd = g('src/**/*.js');
const ok = r.test('src/a/x.js') && r.test('src/b/y.js') && !r.test('src/c/x.js') && !r.test('src/a/u/x.js') && s.test('x/p.md') && s.test('x/q.md') && !s.test('x/r.md') && !s.test('x/p.mdx')
  && alt.test('docs/a.md') && !alt.test('docs/x/a.md') && dd.test('src/a/b/c.js') && g('a.b').test('a.b') && !g('a.b').test('aXb');
process.exit(ok ? 0 : 1);`;
      fs.writeFileSync(path.join(d, '__abnahme.mjs'), probe);
      const p = node(d, ['__abnahme.mjs']);
      fs.rmSync(path.join(d, '__abnahme.mjs'));
      const t = node(d, ['--test', 'test/orchestrierung/tore.orchestrierung.js']);
      const hatTests = /tore\.orchestrierung\.js\s+\|/.test(gitDiff(d));
      const ok = p.status === 0 && t.status === 0 && hatTests;
      return { ok, hinweis: `Abnahmeprobe ${p.status === 0 ? 'ok' : 'FEHLER'}, Testdatei ${t.status === 0 ? 'grün' : 'ROT'}, neue Tests ${hatTests ? 'ja' : 'NEIN'}` };
    },
  },
  T3: {
    name: 'Codeanalyse über mehrere Module',
    vorbereiten() {},
    auftrag: 'Analyse ohne Codeänderung: Beschreibe in höchstens 25 Zeilen, wie die Palette (Materialwahl) von der Eingabe bis zu den gesetzten Blöcken durch Ebene 3 fließt. Nenne jede beteiligte Funktion als `Datei:Funktion` (mindestens 6, nur wirklich vorhandene). Schreibe nichts in Dateien.',
    abnehmen(d, antwort) {
      const refs = [...new Set([...(antwort || '').matchAll(/((?:src|tools)\/[\w./-]+\.js):(\w+)/g)].map((m) => `${m[1]}:${m[2]}`))];
      let gueltig = 0;
      for (const r of refs) {
        const [f, fn] = r.split(':');
        try { if (new RegExp(`\\b${fn}\\b`).test(lies(d, f))) gueltig++; } catch { /* Datei fehlt */ }
      }
      const geaendert = gitDiff(d).trim() !== '';
      const ok = gueltig >= 6 && gueltig === refs.length && !geaendert;
      return { ok, hinweis: `${gueltig}/${refs.length} Fundstellen gültig${geaendert ? ', Dateien verändert!' : ''}` };
    },
  },
};

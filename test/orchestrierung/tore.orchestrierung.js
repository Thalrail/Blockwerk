// Orchestrierung: Freigabegrenzen („Tore“). Was ein Agent ändern darf, was Jonah entscheiden muss, was nie automatisch geschieht.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { schnappschuss, seed } from '../../tools/orchestrierung/schnappschuss.js';
import { pruefeTore, bewerteTore, globZuRegex } from '../../tools/orchestrierung/tore.js';
import { neuesRepo, neuerName, w, text } from './hilfe.js';

/** Führt `aend(worktree)` als „Agentenarbeit“ aus und liefert die Funde. */
function funde(aend, opt = {}) {
  const repo = neuesRepo();
  const s0 = schnappschuss(repo, { id: 'a' });
  const wt = seed(repo, s0.commit, neuerName('wt'));
  aend(wt);
  const s1 = schnappschuss(wt, { id: 'b', eltern: s0.commit });
  return pruefeTore(repo, s0.commit, s1.commit, { ausgeschlossen: s1.ausgeschlossen, ...opt }).findings;
}
const hat = (f, stufe, tor, pfad) => f.some((x) => x.stufe === stufe && x.tor === tor && (pfad === undefined || x.pfad === pfad));
const paket = (wt, aend) => { const p = JSON.parse(text(wt, 'package.json')); aend(p); w(wt, 'package.json', `${JSON.stringify(p, null, 2)}\n`); };

test('Routinearbeit im Auftrag erzeugt keinen Fund', () => {
  const f = funde((wt) => { w(wt, 'src/a.js', 'eins\nZWEI\ndrei\nvier\nfünf\nsechs\n'); w(wt, 'src/neu/z.js', "import fs from 'node:fs';\nimport { b } from '../b.js';\nexport default [fs, b];\n"); w(wt, 'docs/stand.md', '# Stand\nneu\n'); w(wt, 'test/neu.test.js', 'x\n'); }, { dateien: ['src/**', 'docs/stand.md', 'test/**'] });
  assert.deepEqual(f, []);
});

test('Neue Abhängigkeiten: package.json, Lock-Datei, fremde Importe und Netz-Adressen verlangen Zustimmung', () => {
  assert.ok(hat(funde((wt) => paket(wt, (p) => { p.dependencies = { lodash: '4.0.0' }; })), 'frage', 'abhaengigkeit', 'package.json'));
  assert.ok(hat(funde((wt) => paket(wt, (p) => { p.devDependencies = { x: '1' }; })), 'frage', 'abhaengigkeit'));
  assert.ok(hat(funde((wt) => w(wt, 'package-lock.json', '{}\n')), 'frage', 'abhaengigkeit', 'package-lock.json'));
  assert.ok(hat(funde((wt) => w(wt, 'src/neu1.js', "import _ from 'lodash';\nexport default _;\n")), 'frage', 'abhaengigkeit', 'src/neu1.js'));
  assert.ok(hat(funde((wt) => w(wt, 'src/neu2.js', "const m = require('express');\n")), 'frage', 'abhaengigkeit'));
  assert.ok(hat(funde((wt) => w(wt, 'src/neu3.js', "import x from 'https://cdn.example.com/x.js';\n")), 'frage', 'abhaengigkeit'));
  assert.ok(hat(funde((wt) => w(wt, 'index.html', '<script src="https://cdn.example.com/x.js"></script>\n')), 'frage', 'abhaengigkeit', 'index.html'));
  // erlaubt: relative Importe, node:-Module, Standardbibliothek ohne Präfix, ein neues Skript in package.json (nur Hinweis)
  const ok = funde((wt) => { w(wt, 'src/neu4.js', "import fs from 'fs';\nimport p from 'node:path';\nimport q from './b.js';\n"); paket(wt, (p) => { p.scripts['test:neu'] = 'echo'; }); });
  assert.ok(!ok.some((x) => x.tor === 'abhaengigkeit'));
  assert.ok(hat(ok, 'info', 'skript'));
});

test('Architektur: Ebenengrenzen sind hart, Entscheidungsdokumente, Datenformat und neue Bereiche verlangen Zustimmung', () => {
  assert.ok(hat(funde((wt) => w(wt, 'src/ebene1/e1.js', "import { e3 } from '../ebene3/e3.js';\nexport const e1 = e3;\n")), 'stopp', 'ebenengrenze', 'src/ebene1/e1.js'));
  assert.ok(!funde((wt) => w(wt, 'src/ebene3/e3.js', "import { e1 } from '../ebene1/e1.js';\nexport const e3 = e1;\n")).some((x) => x.tor === 'ebenengrenze'), 'nach unten ist erlaubt');
  assert.ok(hat(funde((wt) => w(wt, 'docs/entscheidungen.md', '# Entscheidungen\n- neu\n')), 'frage', 'entscheidung'));
  assert.ok(hat(funde((wt) => w(wt, 'CLAUDE.md', 'x\n')), 'frage', 'entscheidung'));
  assert.ok(hat(funde((wt) => w(wt, 'src/ebene1/e1.js', 'export const VERSION = 2;\n')), 'frage', 'datenformat'));
  assert.ok(hat(funde((wt) => w(wt, 'src/ebene6/neu.js', 'x\n')), 'frage', 'architektur'));
  assert.ok(hat(funde((wt) => paket(wt, (p) => { p.type = 'commonjs'; })), 'frage', 'architektur', 'package.json'));
});

test('Bedrock-Regeln: geprüft setzen ist verboten, bestehende Bedrock-Regeln ändern verlangt Zustimmung, neue Regeln brauchen Quelle', () => {
  const regel = (wt, aend) => { const d = JSON.parse(text(wt, 'data/regeln/lore.json')); aend(d); w(wt, 'data/regeln/lore.json', `${JSON.stringify(d, null, 2)}\n`); };
  assert.ok(hat(funde((wt) => regel(wt, (d) => { d.regeln[0].status = 'geprüft'; })), 'stopp', 'geprueft-status'));
  assert.ok(hat(funde((wt) => regel(wt, (d) => { d.regeln.push({ id: 'lore.neu', titel: 't', regel: 'r', quelle: 'q', status: 'geprüft', ungeprueft: false }); })), 'stopp', 'geprueft-status'));
  assert.ok(hat(funde((wt) => regel(wt, (d) => { d.regeln[0].parameter.n = 2; })), 'frage', 'bedrock-regel'));
  assert.ok(hat(funde((wt) => regel(wt, (d) => { d.regeln.shift(); })), 'frage', 'bedrock-regel'));
  assert.ok(hat(funde((wt) => regel(wt, (d) => { d.regeln.push({ id: 'lore.neu', titel: 't', regel: 'r', status: 'simuliert', ungeprueft: false }); })), 'frage', 'bedrock-regel'), 'ohne Quelle');
  assert.ok(hat(funde((wt) => regel(wt, (d) => { d.regeln.push({ id: 'lore.neu', titel: 't', regel: 'r', quelle: 'q', status: 'simuliert', ungeprueft: true, testanleitung: 'kurz' }); })), 'frage', 'bedrock-regel'), 'ungeprüft ohne Testanleitung');
  assert.ok(hat(funde((wt) => regel(wt, (d) => { d.regeln.push({ id: 'lore.neu', titel: 't', regel: 'r', quelle: 'q', status: 'simuliert', ungeprueft: true, testanleitung: 'Bau eine Strecke und miss die Länge im Spiel.' }); })), 'info', 'bedrock-regel'), 'vollständig dokumentiert: nur Hinweis');
  assert.ok(hat(funde((wt) => regel(wt, (d) => { d.regeln[1].parameter.n = 5; }), { dateien: ['data/regeln/lore.json'] }), 'info', 'entwurfsregel'), 'Entwurfsregel (plan.*) im Auftrag ist frei');
  assert.ok(hat(funde((wt) => regel(wt, (d) => { d.regeln[1].parameter.n = 5; }), { dateien: ['src/**'] }), 'frage', 'entwurfsregel'), 'außerhalb des Auftrags: Frage');
  assert.ok(hat(funde((wt) => w(wt, 'data/wesen.json', '{}\n')), 'frage', 'bedrock-daten'));
});

test('Sicherheit: Orchestrierungsdateien, Hooks, Einstellungen, CI und .gitignore ändert nur der Koordinator', () => {
  for (const p of ['.claude/settings.json', '.claude/launch.json', '.claude/hooks/x.js', '.claude/agents/x.md', '.claude/skills/x/SKILL.md', 'tools/orchestrierung/x.js', '.gitignore', '.github/workflows/x.yml']) {
    assert.ok(hat(funde((wt) => w(wt, p, p.endsWith('.json') ? '{}\n' : 'x\n')), 'stopp', 'sicherheit', p), p);
  }
});

test('Zeilenenden, Dateien außerhalb des Auftrags und nicht übernommene Dateien', () => {
  assert.ok(hat(funde((wt) => w(wt, 'docs/crlf.md', 'x\ny\nz\n')), 'stopp', 'zeilenenden', 'docs/crlf.md'));
  assert.ok(hat(funde((wt) => w(wt, 'docs/neu-crlf.md', 'a\r\nb\r\n')), 'frage', 'zeilenenden'));
  assert.ok(!funde((wt) => w(wt, 'docs/neu-lf.md', 'a\nb\n')).some((x) => x.tor === 'zeilenenden'));
  assert.ok(hat(funde((wt) => w(wt, 'web/x.js', 'x\n'), { dateien: ['src/**'] }), 'frage', 'ausserhalb-auftrag', 'web/x.js'));
  assert.ok(!funde((wt) => w(wt, 'src/x/y.js', 'x\n'), { dateien: ['src/**'] }).some((x) => x.tor === 'ausserhalb-auftrag'));
  // eine Datei, die der Snapshot nicht aufnimmt (verbotener Name), darf nicht still verloren gehen
  const f = funde((wt) => { w(wt, 'src/neu/token.json', '{}\n'); w(wt, 'fremd/neu.txt', 'x\n'); });
  assert.ok(hat(f, 'frage', 'nicht-uebernommen', 'src/neu/token.json') && hat(f, 'frage', 'nicht-uebernommen', 'fremd/neu.txt'));
});

test('Bewertung: stopp blockiert immer, frage nur ohne Zustimmung; Globs', () => {
  const f = [{ stufe: 'stopp', tor: 'sicherheit', pfad: 'a', grund: '' }, { stufe: 'frage', tor: 'abhaengigkeit', pfad: 'package.json', grund: '' }, { stufe: 'info', tor: 'skript', pfad: 'p', grund: '' }];
  assert.equal(bewerteTore(f, []).frei, false);
  assert.equal(bewerteTore(f, ['abhaengigkeit', 'sicherheit']).frei, false, 'stopp ist nicht freizugeben');
  const nurFrage = f.filter((x) => x.stufe !== 'stopp');
  assert.equal(bewerteTore(nurFrage, []).frei, false);
  assert.equal(bewerteTore(nurFrage, ['abhaengigkeit']).frei, true);
  assert.equal(bewerteTore(nurFrage, ['abhaengigkeit:package.json']).frei, true);
  assert.equal(bewerteTore(nurFrage, ['abhaengigkeit:andere.json']).frei, false);
  assert.equal(bewerteTore([], []).frei, true);
  const g = globZuRegex('src/**/*.js');
  assert.ok(g.test('src/a/b/c.js') && g.test('src/c.js') && !g.test('src/c.json') && !g.test('x/src/c.js'));
  assert.ok(globZuRegex('docs/*.md').test('docs/a.md') && !globZuRegex('docs/*.md').test('docs/x/a.md'));
});

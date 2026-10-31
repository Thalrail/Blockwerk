// Orchestrierung: ganzer Lauf mit den echten Hook-Skripten in einem Wegwerf-Repository: Start, Worktree über den Hook, mehrere Korrekturrunden,
// Tore, Übernahme, Wiederherstellung, Ende. Der Hauptarbeitsbaum bleibt während der isolierten Entwicklung unverändert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { git, zustand } from '../../tools/orchestrierung/git.js';
import { schnappschuss, seed } from '../../tools/orchestrierung/schnappschuss.js';
import * as lauf from '../../tools/orchestrierung/lauf.js';
import { fuehreAus } from '../../tools/orchestrierung/cli.js';
import { neuesRepo, neuerName, WURZEL, w, text } from './hilfe.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(HIER, '../../.claude/hooks/worktree-hook.js');
const UEBERNEHMEN = pathToFileURL(path.resolve(HIER, '../../tools/orchestrierung/uebernehmen.js')).href;
const vor = (p) => p.replace(/\\/g, '/');
const hook = (repo, ein) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ cwd: repo, ...ein }), encoding: 'utf8', cwd: repo });
const erstelle = (repo, name = 'agent-test') => { const h = hook(repo, { hook_event_name: 'WorktreeCreate', name }); assert.equal(h.status, 0, h.stderr); return h.stdout.trim(); };
const AUSSER = lauf.AUSSER;
const buch = (z) => ({ head: z.head, zweig: z.zweig, stash: z.stash, refs: z.refs, index: z.index });

test('Hook ohne aktiven Lauf, mit geändertem HEAD und mit unlesbarer Eingabe bricht ab (fail-closed), es entsteht kein Worktree', () => {
  const repo = neuesRepo();
  let h = hook(repo, { hook_event_name: 'WorktreeCreate', name: 'agent-x' });
  assert.equal(h.status, 1);
  assert.match(h.stderr, /Kein aktiver Orchestrierungslauf/);
  assert.equal(h.stdout, '', 'kein Pfad auf stdout');
  assert.ok(!fs.existsSync(path.join(repo, '.claude', 'worktrees')) || fs.readdirSync(path.join(repo, '.claude', 'worktrees')).length === 0);
  lauf.starten(repo, { auftrag: 'Test', dateien: ['src/**'] });
  git(repo, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-q', '-m', 'dazwischen']);
  h = hook(repo, { hook_event_name: 'WorktreeCreate', name: 'agent-x' });
  assert.equal(h.status, 1);
  assert.match(h.stderr, /HEAD hat sich seit dem Start des Laufs geändert/);
  assert.ok(!fs.existsSync(path.join(repo, '.claude', 'worktrees')) || fs.readdirSync(path.join(repo, '.claude', 'worktrees')).length === 0);
  const kaputt = spawnSync(process.execPath, [HOOK], { input: 'kein json', encoding: 'utf8', cwd: repo });
  assert.equal(kaputt.status, 1);
  assert.match(fs.readFileSync(path.join(repo, '.claude', 'orchestrierung', 'hook.log'), 'utf8'), /"ergebnis":"abgelehnt"/);
});

test('Ganzer Lauf: Hook-Worktree sieht den uncommitteten Stand; Folgeagent sieht die Vorrunde (nie wieder S0); höchstens drei Korrekturschleifen', () => {
  const repo = neuesRepo();
  const vorher = zustand(repo);
  const start = lauf.starten(repo, { auftrag: 'Kleine Änderung', dateien: ['src/**', 'docs/stand.md'] });
  assert.ok(start.ausgeschlossen.some((x) => x.pfad === '.env'), 'Geheimnisdatei nicht im Snapshot');
  // Runde 1
  const wt1 = erstelle(repo, 'agent-r1');
  assert.ok(wt1.startsWith(`${vor(repo)}/.claude/worktrees/`), wt1);
  assert.equal(text(wt1, 'src/a.js'), text(repo, 'src/a.js'), 'uncommitteter Stand im Worktree sichtbar');
  assert.ok(fs.existsSync(path.join(wt1, 'docs/neu.md')) && !fs.existsSync(path.join(wt1, '.env')));
  w(wt1, 'src/runde1.js', 'export const r = 1;\n');
  const r1 = lauf.rundeEnde(repo, { worktree: wt1 });
  assert.equal(r1.runde, 1); assert.equal(r1.unveraendert, false);
  assert.deepEqual(r1.geaendert.map((x) => x.pfad), ['src/runde1.js']);
  assert.equal(r1.bewertung.frei, true);
  // Runde 2: ein NEUER Agent bekommt einen NEUEN Worktree, der die Arbeit von Runde 1 enthält
  const wt2 = erstelle(repo, 'agent-r2');
  assert.notEqual(wt2, wt1);
  assert.equal(text(wt2, 'src/runde1.js'), 'export const r = 1;\n', 'Folgeagent sieht den Stand der Vorrunde');
  assert.equal(git(wt2, ['rev-parse', 'HEAD']).trim(), r1.commit, 'Basis ist der Zwischen-Snapshot, nicht S0');
  w(wt2, 'src/runde2.js', 'export const r = 2;\n');
  const r2 = lauf.rundeEnde(repo, { worktree: wt2 });
  assert.deepEqual(r2.geaendert.map((x) => x.pfad), ['src/runde1.js', 'src/runde2.js'], 'Delta ist immer gegen S0 (kumulativ)');
  // eine Runde ohne Änderung wird als solche erkannt
  const wt3 = erstelle(repo, 'agent-r3');
  assert.equal(lauf.rundeEnde(repo, { worktree: wt3 }).unveraendert, true);
  const wt4 = erstelle(repo, 'agent-r4');
  w(wt4, 'src/runde4.js', 'x\n');
  assert.equal(lauf.rundeEnde(repo, { worktree: wt4 }).runde, 4);
  assert.throws(() => lauf.rundeEnde(repo, { worktree: wt4 }), /Mehr als 3 Korrekturschleifen/);
  // der Hauptarbeitsbaum wurde in all den Runden nicht angefasst
  const nachher = zustand(repo, { ausser: AUSSER });
  assert.deepEqual(buch(nachher), buch(vorher));
  assert.equal(lauf.hauptKontrolle(repo).unveraendert, true);
  assert.ok(!fs.existsSync(path.join(repo, 'src/runde1.js')));
  // fremde Verzeichnisse sind keine Worktrees dieses Laufs
  assert.throws(() => lauf.rundeEnde(repo, { worktree: neuerName('fremd') }), /kein Worktree dieses Laufs/);
});

test('Tore vor der Übernahme, Zustimmung, Übernahme, Kontrolle und Ende', () => {
  const repo = neuesRepo();
  const vorher = zustand(repo);
  lauf.starten(repo, { auftrag: 'Mit Abhängigkeit', dateien: ['src/**', 'package.json'] });
  const wt = erstelle(repo);
  w(wt, 'src/neu/dep.js', "import _ from 'lodash';\nexport default _;\n");
  const r = lauf.rundeEnde(repo, { worktree: wt });
  assert.equal(r.bewertung.frei, false);
  const abgelehnt = lauf.uebernehmen(repo);
  assert.equal(abgelehnt.status, 'abgelehnt'); assert.equal(abgelehnt.grund, 'tore');
  assert.ok(abgelehnt.offen.some((x) => x.tor === 'abhaengigkeit'));
  assert.ok(!fs.existsSync(path.join(repo, 'src/neu/dep.js')), 'nichts übernommen');
  assert.deepEqual(buch(zustand(repo, { ausser: AUSSER })), buch(vorher));
  assert.throws(() => lauf.beenden(repo), /nicht übernommene Arbeit/);
  // Jonah stimmt zu → Übernahme
  const ok = lauf.uebernehmen(repo, { erlaubt: ['abhaengigkeit'] });
  assert.equal(ok.status, 'uebernommen');
  assert.deepEqual(ok.dateien, ['src/neu/dep.js']);
  assert.equal(ok.kontrolle.unveraendert, true, 'HEAD, Zweig, Stash, Refs, Index unberührt; nur die erwartete Datei ist neu');
  assert.equal(text(repo, 'src/neu/dep.js'), "import _ from 'lodash';\nexport default _;\n");
  assert.deepEqual(buch(zustand(repo, { ausser: AUSSER })), buch(vorher));
  assert.throws(() => lauf.uebernehmen(repo), /schon übernommen/);
  const ende = lauf.beenden(repo);
  assert.deepEqual(ende.entfernteWorktrees, [wt]);
  assert.ok(!fs.existsSync(wt) && lauf.lies(repo) === null);
  assert.ok(!git(repo, ['worktree', 'list']).includes('.claude/worktrees'));
  // danach darf ein neuer Lauf beginnen; ohne Lauf legt der Hook wieder nichts an
  assert.equal(hook(repo, { hook_event_name: 'WorktreeCreate', name: 'agent-x' }).status, 1);
  assert.ok(lauf.starten(repo, { auftrag: 'Zweiter Lauf' }).id);
});

test('Stopp-Tore sind nie freizugeben; Konflikte im Hauptbaum lehnen ab; Verwerfen räumt auf', () => {
  const repo = neuesRepo();
  lauf.starten(repo, { auftrag: 'Sicherheit', dateien: ['src/**'] });
  assert.throws(() => lauf.starten(repo, { auftrag: 'noch einer' }), /läuft noch/);
  const wt = erstelle(repo);
  w(wt, '.claude/hooks/boese.js', 'x\n'); w(wt, 'src/gut.js', 'x\n');
  const r = lauf.rundeEnde(repo, { worktree: wt });
  assert.ok(r.bewertung.stopp.some((x) => x.tor === 'sicherheit'));
  assert.equal(lauf.uebernehmen(repo, { erlaubt: ['sicherheit', 'sicherheit:.claude/hooks/boese.js'] }).status, 'abgelehnt');
  assert.ok(!fs.existsSync(path.join(repo, 'src/gut.js')));
  lauf.beenden(repo, { verwerfen: true });
  // Konflikt: jemand ändert denselben Text im Hauptbaum, während der Agent arbeitet
  lauf.starten(repo, { auftrag: 'Konflikt', dateien: ['src/**'] });
  const wt2 = erstelle(repo);
  w(wt2, 'src/a.js', 'eins\nZWEI\ndrei\nAGENT\nfünf\n');
  lauf.rundeEnde(repo, { worktree: wt2 });
  w(repo, 'src/a.js', 'eins\nZWEI\ndrei\nMENSCH\nfünf\n');
  const k = lauf.uebernehmen(repo);
  assert.equal(k.status, 'abgelehnt'); assert.equal(k.grund, 'konflikt');
  assert.equal(text(repo, 'src/a.js'), 'eins\nZWEI\ndrei\nMENSCH\nfünf\n', 'die Änderung des Menschen ist unangetastet');
});

test('Unterbrochene Übernahme wird beim nächsten Start automatisch zurückgesetzt', () => {
  const repo = neuesRepo();
  const s0 = schnappschuss(repo, { id: 'a' });
  const wt = seed(repo, s0.commit, neuerName('wt'));
  w(wt, 'src/a.js', 'x\n'); w(wt, 'src/b.js', 'y\n'); w(wt, 'docs/neu.md', 'z\n'); w(wt, 'docs/stand.md', 'q\n');
  const s1 = schnappschuss(wt, { id: 'b', eltern: s0.commit });
  const vorher = zustand(repo, { ausser: AUSSER });
  const sich = path.join(repo, '.claude', 'orchestrierung', 'sicherung', 'L-abgestuerzt');
  const skript = path.join(WURZEL, 'crash-lauf.mjs');
  fs.writeFileSync(skript, `import { planen, anwenden } from ${JSON.stringify(UEBERNEHMEN)};\nconst akt = planen(${JSON.stringify(repo)}, ${JSON.stringify(s0.commit)}, ${JSON.stringify(s1.commit)});\nanwenden(${JSON.stringify(repo)}, akt, ${JSON.stringify(sich)}, { vorSchritt: (k) => { if (k === 2) process.exit(137); } });\n`);
  assert.equal(spawnSync(process.execPath, [skript], { encoding: 'utf8' }).status, 137);
  assert.notEqual(zustand(repo, { ausser: AUSSER }).baum, vorher.baum);
  assert.deepEqual(lauf.status(repo).unterbrochen, [vor(sich)]);
  const s = lauf.starten(repo, { auftrag: 'nach Absturz' });
  assert.deepEqual(s.wiederhergestellt, [{ sicherung: vor(sich), ergebnis: 'zurueckgesetzt' }]);
  assert.deepEqual(zustand(repo, { ausser: AUSSER }).dateien, vorher.dateien, 'der Hauptbaum ist wieder genau wie vor dem Absturz');
  assert.equal(git(repo, ['rev-parse', `${s.s0}^{tree}`]).trim(), s0.tree, 'derselbe Stand ergibt denselben Snapshot-Baum');
});

test('Hauptkontrolle meldet Änderungen am Hauptbaum, Review-Meldung prüft den Einzelmodus, Paket entsteht im Review-Ordner', () => {
  const repo = neuesRepo();
  lauf.starten(repo, { auftrag: 'Review', dateien: ['src/**'], kontext: ['docs/stand.md'] });
  const wt = erstelle(repo);
  w(wt, 'src/neu/y.js', "import { b } from '../b.js';\nexport default b;\n");
  lauf.rundeEnde(repo, { worktree: wt });
  assert.equal(lauf.hauptKontrolle(repo).unveraendert, true);
  w(repo, 'docs/keep.md', 'jemand schreibt im Hauptbaum\n');
  const k = lauf.hauptKontrolle(repo);
  assert.equal(k.unveraendert, false); assert.deepEqual(k.unerwarteteDateien, ['docs/keep.md']);
  const iso = neuerName('codex-review');
  const p = lauf.paket(repo, { wurzel: iso, hinweise: 'Test' });
  assert.ok(p.dir.startsWith(vor(iso)) || p.dir.startsWith(iso));
  assert.equal(p.diffIdentisch, true); assert.deepEqual(p.abweichungen, []);
  assert.equal(p.aufruf.auto_diff, false);
  const gut = { review_mode: 'single', failover_occurred: false, provider: 'codex', verdict: 'approve', session_id: 's1', models: [{ provider: 'codex' }] };
  assert.equal(lauf.reviewMelden(repo, gut).gueltig, true);
  const bad = lauf.reviewMelden(repo, { ...gut, failover_occurred: true, provider: 'gemini' });
  assert.equal(bad.gueltig, false);
  const log = fs.readFileSync(path.join(repo, '.claude', 'orchestrierung', 'laeufe', lauf.lies(repo).id, 'reviews.jsonl'), 'utf8').trim().split('\n').map((x) => JSON.parse(x));
  assert.deepEqual(log.map((x) => x.gueltig), [true, false]);
});

test('Kommandozeile: start, status, runde-ende, ende; Fehler werden als JSON gemeldet', () => {
  const repo = neuesRepo();
  const cli = path.resolve(HIER, '../../tools/orchestrierung/cli.js');
  const lauf1 = (...a) => JSON.parse(execFileSync(process.execPath, [cli, ...a], { cwd: repo, encoding: 'utf8' }));
  const s = lauf1('start', '--auftrag', 'CLI-Test', '--dateien', 'src/**,docs/**');
  assert.ok(s.id && s.s0);
  assert.equal(lauf1('status').aktiv, true);
  const wt = erstelle(repo);
  w(wt, 'src/cli.js', 'x\n');
  const r = lauf1('runde-ende', '--worktree', wt);
  assert.equal(r.runde, 1);
  assert.equal(lauf1('tore').bewertung.frei, true);
  const fehler = spawnSync(process.execPath, [cli, 'start', '--auftrag', 'zweiter', '--dateien', 'src/**'], { cwd: repo, encoding: 'utf8' });
  assert.equal(fehler.status, 1); assert.match(JSON.parse(fehler.stdout).fehler, /läuft noch/);
  const ohneDateien = spawnSync(process.execPath, [cli, 'start', '--auftrag', 'x'], { cwd: repo, encoding: 'utf8' });
  assert.equal(ohneDateien.status, 1); assert.match(JSON.parse(ohneDateien.stdout).fehler, /start braucht --dateien/);
  assert.equal(lauf1('ende', '--verwerfen').entfernteWorktrees.length, 1);
  assert.equal(lauf1('status').aktiv, false);
  assert.throws(() => fuehreAus(['gibtsnicht'], repo), /Unbekannter Befehl/);
});

test('Hook Remove lässt den Worktree stehen', () => {
  const repo = neuesRepo();
  lauf.starten(repo, { auftrag: 'Remove' });
  const wt = erstelle(repo);
  const h = hook(repo, { hook_event_name: 'WorktreeRemove', worktree_path: wt });
  assert.equal(h.status, 0, h.stderr);
  assert.ok(fs.existsSync(wt));
});

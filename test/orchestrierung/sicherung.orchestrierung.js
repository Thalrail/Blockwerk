// Orchestrierung: dauerhafte Rundensicherung als Pack-Datei (tools/orchestrierung/sicherung.js). Der Pack ist die einzige dauerhafte Sicherung eines Zwischenstands:
// Er legt keine Git-Referenz an (der Wächter vergleicht alle Referenzen) und überlebt `git gc --prune=now`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { git, gitStatus, zustand, sha256 } from '../../tools/orchestrierung/git.js';
import * as lauf from '../../tools/orchestrierung/lauf.js';
import { sichereRunde, pruefePack, entpacke, SicherungsFehler } from '../../tools/orchestrierung/sicherung.js';
import { neuesRepo, w, text } from './hilfe.js';

const HOOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.claude/hooks/worktree-hook.js');
const erstelle = (repo, name) => { const h = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ cwd: repo, hook_event_name: 'WorktreeCreate', name }), encoding: 'utf8', cwd: repo }); assert.equal(h.status, 0, h.stderr); return h.stdout.trim(); };
const buch = (z) => ({ head: z.head, zweig: z.zweig, stash: z.stash, refs: z.refs, index: z.index });
const sicherungsDir = (repo) => path.join(lauf.laufDir(repo, lauf.status(repo).id), 'sicherung');

/** Lauf mit einer Runde: liefert Repo, Worktree und die Rückgabe von runde-ende. */
function eineRunde() {
  const repo = neuesRepo();
  lauf.starten(repo, { auftrag: 'Sicherung', dateien: ['src/**'] });
  const wt = erstelle(repo, 'agent-s1');
  w(wt, 'src/runde1.js', 'export const r = 1;\n');
  const runde = lauf.rundeEnde(repo, { worktree: wt });
  return { repo, wt, runde };
}

test('runde-ende sichert jede Runde als Pack: Datei da, Prüfsumme und verify-pack stimmen, keine Git-Referenz entsteht, status zeigt die Sicherung', () => {
  const repo = neuesRepo();
  const vorher = zustand(repo);
  lauf.starten(repo, { auftrag: 'Sicherung', dateien: ['src/**'] });
  const wt = erstelle(repo, 'agent-s1');
  w(wt, 'src/runde1.js', 'export const r = 1;\n');
  const r1 = lauf.rundeEnde(repo, { worktree: wt });
  assert.match(r1.sicherung.pack, /^runde-1-[0-9a-f]{40}\.pack$/);
  assert.equal(r1.sicherung.commit, r1.commit);
  assert.ok(fs.existsSync(path.join(sicherungsDir(repo), r1.sicherung.pack)) && fs.existsSync(path.join(sicherungsDir(repo), r1.sicherung.idx)));
  assert.equal(pruefePack(repo, sicherungsDir(repo), r1.sicherung), true);
  // zweite Runde: eigener Pack, enthält die ganze Kette seit dem Start
  const wt2 = erstelle(repo, 'agent-s2');
  w(wt2, 'src/runde2.js', 'export const r = 2;\n');
  const r2 = lauf.rundeEnde(repo, { worktree: wt2 });
  assert.notEqual(r2.sicherung.pack, r1.sicherung.pack);
  assert.equal(lauf.status(repo).runden.map((x) => x.sicherung).join(), `${r1.sicherung.pack},${r2.sicherung.pack}`);
  // Anforderung 2: Referenzen, HEAD, Zweig, Stash und Index des Hauptrepositorys blieben unverändert
  assert.deepEqual(buch(zustand(repo, { ausser: lauf.AUSSER })), buch(vorher));
  assert.equal(lauf.hauptKontrolle(repo).unveraendert, true);
});

test('Der Pack überlebt die Git-Bereinigung: nach gc --prune=now ist der Snapshot weg, entpacke stellt ihn her (Baum, Dateien), ohne eine Referenz anzulegen', () => {
  const { repo, runde } = eineRunde();
  const dir = sicherungsDir(repo);
  const baum = JSON.parse(fs.readFileSync(path.join(lauf.laufDir(repo, lauf.status(repo).id), 'runde-1.json'), 'utf8')).tree;
  lauf.beenden(repo, { verwerfen: true });
  git(repo, ['reflog', 'expire', '--expire=now', '--all']);
  git(repo, ['gc', '--prune=now', '-q']);
  assert.notEqual(gitStatus(repo, ['cat-file', '-e', runde.commit]).status, 0, 'ohne Sicherung wäre der Zwischenstand verloren');
  const refsVorher = git(repo, ['for-each-ref']);
  assert.equal(entpacke(repo, dir, runde.sicherung), runde.commit);
  assert.equal(gitStatus(repo, ['cat-file', '-e', runde.commit]).status, 0);
  assert.equal(git(repo, ['rev-parse', `${runde.commit}^{tree}`]).trim(), baum);
  assert.equal(git(repo, ['show', `${runde.commit}:src/runde1.js`]), 'export const r = 1;\n');
  assert.equal(git(repo, ['for-each-ref']), refsVorher, 'das Entpacken legt keine Referenz an');
});

test('Negativ: ein veränderter oder fehlender Pack wird erkannt und nie entpackt', () => {
  const { repo, runde } = eineRunde();
  const dir = sicherungsDir(repo);
  const datei = path.join(dir, runde.sicherung.pack);
  const original = fs.readFileSync(datei);
  const kaputt = Buffer.from(original); kaputt[Math.floor(kaputt.length / 2)] ^= 0xff;
  fs.chmodSync(datei, 0o666); // Git legt Pack-Dateien schreibgeschützt an
  fs.writeFileSync(datei, kaputt);
  assert.throws(() => pruefePack(repo, dir, runde.sicherung), (f) => f instanceof SicherungsFehler && /Prüfsumme/.test(f.message));
  assert.throws(() => entpacke(repo, dir, runde.sicherung), SicherungsFehler);
  // Prüfsumme „passend“ gemacht, Pack aber kaputt: verify-pack lehnt ab
  const gefaelscht = { ...runde.sicherung, sha256: sha256(kaputt) };
  assert.throws(() => pruefePack(repo, dir, gefaelscht), (f) => f instanceof SicherungsFehler && /verify-pack|Prüfsumme/.test(f.message));
  fs.rmSync(datei);
  assert.throws(() => pruefePack(repo, dir, runde.sicherung), /fehlt/);
  assert.throws(() => pruefePack(repo, dir, null), SicherungsFehler);
});

test('Negativ: scheitert die Sicherung, gibt es keine Runde (Zustand und runde-1.json bleiben unberührt); unvollständige SHA werden abgelehnt', () => {
  const repo = neuesRepo();
  lauf.starten(repo, { auftrag: 'Sicherung', dateien: ['src/**'] });
  const id = lauf.status(repo).id;
  fs.writeFileSync(path.join(lauf.laufDir(repo, id), 'sicherung'), 'ist eine Datei, kein Verzeichnis'); // blockiert mkdir
  const wt = erstelle(repo, 'agent-s1');
  w(wt, 'src/runde1.js', 'x\n');
  assert.throws(() => lauf.rundeEnde(repo, { worktree: wt }));
  assert.equal(lauf.status(repo).runde, 0);
  assert.ok(!fs.existsSync(path.join(lauf.laufDir(repo, id), 'runde-1.json')));
  assert.throws(() => sichereRunde(repo, { verzeichnis: path.join(lauf.laufDir(repo, id), 'x'), nr: 1, commit: 'HEAD', ohne: 'main' }), SicherungsFehler);
});

test('Negativ: enthält der Stand ein Geheimnis, bricht runde-ende vor der Sicherung ab (kein Pack mit Geheimnis)', () => {
  const repo = neuesRepo();
  lauf.starten(repo, { auftrag: 'Sicherung', dateien: ['src/**'] });
  const wt = erstelle(repo, 'agent-s1');
  w(wt, 'src/geheim.js', `const k = '${['-----BEGIN ', 'PRIVATE KEY-----'].join('')}';\n`);
  assert.throws(() => lauf.rundeEnde(repo, { worktree: wt }), /Geheimnis/);
  const dir = path.join(lauf.laufDir(repo, lauf.status(repo).id), 'sicherung');
  assert.ok(!fs.existsSync(dir) || fs.readdirSync(dir).length === 0, 'kein Pack angelegt');
  assert.equal(text(wt, 'src/geheim.js').includes('PRIVATE KEY'), true);
});

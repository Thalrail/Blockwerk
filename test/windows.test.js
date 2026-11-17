// Prüft den Windows-Rahmen (windows/): Kopierskript (Positivliste, nichts Privates, alle Importe auflösbar) und Tauri-Konfiguration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { kopiereDist, dateiListe, WURZEL, DATEIEN, ORDNER } from '../windows/kopiere-dist.mjs';

const konf = JSON.parse(readFileSync(join(WURZEL, 'windows/src-tauri/tauri.conf.json'), 'utf8'));
const mitDist = (fn) => {
  const t = mkdtempSync(join(tmpdir(), 'bw-win-'));
  try { return fn(join(t, 'dist'), t); } finally { rmSync(t, { recursive: true, force: true }); }
};

test('Kopierskript: nur die Positivliste, nichts Privates', () => mitDist((dist) => {
  const n = kopiereDist(dist);
  const dateien = dateiListe(dist);
  assert.equal(dateien.length, n);
  for (const d of dateien) {
    const wurzel = d.split('/')[0];
    assert.ok([...DATEIEN, ...ORDNER].includes(wurzel), `unerwartet: ${d}`);
    assert.ok(!/(^|\/)\./.test(d), `versteckte Datei: ${d}`);
    assert.ok(!/\.(db|db-shm|db-wal|map|log|lock)$/.test(d), `Datenbank/Artefakt: ${d}`);
    assert.ok(!/node_modules|\.git|docs\/|reviews/.test(d), `privat/Entwicklung: ${d}`);
  }
  for (const pflicht of ['index.html', 'manifest.webmanifest', 'web/app.js', 'web/engine-worker.js', 'data/bloecke.json', 'data/texturen.json', 'data/beispiele/zitadelle.json'])
    assert.ok(dateien.includes(pflicht), `fehlt: ${pflicht}`);
  assert.ok(dateien.some((d) => d.startsWith('data/texturen/')), 'Texturen samt Lizenzkopie fehlen');
}));

test('Kopierskript: sperrt versteckte Dateien und Datenbanken auch in Unterordnern', () => mitDist((dist, t) => {
  const w = join(t, 'wurzel');
  for (const o of ORDNER) mkdirSync(join(w, o), { recursive: true });
  for (const d of DATEIEN) writeFileSync(join(w, d), 'x');
  writeFileSync(join(w, 'data/ok.json'), '{}'); writeFileSync(join(w, 'data/.geheim'), 'x'); writeFileSync(join(w, 'src/a.db'), 'x'); writeFileSync(join(w, 'web/a.js.map'), 'x');
  mkdirSync(join(w, 'src/.git')); writeFileSync(join(w, 'src/.git/config'), 'x');
  kopiereDist(dist, w);
  assert.deepEqual(dateiListe(dist).sort(), ['data/ok.json', 'index.html', 'manifest.webmanifest']);
}));

test('Kopierskript: löscht nur Ordner namens dist und nie die Wurzel', () => mitDist((_, t) => {
  assert.throws(() => kopiereDist(join(t, 'irgendwas')), /dist/);
  assert.throws(() => kopiereDist(WURZEL), /dist/);
}));

test('Kopierskript: alle relativen Importe und Datenpfade der Oberfläche sind im Paket', () => mitDist((dist) => {
  kopiereDist(dist);
  const fehlt = [];
  const jsDateien = dateiListe(dist).filter((d) => d.endsWith('.js') && (d.startsWith('web/') || d.startsWith('src/')));
  for (const d of jsDateien) {
    const text = readFileSync(join(dist, d), 'utf8');
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      if (!existsSync(resolve(dirname(join(dist, d)), m[1]))) fehlt.push(`${d} → ${m[1]}`);
    }
  }
  assert.deepEqual(fehlt, []);
  for (const p of ['data/darstellung.json', 'data/texturen.json', 'data/beispiele/zitadelle.json']) assert.ok(existsSync(join(dist, p)), p);
}));

test('Tauri-Konfiguration: eigenständig, ohne Entwicklungsserver, nur NSIS', () => {
  assert.equal(konf.build.frontendDist, '../dist');
  assert.equal(konf.build.devUrl, undefined, 'kein Entwicklungsserver');
  assert.equal(konf.build.beforeDevCommand, undefined);
  assert.deepEqual(konf.bundle.targets, ['nsis']);
  assert.equal(konf.bundle.windows.nsis.installMode, 'currentUser');
  assert.match(konf.identifier, /^[a-z0-9.-]+$/);
  assert.equal(konf.app.withGlobalTauri, true, 'die Oberfläche ruft speichere_datei über window.__TAURI__ auf');
});

test('Windows-Rahmen: nur der eigene Speichern-Befehl, keine Dateisystem-Rechte für die Seite', () => {
  const rust = readFileSync(join(WURZEL, 'windows/src-tauri/src/main.rs'), 'utf8');
  assert.match(rust, /generate_handler!\[speichere_datei\]/);
  assert.match(rust, /blocking_save_file/, 'geschrieben wird nur nach dem Dialog');
  assert.ok(!existsSync(join(WURZEL, 'windows/src-tauri/capabilities')), 'keine Capability-Dateien: Plugin-Befehle bleiben für die Seite gesperrt');
  const cargo = readFileSync(join(WURZEL, 'windows/src-tauri/Cargo.toml'), 'utf8');
  assert.ok(!/tauri-plugin-fs|tauri-plugin-shell/.test(cargo), 'kein fs- oder shell-Plugin');
});

test('Tauri-Konfiguration: Inhaltsrichtlinie ohne unsichere Skripte, Worker und Live-Dienst erlaubt', () => {
  const csp = konf.app.security.csp;
  assert.ok(csp, 'CSP fehlt');
  const teil = (name) => (csp.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${name} `)) ?? '').split(/\s+/).slice(1);
  assert.ok(!teil('script-src').some((q) => /unsafe|\*|^https?:/.test(q)), 'script-src zu offen');
  assert.ok(teil('worker-src').includes("'self'"), 'Modul-Worker braucht worker-src self');
  assert.ok(teil('connect-src').includes('wss:'), 'Live-Dienst (WebSocket) braucht wss:');
  assert.ok(teil('img-src').includes('blob:') && teil('img-src').includes('data:'), 'Texturen/Bilder');
  assert.ok(!/default-src[^;]*\*/.test(csp), 'default-src darf kein * enthalten');
});

test('Tauri-Konfiguration: Symbole und Cargo-Sperrdatei sind vorhanden', () => {
  for (const i of konf.bundle.icon) assert.ok(existsSync(join(WURZEL, 'windows/src-tauri', i)), `Symbol fehlt: ${i}`);
  assert.ok(existsSync(join(WURZEL, 'windows/src-tauri/Cargo.lock')), 'Cargo.lock muss eingecheckt sein (reproduzierbarer Build)');
});

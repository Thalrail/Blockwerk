// Blockwerk – Windows-Rahmen: kopiert genau die Dateien der Weboberfläche nach windows/dist (frontendDist von Tauri).
// Das ist ein reines Kopieren, kein Build. Nur eine feste Positivliste kommt mit; Git-Daten, docs, Tests, Werkzeuge,
// Datenbanken, versteckte Dateien und node_modules bleiben draußen. Aufruf: node windows/kopiere-dist.mjs [Zielordner]
import { cpSync, mkdirSync, rmSync, statSync, readdirSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WURZEL = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const STANDARD_ZIEL = join(WURZEL, 'windows', 'dist');

/** Positivliste relativ zur Wurzel: einzelne Dateien und ganze Ordner. */
export const DATEIEN = ['index.html', 'manifest.webmanifest'];
export const ORDNER = ['web', 'src', 'data'];

const VERBOTEN_NAME = /^\.|^(node_modules|Thumbs\.db)$|\.(db|db-shm|db-wal|map|log|lock)$/i;

/** Kopiert die Positivliste nach `ziel`; ein vorhandenes Ziel wird vorher geleert (nur wenn es `dist` heißt). Gibt die Zahl der Dateien zurück. */
export function kopiereDist(ziel = STANDARD_ZIEL, wurzel = WURZEL) {
  const z = resolve(ziel);
  if (basename(z) !== 'dist') throw new Error(`Zielordner muss „dist“ heißen (Schutz vor Löschen fremder Ordner): ${z}`);
  if (z === resolve(wurzel) || (resolve(wurzel) + sep).startsWith(z + sep)) throw new Error('Zielordner darf nicht die Wurzel enthalten');
  rmSync(z, { recursive: true, force: true });
  mkdirSync(z, { recursive: true });
  let anzahl = 0;
  const filter = (quelle) => {
    if (VERBOTEN_NAME.test(basename(quelle))) return false;
    if (statSync(quelle).isFile()) anzahl++;
    return true;
  };
  for (const d of DATEIEN) { cpSync(join(wurzel, d), join(z, d), { filter }); }
  for (const o of ORDNER) { cpSync(join(wurzel, o), join(z, o), { recursive: true, filter }); }
  return anzahl;
}

/** Alle Dateien unter einem Ordner (relative Pfade mit /), zum Prüfen. */
export function dateiListe(ordner, rel = '') {
  return readdirSync(join(ordner, rel), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dateiListe(ordner, `${rel}${e.name}/`) : [`${rel}${e.name}`]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const n = kopiereDist(process.argv[2] ?? STANDARD_ZIEL);
  console.log(`windows/dist: ${n} Dateien kopiert.`);
}

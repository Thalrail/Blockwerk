// Ebene 1 – Daten laden unter Node (Tests, Werkzeuge). Die Engine selbst liest keine Dateien.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ladeEbene0 } from '../ebene0/daten-node.js';
import { erzeugeEbene1 } from './index.js';

const ordner = fileURLToPath(new URL('../../data/regeln/', import.meta.url));

export function ladeRegeldateien() {
  return readdirSync(ordner).filter((n) => n.endsWith('.json')).sort().map((n) => JSON.parse(readFileSync(ordner + n, 'utf8')));
}

export function ladeEbene1(ebene0 = ladeEbene0()) {
  return { ebene0, ...erzeugeEbene1({ ebene0, regeln: ladeRegeldateien() }) };
}

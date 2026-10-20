// Ebene 0 – Daten laden unter Node (Tests, Werkzeuge). Im Browser lädt Ebene 5 dieselben JSON-Dateien per fetch
// und übergibt sie an `erzeugeEbene0` – die Engine selbst liest keine Dateien.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { erzeugeEbene0 } from './index.js';

const datei = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../data/${name}`, import.meta.url)), 'utf8'));

export function ladeEbene0() {
  return erzeugeEbene0({
    bloecke: datei('bloecke.json'),
    wesen: datei('wesen.json'),
    gegenstaende: datei('gegenstaende.json'),
    drehregeln: datei('drehregeln.json'),
  });
}

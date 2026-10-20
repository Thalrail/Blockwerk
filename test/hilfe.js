import { ladeEbene0 } from '../src/ebene0/daten-node.js';
import { ladeEbene1 } from '../src/ebene1/daten-node.js';

let zwischenspeicher;
/** Einmal laden, in allen Tests wiederverwenden (die Register sind nur lesend). */
export function ebene0() {
  return (zwischenspeicher ??= ladeEbene0());
}

let zwischenspeicher1;
/** Ebene 1 (enthält `ebene0`, `regelwerk`, `neuerSandkasten`, `neuerTaktgeber`, `pruefe`), einmal geladen. */
export function ebene1() {
  return (zwischenspeicher1 ??= ladeEbene1(ebene0()));
}

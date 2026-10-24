import { ladeEbene0 } from '../src/ebene0/daten-node.js';
import { ladeEbene1 } from '../src/ebene1/daten-node.js';
import { erzeugeEbene2 } from '../src/ebene2/index.js';

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

let zwischenspeicher2;
/** Ebene 2 (Formen, `baue`), einmal geladen. */
export function ebene2() {
  const e1 = ebene1();
  return (zwischenspeicher2 ??= { ebene1: e1, ...erzeugeEbene2({ ebene0: e1.ebene0, regelwerk: e1.regelwerk }) });
}

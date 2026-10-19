import { ladeEbene0 } from '../src/ebene0/daten-node.js';

let zwischenspeicher;
/** Einmal laden, in allen Tests wiederverwenden (die Register sind nur lesend). */
export function ebene0() {
  return (zwischenspeicher ??= ladeEbene0());
}

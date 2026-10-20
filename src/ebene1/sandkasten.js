// Ebene 1 – Sandkasten: Simulation läuft immer in einer KOPIE der Welt. Der Bauplan bleibt unberührt.
// Änderungen gehen nur über die Funktionen der Welt aus Ebene 0.
export class Sandkasten {
  /** @param {import('../ebene0/welt.js').Welt} welt Original (wird nicht verändert) */
  constructor(welt) {
    this.welt = welt.kopie();
  }

  /** Neuer Sandkasten aus dem Stand dieses Sandkastens (z. B. für „was wäre wenn“). */
  abzweigen() {
    return new Sandkasten(this.welt);
  }
}

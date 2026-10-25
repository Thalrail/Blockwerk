// Ebene 5 – Materialliste: Summen je Schicht, je Abschnitt und gesamt; Umrechnung in Kisten, Stacks und Reste.
// Rohstoff-Zerlegung kommt später.

export const KISTE = 27;

/**
 * Stapelgrößen-Umrechnung: n Stück bei Stapelgröße s → { kisten, stacks, rest } (stacks sind die Stacks ohne volle Kisten).
 * @param {number} n  Stückzahl
 * @param {number} stapel  Stapelgröße (64, 16 oder 1)
 */
export function umrechnen(n, stapel) {
  const stacksGesamt = Math.floor(n / stapel);
  return { kisten: Math.floor(stacksGesamt / KISTE), stacks: stacksGesamt % KISTE, rest: n % stapel, stacksGesamt };
}

/** „3 Kisten + 5 Stacks + 12“ (Nullen entfallen; 0 → „0“). */
export function umrechnungsText(n, stapel) {
  const u = umrechnen(n, stapel);
  const teile = [];
  if (u.kisten) teile.push(`${u.kisten} ${u.kisten === 1 ? 'Kiste' : 'Kisten'}`);
  if (u.stacks) teile.push(`${u.stacks} ${u.stacks === 1 ? 'Stack' : 'Stacks'}`);
  if (u.rest) teile.push(`${u.rest}`);
  return teile.length ? teile.join(' + ') : '0';
}

/**
 * @param {{register: {stapel: (id: string) => number}, darstellung: object}} quellen
 */
export function erzeugeMaterial({ register, darstellung }) {
  /** Eine Summe {id: n} als Liste mit Namen, Farbe, Stacks; nach Anzahl absteigend. */
  function liste(summe) {
    return Object.entries(summe)
      .map(([id, n]) => ({ ...darstellung.block(id), anzahl: n, stapel: register.stapel(id), text: umrechnungsText(n, register.stapel(id)) }))
      .sort((a, b) => b.anzahl - a.anzahl || (a.id < b.id ? -1 : 1));
  }

  /** Gegenstände, die in Behälter gelegt werden müssen (Trichter, Kisten …): Summe über alle Schichten eines Abschnitts. */
  function inhalte(abschnitt) {
    const summe = {};
    for (const s of abschnitt.schichten) for (const i of s.inhalte) for (const g of i.inhalt) summe[g.gegenstand] = (summe[g.gegenstand] ?? 0) + g.anzahl;
    return summe;
  }

  /** Materialliste eines Plans: gesamt, je Abschnitt, je Schicht (alles als Liste). */
  function material(plan) {
    return {
      gesamt: liste(plan.summe),
      abschnitte: plan.abschnitte.map((a) => ({ id: a.id, name: a.name, liste: liste(a.summe), inhalte: liste(inhalte(a)), schichten: a.schichten.map((s) => ({ y: s.y, liste: liste(s.summe) })) })),
    };
  }

  return { liste, material };
}

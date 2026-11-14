// Ebene 5 – Merker für die Entwürfe der zuletzt gebauten Bauaufträge (Zellenwahl, U2, und Bearbeiten, U3). Jeder Start zählt eine eigene, vom Aufrufer unabhängige Erzeugung hoch:
// ein langsamer, überholter Auftrag kann den Merker nie überschreiben, auch wenn die Aufträge dieselbe (oder keine) `lauf`-Nummer tragen.
// U3: Die Seite zeigt manchmal einen älteren Plan als den neuesten Auftrag (die Umbauhinweise warten auf Bestätigung, oder eine Änderung wurde verworfen). Damit ein Klick
// nie gegen den falschen Entwurf gerechnet wird, behält der Merker die letzten fertigen Entwürfe unter ihrer Erzeugung; die Seite nennt die Erzeugung des Plans, den sie zeigt.

export const BEHALTEN = 3; // angezeigter Plan, wartender neuer Plan und ein Auftrag in Arbeit; mehr braucht die Oberfläche nie

export function erzeugeEntwurfsspeicher() {
  let erzeugung = 0, wert = null;
  const verlauf = new Map(); // Erzeugung → Wert (nur fertige Aufträge)
  return {
    /** Ein neuer Auftrag beginnt: der bisherige Entwurf gilt nicht mehr als „neuester“. Liefert die Erzeugung dieses Auftrags. */
    beginne() { wert = null; return ++erzeugung; },
    /** Der Auftrag mit dieser Erzeugung ist fertig; nur der neueste darf den Merker setzen. @returns {boolean} angenommen */
    setze(meine, neu) {
      if (meine !== erzeugung) return false;
      wert = neu; verlauf.set(meine, neu);
      for (const k of [...verlauf.keys()].sort((a, b) => a - b).slice(0, Math.max(0, verlauf.size - BEHALTEN))) verlauf.delete(k);
      return true;
    },
    /** Ohne Angabe: der Entwurf des neuesten Auftrags (null, solange er noch rechnet). Mit Erzeugung: genau der Entwurf dieses fertigen Auftrags (null, wenn es ihn nicht mehr gibt). */
    hole(gewuenscht) { return gewuenscht === undefined ? wert : (verlauf.get(gewuenscht) ?? null); },
  };
}

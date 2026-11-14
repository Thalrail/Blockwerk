// Ebene 5 – Merker für den Entwurf des zuletzt gestarteten Bauauftrags (Zellenwahl, U2). Jeder Start zählt eine eigene, vom Aufrufer unabhängige Erzeugung hoch:
// ein langsamer, überholter Auftrag kann den Merker nie überschreiben, auch wenn die Aufträge dieselbe (oder keine) `lauf`-Nummer tragen.

export function erzeugeEntwurfsspeicher() {
  let erzeugung = 0, wert = null;
  return {
    /** Ein neuer Auftrag beginnt: der bisherige Entwurf gilt nicht mehr. Liefert die Erzeugung dieses Auftrags. */
    beginne() { wert = null; return ++erzeugung; },
    /** Der Auftrag mit dieser Erzeugung ist fertig; nur der neueste darf den Merker setzen. @returns {boolean} angenommen */
    setze(meine, neu) { if (meine !== erzeugung) return false; wert = neu; return true; },
    hole() { return wert; },
  };
}

// Ebene 5 – Fassungsverlauf (Paket U7 der Oberfläche, docs/plan-oberflaeche-bearbeiten.md): „Fassung X → Fassung Y“ für beide Wege (Spezifikation und Einzelblockänderungen), sichtbar im
// Baubericht. Reines Modul ohne DOM und ohne Uhr: es hält eine kurze, geprüfte Liste und formuliert Sätze; die Seite entscheidet, wann ein Übergang gilt (erst wenn die neue Fassung
// wirklich gilt, nicht beim Versuch) und speichert die Liste. Daten aus dem Browser-Speicher werden streng gelesen (nichts Unbrauchbares kommt in die Anzeige).

export const VERLAUF_MAX = 30;
const ARTEN = ['spezifikation', 'aenderungen'];
const TEXT_MAX = 240;
const NAME_MAX = 24;
const ganz = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000;
const text = (t, max) => String(t ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** Ein Eintrag des Verlaufs. Wirft bei unmöglichen Angaben. @returns {{art: string, von: number, nach: number, text: string, wer: string}} */
export function eintrag({ art, von, nach, text: satz = '', wer = '' }) {
  if (!ARTEN.includes(art)) throw new Error(`Verlauf: Art „${String(art)}“ unbekannt (${ARTEN.join(', ')})`);
  if (!ganz(von) || !ganz(nach)) throw new Error('Verlauf: von und nach brauchen ganze Zahlen');
  return { art, von, nach, text: text(satz, TEXT_MAX), wer: text(wer, NAME_MAX) };
}

/** Hängt einen Übergang an (Kopie). Ein Übergang ohne Änderung der Fassung und ein unmittelbar wiederholter werden nicht gebucht; die Liste ist auf `VERLAUF_MAX` begrenzt (das Älteste fällt weg). */
export function anhaengen(liste, neu) {
  const e = eintrag(neu);
  const l = Array.isArray(liste) ? liste : [];
  if (e.von === e.nach) return l;
  const letzter = l[l.length - 1];
  if (letzter && letzter.art === e.art && letzter.von === e.von && letzter.nach === e.nach) return l;
  return [...l, e].slice(-VERLAUF_MAX);
}

/** Liest eine gespeicherte Liste streng: unbrauchbare Einträge entfallen, nie ein Fehler. */
export function liesListe(roh) {
  if (!Array.isArray(roh)) return [];
  const aus = [];
  for (const x of roh) { try { aus.push(eintrag(x ?? {})); } catch { /* unbrauchbar: weglassen */ } }
  return aus.slice(-VERLAUF_MAX); // erst prüfen, dann begrenzen: Unbrauchbares am Ende verdrängt nichts Gültiges
}

const mehrzahl = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;

/** Satz zu einem Fassungsvergleich der Spezifikation (Ergebnis von `ebene4.vergleiche`). */
export function vergleichText(v) {
  if (!v) return '';
  const teile = [];
  if (v.hinzugefuegt?.length) teile.push(`${mehrzahl(v.hinzugefuegt.length, 'Teil', 'Teile')} hinzugefügt (${v.hinzugefuegt.slice(0, 3).join(', ')}${v.hinzugefuegt.length > 3 ? ' …' : ''})`);
  if (v.entfernt?.length) teile.push(`${mehrzahl(v.entfernt.length, 'Teil', 'Teile')} entfernt (${v.entfernt.slice(0, 3).join(', ')}${v.entfernt.length > 3 ? ' …' : ''})`);
  if (v.geaendert?.length) teile.push(`${mehrzahl(v.geaendert.length, 'Teil', 'Teile')} geändert (${v.geaendert.slice(0, 3).map((x) => x.id).join(', ')}${v.geaendert.length > 3 ? ' …' : ''})`);
  if (v.projekt?.length) teile.push('Projektangaben geändert');
  return teile.join('; ');
}

/** Satz zu zwei Planfassungen: wie viele Einträge neu, weg oder anders sind. */
export function aenderungenText(alt, neu) {
  const a = alt?.eintraege ?? {}, b = neu?.eintraege ?? {};
  const gleich = (x, y) => JSON.stringify({ o: x.op, b: x.block ?? null, z: x.zugelassen === true }) === JSON.stringify({ o: y.op, b: y.block ?? null, z: y.zugelassen === true });
  let neuAnzahl = 0, weg = 0, anders = 0;
  for (const k of Object.keys(b)) { if (!(k in a)) neuAnzahl++; else if (!gleich(a[k], b[k])) anders++; }
  for (const k of Object.keys(a)) if (!(k in b)) weg++;
  const teile = [];
  if (neuAnzahl) teile.push(`${neuAnzahl} neu`);
  if (anders) teile.push(`${anders} geändert`);
  if (weg) teile.push(`${weg} weg`);
  return teile.length ? `Einzelblockänderungen: ${teile.join(', ')} (jetzt ${mehrzahl(Object.keys(b).length, 'Eintrag', 'Einträge')})` : '';
}

/**
 * Der Verlauf für den Baubericht: die aktuellen Fassungen zuerst, darunter die letzten Übergänge (neueste oben).
 * @param {object[]} liste  gebuchter Verlauf
 * @param {{spezifikation: number, aenderungen: number}} aktuell  Versionen jetzt
 * @returns {string[]} Zeilen
 */
export function berichtZeilen(liste, aktuell) {
  const zeilen = [`Aktuell: Spezifikation Version ${aktuell.spezifikation}, Einzelblockänderungen Fassung ${aktuell.aenderungen}.`];
  const l = [...(liste ?? [])].reverse().slice(0, 10);
  if (!l.length) zeilen.push('Noch keine Übergänge in dieser Sitzung.');
  for (const e of l) zeilen.push(`${e.art === 'spezifikation' ? 'Spezifikation' : 'Änderungen'}: Fassung ${e.von} → Fassung ${e.nach}${e.wer ? ` (${e.wer})` : ''}${e.text ? `: ${e.text}` : ''}`);
  return zeilen;
}

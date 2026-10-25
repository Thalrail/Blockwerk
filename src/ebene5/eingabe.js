// Ebene 5 – Eingabe: Logik hinter der Seite „Neue Vorlage“. Rechnet nichts Eigenes aus: ruft Prüfer, Abgleich, Übersetzung, Messung und Freigabe aus Ebene 3/4 auf
// und gibt jede Antwort von Jonah als NEUE VERSION der Spezifikation nach unten (Ebene 5 ändert nie direkt Welt oder Plan). Deterministisch, ohne DOM.

/** Fehler bei der Eingabe (unbrauchbarer Pfad, unzulässige Bilddatei). */
export class EingabeFehler extends Error {
  constructor(nachricht) { super(`Eingabe: ${nachricht}`); this.name = 'EingabeFehler'; }
}

export const BILD_KANTE_MAX = 640;
export const DATEI_MAX = 20 * 1024 * 1024;
export const PIXEL_MAX = 16_000_000;
export const BILD_TYPEN = ['image/png', 'image/jpeg', 'image/webp'];
export const MESSARTEN = ['grundriss', 'aufriss', 'farben'];

const istObjekt = (w) => w !== null && typeof w === 'object';

/** „teile[0].form.groesse“ → ['teile', 0, 'form', 'groesse']; leerer Pfad = ganze Spezifikation. */
export function zerlegePfad(pfad) {
  if (typeof pfad !== 'string') throw new EingabeFehler('der Pfad ist kein Text');
  const teile = [];
  for (const stueck of pfad.split('.').filter((s) => s !== '')) {
    const m = stueck.match(/^([^[\]]+)((?:\[\d+\])*)$/);
    if (!m) throw new EingabeFehler(`der Pfad „${pfad}“ ist nicht lesbar`);
    teile.push(m[1]);
    for (const i of m[2].matchAll(/\[(\d+)\]/g)) teile.push(Number(i[1]));
  }
  return teile;
}

/** Läuft bis zum Elternteil des Ziels; fehlende Zwischenobjekte legt es nur an, wenn `anlegen` gesetzt ist. */
function elternVon(spec, schritte, anlegen) {
  let k = spec;
  for (let i = 0; i < schritte.length - 1; i++) {
    const s = schritte[i];
    if (!istObjekt(k)) throw new EingabeFehler('der Pfad führt ins Leere');
    if (k[s] === undefined) {
      if (!anlegen || Array.isArray(k)) throw new EingabeFehler('der Pfad führt ins Leere');
      k[s] = typeof schritte[i + 1] === 'number' ? [] : {};
    }
    k = k[s];
  }
  if (!istObjekt(k)) throw new EingabeFehler('der Pfad führt ins Leere');
  return k;
}

/** Setzt den Wert am Pfad (Kopie). Objektwerte werden in ein vorhandenes Objekt EINGEMISCHT (Felder, die nicht genannt sind, bleiben). */
export function setzeAm(spec, pfad, wert) {
  const schritte = zerlegePfad(pfad);
  if (!schritte.length) throw new EingabeFehler('der Pfad ist leer');
  const kopie = structuredClone(spec);
  const eltern = elternVon(kopie, schritte, true), letzter = schritte[schritte.length - 1];
  const alt = eltern[letzter];
  eltern[letzter] = istObjekt(wert) && !Array.isArray(wert) && istObjekt(alt) && !Array.isArray(alt) ? { ...alt, ...structuredClone(wert) } : structuredClone(wert);
  return kopie;
}

/** Entfernt das Feld oder den Listeneintrag am Pfad (Kopie). */
export function entferneAm(spec, pfad) {
  const schritte = zerlegePfad(pfad);
  if (!schritte.length) throw new EingabeFehler('der Pfad ist leer');
  const kopie = structuredClone(spec);
  const eltern = elternVon(kopie, schritte, false), letzter = schritte[schritte.length - 1];
  if (!(letzter in eltern)) throw new EingabeFehler(`am Pfad „${pfad}“ ist nichts zu entfernen`);
  if (Array.isArray(eltern)) eltern.splice(letzter, 1); else delete eltern[letzter];
  return kopie;
}

/** Schlüssel einer Rückfrage, unabhängig von ihrer Nummer (die Nummern ändern sich nach jeder Antwort). */
export const schluesselFrage = (f) => `${f.pfad}|${f.frage}`;

/**
 * Prüft alles auf einmal: Prüfer der Spezifikation, Abgleich mit den Messungen und – erst wenn beides offen ist – die Übersetzung in die Vorgabe.
 * @param {{ebene4: object, ebene3: object}} q
 * @param {object} spec
 * @param {object[]} [messungen]
 * @param {string[]} [ignoriert]  Schlüssel von Fragen, bei denen Jonah „so lassen“ gewählt hat
 */
export function pruefeAlles({ ebene4, ebene3 }, spec, messungen = [], ignoriert = []) {
  const aus = new Set(ignoriert);
  const filter = (liste) => liste.filter((f) => !aus.has(schluesselFrage(f)));
  const p = ebene4.pruefe(spec);
  let rueckfragen = filter(p.rueckfragen), hinweise = [...(p.hinweise ?? [])];
  if (!p.rueckfragen.length) {
    const a = ebene4.abgleich(spec, messungen);
    rueckfragen = [...rueckfragen, ...filter(a.rueckfragen)];
    hinweise = [...hinweise, ...a.hinweise];
    if (!rueckfragen.length) {
      const u = ebene3.uebersetzung.uebersetze(spec);
      rueckfragen = filter(u.rueckfragen);
      hinweise = [...hinweise, ...u.hinweise];
    }
  }
  let zusammenfassung = '';
  if (!p.rueckfragen.length) zusammenfassung = ebene4.zusammenfassung(spec);
  return { rueckfragen, hinweise, zusammenfassung, freigebbar: rueckfragen.length === 0 };
}

/**
 * Wendet eine Antwort von Jonah an.
 * - Option mit `wert`: Wert am Pfad setzen · `entfernen`: Feld/Eintrag weglassen → neue Version
 * - `text` („so lassen“): Frage gilt als entschieden, die Spezifikation bleibt unverändert
 * - alles andere („Etwas anderes“, Lage, Maße …): nicht automatisch lösbar → `manuell`
 * @returns {{art: 'geaendert'|'ignoriert'|'manuell', spec: object, ignoriert: string[]}}
 */
export function antworte({ ebene4 }, spec, frage, optionId, ignoriert = []) {
  const o = (frage.optionen ?? []).find((x) => x.id === optionId);
  if (!o) throw new EingabeFehler(`die Option „${optionId}“ gibt es bei dieser Frage nicht`);
  if (o.id === 'text') return { art: 'ignoriert', spec, ignoriert: [...new Set([...ignoriert, schluesselFrage(frage)])] };
  if (o.id === 'entfernen') return { art: 'geaendert', spec: ebene4.neueVersion(spec, (s) => entferneAm(s, frage.pfad)), ignoriert };
  if (Object.hasOwn(o, 'wert')) return { art: 'geaendert', spec: ebene4.neueVersion(spec, (s) => setzeAm(s, frage.pfad, o.wert)), ignoriert };
  return { art: 'manuell', spec, ignoriert };
}

/** Prüft die Angaben zu einer Bilddatei, bevor sie dekodiert wird. */
export function pruefeBildDatei({ typ, groesse, breite, hoehe }) {
  if (!BILD_TYPEN.includes(typ)) throw new EingabeFehler(`der Dateityp „${typ || 'unbekannt'}“ wird nicht gelesen (erlaubt: PNG, JPEG, WebP)`);
  if (!(groesse <= DATEI_MAX)) throw new EingabeFehler(`die Datei ist zu groß (höchstens ${DATEI_MAX / 1024 / 1024} MB)`);
  if (breite !== undefined && !(breite * hoehe <= PIXEL_MAX)) throw new EingabeFehler(`das Bild ist zu groß (höchstens ${PIXEL_MAX / 1e6} Megapixel)`);
}

/** Verkleinert ein RGBA-Bild per Kastenmittel auf höchstens `maxKante` Pixel (längste Kante); kleinere Bilder bleiben unverändert. */
export function verkleinere(bild, maxKante = BILD_KANTE_MAX) {
  const { breite: B, hoehe: H, daten: d } = bild;
  if (Math.max(B, H) <= maxKante) return bild;
  const f = maxKante / Math.max(B, H);
  const nb = Math.max(1, Math.floor(B * f)), nh = Math.max(1, Math.floor(H * f));
  const aus = new Uint8ClampedArray(nb * nh * 4);
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor((y * H) / nh), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * H) / nh));
    for (let x = 0; x < nb; x++) {
      const x0 = Math.floor((x * B) / nb), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * B) / nb));
      const s = [0, 0, 0, 0];
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * B + xx) * 4; s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; s[3] += d[i + 3]; }
      const n = (y1 - y0) * (x1 - x0), o = (y * nb + x) * 4;
      for (let c = 0; c < 4; c++) aus[o + c] = Math.round(s[c] / n);
    }
  }
  return { breite: nb, hoehe: nh, daten: aus };
}

/** Misst ein Bild für ein Teil; das Ergebnis hat das Format der Messungen für den Abgleich. Das Bild selbst wird nicht aufgehoben. */
export function messeBild({ ebene4 }, bild, { teil, art, name = '', mitHintergrund = false }) {
  if (!MESSARTEN.includes(art)) throw new EingabeFehler(`die Messart „${art}“ gibt es nicht (erlaubt: ${MESSARTEN.join(', ')})`);
  const b = verkleinere(bild);
  const m = ebene4.messung;
  const ergebnis = art === 'grundriss' ? m.grundriss(b) : art === 'aufriss' ? m.umriss(b) : m.farben(b, { mitHintergrund });
  return { teil, art, bild: name, ergebnis };
}

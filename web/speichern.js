// Blockwerk – Projektdatei sichern: in der Windows-Anwendung (Tauri) mit „Speichern unter“-Dialog, im Browser wie bisher als Download.
// Reine Logik: Tauri-Objekt, Dokument und URL werden eingespeist (in Node mit Fakes testbar).

/** Dateiname aus dem Projektnamen (nur Buchstaben, Ziffern, Unterstrich, Bindestrich). */
export const dateiname = (projektName) => `${(projektName || 'blockwerk').replace(/[^\w-]+/g, '-')}.blockwerk.json`;

/**
 * Sichert den Text als Datei. Ergebnis: {status:'gespeichert', pfad} | {status:'abgebrochen'} | {status:'download'} | {status:'fehler', meldung}.
 * `tauri` = window.__TAURI__ (oder undefined im Browser).
 */
export async function sichereDatei({ text, projektName, tauri, doc, urlApi }) {
  const name = dateiname(projektName);
  const invoke = tauri?.core?.invoke;
  if (typeof invoke === 'function') {
    try {
      const pfad = await invoke('speichere_datei', { vorschlag: name, text });
      return pfad ? { status: 'gespeichert', pfad } : { status: 'abgebrochen' };
    } catch (f) { return { status: 'fehler', meldung: String(f?.message ?? f) }; }
  }
  const a = doc.createElement('a');
  a.href = urlApi.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click();
  setTimeout(() => urlApi.revokeObjectURL(a.href), 1000);
  return { status: 'download' };
}

/** Meldung für die Oberfläche (null = nichts melden, der Browser zeigt seinen eigenen Download). */
export function meldung(erg) {
  if (erg.status === 'gespeichert') return `Gespeichert: ${erg.pfad}`;
  if (erg.status === 'abgebrochen') return 'Speichern abgebrochen – nichts geschrieben.';
  if (erg.status === 'fehler') return `Speichern fehlgeschlagen: ${erg.meldung}`;
  return null;
}

/** Läuft die Oberfläche in der Windows-Anwendung (Tauri)? */
export const istTauri = (fenster) => typeof fenster?.__TAURI__?.core?.invoke === 'function';

/** Meldung nach dem Öffnen einer Datei oder eines Links (d = geprüftes Paket aus teilen.importDatei/ausLink). */
export function importMeldung(d) {
  const name = d?.spezifikation?.projekt?.name;
  const mit = [d?.fortschritt ? 'Fortschritt' : null, d?.aenderungen ? 'Änderungen' : null].filter(Boolean);
  return `Projekt${name ? ` „${name}“` : ''} übernommen${mit.length ? ` (mit ${mit.join(' und ')})` : ''}.`;
}

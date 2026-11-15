// Blockwerk – Maus fangen (Pointer Lock) mit sichtbarer Fehlerursache. Reine Logik ohne Zugriff auf window: canvas und doc werden eingespeist (in Node mit Fakes testbar).

const UMGEBUNG = new Set(['WrongDocumentError', 'NotSupportedError']); // eingebettetes Fenster, API fehlt: der Browser, nicht die Seite
const NAME_ARTEN = { SecurityError: 'abgelehnt', NotAllowedError: 'abgelehnt', InvalidStateError: 'abgelehnt' };

function fehler(art, name, nachricht) { return { status: 'fehler', art, name, nachricht }; }

/** Ordnet eine Ausnahme oder Ablehnung ein; unbekannte Namen: synchron = 'ausnahme', Promise = 'abgelehnt'. */
function einordnen(e, unbekannt) {
  const name = String(e?.name ?? 'Error'), nachricht = String(e?.message ?? e ?? '');
  return fehler(UMGEBUNG.has(name) ? 'umgebung' : (NAME_ARTEN[name] ?? unbekannt), name, nachricht);
}

/**
 * Fordert canvas.requestPointerLock() an (synchron, innerhalb des Benutzerereignisses aufrufen). Das Ergebnis kommt genau einmal:
 * {status:'angefordert'} oder {status:'fehler', art:'nicht-unterstuetzt'|'umgebung'|'abgelehnt'|'ausnahme', name, nachricht}.
 * Rückgabe: Promise mit demselben Ergebnis (beiErgebnis ist optional).
 */
export function fangeMaus(canvas, doc, beiErgebnis) {
  return new Promise((aufloesen) => {
    let fertig = false, aufraeumen = () => {};
    const ende = (ergebnis) => {
      if (fertig) return;
      fertig = true; aufraeumen();
      try { beiErgebnis?.(ergebnis); } finally { aufloesen(ergebnis); }
    };
    if (typeof canvas?.requestPointerLock !== 'function') return ende(fehler('nicht-unterstuetzt', 'NotSupportedError', 'requestPointerLock fehlt'));
    let p;
    try { p = canvas.requestPointerLock(); } catch (e) { return ende(einordnen(e, 'ausnahme')); }
    // Mit Promise entscheidet allein das Promise: es trägt den Fehlernamen, das Ereignis nicht.
    if (typeof p?.then === 'function') return void p.then(() => ende({ status: 'angefordert' }), (e) => ende(einordnen(e, 'abgelehnt')));
    // Ältere Browser liefern kein Promise: dort entscheidet das Ereignis (pointerlockerror = Fehler, pointerlockchange = Erfolg).
    const beiFehlerEreignis = () => ende(fehler('abgelehnt', 'pointerlockerror', 'der Browser nannte keinen Grund'));
    const beiWechsel = () => ende({ status: 'angefordert' });
    aufraeumen = () => { doc.removeEventListener('pointerlockerror', beiFehlerEreignis); doc.removeEventListener('pointerlockchange', beiWechsel); };
    doc.addEventListener('pointerlockerror', beiFehlerEreignis);
    doc.addEventListener('pointerlockchange', beiWechsel);
  });
}

/**
 * Verwaltet die Lock-Versuche eines Canvas: höchstens eine Browser-Anforderung steht aus; jeder Versuch bekommt eine fortlaufende ID.
 * invalidiere() entwertet nur das Ergebnis (Generation); die Anforderung gilt bis zu ihrem wirklichen Abschluss als offen (laeuft()).
 * Eine veraltete Anforderung, die danach doch den Lock erwirbt, gibt ihn sofort wieder frei (exitPointerLock).
 * starte(beiErgebnis) → true, wenn ein Versuch begann; false bei ausstehender (auch veralteter) Anforderung oder schon gefangener Maus.
 * Ein Fehler bei bereits gefangener Maus wird als Erfolg gemeldet (kein Fehlerhinweis trotz aktivem Lock).
 */
export function erzeugeVersuche(canvas, doc) {
  let aktuell = 0, ausstehend = false;
  const gefangen = () => doc.pointerLockElement === canvas;
  return {
    laeuft: () => ausstehend,
    invalidiere() { aktuell++; },
    starte(beiErgebnis) {
      if (ausstehend || gefangen()) return false;
      const id = ++aktuell;
      ausstehend = true;
      fangeMaus(canvas, doc, (erg) => {
        ausstehend = false;
        if (id !== aktuell) { if (gefangen()) doc.exitPointerLock?.(); return; } // veraltet: ein verspäteter Lock ist unerwünscht
        beiErgebnis(erg.status === 'fehler' && gefangen() ? { status: 'angefordert' } : erg);
      });
      return true;
    },
  };
}

/** Verständlicher Hinweis für die Oberfläche (als textContent setzen), mit technischer Kurzform am Ende. */
export function hinweisFuerFehler(f) {
  const technik = `(${f.name}: ${f.nachricht})`;
  if (f.art === 'umgebung' || f.art === 'nicht-unterstuetzt') {
    return `Dieses Fenster erlaubt kein Fangen der Maus (zum Beispiel ein eingebettetes Fenster). Öffne Blockwerk in Chrome oder Edge. Bis dahin: Maustaste halten und ziehen zum Umsehen. ${technik}`;
  }
  return `Der Browser hat das Fangen der Maus abgelehnt (${f.name}). Klick noch einmal ins Bild; sonst Maustaste halten und ziehen. ${technik}`;
}

// Orchestrierung: Ist ein Codex-Review-Ergebnis ein gültiger, unabhängiger Einzel-Review?
// Gültig nur bei review_mode „single“, ohne Failover, ohne Beratung mit einem zweiten Anbieter und mit genau einem Codex-Modell.
// Ein Wechsel zu Gemini oder einem anderen Prüfer geschieht nie automatisch: ungültig heißt „Ergebnis nicht werten, nicht wiederholen, Jonah fragen“.

const URTEILE = ['approve', 'request_changes', 'reject'];

/** @param {object} erg das Ergebnis von review_code (nur die Kopffelder werden gebraucht) */
export function pruefeReviewErgebnis(erg) {
  const gruende = [];
  if (!erg || typeof erg !== 'object') return { gueltig: false, gruende: ['kein Ergebnis'] };
  if (erg.review_mode !== 'single') gruende.push(`review_mode ist „${String(erg.review_mode)}“, erwartet „single“`);
  if (erg.failover_occurred !== false) gruende.push(`failover_occurred ist ${String(erg.failover_occurred)}, erwartet false`);
  if (erg.failover) gruende.push('Ergebnis enthält einen failover-Block (ein anderer Prüfer hat geantwortet)');
  if (erg.deliberation) gruende.push('Ergebnis enthält eine Beratung mit einem zweiten Anbieter');
  if (erg.provider !== 'codex') gruende.push(`provider ist „${String(erg.provider)}“, erwartet „codex“`);
  const m = erg.models;
  if (!Array.isArray(m) || m.length !== 1 || m[0]?.provider !== 'codex') gruende.push('models enthält nicht genau ein Codex-Modell');
  if (!URTEILE.includes(erg.verdict)) gruende.push(`verdict „${String(erg.verdict)}“ unbekannt`);
  if (typeof erg.session_id !== 'string' || !erg.session_id) gruende.push('session_id fehlt');
  return { gueltig: gruende.length === 0, gruende };
}

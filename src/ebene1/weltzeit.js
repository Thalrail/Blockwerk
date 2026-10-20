// Ebene 1 – Weltzeit: reine Rechnung zwischen Spielticks, Sekunden und Tagen.
// Regel `takt.spieltick`: 20 Spielticks pro Sekunde (0,05 s), ein Tag = 24.000 Ticks.
export const TICKS_PRO_SEKUNDE = 20;
export const TICKS_PRO_TAG = 24000;

const pruefeTick = (tick) => {
  if (!Number.isInteger(tick) || tick < 0) throw new Error(`Tick muss eine ganze Zahl >= 0 sein: ${String(tick)}`);
};

/** Spieltick → Tag (ab 0), Tick im Tag und Sekunden im Tag. */
export function tickZuZeit(tick) {
  pruefeTick(tick);
  const tickImTag = tick % TICKS_PRO_TAG;
  return { tag: Math.floor(tick / TICKS_PRO_TAG), tickImTag, sekundenImTag: tickImTag / TICKS_PRO_SEKUNDE };
}

export function sekundenZuTicks(sekunden) {
  if (!Number.isFinite(sekunden) || sekunden < 0) throw new Error('Sekunden müssen eine Zahl >= 0 sein');
  return Math.round(sekunden * TICKS_PRO_SEKUNDE);
}

export function ticksZuSekunden(ticks) {
  pruefeTick(ticks);
  return ticks / TICKS_PRO_SEKUNDE;
}

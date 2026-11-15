// Ebene 5 – Freiflugkamera (WASD) für die 3D-Ansicht: Position, Gier (links/rechts) und Nick (hoch/runter), Bewegung nach Tasten.
// Reine Rechnung (keine Uhr, kein DOM); die Oberfläche (web/ansicht3d.js) liefert Tasten, Zeitschritt und Mausbewegung.
// Blickrichtung = (cos(nick)·sin(gier), sin(nick), cos(nick)·cos(gier)); gier = Azimut der Orbit-Kamera + 180°, nick = −Neigung.
import { blickAuf, multipliziere, perspektive } from './matrix.js';
import { FOV, NEIGUNG_MAX } from './kamera.js';

export const DT_MAX = 0.1; // längster Zeitschritt in Sekunden (nach einem Tab-Wechsel kein Sprung)
export const TEMPO_MIN = 6, TEMPO_MAX = 600; // Standardtempo (Blöcke je Sekunde) je nach Bauwerksgröße
const TEMPO_UNTEN = 1, TEMPO_OBEN = 2000; // Grenzen für das Tempo, das der Benutzer mit dem Mausrad einstellt
const NAH = 0.1;
const ZWEI_PI = 2 * Math.PI;

const begrenze = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Blickrichtung (Einheitsvektor). */
export const blick = (f) => {
  const c = Math.cos(f.nick);
  return [c * Math.sin(f.gier), Math.sin(f.nick), c * Math.cos(f.gier)];
};

/** Nach rechts, waagerecht (Einheitsvektor). */
export const rechts = (f) => [-Math.cos(f.gier), 0, Math.sin(f.gier)];

/** Freiflug mit demselben Blick wie die Orbit-Kamera (gleiche Augenposition und Blickrichtung). */
export function ausKamera(k) {
  const c = Math.cos(k.neigung);
  return {
    position: [k.ziel[0] + k.abstand * c * Math.sin(k.azimut), k.ziel[1] + k.abstand * Math.sin(k.neigung), k.ziel[2] + k.abstand * c * Math.cos(k.azimut)],
    gier: (((k.azimut + Math.PI) % ZWEI_PI) + ZWEI_PI) % ZWEI_PI,
    nick: begrenze(-k.neigung, -NEIGUNG_MAX, NEIGUNG_MAX),
  };
}

/** Zurück zur Orbit-Kamera: das Ziel liegt `abstand` Blöcke vor dem Auge. */
export function zuOrbit(f, abstand) {
  const b = blick(f);
  return {
    ziel: [f.position[0] + b[0] * abstand, f.position[1] + b[1] * abstand, f.position[2] + b[2] * abstand],
    azimut: (((f.gier - Math.PI) % ZWEI_PI) + ZWEI_PI) % ZWEI_PI,
    neigung: begrenze(-f.nick, -NEIGUNG_MAX, NEIGUNG_MAX),
    abstand,
  };
}

/** Umsehen (Bogenmaß): positives dGier dreht nach links, positives dNick nach oben; Nick bleibt zwischen −85° und 85°. */
export function drehen(f, dGier, dNick) {
  return {
    position: [...f.position],
    gier: (((f.gier + dGier) % ZWEI_PI) + ZWEI_PI) % ZWEI_PI,
    nick: begrenze(f.nick + dNick, -NEIGUNG_MAX, NEIGUNG_MAX),
  };
}

/**
 * Bewegen: tasten = {vor, zurueck, links, rechts, hoch, runter}. W/S entlang der Blickrichtung (mit Nick), A/D seitlich waagerecht,
 * hoch/runter senkrecht. Die Richtung wird normalisiert (Diagonalen nicht schneller); dt wird auf höchstens DT_MAX begrenzt.
 */
export function schritt(f, tasten, dt, tempo) {
  const t = Number.isFinite(dt) ? begrenze(dt, 0, DT_MAX) : 0;
  const vw = (tasten.vor ? 1 : 0) - (tasten.zurueck ? 1 : 0), sw = (tasten.rechts ? 1 : 0) - (tasten.links ? 1 : 0), hr = (tasten.hoch ? 1 : 0) - (tasten.runter ? 1 : 0);
  const b = blick(f), r = rechts(f);
  const v = [b[0] * vw + r[0] * sw, b[1] * vw + hr, b[2] * vw + r[2] * sw];
  const laenge = Math.hypot(v[0], v[1], v[2]);
  const weg = laenge > 1e-9 && Number.isFinite(tempo) ? (tempo * t) / laenge : 0;
  return { position: [f.position[0] + v[0] * weg, f.position[1] + v[1] * weg, f.position[2] + v[2] * weg], gier: f.gier, nick: f.nick };
}

/** Standardtempo (Blöcke je Sekunde) aus der Hüllendiagonale {von, bis}: etwa die halbe Diagonale je Sekunde, begrenzt. */
export function standardTempo(huelle) {
  if (!huelle) return 30;
  const diagonale = Math.hypot(huelle.bis[0] - huelle.von[0], huelle.bis[1] - huelle.von[1], huelle.bis[2] - huelle.von[2]);
  return begrenze(diagonale / 2, TEMPO_MIN, TEMPO_MAX);
}

/** Tempo per Faktor ändern (Mausrad), begrenzt auf 1 bis 2000 Blöcke je Sekunde. */
export const tempoAnpassen = (tempo, faktor) => begrenze(tempo * faktor, TEMPO_UNTEN, TEMPO_OBEN);

/** Matrizen: Ansicht, Projektion, beides; Near fest 0,1, Far reicht bis zur fernsten Ecke der Hülle (auch von außerhalb). */
export function matrizen(f, aspekt, huelle) {
  let fern = 5000;
  if (huelle) {
    let weit = 0;
    for (const x of [huelle.von[0], huelle.bis[0]]) for (const y of [huelle.von[1], huelle.bis[1]]) for (const z of [huelle.von[2], huelle.bis[2]]) {
      weit = Math.max(weit, Math.hypot(x - f.position[0], y - f.position[1], z - f.position[2]));
    }
    fern = Math.max(500, weit * 1.1 + 100);
  }
  const b = blick(f);
  const ansicht = blickAuf(f.position, [f.position[0] + b[0], f.position[1] + b[1], f.position[2] + b[2]], [0, 1, 0]);
  const projektion = perspektive(FOV, aspekt, NAH, fern);
  return { ansicht, projektion, mvp: multipliziere(projektion, ansicht), auge: [...f.position] };
}

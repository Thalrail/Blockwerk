// Ebene 5 – Orbit-Kamera für die 3D-Ansicht: um einen Zielpunkt drehen und neigen (mit Grenzen), zoomen, verschieben, auf ein Hüllvolumen einpassen.
// Reine Rechnung (keine Uhr, kein DOM); die Oberfläche (web/ansicht3d.js) übersetzt Mausbewegungen in diese Aufrufe.
import { blickAuf, multipliziere, perspektive } from './matrix.js';

export const NEIGUNG_MAX = (85 * Math.PI) / 180;
export const FOV = (50 * Math.PI) / 180;
const ABSTAND_MIN = 2;
const ABSTAND_MAX = 20000;

/** Neue Kamera: schräg von Süd-Ost oben auf den Ursprung. */
export const neueKamera = () => ({ ziel: [0, 0, 0], azimut: Math.PI / 4, neigung: Math.PI / 6, abstand: 60 });

const begrenze = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const kopie = (k) => ({ ziel: [...k.ziel], azimut: k.azimut, neigung: k.neigung, abstand: k.abstand });

/** Drehen (Azimut, links/rechts) und Neigen (hoch/runter); Neigung bleibt zwischen −85° und 85°, kein Überschlag. */
export function drehen(k, dAzimut, dNeigung) {
  const n = kopie(k);
  n.azimut = (((k.azimut + dAzimut) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  n.neigung = begrenze(k.neigung + dNeigung, -NEIGUNG_MAX, NEIGUNG_MAX);
  return n;
}

/** Zoomen: Faktor kleiner 1 = näher heran. */
export function zoomen(k, faktor) {
  const n = kopie(k);
  n.abstand = begrenze(k.abstand * faktor, ABSTAND_MIN, ABSTAND_MAX);
  return n;
}

/** Position des Auges. */
export function auge(k) {
  const c = Math.cos(k.neigung);
  return [k.ziel[0] + k.abstand * c * Math.sin(k.azimut), k.ziel[1] + k.abstand * Math.sin(k.neigung), k.ziel[2] + k.abstand * c * Math.cos(k.azimut)];
}

/** Verschieben in der Bildebene; dx, dy sind Anteile der Bildhöhe (1 = ganze Bildhöhe). */
export function verschieben(k, dx, dy) {
  const n = kopie(k);
  const hoehe = 2 * k.abstand * Math.tan(FOV / 2);
  const rechts = [Math.cos(k.azimut), 0, -Math.sin(k.azimut)];
  const hoch = [-Math.sin(k.neigung) * Math.sin(k.azimut), Math.cos(k.neigung), -Math.sin(k.neigung) * Math.cos(k.azimut)];
  for (let i = 0; i < 3; i++) n.ziel[i] = k.ziel[i] - rechts[i] * dx * hoehe + hoch[i] * dy * hoehe;
  return n;
}

/** Passt die Kamera so an, dass das ganze Hüllvolumen {von, bis} (obere Grenze offen) im Bild liegt. */
export function einpassen(k, huelle, seitenverhaeltnis = 1) {
  const n = kopie(k);
  const von = huelle.von, bis = huelle.bis;
  n.ziel = [(von[0] + bis[0]) / 2, (von[1] + bis[1]) / 2, (von[2] + bis[2]) / 2];
  const radius = Math.hypot(bis[0] - von[0], bis[1] - von[1], bis[2] - von[2]) / 2 || 1;
  const halbH = Math.atan(Math.tan(FOV / 2) * Math.min(1, seitenverhaeltnis)); // der kleinere der beiden Öffnungswinkel entscheidet
  n.abstand = begrenze((radius / Math.sin(halbH)) * 1.08, ABSTAND_MIN, ABSTAND_MAX);
  return n;
}

/** Matrizen für das Zeichnen: Ansicht, Projektion und beides zusammen. */
export function matrizen(k, seitenverhaeltnis) {
  const a = auge(k);
  const ansicht = blickAuf(a, k.ziel, [0, 1, 0]);
  const projektion = perspektive(FOV, seitenverhaeltnis, Math.max(0.1, k.abstand * 0.01), k.abstand * 4 + 5000);
  return { ansicht, projektion, mvp: multipliziere(projektion, ansicht), auge: a };
}

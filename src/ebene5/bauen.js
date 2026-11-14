// Ebene 5 – der Bauauftrag der Oberfläche: Spezifikation (und die manuellen Änderungen der Planfassung) → Entwurf der Planung.
// Eigener Ort, damit der Worker im Browser und die Tests genau denselben Weg gehen.

/**
 * @param {{ebene4: {baue: Function}}} e  geladene Engine
 * @param {object} spezifikation  freigegebene Spezifikation
 * @param {object[]} [messungen]
 * @param {{version: number, eintraege: object}|null} [aenderungen]  Planfassung (manuelle Einzelblockänderungen); ohne sie wird nur die Spezifikation gebaut
 */
export function bauePlan(e, spezifikation, messungen = [], aenderungen = null) {
  return e.ebene4.baue(spezifikation, messungen, aenderungen ? { aenderungen } : {});
}

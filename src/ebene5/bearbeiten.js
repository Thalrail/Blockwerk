// Ebene 5 – Einzelblockänderungen bearbeiten (Paket U3 der Oberfläche, docs/plan-oberflaeche-bearbeiten.md).
// Reines Modul ohne DOM: aus einer gewählten Zelle (Zellenwahl, Ebene 3) und einer Aktion der Benutzerin oder des Benutzers wird eine Planfassungs-Operation
// (`{teil, zelle, erwartet, neu}`, siehe planfassung.js) und daraus die neue Planfassung. Diese Ebene rechnet am Plan nichts: sie übersetzt nur eine Eingabe in die Form,
// die Ebene 3 (`aenderungen.js`) versteht, und zeigt Blöcke und Zustände aus dem Register (Ebene 0).
//
// Wichtig: Änderungen liegen im Rahmen des Teils (Ecke Nordwest unten, vor der Drehung des Teils). Die Auswahl der Benutzerin ist aber die, die sie in der Welt sieht
// (Blick nach Norden, wie im Schichtplan). Richtungszustände (facing, weirdo_direction, Achse …) werden deshalb vom Vermesser (Ebene 0) in den Rahmen zurückgedreht.
// Die Erwartung `erwartet` stammt aus dem Stand der Planfassung zum Zeitpunkt der Auswahl (nicht aus dem jüngsten lokalen Stand): hat inzwischen jemand anders dieselbe
// Zelle geändert, ist das ein Konflikt und nie ein stilles Überschreiben.
import * as PF from './planfassung.js';

export const AKTIONEN = Object.freeze(['aendern', 'entfernen', 'zuruecknehmen']);
const LUFT = 'minecraft:air';
const NAME_MAX = 24; // PF.pruefeForm lehnt längere Namen ab (die ganze Planfassung wäre dann beim Laden verloren)

export class BearbeitenFehler extends Error {
  constructor(nachricht) { super(nachricht); this.name = 'BearbeitenFehler'; }
}

/** Name des Spielers für den Eintrag: nie leer, höchstens 24 Zeichen, keine Steuerzeichen. */
export function spielerName(name) {
  const n = String(name ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return (n || 'Spieler').slice(0, NAME_MAX).trim() || 'Spieler';
}

/** Inhalt eines Eintrags ohne Autor (so, wie `wende` ihn als Erwartung vergleicht). */
export const inhaltVon = (eintrag) => (eintrag ? { op: eintrag.op, ...(eintrag.block ? { block: { id: eintrag.block.id, ...(eintrag.block.zustand ? { zustand: { ...eintrag.block.zustand } } : {}) } } : {}), ...(eintrag.zugelassen === true ? { zugelassen: true } : {}) } : null);

/**
 * Aus der Antwort der Zellenwahl wird die Auswahl der Oberfläche. `planfassung` ist der Stand, den die Benutzerin gerade sieht; der Eintrag an dieser Zelle wird jetzt
 * als Erwartung festgehalten und reist mit der Auswahl.
 * @returns {{waehlbar: false, zelle: object, hinweis: string}|{waehlbar: true, welt: object, teil: string, teilName: string, baustein: string, zelle: object, drehung: number, block: object|null, besitzt: boolean, erwartet: object|null, aenderung: object|null, hinweis: string|null, kandidaten: object[]}}
 */
export function auswahlAus(wahl, planfassung) {
  if (!wahl?.gewaehlt) return { waehlbar: false, zelle: wahl?.zelle ?? null, hinweis: wahl?.hinweis ?? 'Hier lässt sich nichts ändern.' };
  const g = wahl.gewaehlt;
  const erwartet = inhaltVon((planfassung?.eintraege ?? {})[PF.schluessel(g.teil, g.zelle)]);
  return {
    waehlbar: true, welt: { ...wahl.zelle }, teil: g.teil, teilName: g.name ?? g.teil, baustein: g.baustein, zelle: { ...g.zelle }, drehung: g.drehung ?? 0,
    block: wahl.block ?? null, besitzt: !!g.besitzt, erwartet, aenderung: g.aenderung ?? null, hinweis: wahl.hinweis ?? null, kandidaten: wahl.kandidaten ?? [],
  };
}

/** Welche Aktionen sind für diese Auswahl sinnvoll? (die Oberfläche zeigt nur diese Knöpfe) */
export function moeglicheAktionen(auswahl) {
  if (!auswahl?.waehlbar) return [];
  const a = ['aendern'];
  if (auswahl.besitzt && auswahl.block && auswahl.erwartet?.op !== 'leere') a.push('entfernen');
  if (auswahl.erwartet) a.push('zuruecknehmen');
  return a;
}

const kurz = (id) => String(id).replace(/^minecraft:/, '');

/** Zustandsart, deren Fehlen das Drehen unmöglich macht: aus der Fehlermeldung des Vermessers. */
const fehlenderZustand = (meldung) => /Zustand "([^"]+)" fehlt/.exec(String(meldung))?.[1] ?? null;

/** Dreht einen einzelnen Block (nur sein Zustand) durch den Vermesser; wirft dessen Fehler (z. B. fehlender Richtungszustand). */
function drehe(ebene0, id, zustand, viertel) {
  return ebene0.vermesser.drehe({ bloecke: [{ id, x: 0, y: 0, z: 0, zustand: { ...zustand } }], wesen: [] }, viertel).bloecke[0].zustand;
}

/**
 * Blockzustand von der Welt (so, wie die Benutzerin ihn sieht) in den Rahmen des Teils (vor dessen Drehung) – die Umkehrung dessen, was `bloeckeInWelt` beim Zusammenbau tut.
 * Fehlt ein Richtungszustand, wirft das – das gilt unabhängig von der Drehung des Teils (sonst bräche die Änderung später, sobald das Teil gedreht wird).
 */
export function zustandInRahmen(ebene0, id, zustand, drehung) {
  const z = zustand ?? {};
  try { drehe(ebene0, id, z, 1); } catch (f) {
    const name = fehlenderZustand(f.message);
    throw new BearbeitenFehler(name ? `${kurz(id)}: bitte „${name}“ wählen (sonst weiß der Plan nicht, wohin der Block zeigt, wenn das Teil gedreht wird).` : `${kurz(id)}: ${f.message}`);
  }
  const rueck = (((4 - drehung) % 4) + 4) % 4;
  return rueck === 0 ? { ...z } : drehe(ebene0, id, z, rueck);
}

/**
 * Block und Zustand der Welt-Auswahl prüfen (nur gültige Zustände) und in den Rahmen des Teils bringen.
 * @returns {{id: string, zustand?: object}} Block im Rahmen des Teils
 */
export function blockImRahmen(ebene0, block, drehung) {
  const reg = ebene0.register.bloecke;
  if (typeof block?.id !== 'string' || !reg.hat(block.id)) throw new BearbeitenFehler(`„${String(block?.id ?? '').slice(0, 60)}“ ist kein Block im Register.`);
  if (block.id === LUFT) throw new BearbeitenFehler('Luft setzt man nicht als Block: bitte „Block entfernen“ nehmen.');
  const z = block.zustand ?? {};
  try { reg.pruefeZustand(block.id, z); } catch (f) { throw new BearbeitenFehler(f.message); }
  const rahmen = zustandInRahmen(ebene0, block.id, z, drehung);
  try { reg.pruefeZustand(block.id, rahmen); } catch (f) { throw new BearbeitenFehler(f.message); }
  return { id: block.id, ...(Object.keys(rahmen).length ? { zustand: rahmen } : {}) };
}

/**
 * Eine Aktion der Benutzerin ergibt genau eine Planfassungs-Operation. `block` (nur bei „aendern“) ist der gewünschte Block in der Sicht der Welt.
 * @returns {{teil: string, zelle: object, erwartet: object|null, neu: object|null}}
 */
export function operation(ebene0, auswahl, aktion, block) {
  if (!auswahl?.waehlbar) throw new BearbeitenFehler(auswahl?.hinweis ?? 'Es ist keine Zelle gewählt.');
  if (!AKTIONEN.includes(aktion)) throw new BearbeitenFehler(`Unbekannte Aktion „${String(aktion)}“.`);
  const grund = { teil: auswahl.teil, zelle: { ...auswahl.zelle }, erwartet: auswahl.erwartet };
  if (aktion === 'zuruecknehmen') {
    if (!auswahl.erwartet) throw new BearbeitenFehler('An dieser Zelle gibt es keine Änderung zum Zurücknehmen.');
    return { ...grund, neu: null };
  }
  if (aktion === 'entfernen') {
    if (!(auswahl.besitzt && auswahl.block)) throw new BearbeitenFehler('An dieser Zelle ist kein Block des Teils, den man entfernen könnte.');
    if (auswahl.erwartet?.op === 'leere') throw new BearbeitenFehler('Dieser Block ist schon entfernt.');
    return { ...grund, neu: PF.pruefeInhalt({ op: 'leere' }) };
  }
  return { ...grund, neu: PF.pruefeInhalt({ op: 'setze', block: blockImRahmen(ebene0, block, auswahl.drehung) }) };
}

/**
 * Die Operation auf eine lokale Planfassung anwenden (Vergleichen-und-Setzen). Nie überschreibend: bei Abweichung zwischen Erwartung und Stand kommt `konflikt`.
 * @returns {{planfassung: object, geaendert: boolean, konflikt: object|null}}
 */
export function anwenden(planfassung, op, von) {
  const r = PF.wende(planfassung, [op], spielerName(von));
  return { planfassung: r.planfassung, geaendert: r.geaendert, konflikt: r.konflikte[0] ?? null };
}

/** Alle Einträge einer Planfassung als Operationen gegen einen Stand ohne diese Einträge (z. B. lokale Änderungen in einen neuen, noch leeren Raum übertragen). */
export const operationenAus = (planfassung) => Object.keys(planfassung?.eintraege ?? {}).sort().map((k) => { const e = planfassung.eintraege[k]; return { teil: e.teil, zelle: { ...e.zelle }, erwartet: null, neu: PF.pruefeInhalt(inhaltVon(e)) }; });

/** Eine Planfassung, die nach dem Vorgänger nur Änderungen enthält? Kurze Beschreibung für die Anzeige („3 Änderungen, Fassung 5“). */
export const beschreibung = (pf) => { const n = Object.keys(pf?.eintraege ?? {}).length; return `${n} ${n === 1 ? 'Änderung' : 'Änderungen'}, Fassung ${pf?.version ?? 0}`; };

/** Gleicher Inhalt (Einträge)? Die Versionsnummer allein zählt nicht (eine zurückgenommene und neu gesetzte Änderung ändert den Plan nicht). */
export const gleicheEintraege = (a, b) => { const kanon = (pf) => JSON.stringify(Object.keys(pf?.eintraege ?? {}).sort().map((k) => [k, PF.pruefeInhalt(inhaltVon(pf.eintraege[k]))])); return kanon(a) === kanon(b); }; // ohne Autor: gleicher Plan = gleiche Änderung

// ---------- Probleme nach einer Änderung ----------

/** Änderungen des Plans, die sich nicht anwenden lassen (verwaist, Konflikt, ungültig) und auf eine Entscheidung warten (Regel plan.aenderung). Sie ändern den Plan nicht. */
export const offeneAenderungen = (daten) => (daten?.plan?.aenderungen ?? []).filter((a) => a.rueckfrage);

/**
 * Hat die Änderung, die gerade gebaut wurde, ein neues Problem erzeugt? Dann steht hier der Text der Rückfrage(n), sonst null. Die Oberfläche nimmt eine solche eigene
 * Änderung zurück, statt den Benutzer mit einer Sackgasse allein zu lassen (die Auflösung einzelner Änderungen folgt mit U6).
 * @param {{plan: object, rueckfragenOffen?: object[]}} neu  Antwort des Baus mit der Änderung
 * @param {{plan: object}} alt  der bisher gezeigte Plan
 */
export function neueProbleme(neu, alt) {
  const id = (a) => `${a.teil}|${a.zelle.x},${a.zelle.y},${a.zelle.z}`, bekannt = new Set(offeneAenderungen(alt).map(id)); // nicht die Anzahl zählt: ein behobenes und ein neues Problem sind zwei verschiedene
  if (!offeneAenderungen(neu).some((a) => !bekannt.has(id(a)))) return null;
  return (neu.rueckfragenOffen ?? []).filter((q) => q.art === 'aenderung').map((q) => q.frage).join(' ') || 'Die Änderung lässt sich nicht anwenden.';
}

// ---------- Blockauswahl aus dem Register (Ebene 0) ----------

/** Blöcke, deren ID den Suchtext enthält (Anfang des Namens zuerst, dann alphabetisch), ohne Luft. */
export function blockSuche(ebene0, text, grenze = 40) {
  const t = String(text ?? '').trim().toLowerCase().replace(/^minecraft:/, '').replace(/\s+/g, '_');
  if (!t) return [];
  const treffer = ebene0.register.bloecke.ids().filter((id) => id !== LUFT && kurz(id).includes(t));
  treffer.sort((a, b) => Number(kurz(b).startsWith(t)) - Number(kurz(a).startsWith(t)) || (a < b ? -1 : 1));
  return treffer.slice(0, grenze).map((id) => ({ id, name: kurz(id) }));
}

/**
 * Zustandsarten eines Blocks für die Auswahl: Name, erlaubte Werte, `pflicht` (ohne den Wert lässt sich der Block nicht drehen, also muss er gewählt sein) und ein
 * Vorschlag. Die Reihenfolge ist fest (alphabetisch), damit die Anzeige deterministisch bleibt.
 */
export function blockInfo(ebene0, id) {
  const reg = ebene0.register.bloecke;
  if (!reg.hat(id) || id === LUFT) throw new BearbeitenFehler(`„${String(id).slice(0, 60)}“ ist kein wählbarer Block.`);
  const b = reg.block(id);
  const pflicht = new Set();
  const z = {};
  for (let i = 0; i <= Object.keys(b.zustaende).length; i++) { // je Runde fehlt höchstens ein weiterer Pflichtzustand
    try { drehe(ebene0, id, z, 1); break; } catch (f) {
      const n = fehlenderZustand(f.message);
      if (!n || !b.zustaende[n] || pflicht.has(n)) break;
      pflicht.add(n); z[n] = b.zustaende[n].werte[0];
    }
  }
  return {
    id, name: kurz(id),
    zustaende: Object.entries(b.zustaende).sort(([p], [q]) => (p < q ? -1 : 1)).map(([name, art]) => ({ name, typ: art.typ, werte: [...art.werte], pflicht: pflicht.has(name), vorschlag: pflicht.has(name) ? art.werte[0] : null })),
  };
}

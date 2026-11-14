// Ebene 5 – Verwaistes und Konflikte lösen (Paket U6 der Oberfläche, docs/plan-oberflaeche-bearbeiten.md): das Datenmodell hinter dem Panel „Änderungen“ und die Operationen,
// mit denen Jonah über eine nicht anwendbare Änderung entscheidet. Rein, ohne DOM. Jede Entscheidung ist eine Operation der Planfassung (Vergleichen-und-Setzen mit der
// Erwartung, die Jonah gesehen hat): verwerfen = Eintrag löschen, zulassen = Eintrag mit Zulassung versehen (der Bau geht ohne die Änderung weiter, sie bleibt gespeichert),
// neu verankern = alten Eintrag löschen und neuen an der Zielzelle setzen, **als Gruppe** (ganz oder gar nicht, auch im gemeinsamen Raum). Nichts geschieht automatisch.
import * as PF from './planfassung.js';
import { inhaltVon, spielerName } from './bearbeiten.js';

export class LoesenFehler extends Error {
  constructor(nachricht) { super(nachricht); this.name = 'LoesenFehler'; }
}

const GRUND = {
  'teil-fehlt': 'das Teil gibt es nicht mehr', 'teil-leer': 'das Teil hat keine Blöcke mehr', ausserhalb: 'die Zelle liegt nicht mehr im Teil (das Teil ist kleiner geworden)',
  'kein-block': 'an der Zelle steht im Teil kein Block mehr', 'fremder-block': 'dort steht ein Block eines anderen Teils', freiraum: 'die Zelle muss freigehalten werden',
};
const schluesselVon = (a) => PF.schluessel(a.teil, a.zelle);
const ort = (a) => `Zelle ${a.zelle.x}, ${a.zelle.y}, ${a.zelle.z} von „${a.teil}“`;
const kurz = (id) => String(id ?? '').replace(/^minecraft:/, '');

/** Ein Satz zum Grund, warum eine Änderung nicht wirkt (leer, wenn sie wirkt). */
export function grundText(a) {
  if (a.status === 'angewandt') return '';
  if (a.status === 'ueberholt') return 'Ein Einbauteil (Tür, Fenster, Treppe) spart die Zelle schon aus; die Änderung hat keine Wirkung mehr.';
  if (a.status === 'ungueltig') return `Der Block oder sein Zustand ist nicht möglich: ${a.grund ?? 'siehe Plan'}.`;
  const g = GRUND[a.grund] ?? a.grund ?? 'siehe Plan';
  return `${a.status === 'konflikt' ? 'Konflikt' : 'Verwaist'}: ${g}${a.mit && a.grund === 'fremder-block' ? ` (${[].concat(a.mit).join(', ')})` : ''}.`;
}

/** Der Inhalt einer Änderung als kurzer Text („Block gesetzt: glass“, „Block entfernt“). */
export const inhaltText = (i) => (!i ? 'keine Änderung' : i.op === 'leere' ? 'Block entfernt' : `Block gesetzt: ${kurz(i.block?.id)}${i.block?.zustand && Object.keys(i.block.zustand).length ? ` [${Object.entries(i.block.zustand).map(([k, w]) => `${kurz(k)}=${w}`).join(', ')}]` : ''}`);

/**
 * Das Panel „Änderungen“: alle manuellen Änderungen des Plans, nach Zustand gruppiert, je mit Satz und erlaubten Aktionen. Eine Änderung verschwindet nie stillschweigend aus dieser
 * Liste (verwaist, im Konflikt, ungültig, überholt, zugelassen, wirkt).
 * @param {{aenderungen?: object[]}} plan  Bauplan (Ebene 5)
 * @returns {{offen: object[], zugelassen: object[], ueberholt: object[], wirkt: object[], anzahl: number}}
 */
export function aenderungsPanel(plan) {
  const aus = { offen: [], zugelassen: [], ueberholt: [], wirkt: [], anzahl: 0 };
  for (const a of plan?.aenderungen ?? []) {
    const e = {
      id: a.id, schluessel: schluesselVon(a), teil: a.teil, zelle: { ...a.zelle }, op: a.op, block: a.block ?? null, von: a.von ?? null, status: a.status, zugelassen: a.zugelassen === true,
      text: `${inhaltText({ op: a.op, block: a.block })} an ${ort(a)}${a.von ? ` (von ${a.von})` : ''}`, grund: grundText(a), aktionen: [],
    };
    if (a.status === 'angewandt') { e.aktionen = ['verwerfen']; aus.wirkt.push(e); }
    else if (a.status === 'ueberholt') { e.aktionen = ['verwerfen', 'verankern']; aus.ueberholt.push(e); }
    else if (e.zugelassen) { e.aktionen = ['zulassung-zurueck', 'verwerfen', 'verankern']; aus.zugelassen.push(e); }
    else { e.aktionen = ['verwerfen', 'verankern', 'zulassen']; aus.offen.push(e); }
    aus.anzahl++;
  }
  return aus;
}

const eintragVon = (pf, schluessel) => {
  const e = (pf?.eintraege ?? {})[schluessel];
  if (!e) throw new LoesenFehler('Diese Änderung gibt es in der Planfassung nicht mehr (vielleicht hat jemand anders sie schon entschieden).');
  return e;
};

/** Verwerfen: der Eintrag wird gelöscht. Erwartung = der Stand, den die Benutzerin gesehen hat (kommt von der Planfassung zum Zeitpunkt der Auswahl). */
export function opVerwerfen(pf, schluessel) {
  const e = eintragVon(pf, schluessel);
  return { teil: e.teil, zelle: { ...e.zelle }, erwartet: inhaltVon(e), neu: null };
}

/** Zulassen (oder die Zulassung zurücknehmen): derselbe Inhalt mit oder ohne `zugelassen`. */
export function opZulassen(pf, schluessel, zugelassen = true) {
  const e = eintragVon(pf, schluessel), jetzt = inhaltVon(e);
  const neu = { ...jetzt }; delete neu.zugelassen;
  if (zugelassen) neu.zugelassen = true;
  return { teil: e.teil, zelle: { ...e.zelle }, erwartet: jetzt, neu };
}

/**
 * Neu verankern: der Eintrag geht an eine andere Zelle (Teil und Rahmenzelle, wie `zellenwahl` sie nennt). Zwei Operationen, die nur zusammen gelten (Gruppe): alten Eintrag löschen,
 * neuen setzen. Ist die Zielzelle schon belegt, wird nichts verdrängt (erst ausdrücklich verwerfen). Eine Zulassung gilt für den neuen Ort nicht mehr (er wird neu bewertet).
 * @returns {{teil: string, zelle: object, erwartet: object|null, neu: object|null}[]}
 */
export function opsVerankern(pf, schluessel, ziel, quelle = null) {
  // `quelle`: der Eintrag so, wie die Benutzerin ihn beim Start von „Neu verankern“ sah. Die Erwartung kommt von ihm, nicht vom jüngsten Stand: hat jemand den Eintrag inzwischen geändert, lehnt die Gruppe ab, statt etwas anderes zu verschieben.
  const e = quelle ?? eintragVon(pf, schluessel);
  if (typeof ziel?.teil !== 'string' || !ziel.zelle) throw new LoesenFehler('Das Ziel braucht Teil und Zelle.');
  const neuerSchluessel = PF.schluessel(ziel.teil, ziel.zelle);
  if (neuerSchluessel === schluessel) throw new LoesenFehler('Das ist dieselbe Zelle. Bitte eine andere wählen.');
  if (pf.eintraege[neuerSchluessel]) throw new LoesenFehler(`An der Zelle ${ziel.zelle.x}, ${ziel.zelle.y}, ${ziel.zelle.z} von „${ziel.teil}“ gibt es schon eine Änderung. Sie muss zuerst ausdrücklich verworfen werden.`);
  const inhalt = inhaltVon(e); delete inhalt.zugelassen;
  return [
    { teil: e.teil, zelle: { ...e.zelle }, erwartet: inhaltVon(e), neu: null },
    { teil: ziel.teil, zelle: { x: ziel.zelle.x, y: ziel.zelle.y, z: ziel.zelle.z }, erwartet: null, neu: inhalt },
  ];
}

/**
 * Operationen lokal anwenden (Vergleichen-und-Setzen, bei `gruppe` ganz oder gar nicht).
 * @returns {{planfassung: object, geaendert: boolean, konflikte: object[]}}
 */
export function anwendenOps(pf, ops, von, { gruppe = false } = {}) {
  const r = PF.wende(pf, ops, spielerName(von), { gruppe });
  return { planfassung: r.planfassung, geaendert: r.geaendert, konflikte: r.konflikte };
}

/**
 * Ein Mehrspieler-Konflikt (Antwort `aenderung-konflikt` des Raums) für die Anzeige: deine Fassung gegen die des anderen Spielers.
 * @param {{teil: string, zelle: object, aktuell: object|null, vorschlag: object|null}} k
 */
export function konfliktAnsicht(k, { gruppe = false } = {}) {
  return {
    teil: k.teil, zelle: { ...k.zelle }, ort: ort(k), gruppe,
    deine: inhaltText(k.vorschlag), ihre: inhaltText(k.aktuell), von: k.aktuell?.von ?? null,
    satz: `${gruppe ? 'Das Verschieben wurde ganz abgelehnt, nichts wurde geändert. ' : ''}${ort(k)}: Du wolltest „${inhaltText(k.vorschlag)}“, ${k.aktuell?.von ?? 'jemand anders'} hat inzwischen „${inhaltText(k.aktuell)}“ gesetzt.${gruppe ? ' Bitte „Neu verankern“ noch einmal wählen.' : ''}`,
  };
}

/**
 * Die Technikanlagen für die Anzeige: Status aus dem Plan (nie „funktioniert“ ohne Bestätigung), dazu die angewandten Änderungen im Prüfbereich und, nach „neu prüfen“, die Verstöße
 * mit Koordinate.
 * @param {{technik?: object[]}} plan
 * @param {{bestaetigt: string[], abgelehnt: {ref: string, meldungen: {ort: object, meldung?: string, regel?: string}[]}[]}|null} pruefung  Ergebnis der neuen Prüfung durch Ebene 1
 */
export function technikAnsicht(plan, pruefung = null) {
  return (plan?.technik ?? []).map((t) => {
    const ab = pruefung?.abgelehnt?.find((x) => x.ref === t.ref) ?? null;
    const status = pruefung ? (ab ? 'abgelehnt' : pruefung.bestaetigt?.includes(t.ref) ? 'bestaetigt' : t.status) : t.status;
    return {
      ref: t.ref, name: t.name, abschnitt: t.abschnitt, status,
      text: { bestaetigt: 'bestätigt: die Prüfung durch Ebene 1 findet im Prüfbereich keinen Verstoß', 'nicht-bestaetigt': 'nicht bestätigt: im Prüfbereich hat sich seit der letzten Prüfung etwas geändert', ungeprueft: 'noch nicht geprüft', abgelehnt: 'nicht bestätigt: die Prüfung findet Verstöße' }[status] ?? status,
      funktioniert: status === 'bestaetigt', // nur eine bestätigte Anlage gilt als funktionsfähig
      geaendertDurch: [...(t.geaendertDurch ?? [])],
      verstoesse: (ab?.meldungen ?? []).map((m) => ({ x: m.ort?.x, y: m.ort?.y, z: m.ort?.z, text: m.meldung ?? m.regel ?? 'Verstoß' })),
    };
  });
}

/**
 * „Neu prüfen“ der Technikanlagen: die Prüfer aus Ebene 1 laufen über den Prüfbereich jeder Anlage (Ebene 3, `bestaetigung.bestaetige`). Ändert den Entwurf nicht (die Seite zeigt nur das
 * Ergebnis). @returns {{bestaetigt: string[], abgelehnt: {ref: string, meldungen: {ort: object, meldung?: string, regel?: string}[]}[]}}
 */
export function technikPruefen(bestaetigung, entwurf) {
  const r = bestaetigung.bestaetige(entwurf);
  return { bestaetigt: [...r.bestaetigt], abgelehnt: r.abgelehnt.map((a) => ({ ref: a.ref, meldungen: a.meldungen.map((m) => ({ ort: { ...m.ort }, meldung: m.meldung, regel: m.regel })) })) };
}

// Blockwerk – Oberfläche (Ebene 5): zeigt den Bauplan, nimmt Haken entgegen und teilt Projekte. Rechnet nichts selbst:
// die Engine läuft im Worker (engine-worker.js), die Mengen- und Fortschrittslogik kommt aus src/ebene5.
import * as fortschritt from '../src/ebene5/fortschritt.js';
import * as teilen from '../src/ebene5/teilen.js';
import * as Umbau from '../src/ebene5/umbau.js';
import * as Projekt from '../src/ebene5/projektid.js';
import * as PF from '../src/ebene5/planfassung.js';
import * as Bearbeiten from '../src/ebene5/bearbeiten.js';
import { RICHTUNGEN } from '../src/ebene5/bauplan.js';
import { baueNetz } from '../src/ebene5/netz.js';
import { erzeugeAnsicht3d } from './ansicht3d.js';
import * as Eingabe from './eingabe.js';
import * as Tex from './texturen.js';
import * as Live from './live.js';

const FLAECHEN_MAX = 3_000_000;

const PFEIL = [' ', '↑', '→', '↓', '←', '⊙', '⊗'];
const $app = document.getElementById('app');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const speicher = {
  lies(k, std = null) { try { const v = localStorage.getItem(k); return v === null ? std : JSON.parse(v); } catch { return std; } },
  schreib(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* Speicher voll oder gesperrt: dann bleibt es nur im Fenster */ } },
};

const z = {
  spec: null, daten: null, fortschritt: fortschritt.leer(), name: speicher.lies('blockwerk.name', ''),
  modus: speicher.lies('blockwerk.modus', 'voll'), ansicht: speicher.lies('blockwerk.ansicht', 'plan'),
  sicht: { abschnitte: 'alle', maxY: null, technik: true, verbindungen: true, fortschritt: true, hervorheben: true }, netzMeldung: '', netzSignatur: '', a: 0, s: 0, reiter: 'material', status: null, fehler: null, rueckfragen: null, pip: null,
  seite: null, liveOffen: false, einladung: null, messungen: [], planfassung: PF.leer(), auswahl: null, blockwahl: null, bearbeitung: false, klickNr: 0, e: Eingabe.neuerZustand(speicher.lies('blockwerk.entwurf')),
};

// ---------- Engine im Hintergrund ----------
const worker = new Worker(new URL('./engine-worker.js', import.meta.url), { type: 'module' });
const offeneAnfragen = new Map();
let anfrageNr = 0;
/** Schickt eine Nachricht an die Engine und wartet auf die Antwort mit derselben Nummer. */
function anfrage(nachricht, uebertragen = []) {
  return new Promise((ok, nein) => { const nr = ++anfrageNr; offeneAnfragen.set(nr, { ok, nein }); worker.postMessage({ ...nachricht, anfrage: nr }, uebertragen); });
}
worker.onmessage = ({ data }) => {
  if (data.anfrage !== undefined) {
    const a = offeneAnfragen.get(data.anfrage); offeneAnfragen.delete(data.anfrage);
    if (data.typ === 'fehler') a?.nein(new Error(data.text)); else a?.ok(data);
    return;
  }
  if (data.lauf !== undefined && data.lauf !== z.lauf) return; // Antwort oder Statusmeldung eines überholten Auftrags (inzwischen wurde ein neueres Projekt gestartet)
  if (data.typ === 'status') { z.status = data.text; render(); return; }
  z.status = null;
  if (z.bearbeitung && z.vorher && (data.typ === 'fehler' || data.typ === 'rueckfragen')) { bearbeitungVerwerfen(data.typ === 'fehler' ? data.text : data.rueckfragen.map((q) => q.frage).join(' ')); render(); return; }
  if (data.typ === 'fehler') { z.fehler = data.text; z.daten = null; }
  else if (data.typ === 'rueckfragen') { z.rueckfragen = data.rueckfragen; z.daten = null; z.fehler = null; }
  else if (data.typ === 'fertig' && z.bearbeitung && z.vorher && Bearbeiten.neueProbleme(data, z.vorher.daten)) { bearbeitungVerwerfen(Bearbeiten.neueProbleme(data, z.vorher.daten)); }
  else if (data.typ === 'fertig') { z.daten = data; z.fehler = null; z.rueckfragen = null; nachDemBauen(); }
  render();
};
worker.onerror = (e) => { z.status = null; z.fehler = `Die Berechnung ist abgebrochen: ${e.message ?? e}`; render(); };

const zufall = () => crypto.getRandomValues(new Uint8Array(16)); // der einzige Zufall der Projektkennung: die Logik in src/ bekommt ihn hereingereicht

function startProjekt(spezifikation, empfangenerFortschritt = null, messungen = [], entscheidung = null, empfangeneAenderungen = null) {
  // Neue Fassung desselben Projekts: die alte (mit ihrem Fortschritt) bleibt gültig, bis Jonah die Umbauhinweise bestätigt hat
  // Läuft noch eine Berechnung (z.daten ist leer), bleibt die zuletzt bestätigte Fassung aus dem früheren Aufruf die Grundlage.
  const basis = z.daten && z.spec ? { spec: z.spec, daten: z.daten, fortschritt: z.fortschritt, planfassung: z.planfassung } : (z.vorher ?? null);
  // Zugehörigkeit über die Projektkennung (nicht über den Namen): gleiche Kennung = neue Fassung desselben Projekts, andere Kennung = eigenständiges Projekt;
  // Altbestand ohne Kennung wird nicht geraten, sondern gefragt (identischer Inhalt ist eindeutig und braucht keine Frage)
  let b;
  try { b = Projekt.bezug(basis?.spec ?? null, spezifikation); } catch (f) { z.idFrage = null; z.fehler = String(f.message ?? f); z.status = null; render(); return; } // ungültige Kennung: sichtbarer Fehler, nichts wird ersetzt
  if (b.art === 'unklar' && !entscheidung && !b.inhaltGleich) {
    z.idFrage = { spezifikation, empfangen: empfangenerFortschritt, aenderungen: empfangeneAenderungen, messungen, name: basis.spec.projekt?.name, neuerName: spezifikation.projekt?.name, nameGleich: b.nameGleich, neueOhneKennung: !Projekt.idVon(spezifikation) };
    render();
    return;
  }
  z.idFrage = null;
  let u;
  try { u = Projekt.uebernehme(basis?.spec ?? null, spezifikation, { entscheidung: b.art === 'unklar' ? (entscheidung ?? 'fortsetzung') : undefined, bytes: zufall() }); } catch (f) { z.idFrage = null; z.fehler = String(f.message ?? f); z.status = null; render(); return; }
  // Altbestand: der Fortschritt unter dem alten Schlüssel (ohne Kennung) geht mit, sei es von der ankommenden Fassung (Kennung neu vergeben) oder vom geöffneten Projekt (hatte keine)
  const altAbdruck = Projekt.alterFortschrittsAbdruck(u, basis?.spec ?? null, spezifikation);
  z.altSchluessel = altAbdruck ? `blockwerk.fortschritt.${altAbdruck}` : null;
  spezifikation = u.spec;
  // Manuelle Änderungen (Planfassung) gehören zum Projekt (Kennung), nicht zur Fassung: lokal gespeicherte, dazu die aus Link oder Datei. Nichts geht still verloren:
  // eigene lokale Änderungen haben Vorrang, abweichende aus der Datei werden gemeldet (das Zusammenführen mehrerer Spieler kommt mit U6/U7).
  let pf = ladePlanfassung(spezifikation);
  if (empfangeneAenderungen) {
    try {
      const emp = PF.pruefeForm(empfangeneAenderungen);
      if (!Object.keys(pf.eintraege).length) pf = emp;
      else if (!Bearbeiten.gleicheEintraege(emp, pf)) toast(`Der Link oder die Datei enthält andere Änderungen (${Bearbeiten.beschreibung(emp)}); deine eigenen (${Bearbeiten.beschreibung(pf)}) bleiben.`);
    } catch (f) { toast(`Die Änderungen im Link oder in der Datei sind unbrauchbar und wurden ignoriert: ${f.message}`); }
  }
  const gleichesProjekt = basis && u.art === 'fortsetzung' && (basis.spec.freigabe?.abdruck !== spezifikation.freigabe?.abdruck || !Bearbeiten.gleicheEintraege(basis.planfassung ?? PF.leer(), pf));
  z.vorher = gleichesProjekt ? basis : null;
  z.bearbeitung = false; z.auswahl = null; z.blockwahl = null; z.planfassung = pf;
  z.umbau = null;
  z.seite = null; z.messungen = messungen;
  z.spec = spezifikation; z.empfangen = empfangenerFortschritt; z.daten = null; z.fehler = null; z.rueckfragen = null;
  z.status = 'Bauplan wird berechnet …';
  speicher.schreib('blockwerk.projekt', spezifikation);
  render();
  worker.postMessage({ typ: 'baue', spezifikation, messungen, aenderungen: mitEintraegen(pf), lauf: z.lauf = (z.lauf ?? 0) + 1 });
}

// ---------- Manuelle Änderungen (Planfassung) ----------
const mitEintraegen = (pf) => (Object.keys(pf.eintraege).length ? pf : null); // leere Planfassung = nur die Spezifikation (der Plan bleibt Byte für Byte derselbe)
const pfSchluessel = (spec) => { const id = Projekt.idVon(spec); return id ? `blockwerk.aenderungen.${id}` : null; };
function ladePlanfassung(spec) {
  const k = pfSchluessel(spec); if (!k) return PF.leer();
  try { const roh = speicher.lies(k, null); return roh === null ? PF.leer() : PF.pruefeForm(roh); } catch { return PF.leer(); } // beschädigt: nicht erfinden, neu anfangen
}
const sichereAenderungen = (pf = z.planfassung, spec = z.spec) => { const k = pfSchluessel(spec); if (k) speicher.schreib(k, pf); };

/** Eine neue Planfassung (eigene Änderung oder Änderung aus dem Raum) wird gebaut. Die Seite zeigt den bisherigen Plan, bis der neue fertig und (bei geänderten Schichten) bestätigt ist. */
function baueMitAenderungen(pf) {
  if (!z.spec) return;
  const basis = z.daten ? { spec: z.spec, daten: z.daten, fortschritt: z.fortschritt, planfassung: z.planfassung } : (z.vorher ?? null); // läuft schon eine Berechnung, bleibt der zuletzt gezeigte Plan die Grundlage
  z.bleibe = z.daten ? { id: abschnitt().id, y: schicht().y } : z.bleibe; // nach dem Neubau an derselben Schicht bleiben (nicht zur nächsten ungebauten springen)
  z.vorher = basis; z.umbau = null; z.planfassung = pf; z.bearbeitung = !!basis;
  z.auswahl = null; z.blockwahl = null; z.daten = null; z.fehler = null; z.rueckfragen = null;
  z.status = 'Bauplan wird mit den Änderungen neu berechnet …';
  render();
  worker.postMessage({ typ: 'baue', spezifikation: z.spec, messungen: z.messungen, aenderungen: mitEintraegen(pf), lauf: z.lauf = (z.lauf ?? 0) + 1 });
}
/** Notausgang, wenn der Plan mit den gespeicherten Änderungen nicht entsteht (z. B. Änderungen aus einer Datei, die zu einer anderen Fassung gehören): die Änderungen lassen sich verwerfen. Das Auflösen einzelner Änderungen folgt mit U6. */
function aenderungenNotausgang() {
  const n = Object.keys(z.planfassung.eintraege).length;
  return n ? `<button data-a="aenderungen-verwerfen" title="Alle ${n} gespeicherten Änderungen dieses Projekts entfernen und den Plan neu berechnen (eine Sicherung bleibt im Browser)">Änderungen verwerfen (${n})</button>` : '';
}
/** Nach einer Änderung bleibt die Ansicht an der Schicht, an der gearbeitet wurde (falls es sie noch gibt). */
function behaltePosition(b) {
  if (!b || !z.daten) return;
  const ai = z.daten.plan.abschnitte.findIndex((a) => a.id === b.id); if (ai < 0) return;
  const si = z.daten.plan.abschnitte[ai].schichten.findIndex((q) => q.y === b.y);
  if (si >= 0) { z.a = ai; z.s = si; }
}
/** Die Änderung ließ sich nicht bauen (Rückfrage oder Fehler der Planung): nichts wird still angewandt, der bisherige Plan und die bisherigen Änderungen gelten weiter. */
function bearbeitungVerwerfen(grund) {
  const v = z.vorher; z.vorher = null; z.bearbeitung = false;
  z.spec = v.spec; z.daten = v.daten; z.fortschritt = v.fortschritt; z.planfassung = v.planfassung ?? PF.leer();
  z.fehler = null; z.rueckfragen = null; z.auswahl = null; z.blockwahl = null; z.bleibe = null;
  toast(`Die Änderung wurde nicht übernommen, der bisherige Plan gilt weiter: ${String(grund).slice(0, 300)}`);
}

const speicherSchluessel = () => { const id = Projekt.idVon(z.spec), a = z.spec?.freigabe?.abdruck ?? 'ohne'; return id ? `blockwerk.fortschritt.${id}.${a}` : `blockwerk.fortschritt.${a}`; };
function nachDemBauen() {
  let f = fortschritt.leer();
  try {
    let roh = speicher.lies(speicherSchluessel(), null);
    if (roh === null && z.altSchluessel) roh = speicher.lies(z.altSchluessel, null); // Altbestand ohne Kennung: Fortschritt unter dem alten Schlüssel übernehmen (der alte Eintrag bleibt)
    if (roh !== null) f = fortschritt.pruefe(roh);
  } catch { /* beschädigter Speicher: neu anfangen */ }
  let hinweis = '';
  if (z.empfangen) {
    try { f = fortschritt.zusammenfuehren(f, fortschritt.pruefe(z.empfangen)); hinweis = ' Der Fortschritt aus dem Link wurde mit deinem Stand zusammengeführt.'; } catch { hinweis = ' Der Fortschritt im Link war unbrauchbar und wurde ignoriert.'; }
    z.empfangen = null;
  }
  if (z.vorher) {
    const v = z.vorher; z.vorher = null;
    f = fortschritt.zusammenfuehren(f, v.fortschritt); // der Fortschritt der alten Fassung geht mit (Haken unveränderter Schichten gelten weiter)
    const h = Umbau.hinweise(v.daten.plan, z.daten.plan, v.fortschritt);
    if (h.noetig) {
      f = Umbau.offeneSchichten(f, z.daten.plan, h, z.name || 'Blockwerk'); // geänderte gebaute Schichten sind offen, auch gegen alte Haken desselben Abdrucks
      // schon gebaute Schichten ändern sich: bis zur Bestätigung der Umbauhinweise gilt weiter die alte Fassung
      z.umbau = { hinweise: h, neu: { spec: z.spec, daten: z.daten, fortschritt: f, planfassung: z.planfassung }, hinweis, bleibe: z.bleibe ?? null }; z.bleibe = null;
      z.spec = v.spec; z.daten = v.daten; z.fortschritt = v.fortschritt; z.planfassung = v.planfassung ?? PF.leer(); // bis zur Bestätigung gilt die alte Fassung samt ihren Änderungen
      z.bearbeitung = false;
      speicher.schreib('blockwerk.projekt', v.spec); sichereAenderungen();
      toast('Die neue Fassung ändert schon gebaute Schichten: bitte die Umbauhinweise ansehen und bestätigen.');
      return;
    }
  }
  z.fortschritt = f;
  z.bearbeitung = false;
  const n = fortschritt.naechsteSchicht(f, z.daten.plan);
  z.a = n?.abschnitt ?? 0; z.s = n?.index ?? 0;
  behaltePosition(z.bleibe); z.bleibe = null;
  speichern(); sichereAenderungen();
  toast(`Bauplan bereit: ${z.daten.plan.bloecke} Blöcke in ${z.daten.plan.abschnitte.length} Abschnitten.${hinweis}`);
}

/** Altbestand ohne Projektkennung: nicht raten, sondern fragen, ob die ankommende Spezifikation zum geöffneten Projekt gehört. */
function idFragePanel() {
  const q = z.idFrage;
  return `<section class="umbau"><h2>Gehört das zum geöffneten Projekt?</h2>
    <p>Die neue Spezifikation ${q.neuerName ? `„${esc(q.neuerName)}“ ` : ''}${q.neueOhneKennung ? 'hat noch keine Projektkennung (ältere Datei oder Chat-Ergebnis)' : 'hat eine Projektkennung, das geöffnete Projekt aber noch nicht (Altbestand)'}. Geöffnet ist „${esc(q.name ?? '')}“${q.nameGleich ? ' (gleicher Name)' : ' (anderer Name)'}.
    Ist es eine neue Fassung davon, bleiben Fortschritt und Umbauhinweise verbunden. Ist es ein eigenständiges Projekt, bekommt es eine neue Kennung und einen eigenen Fortschritt.</p>
    <div class="knoepfe"><button class="haupt" data-a="id-fortsetzen">Neue Fassung des geöffneten Projekts</button><button data-a="id-neu">Eigenständiges, neues Projekt</button><button data-a="id-abbrechen">Abbrechen</button></div></section>`;
}

/** Umbauhinweise: was an schon gebauten Schichten geändert werden muss, bevor die neue Fassung gilt (Bestätigung nötig). */
function umbauPanel() {
  const h = z.umbau.hinweise, sm = h.summe, kurz = (id) => esc(String(id).replace('minecraft:', ''));
  const zelle = (c, art) => `<li>x ${c.x}, z ${c.z}: ${art === 'entfernen' ? `${kurz(c.alt)} entfernen` : art === 'ersetzen' ? `${kurz(c.alt)} durch ${kurz(c.neu)} ersetzen${c.neuRichtung && c.neuRichtung !== c.altRichtung ? ` (Richtung ${PFEIL[c.neuRichtung]})` : ''}` : `${kurz(c.neu)} ergänzen`}</li>`;
  const liste = (cs, art) => { const zeig = cs.slice(0, 12); return zeig.map((c) => zelle(c, art)).join('') + (cs.length > zeig.length ? `<li class="klein">… und ${cs.length - zeig.length} weitere</li>` : ''); };
  return `<section class="umbau"><h2>Umbauhinweise</h2>
    <p>Die neue Fassung ändert Schichten, die du schon gebaut hast: <b>${sm.entfernen}</b> Blöcke entfernen, <b>${sm.ersetzen}</b> ersetzen, <b>${sm.ergaenzen}</b> ergänzen (${sm.schichten} Schichten). Bis zu deiner Bestätigung gilt die alte Fassung.</p>
    ${h.schichten.map((s) => `<details><summary>${esc(Umbau.hinweisText(s))}</summary><ul class="klein">${liste(s.entfernen, 'entfernen')}${liste(s.ersetzen, 'ersetzen')}${liste(s.ergaenzen, 'ergaenzen')}</ul></details>`).join('')}
    <div class="knoepfe"><button class="haupt" data-a="umbau-ja">Hinweise bestätigt – neue Fassung übernehmen</button><button data-a="umbau-nein">Bei der alten Fassung bleiben</button></div></section>`;
}
function umbauEntscheiden(ja) {
  const u = z.umbau; if (!u) return;
  if (!ja) { z.umbau = null; z.auswahl = null; toast('Die alte Fassung bleibt gültig.'); render(); return; }
  // Während das Fenster offen war, kann sich der Fortschritt der alten Fassung geändert haben (eigenes Abhaken, Live): die Hinweise werden neu berechnet,
  // und ändern sie sich, muss die aktualisierte Liste noch einmal bestätigt werden.
  const h = Umbau.hinweise(z.daten.plan, u.neu.daten.plan, z.fortschritt);
  if (JSON.stringify(h) !== JSON.stringify(u.hinweise)) {
    u.hinweise = h;
    if (h.noetig) { toast('Der Fortschritt hat sich geändert, die Umbauhinweise wurden aktualisiert: bitte noch einmal bestätigen.'); render(); return; }
  }
  z.umbau = null;
  let f = fortschritt.zusammenfuehren(u.neu.fortschritt, z.fortschritt);
  f = Umbau.offeneSchichten(f, u.neu.daten.plan, h, z.name || 'Blockwerk');
  z.spec = u.neu.spec; z.daten = u.neu.daten; z.fortschritt = f; z.planfassung = u.neu.planfassung ?? PF.leer();
  speicher.schreib('blockwerk.projekt', z.spec); sichereAenderungen();
  const n = fortschritt.naechsteSchicht(z.fortschritt, z.daten.plan);
  z.a = n?.abschnitt ?? 0; z.s = n?.index ?? 0;
  behaltePosition(u.bleibe);
  speichern();
  toast(`Neue Fassung übernommen: ${z.daten.plan.bloecke} Blöcke in ${z.daten.plan.abschnitte.length} Abschnitten.${u.hinweis ?? ''}`);
  render();
}

/** Der Raum hat eine neue Planfassung (beim Beitritt, oder weil jemand eine Änderung gemacht hat): sie gilt für alle und wird gebaut. Eigene Änderungen aus der Zeit vor dem Beitritt gehen nicht verloren, sondern bleiben als Sicherung im Browser. */
function raumAenderung(pf, beimBeitritt = false) {
  if (!z.spec) return;
  if (Bearbeiten.gleicheEintraege(pf, z.planfassung)) { z.planfassung = pf; sichereAenderungen(); return; }
  const lokal = Object.keys(z.planfassung.eintraege).length;
  if (beimBeitritt && lokal && !Object.keys(pf.eintraege).length) { // der Raum hat noch keine Änderungen: die eigenen gehen in den Raum (so beginnt der Raum mit dem Plan, den du siehst)
    if (live.sendeOperationen(Bearbeiten.operationenAus(z.planfassung))) toast(`Deine ${lokal} ${lokal === 1 ? 'Änderung wird' : 'Änderungen werden'} in den Raum übertragen.`);
    return;
  }
  if (beimBeitritt && lokal) {
    const k = pfSchluessel(z.spec); if (k) speicher.schreib(`${k}.sicherung`, z.planfassung);
    toast(`Der Raum hat andere Änderungen (${Bearbeiten.beschreibung(pf)}) als du (${Bearbeiten.beschreibung(z.planfassung)}). Im Raum gilt der Stand des Raums; deine bisherigen bleiben als Sicherung im Browser (${k}.sicherung).`);
  }
  baueMitAenderungen(pf);
}

function speichern() { speicher.schreib(speicherSchluessel(), z.fortschritt); live?.lokalGeaendert(z.fortschritt); }

// ---------- Live mit Freunden ----------
const live = Live.erzeugeLive({
  z, render: () => render(), toast: (t) => toast(t), name: () => z.name, projekt: () => z.spec, fortschritt: () => z.fortschritt,
  setzeFortschritt: (f) => { z.fortschritt = f; if (z.spec) speicher.schreib(speicherSchluessel(), f); }, startProjekt: (...a) => startProjekt(...a), setzePlanfassung: (pf, beimBeitritt) => raumAenderung(pf, beimBeitritt),
  plan: () => z.daten?.plan ?? null, merke: (k, v) => speicher.schreib(k, v), gespeicherterDienst: () => speicher.lies('blockwerk.dienst', ''),
});

// ---------- Hilfen ----------
const plan = () => z.daten.plan;
const abschnitt = () => plan().abschnitte[z.a];
const schicht = () => abschnitt().schichten[z.s];
const key = (a = abschnitt(), s = schicht()) => fortschritt.schluessel(a.id, s);
const fertig = (a, s) => fortschritt.istAbgehakt(z.fortschritt, fortschritt.schluessel(a.id, s));
const prozentText = (p) => `${Math.round(p.anteil * 100)} %`;
const matListe = (a, s) => z.daten.material.abschnitte[a].schichten[s].liste;

function toast(text) {
  const t = document.getElementById('toast');
  t.textContent = text; t.classList.add('sichtbar');
  clearTimeout(toast.zeit); toast.zeit = setTimeout(() => t.classList.remove('sichtbar'), 4500);
}

function haken(werte) {
  if (!z.name.trim()) { toast('Bitte oben deinen Spielernamen eintragen (damit Freunde sehen, wer abgehakt hat).'); document.getElementById('name')?.focus(); return; }
  z.fortschritt = fortschritt.haken(z.fortschritt, werte.keys, werte.wert, z.name.trim());
  speichern();
}
function schichtUmschalten() {
  const k = key();
  const wert = !fortschritt.istAbgehakt(z.fortschritt, k);
  haken({ keys: [k], wert });
  if (wert && z.s < abschnitt().schichten.length - 1) z.s++;
  else if (wert && z.a < plan().abschnitte.length - 1) { z.a++; z.s = fortschritt.naechsteSchicht(z.fortschritt, plan())?.abschnitt === z.a ? fortschritt.naechsteSchicht(z.fortschritt, plan()).index : 0; }
}
function schrittSchicht(d) {
  const ab = plan().abschnitte;
  let a = z.a, s = z.s + d;
  if (s < 0) { if (a === 0) return; a--; s = ab[a].schichten.length - 1; }
  else if (s >= ab[a].schichten.length) { if (a === ab.length - 1) return; a++; s = 0; }
  z.a = a; z.s = s;
}

// ---------- Zeichnen ----------
function zeichne(leinwand, a, s, kompakt) {
  const ratio = window.devicePixelRatio || 1;
  const box = leinwand.parentElement.getBoundingClientRect();
  leinwand.width = Math.max(10, Math.floor(box.width * ratio)); leinwand.height = Math.max(10, Math.floor(box.height * ratio));
  const g = leinwand.getContext('2d');
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  g.clearRect(0, 0, box.width, box.height);
  // auf den Inhalt der Schicht zoomen (mit einem Block Rand); das Maßband nennt die echten Koordinaten
  const r0 = s.bereich, b = { x0: r0.x0 - 1, x1: r0.x1 + 1, z0: r0.z0 - 1, z1: r0.z1 + 1 }, rand = kompakt ? 6 : 30;
  const spalten = b.x1 - b.x0 + 1, zeilen = b.z1 - b.z0 + 1;
  const cs = Math.max(2, Math.min(48, Math.floor(Math.min((box.width - rand - 4) / spalten, (box.height - rand - 4) / zeilen))));
  const ox = rand + Math.floor((box.width - rand - cs * spalten) / 2), oy = rand;
  leinwand._geo = { b, cs, ox, oy, a, s };
  // Schicht darunter blass
  const darunter = a.schichten[a.schichten.indexOf(s) - 1];
  if (darunter && !kompakt) {
    g.globalAlpha = 0.18;
    for (let i = 0; i < darunter.n; i++) { if (darunter.x[i] < b.x0 || darunter.x[i] > b.x1 || darunter.z[i] < b.z0 || darunter.z[i] > b.z1) continue; fuelle(g, a.legende[darunter.b[i]], ox + (darunter.x[i] - b.x0) * cs, oy + (darunter.z[i] - b.z0) * cs, cs); }
    g.globalAlpha = 1;
  }
  g.font = `bold ${Math.max(8, Math.floor(cs * 0.55))}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < s.n; i++) {
    const l = a.legende[s.b[i]], x = ox + (s.x[i] - b.x0) * cs, y = oy + (s.z[i] - b.z0) * cs;
    fuelle(g, l, x, y, cs);
    if (cs >= 9) {
      const text = s.r[i] ? PFEIL[s.r[i]] : l.symbol;
      if (obenBild(l)) { g.lineWidth = Math.max(2, cs / 8); g.strokeStyle = '#000000cc'; g.strokeText(text, x + cs / 2, y + cs / 2 + 1); g.fillStyle = '#ffffff'; }
      else g.fillStyle = luminanz(l.farbe) > 0.55 ? '#000000cc' : '#ffffffdd';
      g.fillText(text, x + cs / 2, y + cs / 2 + 1);
    }
    if (cs >= 12) { g.strokeStyle = '#00000040'; g.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1); }
  }
  // Aussparungen (Durchbruch, den ein Kind seinem Träger genommen hat): rot gestrichelt, hier bewusst leer lassen
  for (const q of s.aussparungen ?? []) {
    if (q.x < b.x0 || q.x > b.x1 || q.z < b.z0 || q.z > b.z1) continue;
    const x = ox + (q.x - b.x0) * cs, y = oy + (q.z - b.z0) * cs;
    g.save(); g.fillStyle = 'rgba(211,51,51,0.18)'; g.fillRect(x, y, cs, cs);
    g.strokeStyle = '#d33'; g.lineWidth = Math.max(1, cs / 12); g.setLineDash([Math.max(2, cs / 6), Math.max(2, cs / 6)]); g.strokeRect(x + 1.5, y + 1.5, cs - 3, cs - 3);
    if (cs >= 9) { g.setLineDash([]); g.fillStyle = '#d33'; g.fillText('×', x + cs / 2, y + cs / 2 + 1); }
    g.restore();
  }
  if (!kompakt && z.auswahl && ortVon(z.auswahl).y === s.y) { // gewählte Zelle (für „Zelle ändern“)
    const o = ortVon(z.auswahl);
    if (o.x >= b.x0 && o.x <= b.x1 && o.z >= b.z0 && o.z <= b.z1) { g.save(); g.strokeStyle = '#ffd400'; g.lineWidth = Math.max(2, cs / 8); g.strokeRect(ox + (o.x - b.x0) * cs + 1, oy + (o.z - b.z0) * cs + 1, cs - 2, cs - 2); g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(ox + (o.x - b.x0) * cs - 0.5, oy + (o.z - b.z0) * cs - 0.5, cs + 1, cs + 1); g.restore(); }
  }
  if (!kompakt) { // Maßband: absolute Koordinaten alle 5 Blöcke
    const stil = getComputedStyle(document.body).color;
    g.fillStyle = stil; g.font = '11px system-ui, sans-serif'; g.textBaseline = 'middle';
    for (let x = b.x0; x <= b.x1; x++) if (x % 5 === 0) { g.textAlign = 'center'; g.fillText(String(x), ox + (x - b.x0) * cs + cs / 2, oy - 14); }
    for (let zz = b.z0; zz <= b.z1; zz++) if (zz % 5 === 0) { g.textAlign = 'right'; g.fillText(String(zz), ox - 4, oy + (zz - b.z0) * cs + cs / 2); }
  }
}
const obenBild = Tex.obenBild;
/** Zelle füllen: Textur (scharfe Pixel) oder Ersatzfarbe. */
function fuelle(g, l, x, y, cs) {
  const bild = obenBild(l);
  if (bild) { g.imageSmoothingEnabled = false; g.drawImage(bild, x, y, cs, cs); } else { g.fillStyle = l.farbe; g.fillRect(x, y, cs, cs); }
}
function luminanz(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }

/** Klick auf eine Zelle des Schichtplans: die Engine sagt, welchem Teil sie gehört (U2), die Seite hält die Auswahl samt dem Stand der Änderungen zu diesem Zeitpunkt (U3). */
async function zelleKlick(ev) {
  const l = ev.currentTarget, geo = l._geo; if (!geo || !z.daten) return;
  const r = l.getBoundingClientRect();
  const x = Math.floor((ev.clientX - r.left - geo.ox) / geo.cs) + geo.b.x0, zz = Math.floor((ev.clientY - r.top - geo.oy) / geo.cs) + geo.b.z0;
  const zelle = { x, y: geo.s.y, z: zz }, erzeugung = z.daten.erzeugung, nr = ++z.klickNr;
  let auswahl;
  try { auswahl = Bearbeiten.auswahlAus(await anfrage({ typ: 'waehleZelle', zelle, erzeugung }), z.planfassung); } catch (f) { auswahl = { waehlbar: false, zelle, hinweis: String(f.message ?? f) }; }
  if (nr !== z.klickNr || z.daten?.erzeugung !== erzeugung) return; // inzwischen anderer Klick oder anderer Plan: diese Antwort ist überholt
  z.auswahl = auswahl; z.blockwahl = null; z.reiter = 'zelle';
  render();
}
const ortVon = (a) => (a.waehlbar ? a.welt : a.zelle);

function hinweisUnterMaus(ev) {
  const l = ev.currentTarget, geo = l._geo; if (!geo) return;
  const r = l.getBoundingClientRect();
  const cx = Math.floor((ev.clientX - r.left - geo.ox) / geo.cs) + geo.b.x0, cz = Math.floor((ev.clientY - r.top - geo.oy) / geo.cs) + geo.b.z0;
  const s = geo.s; let text = `x ${cx}, z ${cz}, Höhe ${s.y}`;
  for (let i = 0; i < s.n; i++) if (s.x[i] === cx && s.z[i] === cz) { const li = geo.a.legende[s.b[i]], teil = geo.a.teile?.[s.p?.[i]]; text = `${li.name}${teil && geo.a.teile.length > 1 ? ` (${teil.name})` : ''} · ${text}${s.r[i] ? ` · Richtung ${PFEIL[s.r[i]]} ${RICHTUNGEN[s.r[i]]}` : ''}`; break; }
  const luecke = (s.aussparungen ?? []).find((q) => q.x === cx && q.z === cz);
  if (luecke) text = `Aussparung: leer lassen (${luecke.art === 'oeffnung' ? 'Öffnung' : 'Durchbruch und Kopffreiheit'} für ${luecke.kind} in ${luecke.traeger}) · ${text}`;
  const ziel = l.closest('.mitte, .kompakt')?.querySelector('.hinweis-zeile'); if (ziel) ziel.textContent = text;
}

// ---------- Ansichten ----------
function kopf() {
  const kompakt = z.modus === 'kompakt';
  return `<header class="kopf">
    <h1>Blockwerk</h1><strong>${z.daten ? esc(plan().projekt.name) : ''}</strong>
    <span class="abstand"></span>
    <label>Spieler <input id="name" type="text" maxlength="24" placeholder="Name" value="${esc(z.name)}"></label>
    ${z.daten ? `<button data-a="modus" title="Taste M">${kompakt ? 'Vollansicht' : 'Kompaktmodus'}</button>
    <button data-a="pip" title="Kleines Fenster, das immer im Vordergrund bleibt (Chrome/Edge)">Immer im Vordergrund</button>
    <button data-a="link">Link kopieren</button><button data-a="sichern">Datei sichern</button><button data-a="kopie" title="Gleicher Inhalt, neue Projektkennung, eigener Fortschritt">Als eigene Kopie</button>` : ''}
    <button data-a="live-offen" title="Gemeinsam mit Freunden abhaken">Live</button>
    <button data-a="${z.seite === 'eingabe' ? 'eingabe-zu' : 'eingabe-offen'}">${z.seite === 'eingabe' ? (z.daten ? 'Zurück zum Bauplan' : 'Schließen') : 'Neue Vorlage'}</button>
    <button data-a="oeffnen">Datei öffnen</button><input id="datei" type="file" accept=".json,application/json" hidden>
  </header>`;
}
function startseite() {
  return `<section class="start"><h2>Bauplan öffnen</h2>
    <p>Blockwerk zeigt dir Schicht für Schicht, was du in Minecraft bauen musst – groß genug, um es vom Sofa aus neben der PS5 zu lesen.</p>
    <div class="knoepfe"><button class="haupt" data-a="eingabe-offen">Neue Vorlage (Bilder und Text)</button><button data-a="beispiel">Beispielprojekt laden (Zitadelle, klein)</button><button data-a="oeffnen">Projektdatei öffnen</button></div>
    <p class="klein">Einen Link von einem Freund öffnest du einfach im Browser; er enthält die Spezifikation und seinen Fortschritt.</p></section>`;
}
function rechnet() {
  return `<div class="rechnet"><div>${esc(z.status ?? 'Bauplan wird berechnet …')}</div><div class="balken"><i></i></div><p class="klein">Der Plan wird deterministisch aus der Spezifikation geplant und geprüft.</p></div>`;
}
function abschnittsliste() {
  return plan().abschnitte.map((a, i) => {
    const p = fortschritt.prozent(z.fortschritt, plan(), a.id);
    return `<div class="abschnitt ${i === z.a ? 'aktiv' : ''}"><div class="titel" data-a="abschnitt" data-i="${i}"><span>${i + 1}. ${esc(a.name)}${(a.technik ?? []).some((t) => t.status !== 'bestaetigt') ? ' <span title="Technik nicht bestätigt oder noch nicht geprüft (Reiter Status)">⚠</span>' : ''}</span><span class="anteil">${p.fertigeSchichten}/${p.schichten}</span></div>
      <div class="balkenzeile"><i style="width:${Math.round(p.anteil * 100)}%"></i></div>
      ${i === z.a ? `<div class="schichten">${a.schichten.map((s, j) => `<div class="schicht ${fertig(a, s) ? 'fertig' : ''} ${j === z.s ? 'aktiv' : ''}" data-a="schicht" data-i="${i}" data-j="${j}" title="${s.n} Blöcke">${s.y}</div>`).join('')}</div>` : ''}</div>`;
  }).join('');
}
function tabelle(liste, mitStack = true) {
  return `<table class="tabelle">${liste.map((m) => `<tr><td><span class="farbe ${m.ersatz ? 'ersatz' : ''}" style="${Tex.feldStil(m)}" title="${Tex.feldTitel(m)}"></span>${esc(m.name)}</td><td class="zahl">${m.anzahl}</td>${mitStack ? `<td class="klein">${esc(m.text)}</td>` : ''}</tr>`).join('')}</table>`;
}
const kurzId = (id) => String(id).replace(/^minecraft:/, '');
const zustandText = (zu) => { const k = Object.keys(zu ?? {}).sort(); return k.length ? ` [${k.map((n) => `${kurzId(n)}=${zu[n]}`).join(', ')}]` : ''; };
const STATUS_TEXT = { angewandt: 'wirkt im Plan', ueberholt: 'überholt (ein Einbauteil hat die Zelle schon ausgespart)', verwaist: 'verwaist', konflikt: 'Konflikt', ungueltig: 'ungültig' };
/** Seitenleiste „Zelle“: gewählte Zelle, ihr Block, das Teil, der Stand der Änderung und die möglichen Aktionen (Block ändern, entfernen, zurücknehmen). */
function zellePanel() {
  const a = z.auswahl, anzahl = Bearbeiten.beschreibung(z.planfassung);
  const offen = Bearbeiten.offeneAenderungen(z.daten).length;
  const fuss = `${offen ? `<p class="fehler">${offen} ${offen === 1 ? 'Änderung lässt' : 'Änderungen lassen'} sich nicht anwenden (verwaist oder im Konflikt) und ${offen === 1 ? 'wartet' : 'warten'} auf eine Entscheidung. ${offen === 1 ? 'Sie ändert' : 'Sie ändern'} den Plan nicht; das Auflösen folgt mit U6.</p><div class="knoepfe">${aenderungenNotausgang()}</div>` : ''}<p class="klein">Änderungen im Projekt: ${esc(anzahl)}. Sie werden im Browser gespeichert und gehen mit Link und Datei.</p>`;
  if (!a) return `<p class="klein">Klicke im Schichtplan auf eine Zelle, um ihren Block zu sehen und zu ändern.</p>${fuss}`;
  const o = ortVon(a);
  let h = `<h3>Zelle x ${o.x}, y ${o.y}, z ${o.z}</h3>`;
  if (!a.waehlbar) return h + `<p class="klein">${esc(a.hinweis)}</p>` + fuss;
  const von = z.planfassung.eintraege[PF.schluessel(a.teil, a.zelle)]?.von;
  h += `<p>Block: <b>${esc(a.block ? kurzId(a.block.id) + zustandText(a.block.zustand) : 'leer (Luft)')}</b></p>
    <p class="klein">Teil: ${esc(a.teilName)} (${esc(a.teil)}), Zelle im Teil: ${a.zelle.x}, ${a.zelle.y}, ${a.zelle.z}${a.besitzt ? '' : '. Hier hat das Teil keinen Block (leere Zelle in seiner Hülle).'}</p>`;
  if (a.aenderung) h += `<p class="klein">Änderung ${esc(a.aenderung.id)}: ${a.erwartet?.op === 'leere' ? 'Block entfernt' : `Block gesetzt: ${esc(kurzId(a.erwartet?.block?.id ?? ''))}${esc(zustandText(a.erwartet?.block?.zustand))}`}${von ? ` (von ${esc(von)})` : ''} · Status: <span class="plakette ${a.aenderung.status === 'angewandt' ? 'simuliert' : 'entworfen'}">${esc(STATUS_TEXT[a.aenderung.status] ?? a.aenderung.status)}</span></p>`;
  if (a.hinweis) h += `<p class="klein">${esc(a.hinweis)}</p>`;
  const grund = z.umbau ? 'Erst die Umbauhinweise oben bestätigen oder verwerfen, dann lässt sich weiter ändern.' : null;
  if (grund) return h + `<p class="fehler">${esc(grund)}</p>` + fuss;
  const m = Bearbeiten.moeglicheAktionen(a);
  h += `<div class="knoepfe"><button class="haupt" data-a="bk-aendern">${a.block ? 'Block ändern …' : 'Block setzen …'}</button>${m.includes('entfernen') ? '<button data-a="bk-entfernen">Block entfernen</button>' : ''}${m.includes('zuruecknehmen') ? '<button data-a="bk-zurueck">Änderung zurücknehmen</button>' : ''}</div>`;
  if (z.blockwahl) h += blockwahlPanel();
  return h + fuss;
}
function trefferListe(w) {
  return w.treffer.length ? w.treffer.map((t) => `<button class="treffer" data-a="bk-waehle" data-id="${esc(t.id)}">${esc(t.name)}</button>`).join('') + (w.mehr ? '<span class="klein">Es gibt mehr Treffer, bitte genauer suchen (z. B. oak_stairs).</span>' : '') : (w.suche ? '<span class="klein">Kein Block gefunden.</span>' : '<span class="klein">Tippe einen Teil des Namens, z. B. glass, oak_stairs, lantern.</span>');
}
/** Blockauswahl: Suche im Register (1463 Blöcke) und die erlaubten Zustände des gewählten Blocks. Richtungen wählst du so, wie du sie im Plan siehst (Norden oben). */
function blockwahlPanel() {
  const w = z.blockwahl, g = w.gewaehlt;
  let h = `<div class="blockwahl"><input id="bk-suche" type="text" autocomplete="off" placeholder="Block suchen, z. B. glass" value="${esc(w.suche)}"><div id="bk-treffer" class="trefferliste">${trefferListe(w)}</div>`;
  if (g) {
    h += `<h4>${esc(g.info.name)}</h4>${g.info.zustaende.length ? '' : '<p class="klein">Dieser Block hat keine Zustände.</p>'}`;
    h += g.info.zustaende.map((za, i) => `<label class="klein zustand">${esc(kurzId(za.name))}${za.pflicht ? ' (nötig)' : ''} <select id="bk-z-${i}" data-i="${i}">${za.pflicht ? '' : '<option value="-1">(Standard)</option>'}${za.werte.map((v, j) => `<option value="${j}" ${g.zustand[za.name] !== undefined && g.zustand[za.name] === v ? 'selected' : ''}>${esc(String(v))}</option>`).join('')}</select></label>`).join('');
    h += '<div class="knoepfe"><button class="haupt" data-a="bk-setzen">Übernehmen</button><button data-a="bk-abbrechen">Abbrechen</button></div>';
  } else h += '<div class="knoepfe"><button data-a="bk-abbrechen">Abbrechen</button></div>';
  return h + '</div>';
}
function rechteSpalte() {
  const a = abschnitt(), s = schicht(), r = z.reiter;
  const reiter = [['material', 'Material'], ['schicht', 'Diese Schicht'], ['zelle', 'Zelle'], ['bericht', 'Baubericht'], ['status', 'Status'], ['spec', 'Spezifikation']];
  let inhalt = '';
  if (r === 'material') {
    const m = z.daten.material;
    inhalt = `<h3>Dieser Abschnitt</h3>${tabelle(m.abschnitte[z.a].liste)}${m.abschnitte[z.a].inhalte.length ? `<h3>In Behälter legen</h3>${tabelle(m.abschnitte[z.a].inhalte)}` : ''}<h3>Gesamt</h3>${tabelle(m.gesamt)}`;
    if (a.wesen.length) inhalt += `<h3>Wesen in diesem Abschnitt</h3><p class="klein">${a.wesen.length} (${[...new Set(a.wesen.map((w) => w.id))].map(esc).join(', ')}) – selbst mitbringen.</p>`;
  } else if (r === 'schicht') {
    inhalt = `<h3>Legende</h3><table class="tabelle">${a.legende.filter((l) => s.summe[l.id]).map((l) => `<tr><td><span class="symbol">${l.symbol}</span><span class="farbe ${l.ersatz ? 'ersatz' : ''}" style="${Tex.feldStil(l)}" title="${Tex.feldTitel(l)}"></span>${esc(l.name)}</td><td class="zahl">${s.summe[l.id]}</td></tr>`).join('')}</table>
      <p class="klein">Pfeile zeigen die Blickrichtung (↑ Norden, → Osten, ↓ Süden, ← Westen); Norden ist oben.</p>
      ${s.inhalte.length ? `<h3>Behälter in dieser Schicht</h3>${s.inhalte.map((i) => `<p class="klein">${esc(a.legende.find((l) => l.id === i.id).name)} bei x ${i.x}, z ${i.z}: ${i.inhalt.map((g) => `${g.anzahl}× ${esc(g.gegenstand.replace('minecraft:', ''))}`).join(', ')}</p>`).join('')}` : ''}
      ${(s.aussparungen ?? []).length ? `<h3>Aussparungen</h3><p class="klein">${s.aussparungen.length} rot gestrichelte Zellen bleiben leer: ${[...new Set(s.aussparungen.map((q) => `${q.kind} in ${q.traeger}`))].map(esc).join(', ')}. Dort wird kein Block gesetzt (Durchbruch, Kopffreiheit).</p>` : ''}
      ${a.wesen.filter((w) => w.y === s.y).length ? `<h3>Wesen</h3>${a.wesen.filter((w) => w.y === s.y).map((w) => `<p class="klein">${esc(w.id.replace('minecraft:', ''))}${w.baby ? ' (Baby)' : ''} bei x ${w.x}, z ${w.z}</p>`).join('')}` : ''}`;
  } else if (r === 'zelle') inhalt = zellePanel();
  else if (r === 'bericht') inhalt = `<pre class="text">${esc(z.daten.bericht)}</pre>`;
  else if (r === 'status') {
    const st = z.daten.baustatus;
    inhalt = `<p class="klein">${st.anzahlRegeln} Regeln: ${st.regeln.simuliert} simuliert, ${st.regeln.entworfen} entworfen, ${st.regeln.geprueft} im Spiel geprüft. ${st.regeln.ungeprueft} enthalten Annahmen, die du noch im Spiel testen kannst (siehe docs/spieltests.md).</p>
      <table class="tabelle">${st.bausteine.map((b) => `<tr><td>${esc(b.titel)}</td><td class="zahl"><span class="plakette ${esc(b.status)}">${esc(b.status)}</span></td></tr>`).join('')}</table>
      ${plan().technik?.length ? `<h3>Technikanlagen</h3><table class="tabelle">${plan().technik.map((t) => `<tr><td>${esc(t.name)} <span class="klein">(${esc(t.abschnitt)})</span></td><td class="zahl"><span class="plakette ${t.status === 'bestaetigt' ? 'simuliert' : 'entworfen'}">${t.status === 'bestaetigt' ? 'bestätigt' : t.status === 'nicht-bestaetigt' ? 'nicht bestätigt' : 'noch nicht geprüft'}</span></td></tr>`).join('')}</table><p class="klein">Eine Anlage gilt erst als funktionsfähig, wenn Ebene 1 sie geprüft hat und sich seitdem in ihrer Umgebung (Prüfbereich) nichts verändert hat. „Nicht bestätigt“: im Prüfbereich wurde etwas geändert, die Anlage muss neu geprüft werden.</p>` : ''}
      ${z.daten.anfragen.length ? `<h3>Noch offen</h3>${z.daten.anfragen.map((q) => `<p class="klein">Schaltungsanfrage ${esc(q.id)}: für „${esc(q.art)}“ gibt es noch kein Modul.</p>`).join('')}` : ''}`;
  } else inhalt = `<pre class="text">${esc(z.daten.zusammenfassung)}</pre>`;
  return `<div class="reiter">${reiter.map(([k, t]) => `<button class="${r === k ? 'an' : ''}" data-a="reiter" data-k="${k}">${t}</button>`).join('')}</div>${inhalt}`;
}
function hoehen() {
  let lo = Infinity, hi = -Infinity;
  for (const ab of plan().abschnitte) for (const sc of ab.schichten) { lo = Math.min(lo, sc.y); hi = Math.max(hi, sc.y); }
  return { lo, hi };
}
function mitte3d() {
  const h = hoehen(), q = z.sicht, y = q.maxY ?? h.hi;
  const wahl = (wert, text) => `<option value="${wert}" ${q.abschnitte === wert ? 'selected' : ''}>${text}</option>`;
  return `<div class="regler">
      <label>Abschnitte <select id="s3-abschnitte">${wahl('alle', 'alle')}${wahl('nur', 'nur der gewählte')}${wahl('bis', 'bis einschließlich des gewählten')}</select></label>
      <label>Etagenschnitt bis Höhe <input id="s3-hoehe" type="range" min="${h.lo}" max="${h.hi}" value="${y}"> <b id="s3-hoehe-wert">${y === h.hi ? 'ganz' : y}</b></label>
      <button data-a="bisAktuelle" title="Höhe der aktuellen Schicht">bis zur aktuellen Schicht</button>
      <label><input id="s3-technik" type="checkbox" ${q.technik ? 'checked' : ''}> Technik</label>
      <label><input id="s3-verbindungen" type="checkbox" ${q.verbindungen ? 'checked' : ''}> Gänge und Schienen</label>
      <label><input id="s3-fortschritt" type="checkbox" ${q.fortschritt ? 'checked' : ''}> Baufortschritt einfärben</label>
      <label><input id="s3-hervorheben" type="checkbox" ${q.hervorheben ? 'checked' : ''}> gewählten Abschnitt hervorheben</label>
      <button data-a="einpassen">Einpassen</button></div>
    <div class="leinwand drei"></div>
    <div class="hinweis-zeile" id="s3-info">${esc(z.netzMeldung)}</div>
    <div class="klein"><strong>Vereinfachte Darstellung:</strong> jeder Block als voller Würfel (Treppen, Platten, Zäune usw. nicht in Originalform). Maus: ziehen = drehen, Umschalt-Ziehen = verschieben, Rad = zoomen, Doppelklick = einpassen.</div>`;
}
function mitteSchichtplan() {
  const a = abschnitt(), s = schicht(), p = fortschritt.prozent(z.fortschritt, plan());
  return `<div class="leiste"><h2>${esc(a.name)} – Höhe ${s.y}</h2><span class="klein">Schicht ${z.s + 1} von ${a.schichten.length} · ${s.n} Blöcke</span><span class="abstand"></span>
        <button data-a="zurueck" title="Taste ←">←</button><button data-a="vor" title="Taste →">→</button>
        <button class="${fertig(a, s) ? '' : 'gut'}" data-a="haken" title="Leertaste">${fertig(a, s) ? 'Haken entfernen' : 'Schicht abhaken'}</button>
        <button data-a="abschnittHaken" title="Alle Schichten dieses Abschnitts abhaken">Abschnitt ✓</button></div>
      <div class="klein">Gesamtfortschritt: ${prozentText(p)} (${p.fertigeSchichten}/${p.schichten} Schichten)</div>
      <div class="leinwand"><canvas></canvas></div><div class="hinweis-zeile"></div>`;
}
function vollansicht() {
  const reiter = `<div class="reiter"><button class="${z.ansicht === 'plan' ? 'an' : ''}" data-a="ansicht" data-k="plan">Schichtplan</button><button class="${z.ansicht === '3d' ? 'an' : ''}" data-a="ansicht" data-k="3d">3D-Ansicht</button>
    ${z.ansicht === '3d' ? `<span class="abstand"></span><button data-a="zurueck" title="Taste ←">←</button><button data-a="vor" title="Taste →">→</button><button class="${fertig(abschnitt(), schicht()) ? '' : 'gut'}" data-a="haken" title="Leertaste">${fertig(abschnitt(), schicht()) ? 'Haken entfernen' : 'Schicht abhaken'}</button>` : ''}</div>`;
  return `<div class="haupt-raster">
    <aside class="spalte">${abschnittsliste()}</aside>
    <main class="mitte">${reiter}${z.ansicht === '3d' ? mitte3d() : mitteSchichtplan()}</main>
    <aside class="spalte">${rechteSpalte()}</aside></div>`;
}
function kompaktansicht() {
  const a = abschnitt(), s = schicht(), p = fortschritt.prozent(z.fortschritt, plan());
  const liste = matListe(z.a, z.s).slice(0, 12);
  return `<div class="kompakt">
    <div class="kopfzeile"><span class="gross">${esc(a.name)} · Höhe ${s.y}</span><span class="mittel">Schicht ${z.s + 1}/${a.schichten.length}${fertig(a, s) ? ' · fertig ✓' : ''}</span></div>
    <div class="leinwand"><canvas></canvas></div><div class="hinweis-zeile"></div>
    <div class="bedarf">${liste.map((m) => `<div><span class="farbe ${m.ersatz ? 'ersatz' : ''}" style="${Tex.feldStil(m)}" title="${Tex.feldTitel(m)}"></span>${m.anzahl}× ${esc(m.name)}${m.anzahl >= m.stapel && m.stapel > 1 ? ` <span class="mittel">(${esc(m.text)})</span>` : ''}</div>`).join('')}</div>
    <div class="zeile-unten"><button data-a="zurueck">←</button><button class="${fertig(a, s) ? '' : 'gut'}" data-a="haken">${fertig(a, s) ? 'Haken entfernen' : 'Abhaken'}</button><button data-a="vor">→</button>
      <div class="balken" title="Gesamtfortschritt"><i style="width:${Math.round(p.anteil * 100)}%"></i></div><span class="mittel">${prozentText(p)}</span></div></div>`;
}

function render() {
  const aktiv = document.activeElement?.id === 'name';
  let html = kopf() + live.leiste(z.liveOffen, z.einladung) + (z.idFrage ? idFragePanel() : '') + (z.umbau && z.daten ? umbauPanel() : '');
  if (z.status) html += rechnet();
  else if (z.seite === 'eingabe') html += Eingabe.seite(z.e, { name: z.name, hatProjekt: !!z.spec, raumAktiv: live.istVerbunden() });
  else if (z.fehler) html += `<section class="start"><h2>Das hat nicht geklappt</h2><p class="fehler">${esc(z.fehler)}</p><div class="knoepfe"><button data-a="neu">Zurück</button>${aenderungenNotausgang()}</div></section>`;
  else if (z.rueckfragen) html += `<section class="start"><h2>Rückfragen vor dem Bauen</h2><p>Die Spezifikation hat noch offene Fragen. Das Beantworten kommt in einem nächsten Schritt; so lange gilt:</p><ul>${z.rueckfragen.map((q) => `<li>${esc(q.frage)}</li>`).join('')}</ul><div class="knoepfe"><button data-a="neu">Zurück</button>${aenderungenNotausgang()}</div></section>`;
  else if (!z.daten) html += startseite();
  else html += z.modus === 'kompakt' ? kompaktansicht() : vollansicht();
  $app.innerHTML = html;
  if (z.seite === 'eingabe') { const f = z.fokus && document.getElementById(z.fokus); if (f) { f.focus(); if (z.fokusPos != null) f.setSelectionRange(z.fokusPos, z.fokusPos); } }
  if (aktiv) { const n = document.getElementById('name'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
  if (z.daten && !z.status && z.modus !== 'kompakt' && z.ansicht === '3d') aktualisiere3d(true);
  if (z.daten && !z.status && !(z.modus !== 'kompakt' && z.ansicht === '3d')) {
    const l = $app.querySelector('canvas');
    if (l) { requestAnimationFrame(() => { zeichne(l, abschnitt(), schicht(), z.modus === 'kompakt'); }); l.addEventListener('mousemove', hinweisUnterMaus); if (z.modus !== 'kompakt') { l.addEventListener('click', zelleKlick); l.style.cursor = 'crosshair'; } }
  }
  if (z.pip && !z.pip.closed) renderPip();
}

// ---------- 3D ----------
let a3d = null;
function sichtParameter() {
  const q = z.sicht;
  return {
    maxY: q.maxY ?? undefined, abschnitte: q.abschnitte, gewaehlt: z.a, hervorheben: q.hervorheben,
    ausgeblendet: [...(q.technik ? [] : [2]), ...(q.verbindungen ? [] : [3])],
    atlas: Tex.T.atlas,
    fortschritt: q.fortschritt ? (ai, si) => (fortschritt.istAbgehakt(z.fortschritt, fortschritt.schluessel(plan().abschnitte[ai].id, plan().abschnitte[ai].schichten[si])) ? 1 : (ai === z.a && si === z.s ? 2 : 0)) : null,
  };
}
/** Hängt die 3D-Zeichnung in die Seite und baut das Netz neu, wenn sich Sicht, Auswahl oder Fortschritt geändert haben. */
function aktualisiere3d(einhaengen) {
  a3d ??= erzeugeAnsicht3d();
  if (Tex.T.atlas && a3d.verfuegbar && a3d.atlasVon !== Tex.T.atlas) { a3d.setzeAtlas(Tex.T.canvas); a3d.atlasVon = Tex.T.atlas; }
  const platz = $app.querySelector('.leinwand.drei');
  if (!platz) return;
  if (!a3d.verfuegbar) { platz.textContent = 'Dein Browser kann kein WebGL2. Bitte Chrome, Edge oder Firefox in einer aktuellen Version benutzen.'; return; }
  if (einhaengen) platz.append(a3d.canvas);
  a3d.groesse(); // erst die Größe, dann einpassen: das Seitenverhältnis muss stimmen
  const signatur = JSON.stringify([!!Tex.T.atlas, z.spec?.freigabe?.abdruck, z.a, z.s, z.sicht, z.fortschritt.uhr, Object.keys(z.fortschritt.eintraege).length]);
  const neuesProjekt = a3d.projekt !== z.daten;
  if (signatur !== z.netzSignatur || neuesProjekt) {
    z.netzSignatur = signatur;
    const netz = baueNetz(plan(), sichtParameter());
    z.netzMeldung = netz.bloecke ? `${netz.bloecke.toLocaleString('de-DE')} Blöcke, ${netz.flaechen.toLocaleString('de-DE')} sichtbare Flächen` : 'Nichts anzuzeigen (alles ausgeblendet oder abgeschnitten).';
    if (netz.flaechen > FLAECHEN_MAX) { z.netzMeldung = `Zu viele Flächen (${netz.flaechen.toLocaleString('de-DE')}). Bitte einen Abschnitt oder einen Etagenschnitt wählen.`; a3d.setzeNetz(baueNetz({ abschnitte: [] }), {}); }
    else a3d.setzeNetz(netz, { passeEin: neuesProjekt });
    a3d.projekt = z.daten;
    const info = document.getElementById('s3-info'); if (info) info.textContent = z.netzMeldung;
  }
  requestAnimationFrame(() => a3d.groesse());
}

// ---------- Kleines Fenster, das im Vordergrund bleibt (Document Picture-in-Picture) ----------
function renderPip() {
  const w = z.pip, doc = w.document;
  if (!z.daten) return;
  doc.body.innerHTML = kompaktansicht();
  const l = doc.querySelector('canvas');
  if (l) requestAnimationFrame(() => { zeichne(l, abschnitt(), schicht(), true); }), l.addEventListener('mousemove', hinweisUnterMaus);
}
async function pip() {
  if (!('documentPictureInPicture' in window)) { toast('Dein Browser kennt kein Fenster im Vordergrund. In Chrome oder Edge (ab Version 116) geht es; sonst das Fenster selbst anheften.'); return; }
  if (z.pip && !z.pip.closed) { z.pip.close(); return; }
  const w = await window.documentPictureInPicture.requestWindow({ width: 560, height: 520 });
  for (const s of document.querySelectorAll('link[rel=stylesheet]')) { const n = w.document.createElement('link'); n.rel = 'stylesheet'; n.href = s.href; w.document.head.append(n); }
  w.document.body.className = 'pip';
  w.document.addEventListener('click', klick); w.document.addEventListener('keydown', taste);
  w.addEventListener('pagehide', () => { z.pip = null; });
  z.pip = w;
  renderPip();
}

// ---------- Aktionen ----------
/** Klicks der Live-Leiste. */
function liveAktion(name) {
  if (name === 'live-offen') { z.liveOffen = true; render(); }
  else if (name === 'live-zu') { z.liveOffen = false; render(); }
  else if (name === 'live-start') { z.liveOffen = false; live.start(document.getElementById('live-dienst')?.value); }
  else if (name === 'live-verbinden') live.verbinde();
  else if (name === 'live-trennen') live.trennen();
  else if (name === 'live-link') navigator.clipboard.writeText(live.link()).then(() => toast('Raum-Link kopiert. Wer ihn öffnet, ist live dabei.'));
  else if (name === 'live-uebernehmen') live.uebernehmen();
  else if (name === 'live-spaeter') live.spaeter();
  else if (name === 'live-beitreten') { const e = z.einladung; z.einladung = null; live.beitreten(e.raum, e.dienst); }
  else if (name === 'live-einladung-weg') { z.einladung = null; render(); }
}
const kontextEingabe = () => ({
  live,
  e: z.e, render, toast, anfrage, startProjekt, name: () => z.name, projekt: () => z.spec,
  speichern: () => speicher.schreib('blockwerk.entwurf', Eingabe.zuSpeichern(z.e)),
});
async function datenLaden(pfad) { const r = await fetch(new URL(`../${pfad}`, import.meta.url)); if (!r.ok) throw new Error(`${pfad}: ${r.status}`); return r.json(); }
/** Aktionen der Zellen-Seitenleiste. Jede Änderung ist genau eine Operation (bearbeiten.js → Planfassung); die Oberfläche rechnet nichts am Plan. */
async function blockAktion(name, d) {
  const a = z.auswahl;
  if (name === 'bk-abbrechen') { z.blockwahl = null; render(); return; }
  if (name === 'bk-aendern') { z.blockwahl = { suche: '', treffer: [], gewaehlt: null }; render(); document.getElementById('bk-suche')?.focus(); return; }
  if (name === 'bk-waehle') {
    const w = z.blockwahl; if (!w) return;
    const info = (await anfrage({ typ: 'blockInfo', id: d.id })).info, zustand = {};
    for (const za of info.zustaende) if (za.pflicht) zustand[za.name] = za.vorschlag; // Richtungen sind nötig; alles andere bleibt Standard, bis du es wählst
    w.gewaehlt = { info, zustand }; render(); return;
  }
  if (!a?.waehlbar) return;
  if (z.status || z.umbau || !z.daten) { toast('Jetzt gerade nicht: Der Plan wird berechnet oder die Umbauhinweise warten.'); return; }
  const aktionName = { 'bk-setzen': 'aendern', 'bk-entfernen': 'entfernen', 'bk-zurueck': 'zuruecknehmen' }[name];
  if (!aktionName) return;
  let block;
  if (aktionName === 'aendern') { const g = z.blockwahl?.gewaehlt; if (!g) { toast('Bitte zuerst einen Block aus der Liste wählen.'); return; } block = { id: g.info.id, ...(Object.keys(g.zustand).length ? { zustand: g.zustand } : {}) }; }
  const op = (await anfrage({ typ: 'bearbeiteOperation', auswahl: a, aktion: aktionName, block })).operation; // prüft Block und Zustand und dreht Richtungen in den Rahmen des Teils
  if (live.istVerbunden()) { // im Raum entscheidet der Raum; lokal ändert sich erst etwas, wenn er die Änderung annimmt
    if (!live.sendeOperation(op)) { toast('Der Raum ist gerade nicht erreichbar. Die Änderung wurde nicht gesendet.'); return; }
    z.blockwahl = null; toast('Änderung an den Raum gesendet. Sie gilt, sobald der Raum sie annimmt.'); render(); return;
  }
  const r = Bearbeiten.anwenden(z.planfassung, op, z.name);
  if (r.konflikt) { z.auswahl = null; z.blockwahl = null; toast('Diese Zelle wurde inzwischen anders geändert. Bitte die Zelle noch einmal wählen und neu entscheiden.'); render(); return; }
  if (!r.geaendert) { toast('Die Zelle ist schon so.'); return; }
  baueMitAenderungen(r.planfassung);
}
async function aktion(name, el) {
  const d = el?.dataset ?? {};
  try {
    if (name.startsWith('live-')) liveAktion(name);
    else if (name.startsWith('e-')) await Eingabe.aktion(name, el, kontextEingabe());
    else if (name === 'eingabe-offen') { z.seite = 'eingabe'; z.status = null; render(); await Eingabe.aktion('e-neu-pruefen', null, kontextEingabe()); }
    else if (name === 'eingabe-zu') { z.seite = null; render(); }
    else if (name === 'beispiel') startProjekt(await datenLaden('data/beispiele/zitadelle-klein.json'));
    else if (name === 'id-fortsetzen' || name === 'id-neu') { const q = z.idFrage; if (q) startProjekt(q.spezifikation, q.empfangen, q.messungen, name === 'id-neu' ? 'neu' : 'fortsetzung', q.aenderungen ?? null); }
    else if (name === 'id-abbrechen') { z.idFrage = null; render(); }
    else if (name === 'kopie') { startProjekt(Projekt.eigenstaendigeKopie(z.spec, zufall())); toast('Eigenständige Kopie angelegt: neue Projektkennung, eigener Fortschritt, nie mit dem Original gemischt.'); }
    else if (name.startsWith('bk-')) await blockAktion(name, d);
    else if (name === 'aenderungen-verwerfen') {
      const k = pfSchluessel(z.spec); if (k) speicher.schreib(`${k}.sicherung`, z.planfassung); // nichts geht endgültig verloren
      z.fehler = null; z.rueckfragen = null; z.vorher = null; z.bearbeitung = false;
      z.planfassung = PF.leer(); sichereAenderungen();
      toast('Die Änderungen wurden verworfen; der Plan wird nur aus der Spezifikation neu berechnet.');
      z.status = 'Bauplan wird berechnet …'; render();
      worker.postMessage({ typ: 'baue', spezifikation: z.spec, messungen: z.messungen, aenderungen: null, lauf: z.lauf = (z.lauf ?? 0) + 1 });
    }
    else if (name === 'umbau-ja') umbauEntscheiden(true);
    else if (name === 'umbau-nein') umbauEntscheiden(false);
    else if (name === 'oeffnen') document.getElementById('datei').click();
    else if (name === 'neu') {
      z.fehler = null; z.rueckfragen = null; z.daten = null;
      if (z.vorher) { const v = z.vorher; z.vorher = null; z.bearbeitung = false; z.spec = v.spec; z.daten = v.daten; z.fortschritt = v.fortschritt; z.planfassung = v.planfassung ?? z.planfassung; speicher.schreib('blockwerk.projekt', v.spec); sichereAenderungen(); toast('Die bisherige Fassung gilt weiter.'); } // die neue Fassung ließ sich nicht bauen
      render();
    }
    else if (name === 'modus') { z.modus = z.modus === 'kompakt' ? 'voll' : 'kompakt'; speicher.schreib('blockwerk.modus', z.modus); render(); }
    else if (name === 'pip') await pip();
    else if (name === 'abschnitt') { z.a = Number(d.i); z.s = Math.min(z.s, abschnitt().schichten.length - 1); const n = abschnitt().schichten.findIndex((s) => !fertig(abschnitt(), s)); z.s = n >= 0 ? n : 0; render(); }
    else if (name === 'schicht') { z.a = Number(d.i); z.s = Number(d.j); render(); }
    else if (name === 'reiter') { z.reiter = d.k; render(); }
    else if (name === 'ansicht') { z.ansicht = d.k; speicher.schreib('blockwerk.ansicht', z.ansicht); render(); }
    else if (name === 'einpassen') { a3d?.einpassen(); }
    else if (name === 'bisAktuelle') { z.sicht.maxY = schicht().y; render(); }
    else if (name === 'zurueck') { schrittSchicht(-1); render(); }
    else if (name === 'vor') { schrittSchicht(1); render(); }
    else if (name === 'haken') { schichtUmschalten(); render(); }
    else if (name === 'abschnittHaken') {
      const a = abschnitt(), alle = a.schichten.every((s) => fertig(a, s));
      haken({ keys: a.schichten.map((s) => key(a, s)), wert: !alle }); render();
    } else if (name === 'link') {
      const { link, zuLang } = await teilen.link(location.href, { spezifikation: z.spec, fortschritt: z.fortschritt, aenderungen: z.planfassung });
      await navigator.clipboard.writeText(link);
      toast(zuLang ? 'Link kopiert – er ist ziemlich lang. Falls ein Chat ihn abschneidet, nimm „Datei sichern“.' : 'Link kopiert. Wer ihn öffnet, sieht denselben Bauplan mit deinem Fortschritt.');
    } else if (name === 'sichern') {
      const text = teilen.exportDatei({ spezifikation: z.spec, fortschritt: z.fortschritt, aenderungen: z.planfassung });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = `${(plan().projekt.name || 'blockwerk').replace(/[^\w-]+/g, '-')}.blockwerk.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  } catch (f) { toast(String(f?.message ?? f)); }
}
function klick(ev) { const el = ev.target.closest('[data-a]'); if (el) { ev.preventDefault(); aktion(el.dataset.a, el); } }
function taste(ev) {
  if (!z.daten || ev.target.matches?.('input, textarea')) return;
  if (ev.key === 'ArrowRight') { schrittSchicht(1); render(); } else if (ev.key === 'ArrowLeft') { schrittSchicht(-1); render(); }
  else if (ev.key === ' ') { ev.preventDefault(); schichtUmschalten(); render(); } else if (ev.key.toLowerCase() === 'm') aktion('modus');
  else return;
  ev.preventDefault();
}
document.addEventListener('click', klick);
document.addEventListener('keydown', taste);
document.addEventListener('input', (ev) => {
  const id = ev.target.id;
  if (id === 'name') { z.name = ev.target.value; speicher.schreib('blockwerk.name', z.name); if (z.seite === 'eingabe') render(); }
  else if (Eingabe.eingabeGeaendert(id, ev.target.value, z.e)) { speicher.schreib('blockwerk.entwurf', Eingabe.zuSpeichern(z.e)); if (id === 'e-text') { const b = document.querySelector('[data-a="e-pruefen"]'); if (b) b.disabled = !ev.target.value.trim(); } }
  else if (id === 'bk-suche') { // nur die Trefferliste neu schreiben, damit das Eingabefeld seinen Fokus behält
    const w = z.blockwahl; if (!w) return;
    w.suche = ev.target.value; const nr = (w.suchNr = (w.suchNr ?? 0) + 1);
    anfrage({ typ: 'blockSuche', text: w.suche }).then((r) => { if (z.blockwahl !== w || w.suchNr !== nr) return; w.treffer = r.treffer; w.mehr = r.mehr; const ziel = document.getElementById('bk-treffer'); if (ziel) ziel.innerHTML = trefferListe(w); }).catch((f) => toast(String(f.message ?? f)));
  }
  else if (id === 's3-hoehe') { // der Regler bleibt beim Ziehen im Bild, darum kein komplettes Neuzeichnen der Seite
    const h = hoehen(), v = Number(ev.target.value);
    z.sicht.maxY = v >= h.hi ? null : v;
    document.getElementById('s3-hoehe-wert').textContent = v >= h.hi ? 'ganz' : v;
    aktualisiere3d(false);
  }
});
document.addEventListener('change', (ev) => {
  const id = ev.target.id;
  if (id.startsWith('bk-z-')) { // Zustandswert gewählt (der Wert ist der Index in der Liste der erlaubten Werte, so bleiben Zahlen und Wahrheitswerte echt)
    const g = z.blockwahl?.gewaehlt; const za = g?.info.zustaende[Number(ev.target.dataset.i)]; if (!za) return;
    const j = Number(ev.target.value); if (j < 0) delete g.zustand[za.name]; else g.zustand[za.name] = za.werte[j];
  }
  else if (id === 's3-abschnitte') { z.sicht.abschnitte = ev.target.value; render(); }
  else if (['s3-technik', 's3-verbindungen', 's3-fortschritt', 's3-hervorheben'].includes(id)) { z.sicht[id.slice(3)] = ev.target.checked; render(); }
});
document.addEventListener('change', async (ev) => {
  if (ev.target.id === 'e-bild' && ev.target.files[0]) { const f = ev.target.files[0]; ev.target.value = ''; await Eingabe.bildGewaehlt(f, kontextEingabe()); return; }
  if (ev.target.id === 'e-im-raum') { z.e.imRaum = ev.target.checked; return; }
  if (ev.target.id === 'e-teil' || ev.target.id === 'e-art') { Eingabe.eingabeGeaendert(ev.target.id, ev.target.value, z.e); return; }
  if (ev.target.id !== 'datei' || !ev.target.files[0]) return;
  try { const d = teilen.importDatei(await ev.target.files[0].text()); startProjekt(d.spezifikation, d.fortschritt ?? null, [], null, d.aenderungen ?? null); } catch (f) { z.fehler = String(f.message ?? f); render(); }
  ev.target.value = '';
});
window.addEventListener('resize', () => { if (z.daten) render(); });

/** Nennung der Texturen in der Fußzeile (Lizenzpflicht): Pack, Stand, Quelle, Lizenz. */
function fussnote() {
  const p = Tex.T.index?.pack; if (!p) return;
  const f = document.getElementById('texturen-nennung'); if (!f) return;
  f.innerHTML = `Texturen: <a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)} (Bedrock)</a> von ${esc(p.autoren.join(', '))}, ${esc(p.version)}, <a href="${esc(p.quelle)}" target="_blank" rel="noopener">Quelle</a>, <a href="${esc(p.lizenz)}" target="_blank" rel="noopener">Lizenz</a>; nur die benötigten Texturen, unverändert.`;
}

// ---------- Start: Link, gespeichertes Projekt oder Startseite ----------
/** Steckt in der Adresse ein Projekt (#p=…), wird es geöffnet; auch wenn der Link in ein schon offenes Fenster eingefügt wird. */
async function linkPruefen() {
  try {
    const r = Live.ausLink(location.href); // Einladung zu einem Live-Raum: erst nach Bestätigung verbinden
    if (r) {
      history.replaceState(null, '', location.pathname + location.search);
      const saved = speicher.lies('blockwerk.live');
      if (saved?.raum === r.raum && saved?.dienst === r.dienst) live.beitreten(r.raum, r.dienst); else { z.einladung = r; render(); }
      return true;
    }
    const p = await teilen.ausLink(location.href);
    if (!p) return false;
    history.replaceState(null, '', location.pathname + location.search);
    startProjekt(p.spezifikation, p.fortschritt ?? null, [], null, p.aenderungen ?? null);
  } catch (f) { z.fehler = String(f.message ?? f); render(); }
  return true;
}
window.addEventListener('hashchange', linkPruefen);
(async () => {
  Tex.lade().then(() => { fussnote(); if (z.daten && !z.status) render(); });
  render();
  if (await linkPruefen()) return;
  const gespeichert = speicher.lies('blockwerk.projekt');
  if (gespeichert) startProjekt(gespeichert);
  const sitzung = speicher.lies('blockwerk.live'); // nach dem Neuladen wieder in den Raum
  if (sitzung?.raum && sitzung?.dienst && z.name.trim()) live.beitreten(sitzung.raum, sitzung.dienst);
})();

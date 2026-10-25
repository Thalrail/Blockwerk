// Blockwerk – Oberfläche (Ebene 5): zeigt den Bauplan, nimmt Haken entgegen und teilt Projekte. Rechnet nichts selbst:
// die Engine läuft im Worker (engine-worker.js), die Mengen- und Fortschrittslogik kommt aus src/ebene5.
import * as fortschritt from '../src/ebene5/fortschritt.js';
import * as teilen from '../src/ebene5/teilen.js';
import { RICHTUNGEN } from '../src/ebene5/bauplan.js';
import { baueNetz } from '../src/ebene5/netz.js';
import { erzeugeAnsicht3d } from './ansicht3d.js';

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
};

// ---------- Engine im Hintergrund ----------
const worker = new Worker(new URL('./engine-worker.js', import.meta.url), { type: 'module' });
worker.onmessage = ({ data }) => {
  if (data.typ === 'status') { z.status = data.text; render(); return; }
  z.status = null;
  if (data.typ === 'fehler') { z.fehler = data.text; z.daten = null; }
  else if (data.typ === 'rueckfragen') { z.rueckfragen = data.rueckfragen; z.daten = null; z.fehler = null; }
  else if (data.typ === 'fertig') { z.daten = data; z.fehler = null; z.rueckfragen = null; nachDemBauen(); }
  render();
};
worker.onerror = (e) => { z.status = null; z.fehler = `Die Berechnung ist abgebrochen: ${e.message ?? e}`; render(); };

function startProjekt(spezifikation, empfangenerFortschritt = null) {
  z.spec = spezifikation; z.empfangen = empfangenerFortschritt; z.daten = null; z.fehler = null; z.rueckfragen = null;
  z.status = 'Bauplan wird berechnet …';
  speicher.schreib('blockwerk.projekt', spezifikation);
  render();
  worker.postMessage({ typ: 'baue', spezifikation });
}

const speicherSchluessel = () => `blockwerk.fortschritt.${z.spec?.freigabe?.abdruck ?? 'ohne'}`;
function nachDemBauen() {
  let f = fortschritt.leer();
  try { f = fortschritt.pruefe(speicher.lies(speicherSchluessel(), f)); } catch { /* beschädigter Speicher: neu anfangen */ }
  let hinweis = '';
  if (z.empfangen) {
    try { f = fortschritt.zusammenfuehren(f, fortschritt.pruefe(z.empfangen)); hinweis = ' Der Fortschritt aus dem Link wurde mit deinem Stand zusammengeführt.'; } catch { hinweis = ' Der Fortschritt im Link war unbrauchbar und wurde ignoriert.'; }
    z.empfangen = null;
  }
  z.fortschritt = f;
  const n = fortschritt.naechsteSchicht(f, z.daten.plan);
  z.a = n?.abschnitt ?? 0; z.s = n?.index ?? 0;
  speichern();
  toast(`Bauplan bereit: ${z.daten.plan.bloecke} Blöcke in ${z.daten.plan.abschnitte.length} Abschnitten.${hinweis}`);
}

function speichern() { speicher.schreib(speicherSchluessel(), z.fortschritt); }

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
    for (let i = 0; i < darunter.n; i++) { if (darunter.x[i] < b.x0 || darunter.x[i] > b.x1 || darunter.z[i] < b.z0 || darunter.z[i] > b.z1) continue; g.fillStyle = a.legende[darunter.b[i]].farbe; g.fillRect(ox + (darunter.x[i] - b.x0) * cs, oy + (darunter.z[i] - b.z0) * cs, cs, cs); }
    g.globalAlpha = 1;
  }
  g.font = `bold ${Math.max(8, Math.floor(cs * 0.55))}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < s.n; i++) {
    const l = a.legende[s.b[i]], x = ox + (s.x[i] - b.x0) * cs, y = oy + (s.z[i] - b.z0) * cs;
    g.fillStyle = l.farbe; g.fillRect(x, y, cs, cs);
    if (cs >= 9) {
      const hell = luminanz(l.farbe) > 0.55;
      g.fillStyle = hell ? '#000000cc' : '#ffffffdd';
      g.fillText(s.r[i] ? PFEIL[s.r[i]] : l.symbol, x + cs / 2, y + cs / 2 + 1);
    }
    if (cs >= 12) { g.strokeStyle = '#00000040'; g.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1); }
  }
  if (!kompakt) { // Maßband: absolute Koordinaten alle 5 Blöcke
    const stil = getComputedStyle(document.body).color;
    g.fillStyle = stil; g.font = '11px system-ui, sans-serif'; g.textBaseline = 'middle';
    for (let x = b.x0; x <= b.x1; x++) if (x % 5 === 0) { g.textAlign = 'center'; g.fillText(String(x), ox + (x - b.x0) * cs + cs / 2, oy - 14); }
    for (let zz = b.z0; zz <= b.z1; zz++) if (zz % 5 === 0) { g.textAlign = 'right'; g.fillText(String(zz), ox - 4, oy + (zz - b.z0) * cs + cs / 2); }
  }
}
function luminanz(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }

function hinweisUnterMaus(ev) {
  const l = ev.currentTarget, geo = l._geo; if (!geo) return;
  const r = l.getBoundingClientRect();
  const cx = Math.floor((ev.clientX - r.left - geo.ox) / geo.cs) + geo.b.x0, cz = Math.floor((ev.clientY - r.top - geo.oy) / geo.cs) + geo.b.z0;
  const s = geo.s; let text = `x ${cx}, z ${cz}, Höhe ${s.y}`;
  for (let i = 0; i < s.n; i++) if (s.x[i] === cx && s.z[i] === cz) { const li = geo.a.legende[s.b[i]]; text = `${li.name} · ${text}${s.r[i] ? ` · Richtung ${PFEIL[s.r[i]]} ${RICHTUNGEN[s.r[i]]}` : ''}`; break; }
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
    <button data-a="link">Link kopieren</button><button data-a="sichern">Datei sichern</button>` : ''}
    <button data-a="oeffnen">Datei öffnen</button><input id="datei" type="file" accept=".json,application/json" hidden>
  </header>`;
}
function startseite() {
  return `<section class="start"><h2>Bauplan öffnen</h2>
    <p>Blockwerk zeigt dir Schicht für Schicht, was du in Minecraft bauen musst – groß genug, um es vom Sofa aus neben der PS5 zu lesen.</p>
    <div class="knoepfe"><button class="haupt" data-a="beispiel">Beispielprojekt laden (Zitadelle, klein)</button><button data-a="oeffnen">Projektdatei öffnen</button></div>
    <p class="klein">Einen Link von einem Freund öffnest du einfach im Browser; er enthält die Spezifikation und seinen Fortschritt.</p></section>`;
}
function rechnet() {
  return `<div class="rechnet"><div>${esc(z.status ?? 'Bauplan wird berechnet …')}</div><div class="balken"><i></i></div><p class="klein">Der Plan wird deterministisch aus der Spezifikation geplant und geprüft.</p></div>`;
}
function abschnittsliste() {
  return plan().abschnitte.map((a, i) => {
    const p = fortschritt.prozent(z.fortschritt, plan(), a.id);
    return `<div class="abschnitt ${i === z.a ? 'aktiv' : ''}"><div class="titel" data-a="abschnitt" data-i="${i}"><span>${i + 1}. ${esc(a.name)}</span><span class="anteil">${p.fertigeSchichten}/${p.schichten}</span></div>
      <div class="balkenzeile"><i style="width:${Math.round(p.anteil * 100)}%"></i></div>
      ${i === z.a ? `<div class="schichten">${a.schichten.map((s, j) => `<div class="schicht ${fertig(a, s) ? 'fertig' : ''} ${j === z.s ? 'aktiv' : ''}" data-a="schicht" data-i="${i}" data-j="${j}" title="${s.n} Blöcke">${s.y}</div>`).join('')}</div>` : ''}</div>`;
  }).join('');
}
function tabelle(liste, mitStack = true) {
  return `<table class="tabelle">${liste.map((m) => `<tr><td><span class="farbe ${m.ersatz ? 'ersatz' : ''}" style="background:${m.farbe}" title="${m.ersatz ? 'Ersatzfarbe (noch keine Zuordnung)' : ''}"></span>${esc(m.name)}</td><td class="zahl">${m.anzahl}</td>${mitStack ? `<td class="klein">${esc(m.text)}</td>` : ''}</tr>`).join('')}</table>`;
}
function rechteSpalte() {
  const a = abschnitt(), s = schicht(), r = z.reiter;
  const reiter = [['material', 'Material'], ['schicht', 'Diese Schicht'], ['bericht', 'Baubericht'], ['status', 'Status'], ['spec', 'Spezifikation']];
  let inhalt = '';
  if (r === 'material') {
    const m = z.daten.material;
    inhalt = `<h3>Dieser Abschnitt</h3>${tabelle(m.abschnitte[z.a].liste)}${m.abschnitte[z.a].inhalte.length ? `<h3>In Behälter legen</h3>${tabelle(m.abschnitte[z.a].inhalte)}` : ''}<h3>Gesamt</h3>${tabelle(m.gesamt)}`;
    if (a.wesen.length) inhalt += `<h3>Wesen in diesem Abschnitt</h3><p class="klein">${a.wesen.length} (${[...new Set(a.wesen.map((w) => w.id))].map(esc).join(', ')}) – selbst mitbringen.</p>`;
  } else if (r === 'schicht') {
    inhalt = `<h3>Legende</h3><table class="tabelle">${a.legende.filter((l) => s.summe[l.id]).map((l) => `<tr><td><span class="symbol">${l.symbol}</span><span class="farbe ${l.ersatz ? 'ersatz' : ''}" style="background:${l.farbe}"></span>${esc(l.name)}</td><td class="zahl">${s.summe[l.id]}</td></tr>`).join('')}</table>
      <p class="klein">Pfeile zeigen die Blickrichtung (↑ Norden, → Osten, ↓ Süden, ← Westen); Norden ist oben.</p>
      ${s.inhalte.length ? `<h3>Behälter in dieser Schicht</h3>${s.inhalte.map((i) => `<p class="klein">${esc(a.legende.find((l) => l.id === i.id).name)} bei x ${i.x}, z ${i.z}: ${i.inhalt.map((g) => `${g.anzahl}× ${esc(g.gegenstand.replace('minecraft:', ''))}`).join(', ')}</p>`).join('')}` : ''}
      ${a.wesen.filter((w) => w.y === s.y).length ? `<h3>Wesen</h3>${a.wesen.filter((w) => w.y === s.y).map((w) => `<p class="klein">${esc(w.id.replace('minecraft:', ''))}${w.baby ? ' (Baby)' : ''} bei x ${w.x}, z ${w.z}</p>`).join('')}` : ''}`;
  } else if (r === 'bericht') inhalt = `<pre class="text">${esc(z.daten.bericht)}</pre>`;
  else if (r === 'status') {
    const st = z.daten.baustatus;
    inhalt = `<p class="klein">${st.anzahlRegeln} Regeln: ${st.regeln.simuliert} simuliert, ${st.regeln.entworfen} entworfen, ${st.regeln.geprueft} im Spiel geprüft. ${st.regeln.ungeprueft} enthalten Annahmen, die du noch im Spiel testen kannst (siehe docs/spieltests.md).</p>
      <table class="tabelle">${st.bausteine.map((b) => `<tr><td>${esc(b.titel)}</td><td class="zahl"><span class="plakette ${esc(b.status)}">${esc(b.status)}</span></td></tr>`).join('')}</table>
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
    <div class="bedarf">${liste.map((m) => `<div><span class="farbe ${m.ersatz ? 'ersatz' : ''}" style="background:${m.farbe}"></span>${m.anzahl}× ${esc(m.name)}${m.anzahl >= m.stapel && m.stapel > 1 ? ` <span class="mittel">(${esc(m.text)})</span>` : ''}</div>`).join('')}</div>
    <div class="zeile-unten"><button data-a="zurueck">←</button><button class="${fertig(a, s) ? '' : 'gut'}" data-a="haken">${fertig(a, s) ? 'Haken entfernen' : 'Abhaken'}</button><button data-a="vor">→</button>
      <div class="balken" title="Gesamtfortschritt"><i style="width:${Math.round(p.anteil * 100)}%"></i></div><span class="mittel">${prozentText(p)}</span></div></div>`;
}

function render() {
  const aktiv = document.activeElement?.id === 'name';
  let html = kopf();
  if (z.status) html += rechnet();
  else if (z.fehler) html += `<section class="start"><h2>Das hat nicht geklappt</h2><p class="fehler">${esc(z.fehler)}</p><div class="knoepfe"><button data-a="neu">Zurück</button></div></section>`;
  else if (z.rueckfragen) html += `<section class="start"><h2>Rückfragen vor dem Bauen</h2><p>Die Spezifikation hat noch offene Fragen. Das Beantworten kommt in einem nächsten Schritt; so lange gilt:</p><ul>${z.rueckfragen.map((q) => `<li>${esc(q.frage)}</li>`).join('')}</ul><div class="knoepfe"><button data-a="neu">Zurück</button></div></section>`;
  else if (!z.daten) html += startseite();
  else html += z.modus === 'kompakt' ? kompaktansicht() : vollansicht();
  $app.innerHTML = html;
  if (aktiv) { const n = document.getElementById('name'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
  if (z.daten && !z.status && z.modus !== 'kompakt' && z.ansicht === '3d') aktualisiere3d(true);
  if (z.daten && !z.status && !(z.modus !== 'kompakt' && z.ansicht === '3d')) {
    const l = $app.querySelector('canvas');
    if (l) { requestAnimationFrame(() => { zeichne(l, abschnitt(), schicht(), z.modus === 'kompakt'); }); l.addEventListener('mousemove', hinweisUnterMaus); }
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
    fortschritt: q.fortschritt ? (ai, si) => (fortschritt.istAbgehakt(z.fortschritt, fortschritt.schluessel(plan().abschnitte[ai].id, plan().abschnitte[ai].schichten[si])) ? 1 : (ai === z.a && si === z.s ? 2 : 0)) : null,
  };
}
/** Hängt die 3D-Zeichnung in die Seite und baut das Netz neu, wenn sich Sicht, Auswahl oder Fortschritt geändert haben. */
function aktualisiere3d(einhaengen) {
  a3d ??= erzeugeAnsicht3d();
  const platz = $app.querySelector('.leinwand.drei');
  if (!platz) return;
  if (!a3d.verfuegbar) { platz.textContent = 'Dein Browser kann kein WebGL2. Bitte Chrome, Edge oder Firefox in einer aktuellen Version benutzen.'; return; }
  if (einhaengen) platz.append(a3d.canvas);
  a3d.groesse(); // erst die Größe, dann einpassen: das Seitenverhältnis muss stimmen
  const signatur = JSON.stringify([z.spec?.freigabe?.abdruck, z.a, z.s, z.sicht, z.fortschritt.uhr, Object.keys(z.fortschritt.eintraege).length]);
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
async function datenLaden(pfad) { const r = await fetch(new URL(`../${pfad}`, import.meta.url)); if (!r.ok) throw new Error(`${pfad}: ${r.status}`); return r.json(); }
async function aktion(name, el) {
  const d = el?.dataset ?? {};
  try {
    if (name === 'beispiel') startProjekt(await datenLaden('data/beispiele/zitadelle-klein.json'));
    else if (name === 'oeffnen') document.getElementById('datei').click();
    else if (name === 'neu') { z.fehler = null; z.rueckfragen = null; z.daten = null; render(); }
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
      const { link, zuLang } = await teilen.link(location.href, { spezifikation: z.spec, fortschritt: z.fortschritt });
      await navigator.clipboard.writeText(link);
      toast(zuLang ? 'Link kopiert – er ist ziemlich lang. Falls ein Chat ihn abschneidet, nimm „Datei sichern“.' : 'Link kopiert. Wer ihn öffnet, sieht denselben Bauplan mit deinem Fortschritt.');
    } else if (name === 'sichern') {
      const text = teilen.exportDatei({ spezifikation: z.spec, fortschritt: z.fortschritt });
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
  if (id === 'name') { z.name = ev.target.value; speicher.schreib('blockwerk.name', z.name); }
  else if (id === 's3-hoehe') { // der Regler bleibt beim Ziehen im Bild, darum kein komplettes Neuzeichnen der Seite
    const h = hoehen(), v = Number(ev.target.value);
    z.sicht.maxY = v >= h.hi ? null : v;
    document.getElementById('s3-hoehe-wert').textContent = v >= h.hi ? 'ganz' : v;
    aktualisiere3d(false);
  }
});
document.addEventListener('change', (ev) => {
  const id = ev.target.id;
  if (id === 's3-abschnitte') { z.sicht.abschnitte = ev.target.value; render(); }
  else if (['s3-technik', 's3-verbindungen', 's3-fortschritt', 's3-hervorheben'].includes(id)) { z.sicht[id.slice(3)] = ev.target.checked; render(); }
});
document.addEventListener('change', async (ev) => {
  if (ev.target.id !== 'datei' || !ev.target.files[0]) return;
  try { const d = teilen.importDatei(await ev.target.files[0].text()); startProjekt(d.spezifikation, d.fortschritt ?? null); } catch (f) { z.fehler = String(f.message ?? f); render(); }
  ev.target.value = '';
});
window.addEventListener('resize', () => { if (z.daten) render(); });

// ---------- Start: Link, gespeichertes Projekt oder Startseite ----------
/** Steckt in der Adresse ein Projekt (#p=…), wird es geöffnet; auch wenn der Link in ein schon offenes Fenster eingefügt wird. */
async function linkPruefen() {
  try {
    const p = await teilen.ausLink(location.href);
    if (!p) return false;
    history.replaceState(null, '', location.pathname + location.search);
    startProjekt(p.spezifikation, p.fortschritt ?? null);
  } catch (f) { z.fehler = String(f.message ?? f); render(); }
  return true;
}
window.addEventListener('hashchange', linkPruefen);
(async () => {
  render();
  if (await linkPruefen()) return;
  const gespeichert = speicher.lies('blockwerk.projekt');
  if (gespeichert) startProjekt(gespeichert);
})();

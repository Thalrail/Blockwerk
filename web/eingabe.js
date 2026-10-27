// Blockwerk – Seite „Neue Vorlage“ (Ebene 5, Teil 6c): Briefing kopieren, Chat-Antwort einfügen, Bilder messen, Rückfragen beantworten, freigeben.
// Rechnet nichts selbst: die Engine im Worker prüft und misst (src/ebene5/eingabe.js), diese Datei zeichnet und nimmt Klicks entgegen.
import { pruefeBildDatei, BILD_TYPEN } from '../src/ebene5/eingabe.js';
import { zuJson } from '../src/ebene4/spezifikation.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ART_TEXT = { grundriss: 'Grundriss (von oben)', aufriss: 'Aufriss (von der Seite)', farben: 'Farben' };

/** Anfangszustand der Seite; der Entwurf (Text, Spezifikation, Messungen) liegt im lokalen Speicher. */
export function neuerZustand(gespeichert = null) {
  return {
    text: gespeichert?.text ?? '', wunsch: gespeichert?.wunsch ?? '', spec: gespeichert?.spec ?? null, vorher: gespeichert?.vorher ?? null,
    messungen: gespeichert?.messungen ?? [], ignoriert: gespeichert?.ignoriert ?? [], pruef: null, arbeitet: null, meldung: '',
    editor: null, teil: '', art: 'grundriss',
  };
}
export const zuSpeichern = (e) => ({ text: e.text, wunsch: e.wunsch, spec: e.spec, vorher: e.vorher, messungen: e.messungen, ignoriert: e.ignoriert });

function frageHtml(f, offen) {
  const knoepfe = f.optionen.map((o) => {
    const automatisch = o.id === 'entfernen' || o.id === 'text' || Object.hasOwn(o, 'wert');
    return `<button data-a="e-antwort" data-f="${esc(f.id)}" data-o="${esc(o.id)}" class="${automatisch ? '' : 'leise'}" ${automatisch ? '' : 'title="Das kann Blockwerk nicht für dich entscheiden: ändere es im Editor oder frage im Chat nach."'}>${esc(o.text)}</button>`;
  }).join('');
  return `<div class="frage ${offen ? 'offen' : ''}"><div class="klein">${esc(f.id)} · ${esc(f.pfad || 'Spezifikation')}</div><p>${esc(f.frage)}</p><div class="optionen">${knoepfe}<button data-a="e-frage-kopieren" data-f="${esc(f.id)}">Frage in den Chat kopieren</button></div></div>`;
}

/** Die ganze Seite als HTML. */
export function seite(e, { name, hatProjekt, raumAktiv = false }) {
  const p = e.pruef, spec = e.spec;
  const teile = spec?.teile ?? [];
  const busy = e.arbeitet ? `<div class="klein arbeitet">${esc(e.arbeitet)} …</div>` : '';
  const schritt1 = `<div class="schritt"><h3>1 · Briefing für den Claude-Chat</h3>
      <p class="klein">Blockwerk schreibt dir den festen Auftrag für Claude. Gib ihn im Chat zusammen mit deinen Bildern ein.</p>
      <label class="klein">Dein Wunsch in eigenen Worten (optional)<textarea id="e-wunsch" rows="2" placeholder="z. B. Eine Zitadelle mit Zentralturm und Markthalle …">${esc(e.wunsch)}</textarea></label>
      <div class="knoepfe"><button class="haupt" data-a="e-briefing">Briefing-Prompt kopieren</button></div></div>`;
  const schritt2 = `<div class="schritt"><h3>2 · Antwort aus dem Chat einfügen</h3>
      <textarea id="e-text" rows="7" placeholder="Hier die Antwort von Claude einfügen (mit oder ohne \`\`\`json-Zaun)">${esc(e.text)}</textarea>
      <div class="knoepfe"><button class="haupt" data-a="e-pruefen" ${e.text.trim() ? '' : 'disabled'}>Prüfen</button>${hatProjekt ? '<button data-a="e-aus-projekt">Geladenes Projekt bearbeiten</button>' : ''}<button data-a="e-zitadelle" title="Der Entwurf der Zitadelle (Stufe 1: Hülle und Handel) aus den 14 Bildern; nach dem Freigeben dauert die Planung einige Minuten">Zitadelle (Stufe 1) laden</button>${spec ? '<button data-a="e-leeren">Von vorn beginnen</button>' : ''}</div></div>`;
  let rest = '';
  if (spec) {
    const bilder = `<div class="schritt"><h3>3 · Bilder messen (optional)</h3>
      <p class="klein">Blockwerk misst Form, Seitenverhältnis und Farben selbst und vergleicht sie mit der Antwort aus dem Chat. Das Bild wird nicht gespeichert, nur die Messwerte.</p>
      <div class="knoepfe"><label>Teil <select id="e-teil">${teile.map((t) => `<option value="${esc(t.id)}" ${t.id === e.teil ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
        <label>Art <select id="e-art">${Object.entries(ART_TEXT).map(([k, t]) => `<option value="${k}" ${k === e.art ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <button data-a="e-bild-waehlen">Bild wählen …</button><input id="e-bild" type="file" accept="${BILD_TYPEN.join(',')}" hidden></div>
      ${e.messungen.length ? `<table class="tabelle">${e.messungen.map((m, i) => `<tr><td>${esc(m.bild || 'Bild')} → ${esc(teile.find((t) => t.id === m.teil)?.name ?? m.teil)} (${esc(ART_TEXT[m.art])})</td><td class="klein">${esc(kurz(m))}</td><td><button data-a="e-messung-weg" data-i="${i}">entfernen</button></td></tr>`).join('')}</table>` : ''}</div>`;
    let fragen = '';
    if (p) {
      fragen = `<div class="schritt"><h3>4 · Rückfragen</h3>${p.rueckfragen.length
        ? `<p class="klein">Blockwerk rät nicht. Wähle jeweils, was gemeint ist; die Spezifikation bekommt dabei eine neue Version.</p>${p.rueckfragen.map((f) => frageHtml(f, true)).join('')}`
        : '<p class="gut-text">Keine offenen Fragen.</p>'}
        ${p.hinweise.length ? `<h4>Hinweise (kein Hindernis)</h4><ul class="klein">${p.hinweise.map((h) => `<li>${esc(h.pfad ? `${h.pfad}: ` : '')}${esc(h.text)}</li>`).join('')}</ul>` : ''}
        <div class="knoepfe"><button data-a="e-editor">Spezifikation im Editor bearbeiten</button></div>
        ${e.editor !== null ? `<textarea id="e-editor" rows="14" class="mono">${esc(e.editor)}</textarea><div class="knoepfe"><button class="haupt" data-a="e-editor-uebernehmen">Übernehmen und prüfen</button><button data-a="e-editor-zu">Abbrechen</button></div>` : ''}</div>`;
    }
    const freigabe = p ? `<div class="schritt"><h3>5 · Freigabe</h3>
      <p class="klein">Version ${esc(spec.version)}${e.vorher ? ` (vorher ${esc(e.vorher.version)})` : ''}. So hat Blockwerk die Spezifikation verstanden:</p>
      ${p.vergleich ? vergleichHtml(p.vergleich) : ''}
      <pre class="text">${esc(p.zusammenfassung || 'Die Zusammenfassung erscheint, sobald die Spezifikation das Schema erfüllt.')}</pre>
      ${raumAktiv ? `<label class="klein"><input id="e-im-raum" type="checkbox" ${e.imRaum !== false ? 'checked' : ''}> Auch im Live-Raum veröffentlichen (die Freunde bekommen die neue Version zum Übernehmen)</label>` : ''}
      <div class="knoepfe"><button class="gut" data-a="e-freigeben" ${p.freigebbar && name.trim() ? '' : 'disabled'}>Freigeben und Bauplan erstellen</button>
      <span class="klein">${!p.freigebbar ? 'Erst alle Rückfragen beantworten.' : name.trim() ? `Freigabe durch ${esc(name.trim())}.` : 'Bitte oben deinen Spielernamen eintragen.'}</span></div></div>` : '';
    rest = bilder + fragen + freigabe;
  }
  return `<section class="eingabe"><h2>Neue Vorlage</h2>${schritt1}${schritt2}${e.meldung ? `<p class="fehler">${esc(e.meldung)}</p>` : ''}${busy}${rest}</section>`;
}

function kurz(m) {
  const r = m.ergebnis;
  if (m.art === 'grundriss') return `Form ${r.form}, Breite : Tiefe ${String(r.seitenverhaeltnis).replace('.', ',')}, ${r.kreise} Kreise`;
  if (m.art === 'aufriss') return `Höhe : Breite ${String(r.verhaeltnis).replace('.', ',')}`;
  return r.slice(0, 4).map((x) => `${x.farbe} ${Math.round(x.anteil * 100)} %`).join(', ');
}
function vergleichHtml(v) {
  const z = [];
  if (v.hinzugefuegt.length) z.push(`neu: ${v.hinzugefuegt.join(', ')}`);
  if (v.entfernt.length) z.push(`weggefallen: ${v.entfernt.join(', ')}`);
  for (const g of v.geaendert) z.push(`${g.id}: ${g.felder.join(', ')} geändert`);
  if (v.projekt.length) z.push(`Projekt: ${v.projekt.join(', ')} geändert`);
  return z.length ? `<div class="klein"><strong>Änderungen gegenüber der letzten Fassung:</strong><ul>${z.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : '';
}

/** Liest ein Bild in ein Pixelbild (RGBA); Größe und Typ werden vorher geprüft. */
async function dekodiere(datei) {
  pruefeBildDatei({ typ: datei.type, groesse: datei.size });
  const bmp = await createImageBitmap(datei);
  try {
    pruefeBildDatei({ typ: datei.type, groesse: datei.size, breite: bmp.width, hoehe: bmp.height });
    const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, bmp.width, bmp.height);
    return { breite: d.width, hoehe: d.height, daten: d.data.buffer };
  } finally { bmp.close(); }
}

/**
 * Klicks und Eingaben der Seite. `k` verbindet mit app.js: { e, render, toast, anfrage(nachricht, uebertragen?) → Promise, startProjekt, name, projekt, speichern }.
 */
export async function aktion(name, el, k) {
  const e = k.e, d = el?.dataset ?? {};
  const lies = (id) => document.getElementById(id);
  const pruefe = async (extra = {}) => {
    e.arbeitet = 'Wird geprüft'; k.render();
    try {
      const r = await k.anfrage({ typ: 'pruefe', messungen: e.messungen, ignoriert: e.ignoriert, vorher: e.vorher, ...extra });
      e.spec = r.spezifikation; e.pruef = r; e.meldung = '';
      if (extra.text !== undefined) e.text = '';
    } catch (f) { e.meldung = String(f.message ?? f); }
    e.arbeitet = null; k.speichern(); k.render();
  };
  if (name === 'e-briefing') {
    e.arbeitet = 'Briefing wird erzeugt'; k.render();
    try {
      const r = await k.anfrage({ typ: 'briefing', wunsch: e.wunsch, messungen: e.messungen });
      await navigator.clipboard.writeText(r.text);
      k.toast('Briefing kopiert. Jetzt im Claude-Chat einfügen und deine Bilder dazugeben.');
      e.meldung = '';
    } catch (f) { e.meldung = String(f.message ?? f); }
    e.arbeitet = null; k.render();
  } else if (name === 'e-pruefen') {
    e.vorher = e.spec ? (e.vorher ?? e.spec) : null; e.ignoriert = [];
    await pruefe({ text: e.text, vorher: e.vorher });
    if (e.spec && !e.teil) e.teil = e.spec.teile?.[0]?.id ?? '';
    k.render();
  } else if (name === 'e-zitadelle') {
    e.arbeitet = 'Die Zitadelle wird geladen'; k.render();
    try {
      const r = await fetch(new URL('../data/beispiele/zitadelle.json', import.meta.url));
      if (!r.ok) throw new Error(`Die Zitadelle konnte nicht geladen werden (${r.status})`);
      e.spec = await r.json(); e.vorher = null; e.ignoriert = []; e.messungen = []; e.teil = e.spec.teile?.[0]?.id ?? '';
    } catch (f) { e.meldung = String(f.message ?? f); e.arbeitet = null; k.render(); return; }
    await pruefe({ spezifikation: e.spec });
  } else if (name === 'e-neu-pruefen') {
    if (e.spec && !e.pruef) { if (!e.teil) e.teil = e.spec.teile?.[0]?.id ?? ''; await pruefe({ spezifikation: e.spec }); }
  } else if (name === 'e-aus-projekt') {
    e.spec = k.projekt(); e.vorher = k.projekt(); e.ignoriert = []; e.teil = e.spec.teile?.[0]?.id ?? '';
    await pruefe({ spezifikation: e.spec });
  } else if (name === 'e-leeren') {
    Object.assign(e, neuerZustand(), { wunsch: e.wunsch }); k.speichern(); k.render();
  } else if (name === 'e-antwort') {
    const frage = e.pruef.rueckfragen.find((q) => q.id === d.f);
    e.arbeitet = 'Antwort wird angewendet'; k.render();
    try {
      const r = await k.anfrage({ typ: 'antworte', spezifikation: e.spec, messungen: e.messungen, ignoriert: e.ignoriert, frageId: d.f, option: d.o, vorher: e.vorher });
      if (r.art === 'manuell') {
        e.meldung = `„${frage?.optionen.find((o) => o.id === d.o)?.text ?? d.o}“ kann Blockwerk nicht selbst umsetzen. Ändere die Stelle „${frage?.pfad}“ im Editor oder frage im Chat nach.`;
        e.editor = zuJson(e.spec);
      } else { e.spec = r.spezifikation; e.ignoriert = r.ignoriert; e.pruef = r; e.meldung = ''; e.editor = null; }
    } catch (f) { e.meldung = String(f.message ?? f); }
    e.arbeitet = null; k.speichern(); k.render();
  } else if (name === 'e-frage-kopieren') {
    const f = e.pruef.rueckfragen.find((q) => q.id === d.f);
    await navigator.clipboard.writeText(`Zur Bauspezifikation (${f.pfad || 'allgemein'}): ${f.frage}\nOptionen: ${f.optionen.map((o) => o.text).join(' / ')}`);
    k.toast('Frage kopiert.');
  } else if (name === 'e-editor') { e.editor = zuJson(e.spec); k.render(); }
  else if (name === 'e-editor-zu') { e.editor = null; k.render(); }
  else if (name === 'e-editor-uebernehmen') {
    const text = lies('e-editor')?.value ?? e.editor;
    e.editor = null; e.vorher ??= e.spec;
    await pruefe({ text, bearbeitet: true, vorher: e.vorher });
  } else if (name === 'e-bild-waehlen') lies('e-bild').click();
  else if (name === 'e-messung-weg') { e.messungen.splice(Number(d.i), 1); await pruefe({ spezifikation: e.spec }); }
  else if (name === 'e-freigeben') {
    e.arbeitet = 'Freigabe'; k.render();
    try {
      const r = await k.anfrage({ typ: 'freigebe', spezifikation: e.spec, von: k.name().trim(), messungen: e.messungen });
      e.arbeitet = null; k.speichern();
      if (e.imRaum !== false && k.live?.istVerbunden()) k.live.veroeffentliche(r.spezifikation);
      k.startProjekt(r.spezifikation, null, e.messungen);
      return;
    } catch (f) { e.meldung = String(f.message ?? f); e.arbeitet = null; k.render(); }
  }
}

/** Eine Bilddatei wurde gewählt. */
export async function bildGewaehlt(datei, k) {
  const e = k.e;
  e.teil = lies('e-teil') ?? e.teil; e.art = lies('e-art') ?? e.art;
  e.arbeitet = 'Bild wird gemessen'; e.meldung = ''; k.render();
  try {
    const bild = await dekodiere(datei);
    const r = await k.anfrage({ typ: 'messe', breite: bild.breite, hoehe: bild.hoehe, daten: bild.daten, optionen: { teil: e.teil, art: e.art, name: datei.name } }, [bild.daten]);
    e.messungen.push(r.messung);
    const p = await k.anfrage({ typ: 'pruefe', spezifikation: e.spec, messungen: e.messungen, ignoriert: e.ignoriert, vorher: e.vorher });
    e.pruef = p;
  } catch (f) { e.meldung = String(f.message ?? f); }
  e.arbeitet = null; k.speichern(); k.render();
}
function lies(id) { return document.getElementById(id)?.value; }

/** Eingaben in Textfelder merken (ohne die Seite neu zu zeichnen, sonst springt der Cursor). */
export function eingabeGeaendert(id, wert, e) {
  if (id === 'e-text') e.text = wert; else if (id === 'e-wunsch') e.wunsch = wert;
  else if (id === 'e-teil') e.teil = wert; else if (id === 'e-art') e.art = wert;
  else return false;
  return true;
}

// Blockwerk – Live-Abhaken in der Oberfläche (Teil 6e): Verbindung zum Dienst (WebSocket), Statusleiste, Vorschlag einer neuen Planversion.
// Die Logik (Prüfen, Mischen, Planversionen) steckt in src/ebene5/live.js; diese Datei verbindet sie mit WebSocket und Seite. Der Dienst steht in dienst/ (Cloudflare) oder tools/live-lokal.js.
import * as L from '../src/ebene5/live.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const live = {
  status: 'aus', // aus | verbindet | verbunden | getrennt
  raum: null, dienst: null, klient: null, ws: null, spieler: [], vorschlag: null, abgelehnt: null, letzte: '', versuch: 0, neu: false, wartet: null, meldung: '',
};

/** Erlaubte Dienstadressen: wss:// überall, ws:// nur auf dem eigenen Rechner (zum Ausprobieren). */
export function normalisiereDienst(text) {
  let t = String(text ?? '').trim().replace(/\/+$/, '');
  if (!t) throw new Error('Bitte die Adresse des Dienstes eintragen.');
  t = t.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
  if (!/^wss?:\/\//.test(t)) t = `wss://${t}`;
  const u = new URL(t);
  if (u.protocol === 'ws:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) throw new Error('Unverschlüsselte Verbindungen (ws://) gehen nur zum eigenen Rechner. Bitte wss:// verwenden.');
  return `${u.protocol}//${u.host}`;
}
/** Neue Raum-Nummer: 128 Bit Zufall (nur hier, die Logik in src/ kennt keinen Zufall). */
export function neueRaumNummer() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const raumLink = (basis, raum, dienst) => `${basis}#raum=${encodeURIComponent(raum)}&dienst=${encodeURIComponent(dienst)}`;
/** Liest #raum=…&dienst=… aus einer Adresse; null, wenn keiner drinsteckt oder er ungültig ist. */
export function ausLink(adresse) {
  const h = new URL(adresse, 'http://x').hash.slice(1);
  if (!h.startsWith('raum=')) return null;
  const p = new URLSearchParams(h);
  const raum = p.get('raum');
  if (!raum || !/^[A-Za-z0-9_-]{16,64}$/.test(raum)) throw new Error('Der Raum-Link ist ungültig.');
  return { raum, dienst: normalisiereDienst(p.get('dienst')) };
}

/**
 * @param {{ z: object, render: Function, toast: Function, name: () => string, projekt: () => (object|null), fortschritt: () => object, setzeFortschritt: (f: object) => void, startProjekt: Function, plan: () => (object|null), merke: (k: string, v: any) => void }} k
 */
export function erzeugeLive(k) {
  const sende = (msgs) => { if (live.ws?.readyState === 1) for (const m of msgs) live.ws.send(JSON.stringify(m)); };
  const beschriftung = (key) => {
    const plan = k.plan(); if (!plan) return 'eine Schicht';
    const [aid, y] = key.split('|');
    const a = plan.abschnitte.find((x) => x.id === aid);
    return a ? `${a.name}, Höhe ${y}` : 'eine Schicht';
  };

  function verbinde() {
    clearTimeout(live.wartet);
    if (!live.raum || !live.dienst) return;
    if (!k.name().trim()) { live.status = 'aus'; live.meldung = 'Bitte oben deinen Spielernamen eintragen und dann „Verbinden“ wählen.'; k.render(); return; }
    live.status = live.versuch ? 'getrennt' : 'verbindet'; live.meldung = '';
    live.klient = L.erzeugeKlient({ name: k.name().trim(), fortschritt: k.fortschritt() });
    let ws;
    try { ws = new WebSocket(`${live.dienst}/raum/${live.raum}`); } catch (f) { live.status = 'aus'; live.meldung = String(f.message ?? f); k.render(); return; }
    live.ws = ws;
    ws.onopen = () => { live.status = 'verbunden'; live.versuch = 0; sende(live.klient.verbunden()); k.render(); };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      let r;
      try { r = live.klient.beiNachricht(m); } catch { return; } // eine kaputte Nachricht ändert nichts
      sende(r.senden);
      for (const x of r.meldungen) meldung(x);
      k.render();
    };
    ws.onclose = () => {
      if (live.ws !== ws) return; // absichtlich getrennt oder neu verbunden
      live.status = 'getrennt'; live.ws = null; k.render();
      live.versuch++; live.wartet = setTimeout(verbinde, Math.min(30000, 1000 * 2 ** Math.min(live.versuch, 5)));
    };
    ws.onerror = () => { /* onclose folgt */ };
    k.render();
  }

  function meldung(x) {
    if (x.art === 'zustand') {
      live.spieler = live.klient.zustand.spieler;
      k.setzeFortschritt(x.fortschritt);
      const lokal = k.projekt();
      if (x.spezifikation && !lokal) k.startProjekt(x.spezifikation, x.fortschritt, []);
      else if (x.spezifikation && lokal && x.spezifikation.freigabe?.abdruck !== lokal.freigabe?.abdruck) {
        if (x.spezifikation.version > (lokal.version ?? 0)) live.vorschlag = { von: 'dem Raum', spezifikation: x.spezifikation };
        else if (x.spezifikation.version < (lokal.version ?? 0) && lokal.freigabe) sende(live.klient.planVeroeffentlichen(lokal)); // wir haben die neuere Fassung: sie in den Raum stellen
      } else if (!x.spezifikation && lokal?.freigabe) sende(live.klient.planVeroeffentlichen(lokal));
    } else if (x.art === 'haken') {
      k.setzeFortschritt(x.fortschritt);
      const fertig = Object.entries(x.eintraege).filter(([, e]) => e.wert);
      if (x.von && fertig.length) live.letzte = `${x.von} hat ${fertig.length === 1 ? beschriftung(fertig[0][0]) : `${fertig.length} Schichten`} abgehakt.`;
      else if (x.von) live.letzte = `${x.von} hat ${Object.keys(x.eintraege).length === 1 ? 'einen Haken entfernt' : 'Haken entfernt'}.`;
    } else if (x.art === 'spieler') {
      live.spieler = x.spieler;
      if (x.neu) k.toast(`${x.neu} ist dabei.`); else if (x.weg) k.toast(`${x.weg} ist gegangen.`);
    } else if (x.art === 'vorschlag') { live.vorschlag = { von: x.von, spezifikation: x.spezifikation }; k.toast(`${x.von} hat Version ${x.version} vorgeschlagen.`); }
    else if (x.art === 'plan-angenommen') k.toast(`Version ${x.version} ist jetzt für alle im Raum.`);
    else if (x.art === 'abgelehnt') {
      if (x.grund === 'veraltet' && x.spezifikation) live.abgelehnt = { text: `Im Raum gilt schon Version ${x.version}. Hole sie zuerst.`, spezifikation: x.spezifikation };
      else k.toast(x.text ?? 'Der Dienst hat die Nachricht abgelehnt.');
    }
  }

  const speicherLive = () => k.merke('blockwerk.live', live.raum ? { raum: live.raum, dienst: live.dienst } : null);

  return {
    /** Neuen Raum anlegen (mit dem freigegebenen Plan und dem Fortschritt) und verbinden. */
    start(dienstText) {
      const p = k.projekt();
      if (!p?.freigabe) throw new Error('Zum Starten eines Raums braucht es einen freigegebenen Plan (Neue Vorlage → Freigeben oder Beispielprojekt laden).');
      live.dienst = normalisiereDienst(dienstText); k.merke('blockwerk.dienst', live.dienst);
      live.raum = neueRaumNummer(); live.neu = true; live.versuch = 0; speicherLive(); verbinde();
    },
    /** Einem Raum aus einem Link beitreten (erst nach Bestätigung des Dienstes). */
    beitreten(raum, dienst) { live.raum = raum; live.dienst = dienst; live.neu = false; live.versuch = 0; speicherLive(); verbinde(); },
    verbinde,
    trennen() {
      clearTimeout(live.wartet);
      const ws = live.ws; live.ws = null; ws?.close();
      Object.assign(live, { status: 'aus', raum: null, klient: null, spieler: [], vorschlag: null, abgelehnt: null, letzte: '', versuch: 0, meldung: '' });
      speicherLive(); k.render();
    },
    /** Lokal wurde abgehakt. */
    lokalGeaendert(f) { if (live.klient && live.ws?.readyState === 1) sende(live.klient.lokalGeaendert(f)); },
    istVerbunden: () => live.status === 'verbunden',
    /** Eine freigegebene Fassung in den Raum stellen. */
    veroeffentliche(spec) { if (live.klient && live.ws?.readyState === 1) sende(live.klient.planVeroeffentlichen(spec)); },
    uebernehmen() {
      const v = live.vorschlag ?? live.abgelehnt; if (!v) return;
      live.klient?.vorschlagErledigt(); live.vorschlag = null; live.abgelehnt = null;
      k.startProjekt(v.spezifikation, k.fortschritt(), []);
    },
    spaeter() { live.klient?.vorschlagErledigt(); live.vorschlag = null; live.abgelehnt = null; k.render(); },
    link: () => raumLink(location.origin + location.pathname, live.raum, live.dienst),
    /** HTML der Live-Leiste unter der Kopfzeile. */
    leiste(offen, einladung) {
      const z = [];
      if (einladung) z.push(`<div class="live einladung"><strong>Einladung zu einem Live-Raum</strong> auf <code>${esc(new URL(einladung.dienst.replace(/^ws/, 'http')).host)}</code>. Nur verbinden, wenn du dem Absender vertraust: Name, Fortschritt und Plan gehen an diesen Dienst. <button class="haupt" data-a="live-beitreten">Verbinden</button> <button data-a="live-einladung-weg">Nicht verbinden</button></div>`);
      if (live.status !== 'aus' || live.raum) {
        const farbe = live.status === 'verbunden' ? 'gut' : live.status === 'getrennt' ? 'warn' : '';
        z.push(`<div class="live status ${farbe}"><span class="punkt"></span><strong>Live</strong>
          <span>${live.status === 'verbunden' ? 'verbunden' : live.status === 'verbindet' ? 'verbindet …' : 'getrennt, versucht es erneut …'}</span>
          <span class="klein">${live.spieler.length ? `Im Raum: ${live.spieler.map(esc).join(', ')}` : ''}</span><span class="klein">${esc(live.letzte)}</span>
          <span class="abstand"></span><button data-a="live-link">Link kopieren</button><button data-a="live-trennen">Trennen</button></div>`);
      } else if (offen) {
        z.push(`<div class="live panel"><strong>Live mit Freunden abhaken</strong>
          <p class="klein">Ein Raum hält den Plan und alle Haken; jeder mit dem Link sieht Änderungen sofort. Den Dienst richtest du einmal ein (<code>dienst/README.md</code>), zum Ausprobieren: <code>node tools/live-lokal.js</code> und <code>ws://localhost:8787</code>.</p>
          <label class="klein">Adresse des Dienstes <input id="live-dienst" type="text" placeholder="wss://blockwerk-live.…workers.dev" value="${esc(live.dienst ?? k.gespeicherterDienst())}" style="width:24em"></label>
          <button class="haupt" data-a="live-start">Raum starten</button> <button data-a="live-zu">Schließen</button>
          ${live.meldung ? `<p class="fehler">${esc(live.meldung)}</p>` : ''}</div>`);
      } else if (live.meldung) z.push(`<div class="live panel"><p class="fehler">${esc(live.meldung)}</p><button data-a="live-verbinden">Verbinden</button> <button data-a="live-trennen">Verwerfen</button></div>`);
      if (live.vorschlag) z.push(`<div class="live vorschlag"><strong>${esc(live.vorschlag.von)}</strong> hat Version ${esc(live.vorschlag.spezifikation.version)} des Plans vorgeschlagen. <button class="haupt" data-a="live-uebernehmen">Übernehmen</button> <button data-a="live-spaeter">Später</button></div>`);
      if (live.abgelehnt) z.push(`<div class="live vorschlag">${esc(live.abgelehnt.text)} <button class="haupt" data-a="live-uebernehmen">Aktuelle Version holen</button> <button data-a="live-spaeter">Später</button></div>`);
      return z.join('');
    },
  };
}

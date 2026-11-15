// Blockwerk – 3D-Zeichnung mit WebGL2 (ohne Pakete): ein Netz aus src/ebene5/netz.js, Texturatlas (Faithful 32x) mal Tönung pro Ecke, Tiefenpuffer, Orbit-Kamera mit der Maus.
// Maus: Ziehen = drehen, Umschalt-Ziehen oder rechte Taste = verschieben, Rad = zoomen, Doppelklick = einpassen.
import * as K from '../src/ebene5/kamera.js'; // Zeile 3 bleibt: test/tools/karte.test.js prüft sie
import * as F from '../src/ebene5/freiflug.js';
// Freiflug (setzeModus('freiflug')): Klick fängt die Maus (Pointer Lock), Maus = umsehen, W/A/S/D = bewegen, Leertaste = hoch, Umschalt = runter,
// Rad = Tempo, O = zurück zu Orbit, Esc gibt die Maus frei. Ohne Pointer Lock: Ziehen zum Umsehen, die Tasten gehen trotzdem.

// Physische Tasten (event.code, unabhängig vom Tastaturlayout) → Bewegung
const TASTEN = { KeyW: 'vor', KeyS: 'zurueck', KeyA: 'links', KeyD: 'rechts', Space: 'hoch', ShiftLeft: 'runter', ShiftRight: 'runter' };
const leereTasten = () => ({ vor: false, zurueck: false, links: false, rechts: false, hoch: false, runter: false });
const HINWEIS_FREI = 'Klick ins Bild, um die Maus zu fangen';
const HINWEIS_GEFANGEN = 'Maus gefangen: Esc gibt sie frei.';
const HINWEIS_FEHLER = 'Die Maus ließ sich nicht fangen: im Bild ziehen zum Umsehen, die Tasten gehen trotzdem.';

const VERTEX = `#version 300 es
in vec3 p; in vec3 c; in vec2 t; uniform mat4 m; out vec3 f; out vec2 uv;
void main() { gl_Position = m * vec4(p, 1.0); f = c; uv = t; }`;
const FRAGMENT = `#version 300 es
precision mediump float; in vec3 f; in vec2 uv; uniform sampler2D atlas; out vec4 farbe;
void main() { vec4 t = texture(atlas, uv); if (t.a < 0.5) discard; farbe = vec4(t.rgb * f, 1.0); }`;

function programm(gl) {
  const s = (typ, text) => { const x = gl.createShader(typ); gl.shaderSource(x, text); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const p = gl.createProgram();
  gl.attachShader(p, s(gl.VERTEX_SHADER, VERTEX)); gl.attachShader(p, s(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

/**
 * @param {{beiModus?: (modus: string) => void, beiHinweis?: (text: string) => void}} [rueck] Rückmeldungen an die Oberfläche (Modus per Taste O gewechselt; Hinweistext zur Maus)
 * @returns {{canvas: HTMLCanvasElement, verfuegbar: boolean, setzeNetz: Function, einpassen: Function, groesse: Function, zeichne: Function, setzeModus: Function, ruhe: Function}}
 */
export function erzeugeAnsicht3d(rueck = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'ansicht3d';
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) return { canvas, verfuegbar: false, setzeNetz() {}, setzeAtlas() {}, einpassen() {}, groesse() {}, zeichne() {}, setzeModus() {}, ruhe() {} };
  const prog = programm(gl);
  const aP = gl.getAttribLocation(prog, 'p'), aC = gl.getAttribLocation(prog, 'c'), aT = gl.getAttribLocation(prog, 't'), uM = gl.getUniformLocation(prog, 'm');
  const vao = gl.createVertexArray();
  const bufPos = gl.createBuffer(), bufCol = gl.createBuffer(), bufUv = gl.createBuffer(), bufIdx = gl.createBuffer();
  const textur = gl.createTexture();
  const weiss = new Uint8Array([255, 255, 255, 255]); // bis ein Atlas da ist: eine weiße Fläche (Farbe kommt dann nur aus der Tönung)
  gl.bindTexture(gl.TEXTURE_2D, textur); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, weiss);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufPos); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufCol); gl.enableVertexAttribArray(aC); gl.vertexAttribPointer(aC, 3, gl.UNSIGNED_BYTE, true, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufUv); gl.enableVertexAttribArray(aT); gl.vertexAttribPointer(aT, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx);
  gl.bindVertexArray(null);

  // modus 'orbit' | 'freiflug'; im Freiflug gilt z.flug, z.kamera behält den Abstand für den Rückweg; tempo null = Standard aus der Bauwerksgröße
  const z = { kamera: K.neueKamera(), anzahl: 0, huelle: null, geplant: false, modus: 'orbit', flug: null, tempo: null, tasten: leereTasten(), schleife: 0, letzte: 0 };
  const aspekt = () => canvas.width / Math.max(1, canvas.height);

  function zeichne() {
    z.geplant = false;
    const hell = window.matchMedia?.('(prefers-color-scheme: light)').matches;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(...(hell ? [0.95, 0.96, 0.97, 1] : [0.11, 0.125, 0.15, 1]));
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!z.anzahl) return;
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); // die Dreiecke zeigen von außen gegen den Uhrzeigersinn
    gl.useProgram(prog);
    gl.uniformMatrix4fv(uM, false, (z.modus === 'freiflug' ? F.matrizen(z.flug, aspekt(), z.huelle) : K.matrizen(z.kamera, aspekt())).mvp);
    gl.bindTexture(gl.TEXTURE_2D, textur);
    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, z.anzahl, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
  const plane = () => { if (!z.geplant) { z.geplant = true; requestAnimationFrame(zeichne); } };

  function groesse() {
    const r = canvas.parentElement?.getBoundingClientRect();
    if (!r || !r.width) return;
    const d = window.devicePixelRatio || 1;
    const w = Math.max(10, Math.floor(r.width * d)), h = Math.max(10, Math.floor(r.height * d));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    plane();
  }
  new ResizeObserver(() => groesse()).observe(document.body);

  function einpassen() {
    if (z.huelle) { z.kamera = K.einpassen(z.kamera, z.huelle, aspekt()); if (z.modus === 'freiflug') z.flug = F.ausKamera(z.kamera); }
    plane();
  }
  function setzeNetz(netz, { passeEin = false } = {}) {
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufPos); gl.bufferData(gl.ARRAY_BUFFER, netz.positionen, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufCol); gl.bufferData(gl.ARRAY_BUFFER, netz.farben, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufUv); gl.bufferData(gl.ARRAY_BUFFER, netz.uvs, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, netz.indizes, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    z.anzahl = netz.indizes.length; z.huelle = netz.huelle;
    if (passeEin) einpassen(); else plane();
  }

  /** Texturatlas (Canvas) als WebGL-Textur; scharfe Pixel. */
  function setzeAtlas(bild) {
    gl.bindTexture(gl.TEXTURE_2D, textur); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bild);
    plane();
  }

  // Freiflug: Tasten, Bewegungsschleife, Zeiger fangen
  const tempo = () => z.tempo ?? F.standardTempo(z.huelle);
  const gedrueckt = () => Object.values(z.tasten).some(Boolean);
  const gefangen = () => document.pointerLockElement === canvas;
  const hinweis = (text) => rueck.beiHinweis?.(text);
  function stoppeSchleife() { if (z.schleife) cancelAnimationFrame(z.schleife); z.schleife = 0; }
  function loescheTasten() { z.tasten = leereTasten(); stoppeSchleife(); }
  function tick() {
    z.schleife = 0;
    if (z.modus !== 'freiflug' || !gedrueckt()) return;
    const jetzt = performance.now();
    z.flug = F.schritt(z.flug, z.tasten, (jetzt - z.letzte) / 1000, tempo()); // schritt klemmt dt (auch ein negativer Wert)
    z.letzte = jetzt;
    zeichne();
    z.schleife = requestAnimationFrame(tick);
  }
  function startSchleife() { if (!z.schleife && gedrueckt()) { z.letzte = performance.now(); z.schleife = requestAnimationFrame(tick); } }
  const imEingabefeld = (ev) => { const t = ev.target; return !!(t?.isContentEditable || t?.closest?.('input, textarea, select, button')); };
  function beiTasteUnten(ev) {
    if (z.modus !== 'freiflug' || imEingabefeld(ev)) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return; // Browser-Kürzel (Strg+S, Alt+A …) nicht abfangen
    if (ev.code === 'KeyO') { if (!ev.repeat) { setzeModus('orbit'); rueck.beiModus?.('orbit'); } ev.preventDefault(); return; }
    const art = TASTEN[ev.code];
    if (!art) return;
    ev.preventDefault();
    if (ev.repeat) return; // die Autowiederholung ändert nichts: die Taste gilt bis zum Loslassen
    z.tasten[art] = true;
    startSchleife();
  }
  function beiTasteOben(ev) {
    const art = TASTEN[ev.code];
    if (!art) return;
    const aktiv = z.tasten[art];
    z.tasten[art] = false;
    if (ev.code === 'Space' && aktiv) ev.preventDefault(); // nur wenn die Flugsteuerung den keydown angenommen hatte (sonst bleibt die Schaltfläche bedienbar)
    if (art === 'runter' && ev.shiftKey) z.tasten.runter = true; // die andere Umschalttaste ist noch gedrückt
  }
  function beiZeigerwechsel() {
    if (gefangen()) { hinweis(HINWEIS_GEFANGEN); return; }
    loescheTasten(); // Esc: die Maus ist frei, der Modus bleibt
    if (z.modus === 'freiflug') hinweis(HINWEIS_FREI);
  }
  const beiZeigerfehler = () => { if (z.modus === 'freiflug') hinweis(HINWEIS_FEHLER); };
  const globale = [
    [window, 'keydown', beiTasteUnten], [window, 'keyup', beiTasteOben], [window, 'blur', loescheTasten],
    [document, 'visibilitychange', () => { if (document.hidden) loescheTasten(); }],
    [document, 'pointerlockchange', beiZeigerwechsel], [document, 'pointerlockerror', beiZeigerfehler],
  ];
  let gebunden = false;
  function binde() { if (!gebunden) { gebunden = true; for (const [o, n, f] of globale) o.addEventListener(n, f); } }
  function loese() { if (gebunden) { gebunden = false; for (const [o, n, f] of globale) o.removeEventListener(n, f); } }
  const gibMausFrei = () => { if (gefangen()) document.exitPointerLock(); };

  /** 'orbit' | 'freiflug': der Blick bleibt beim Wechsel erhalten. Gleicher Modus erneut: nur die Listener sicherstellen (idempotent). */
  function setzeModus(modus) {
    if (modus !== 'orbit' && modus !== 'freiflug') return;
    if (modus === z.modus) { if (modus === 'freiflug') { binde(); hinweis(gefangen() ? HINWEIS_GEFANGEN : HINWEIS_FREI); } return; }
    loescheTasten(); gibMausFrei();
    if (modus === 'freiflug') {
      z.flug = F.ausKamera(z.kamera); z.modus = modus;
      document.activeElement?.blur?.(); // Leertaste soll nicht die zuletzt angeklickte Schaltfläche auslösen
      binde(); hinweis(HINWEIS_FREI);
    } else {
      z.kamera = F.zuOrbit(z.flug, z.kamera.abstand); z.flug = null; z.modus = modus;
      loese(); hinweis('');
    }
    canvas.style.cursor = modus === 'freiflug' ? 'crosshair' : 'grab';
    plane();
  }
  /** Beim Verlassen der 3D-Ansicht (anderer Reiter, Kompaktmodus): Tasten leeren, Schleife stoppen, Maus freigeben, Listener entfernen; der Modus bleibt. */
  function ruhe() { loescheTasten(); gibMausFrei(); loese(); if (z.modus === 'freiflug') hinweis(HINWEIS_FREI); } // ohne Listener käme der Zeigerwechsel nicht mehr an

  // Maus
  let zieh = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    zieh = { x: e.clientX, y: e.clientY, schieben: z.modus === 'orbit' && (e.shiftKey || e.button === 2) };
    canvas.style.cursor = 'grabbing';
    if (z.modus === 'freiflug' && !gefangen()) {
      document.activeElement?.blur?.();
      if (!canvas.requestPointerLock) hinweis(HINWEIS_FEHLER);
      else { try { const p = canvas.requestPointerLock(); p?.catch?.(() => hinweis(HINWEIS_FEHLER)); } catch { hinweis(HINWEIS_FEHLER); } }
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (z.modus === 'freiflug') {
      let dx, dy;
      if (gefangen()) { dx = e.movementX; dy = e.movementY; }
      else if (zieh) { dx = e.clientX - zieh.x; dy = e.clientY - zieh.y; zieh.x = e.clientX; zieh.y = e.clientY; } // Ersatz ohne Pointer Lock
      else return;
      z.flug = F.drehen(z.flug, -dx * 0.0025, -dy * 0.0025);
      plane();
      return;
    }
    if (!zieh) return;
    const dx = e.clientX - zieh.x, dy = e.clientY - zieh.y, h = canvas.getBoundingClientRect().height || 1;
    zieh.x = e.clientX; zieh.y = e.clientY;
    z.kamera = zieh.schieben ? K.verschieben(z.kamera, dx / h, dy / h) : K.drehen(z.kamera, -dx * 0.008, dy * 0.008);
    plane();
  });
  const los = () => { zieh = null; canvas.style.cursor = z.modus === 'freiflug' ? 'crosshair' : 'grab'; };
  canvas.addEventListener('pointerup', los); canvas.addEventListener('pointercancel', los);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (z.modus === 'freiflug') { z.tempo = F.tempoAnpassen(tempo(), Math.exp(-e.deltaY * 0.0015)); hinweis(`Tempo: ${Math.round(z.tempo)} Blöcke je Sekunde`); return; }
    z.kamera = K.zoomen(z.kamera, Math.exp(e.deltaY * 0.0015)); plane();
  }, { passive: false });
  canvas.addEventListener('dblclick', () => { if (z.modus === 'orbit') einpassen(); });
  canvas.style.cursor = 'grab';

  return { canvas, verfuegbar: true, setzeNetz, setzeAtlas, einpassen, groesse, zeichne: plane, setzeModus, ruhe };
}

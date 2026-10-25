// Blockwerk – 3D-Zeichnung mit WebGL2 (ohne Pakete): ein Netz aus src/ebene5/netz.js, Texturatlas (Faithful 32x) mal Tönung pro Ecke, Tiefenpuffer, Orbit-Kamera mit der Maus.
// Maus: Ziehen = drehen, Umschalt-Ziehen oder rechte Taste = verschieben, Rad = zoomen, Doppelklick = einpassen.
import * as K from '../src/ebene5/kamera.js';

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

/** @returns {{canvas: HTMLCanvasElement, verfuegbar: boolean, setzeNetz: Function, einpassen: Function, groesse: Function, zeichne: Function}} */
export function erzeugeAnsicht3d() {
  const canvas = document.createElement('canvas');
  canvas.className = 'ansicht3d';
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) return { canvas, verfuegbar: false, setzeNetz() {}, setzeAtlas() {}, einpassen() {}, groesse() {}, zeichne() {} };
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

  const z = { kamera: K.neueKamera(), anzahl: 0, huelle: null, geplant: false };
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
    gl.uniformMatrix4fv(uM, false, K.matrizen(z.kamera, aspekt()).mvp);
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
    if (z.huelle) z.kamera = K.einpassen(z.kamera, z.huelle, aspekt());
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

  // Maus
  let zieh = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); zieh = { x: e.clientX, y: e.clientY, schieben: e.shiftKey || e.button === 2 }; canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', (e) => {
    if (!zieh) return;
    const dx = e.clientX - zieh.x, dy = e.clientY - zieh.y, h = canvas.getBoundingClientRect().height || 1;
    zieh.x = e.clientX; zieh.y = e.clientY;
    z.kamera = zieh.schieben ? K.verschieben(z.kamera, dx / h, dy / h) : K.drehen(z.kamera, -dx * 0.008, dy * 0.008);
    plane();
  });
  const los = () => { zieh = null; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', los); canvas.addEventListener('pointercancel', los);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); z.kamera = K.zoomen(z.kamera, Math.exp(e.deltaY * 0.0015)); plane(); }, { passive: false });
  canvas.addEventListener('dblclick', einpassen);
  canvas.style.cursor = 'grab';

  return { canvas, verfuegbar: true, setzeNetz, setzeAtlas, einpassen, groesse, zeichne: plane };
}

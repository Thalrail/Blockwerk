// Repo-Karte: schnelle Orientierung ohne ganze Dateien zu lesen. Keine Abhängigkeiten, schreibt nichts.
//   node tools/karte.js datei <pfad>      Importe, Exporte und Funktionen mit Zeilennummern
//   node tools/karte.js suche <wort> [n]  Fundstellen (Datei:Zeile), höchstens n (Standard 30)
//   node tools/karte.js abhaengig <pfad>  welche Dateien importieren diese Datei
//   node tools/karte.js abhaengig <pfad> funktionen  zusätzlich Aufrufer je Funktion (Datei:Funktion:Zeile; (unklar), wenn nicht sicher zuzuordnen)
//   node tools/karte.js uebersicht        Dateien und Größe je Ordner
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IGNORIERT = new Set(['node_modules', '.git', '.claude', '.wrangler', 'texturen', 'bilder']);
const ENDUNGEN = new Set(['.js', '.mjs', '.json', '.md']);

export function dateien(ordner = wurzel) {
  const aus = [];
  for (const e of fs.readdirSync(ordner, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (IGNORIERT.has(e.name)) continue;
    const voll = path.join(ordner, e.name);
    if (e.isDirectory()) aus.push(...dateien(voll));
    else if (ENDUNGEN.has(path.extname(e.name))) aus.push(path.relative(wurzel, voll).split(path.sep).join('/'));
  }
  return aus;
}

const lies = (rel) => fs.readFileSync(path.join(wurzel, rel), 'utf8');

export function datei(rel) {
  const zeilen = lies(rel).split('\n');
  const aus = [`${rel}: ${zeilen.length} Zeilen`];
  zeilen.forEach((z, i) => {
    const n = i + 1;
    if (/^\s*import\s/.test(z) || /^\s*(?:const|let)\s.*=\s*(?:await\s+)?import\(/.test(z)) aus.push(`  ${n}: ${z.trim().slice(0, 110)}`);
    else if (/^export\s|^(?:async\s+)?function\s|^class\s|^(?:const|let)\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/.test(z) || /^(?:test|describe)\(/.test(z)) aus.push(`  ${n}: ${z.trim().slice(0, 110)}`);
    else if (/^#{1,3}\s/.test(z) && rel.endsWith('.md')) aus.push(`  ${n}: ${z.trim().slice(0, 110)}`);
  });
  return aus.join('\n');
}

export function suche(wort, grenze = 30) {
  const aus = [];
  let mehr = 0;
  for (const rel of dateien()) {
    lies(rel).split('\n').forEach((z, i) => {
      if (!z.includes(wort)) return;
      if (aus.length < grenze) aus.push(`${rel}:${i + 1}: ${z.trim().slice(0, 100)}`);
      else mehr++;
    });
  }
  if (mehr) aus.push(`… und ${mehr} weitere (Wort enger fassen)`);
  return aus.join('\n') || 'keine Treffer';
}

// Importierte Namen aus `import { a, b as c } from …` (nur benannte Importe; Namensimporte und Standardimporte bleiben außen vor).
function importierteNamen(text, d, ziel) {
  const namen = new Set();
  const importZeilen = new Set();
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
    const spec = path.posix.normalize(path.posix.join(path.posix.dirname(d), m[2])).replace(/\.js$/, '');
    if (spec !== ziel && spec !== `${ziel}/index`) continue;
    for (const teil of m[1].split(',')) {
      const nm = teil.trim().split(/\s+as\s+/).pop();
      if (/^\w+$/.test(nm)) namen.add(nm);
    }
    const von = text.slice(0, m.index).split('\n').length;
    for (let k = von; k < von + m[0].split('\n').length; k++) importZeilen.add(k);
  }
  return { namen, importZeilen };
}

// Umschließende Funktion einer Zeile. Nur sicher, wenn die Deklaration am Zeilenanfang steht und
// zwischen ihr und der Zeile kein eingerückter Callback liegt; sonst null (= „(unklar)“).
const DEKLARATION = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/;
const einzug = (z) => z.match(/^\s*/)[0].length;
// Jede eingerückte äußere Zeile, die mit `{` (oder `{` plus Zeilenende-Kommentar) endet und nicht mit einem Kontrollwort
// beginnt, gilt als möglicher Callback/Methode (auch Generatoren, Objektliterale: gewollt konservativ → „(unklar)“).
// Die Zeile wird nicht von `//` abgeschnitten (`//` in Strings/Regex); ein Zufallstreffer macht den Fund höchstens „(unklar)“.
// Grenze: Zeilen in mehrzeiligen Template-Strings, die mit `//`, `*` oder `/*` beginnen, gelten als Kommentar (ohne lexikalische Analyse nicht lösbar).
// Ein offener `/*` nach dem `{` zählt konservativ mit.
const BLOCKENDE = /\{\s*(?:\/\/.*|\/\*.*)?\s*$/;
const KONTROLLWORT = /^(?:if|for|while|switch|catch|else|try|finally|do|with)\b/;
// Kommentarzeile nur, wenn kein Code folgt: `//…`; `/*` ohne Code hinter einem `*/`; `*`-Fortsetzung, die nicht auf `{` endet.
const KOMMENTARZEILE = (z) => {
  const t = z.trim();
  if (t.startsWith('//')) return true;
  if (t.startsWith('/*')) { const e = t.indexOf('*/'); return e < 0 || t.slice(e + 2).trim() === ''; }
  return /^\*(?:\s|\/|$)/.test(t) && !BLOCKENDE.test(t);
};
export function sicherFunktion(zeilen, h) {
  let ind = einzug(zeilen[h]);
  let callback = false;
  for (let k = h - 1; k >= 0; k--) {
    const t = zeilen[k].trim();
    if (!t || KOMMENTARZEILE(t)) continue;
    const li = einzug(zeilen[k]);
    if (li >= ind) continue;
    if (li === 0) {
      const m = zeilen[k].match(DEKLARATION);
      return m && !callback ? (m[1] ?? m[2]) : null;
    }
    if (BLOCKENDE.test(zeilen[k]) && !KONTROLLWORT.test(zeilen[k].replace(/^\s*\}?\s*/, ''))) callback = true;
    ind = li;
  }
  return null;
}

// Abkürzung: Namensfunde per Wortgrenze, kein Scope. Überschattete Parameter, Strings und Objektfelder
// können Treffer erzeugen; kein Parser. Ausbauen erst, wenn daraus echte Fehlurteile entstehen.
// Mit `funktionen` nennt jeder Fund die umschließende Top-Level-Funktion oder „(unklar)“ bei Callbacks.
export function abhaengig(rel, funktionen = false) {
  const ziel = rel.replace(/\.js$/, '');
  const aus = [];
  const treffer = [];
  for (const d of dateien().filter((f) => /\.(m?js)$/.test(f) && f !== rel)) {
    for (const [i, z] of lies(d).split('\n').entries()) {
      const m = z.match(/(?:from\s+|import\()\s*['"](\.[^'"]+)['"]/);
      if (!m) continue;
      const aufgeloest = path.posix.normalize(path.posix.join(path.posix.dirname(d), m[1])).replace(/\.js$/, '');
      if (aufgeloest === ziel || aufgeloest === `${ziel}/index`) { aus.push(`${d}:${i + 1}`); treffer.push({ d, zeile: i + 1 }); break; }
    }
  }
  const basis = aus.join('\n') || 'wird nicht importiert';
  if (!funktionen) return basis;
  const fund = [];
  for (const { d, zeile } of treffer) {
    const text = lies(d);
    const zeilen = text.split('\n');
    const { namen, importZeilen } = importierteNamen(text, d, ziel);
    // Ohne benannten Import (Namespace, Standard, dynamisch) ist die Nutzung nicht erkennbar: sichtbar markieren statt schweigen.
    if (namen.size === 0) fund.push(`${d}:(unklar):${zeile}`);
    zeilen.forEach((z, i) => {
      const n = i + 1;
      if (importZeilen.has(n) || KOMMENTARZEILE(z)) return;
      if (![...namen].some((nm) => new RegExp(`\\b${nm}\\b`).test(z))) return;
      fund.push(`${d}:${sicherFunktion(zeilen, i) ?? '(unklar)'}:${n}`);
    });
  }
  return [basis, 'Aufrufer auf Funktionsebene:', ...(fund.length ? fund : ['keine Treffer'])].join('\n');
}

export function uebersicht() {
  const je = new Map();
  for (const rel of dateien()) {
    const ordner = rel.includes('/') ? rel.split('/').slice(0, rel.startsWith('src/') || rel.startsWith('test/') ? 2 : 1).join('/') : '.';
    const e = je.get(ordner) ?? { n: 0, zeilen: 0 };
    e.n++; e.zeilen += lies(rel).split('\n').length;
    je.set(ordner, e);
  }
  return [...je].sort().map(([o, e]) => `${o}: ${e.n} Dateien, ${e.zeilen} Zeilen`).join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [befehl, arg, n] = process.argv.slice(2);
  const tabelle = { datei: () => datei(arg), suche: () => suche(arg, Number(n) || 30), abhaengig: () => abhaengig(arg, n === 'funktionen'), uebersicht };
  if (!tabelle[befehl] || (befehl !== 'uebersicht' && !arg)) { console.error('Aufruf: node tools/karte.js datei|suche|abhaengig <arg> [funktionen] | uebersicht'); process.exit(2); }
  console.log(tabelle[befehl]());
}

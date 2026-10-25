// Kleiner statischer Server zum lokalen Ansehen der Seite (keine Pakete). Aufruf: node tools/serve.js [Port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.argv[2] ?? 8080);
const typen = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' };

createServer(async (anfrage, antwort) => {
  try {
    let pfad = decodeURIComponent(new URL(anfrage.url, 'http://x').pathname);
    if (pfad.endsWith('/')) pfad += 'index.html';
    const datei = normalize(join(wurzel, pfad));
    if (!datei.startsWith(wurzel)) { antwort.writeHead(403).end('verboten'); return; }
    if (!(await stat(datei)).isFile()) throw new Error('keine Datei');
    antwort.writeHead(200, { 'content-type': typen[extname(datei)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    antwort.end(await readFile(datei));
  } catch {
    antwort.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('nicht gefunden');
  }
}).listen(port, () => console.log(`Blockwerk läuft auf http://localhost:${port}/`));

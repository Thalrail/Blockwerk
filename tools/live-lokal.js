// Probedienst für Live-Abhaken: derselbe Raumcode wie der Cloudflare-Dienst (src/ebene5/live.js), aber als kleiner WebSocket-Server auf dem eigenen Rechner.
// Zum Ausprobieren ohne Cloudflare (zwei Browserfenster, auch mit Freunden im selben Netz) und als Test des Protokolls über echte Sockets. Zustand nur im Arbeitsspeicher.
// Aufruf:  node tools/live-lokal.js [Port]      (Standard 8787)   Umgebungsvariable ERLAUBTE_URSPRUENGE (Standard „*“)
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { neuerRaum, liesNachricht, verarbeite, austritt, zustellungen, LiveFehler, GRENZEN } from '../src/ebene5/live.js';
import { ursprungErlaubt } from '../dienst/raum.js';
import { handshakeSchluessel, kodiere, FrameLeser, OP } from './ws-mini.js';

const RAUM_ID = /^[A-Za-z0-9_-]{16,64}$/;

/** Startet den Probedienst. Gibt Server, Port und die Räume (zum Prüfen in Tests) zurück. */
export function starteProbedienst({ port = 8787, ursprung = process.env.ERLAUBTE_URSPRUENGE ?? '*' } = {}) {
  const raeume = new Map(); // raumId → {raum, sockets: Map(id → socket)}
  let zaehler = 0;
  const server = createServer((anfrage, antwort) => { antwort.writeHead(anfrage.url === '/' ? 200 : 404); antwort.end(anfrage.url === '/' ? 'Blockwerk-Probedienst' : 'Nicht gefunden'); });

  server.on('upgrade', (anfrage, socket) => {
    const m = /^\/raum\/([^/?]+)/.exec(anfrage.url ?? '');
    const abweisen = (code, text) => { socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
    if (!m || !RAUM_ID.test(m[1])) return abweisen(404, 'Not Found');
    if (!ursprungErlaubt(anfrage.headers.origin, ursprung)) return abweisen(403, 'Forbidden');
    const schluessel = anfrage.headers['sec-websocket-key'];
    if (anfrage.headers.upgrade?.toLowerCase() !== 'websocket' || !schluessel) return abweisen(400, 'Bad Request');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${handshakeSchluessel(schluessel)}\r\n\r\n`);

    const id = `v${++zaehler}`;
    if (!raeume.has(m[1])) raeume.set(m[1], { raum: neuerRaum(), sockets: new Map() });
    const r = raeume.get(m[1]);
    r.sockets.set(id, socket);
    const leser = new FrameLeser(GRENZEN.nachricht);
    const schicke = (s, text) => { if (!s.destroyed) s.write(kodiere(OP.TEXT, text)); };
    const zustellen = (res) => { r.raum = res.raum; for (const z of zustellungen(res.raum, res.senden, id)) { const s = r.sockets.get(z.an); if (s) schicke(s, JSON.stringify(z.nachricht)); } };
    const schliessen = (code) => { if (!socket.destroyed) { const b = Buffer.alloc(2); b.writeUInt16BE(code); socket.end(kodiere(OP.SCHLIESSEN, b)); } };

    socket.on('data', (chunk) => {
      let frames;
      try { frames = leser.fuettere(chunk); } catch { schliessen(1009); return; }
      for (const f of frames) {
        if (f.opcode === OP.PING) socket.write(kodiere(OP.PONG, f.nutzlast));
        else if (f.opcode === OP.SCHLIESSEN) { schliessen(1000); }
        else if (f.opcode === OP.TEXT) {
          try { zustellen(verarbeite(r.raum, liesNachricht(f.nutzlast.toString('utf8')), id)); }
          catch (fehler) { if (!(fehler instanceof LiveFehler)) throw fehler; schicke(socket, JSON.stringify({ typ: 'abgelehnt', grund: fehler.grund, text: fehler.message, version: r.raum.spezifikation?.version ?? 0 })); }
        }
      }
    });
    const weg = () => { if (!r.sockets.delete(id)) return; zustellen(austritt(r.raum, id)); if (!r.sockets.size && !r.raum.spezifikation) raeume.delete(m[1]); };
    socket.on('close', weg);
    socket.on('error', weg);
  });

  return new Promise((ok) => server.listen(port, () => ok({ server, port: server.address().port, raeume })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? process.env.PORT ?? 8787);
  const { port: p } = await starteProbedienst({ port });
  console.log(`Blockwerk-Probedienst läuft: ws://localhost:${p}/raum/<Nummer>  (nur im Arbeitsspeicher; Beenden mit Strg+C)`);
}

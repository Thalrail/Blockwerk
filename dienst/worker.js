// Blockwerk-Dienst für Cloudflare Workers: ein Raum je Raum-Nummer als Durable Object mit WebSocket (Hibernation).
// Diese Datei ist nur die Verdrahtung mit Cloudflare (sie kann nur dort laufen); die Logik steht in raum.js und src/ebene5/live.js und ist in Node getestet.
// Einrichten: dienst/README.md. Hier stehen keine Schlüssel; die Anmeldung bei Cloudflare gehört Jonah.
import { DurableObject } from 'cloudflare:workers';
import { RaumHuelle, ursprungErlaubt } from './raum.js';

const RAUM_ID = /^[A-Za-z0-9_-]{16,64}$/;
const umgebung = {
  jetzt: () => Date.now(),
  neuesPaar: () => Object.values(new WebSocketPair()),
  antwort: (status, ws, text) => (ws ? new Response(null, { status, webSocket: ws }) : new Response(text ?? null, { status })),
};

export class Raum extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.h = new RaumHuelle(ctx, env, umgebung); }
  fetch(anfrage) { return this.h.fetch(anfrage); }
  webSocketMessage(ws, nachricht) { return this.h.webSocketMessage(ws, nachricht); }
  webSocketClose(ws) { return this.h.webSocketClose(ws); }
  webSocketError(ws) { return this.h.webSocketError(ws); }
  alarm() { return this.h.alarm(); }
}

export default {
  async fetch(anfrage, env) {
    const url = new URL(anfrage.url);
    if (url.pathname === '/') return new Response('Blockwerk-Dienst', { status: 200 });
    const m = /^\/raum\/([^/]+)$/.exec(url.pathname);
    if (!m || !RAUM_ID.test(m[1])) return new Response('Nicht gefunden', { status: 404 });
    if (!ursprungErlaubt(anfrage.headers.get('Origin'), env.ERLAUBTE_URSPRUENGE)) return new Response('Ursprung nicht erlaubt', { status: 403 });
    return env.RAUM.get(env.RAUM.idFromName(m[1])).fetch(anfrage);
  },
};

// Blockwerk-Dienst – Hülle um einen Raum (Cloudflare Durable Object). Nur Verdrahtung: Verbindung annehmen, Nachrichten an src/ebene5/live.js geben, Antworten zustellen, speichern, aufräumen.
// Alles Fachliche (Prüfen, Mischen, Planversionen) steht in live.js und ist dort getestet. Diese Datei kennt keine Cloudflare-Importe, damit sie in Node mit Attrappen getestet werden kann;
// worker.js reicht die echten Objekte (ctx, WebSocketPair, Response) durch.
import { neuerRaum, liesNachricht, verarbeite, austritt, zustellungen, LiveFehler, GRENZEN } from '../src/ebene5/live.js';

export const TAG_MS = 24 * 60 * 60 * 1000;
export const RATE = Object.freeze({ nachrichten: 40, fensterMs: 10_000 }); // je Verbindung

/** Ist der Ursprung der Anfrage erlaubt? `erlaubt` ist eine kommagetrennte Liste; „*“ erlaubt alle (nur zum Ausprobieren). Ohne Liste wird alles abgewiesen. */
export function ursprungErlaubt(ursprung, erlaubt) {
  const liste = String(erlaubt ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return liste.includes('*') || (typeof ursprung === 'string' && liste.includes(ursprung));
}

export class RaumHuelle {
  /**
   * @param {{storage: object, getWebSockets: () => object[], acceptWebSocket: (ws: object) => void, blockConcurrencyWhile: (f: () => Promise<void>) => Promise<void>}} ctx
   * @param {{ERLAUBTE_URSPRUENGE?: string}} env
   * @param {{jetzt: () => number, neuesPaar: () => [object, object], antwort: (status: number, ws?: object, text?: string) => object}} umgebung
   */
  constructor(ctx, env, umgebung) {
    this.ctx = ctx; this.env = env; this.u = umgebung; this.raum = neuerRaum(); this.takt = new Map();
    ctx.blockConcurrencyWhile(async () => {
      const gespeichert = await ctx.storage.get('raum');
      if (gespeichert) this.raum = { ...gespeichert, spieler: {} };
      for (const ws of ctx.getWebSockets()) { const a = ws.deserializeAttachment?.(); if (a?.id && a.name) this.raum.spieler[a.id] = { name: a.name }; } // nach dem Ruhezustand: wer ist noch da
    });
  }

  /** Eine Verbindung wird angenommen (WebSocket-Upgrade); alles andere ist ein Fehler. */
  fetch(anfrage) {
    if (!ursprungErlaubt(anfrage.headers.get('Origin'), this.env.ERLAUBTE_URSPRUENGE)) return this.u.antwort(403, undefined, 'Ursprung nicht erlaubt');
    if (anfrage.headers.get('Upgrade') !== 'websocket') return this.u.antwort(426, undefined, 'Nur WebSocket');
    const [client, server] = this.u.neuesPaar();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: this.neueId(), name: null });
    return this.u.antwort(101, client);
  }
  neueId() { this.zaehler = (this.zaehler ?? 0) + 1; return `v${this.u.jetzt().toString(36)}-${this.zaehler}`; }

  async webSocketMessage(ws, text) {
    const a = ws.deserializeAttachment() ?? { id: this.neueId(), name: null };
    const jetzt = this.u.jetzt(), alt = (this.takt.get(a.id) ?? []).filter((t) => jetzt - t < RATE.fensterMs);
    alt.push(jetzt); this.takt.set(a.id, alt);
    if (alt.length > RATE.nachrichten) { ws.close(1008, 'zu viele Nachrichten'); return; }
    let r;
    try {
      const m = liesNachricht(typeof text === 'string' ? text : new TextDecoder().decode(text));
      r = verarbeite(this.raum, m, a.id);
      if (m.typ === 'hallo' && r.raum !== this.raum && r.raum.spieler[a.id]) ws.serializeAttachment({ id: a.id, name: r.raum.spieler[a.id].name });
    } catch (f) {
      if (!(f instanceof LiveFehler)) throw f;
      ws.send(JSON.stringify({ typ: 'abgelehnt', grund: f.grund, text: f.message, version: this.raum.spezifikation?.version ?? 0 }));
      return;
    }
    const geaendert = r.raum.spezifikation !== this.raum.spezifikation || r.raum.fortschritt !== this.raum.fortschritt; // nur das Gespeicherte zählt (Anmelden ändert nur die Spielerliste)
    this.raum = r.raum;
    this.zustellen(r, a.id);
    if (geaendert) await this.speichern();
  }

  async webSocketClose(ws) {
    const a = ws.deserializeAttachment?.();
    if (!a?.id) return;
    this.takt.delete(a.id);
    const r = austritt(this.raum, a.id);
    this.raum = r.raum;
    this.zustellen(r, a.id);
  }
  webSocketError(ws) { return this.webSocketClose(ws); }

  zustellen(r, absender) {
    const sockets = new Map(this.ctx.getWebSockets().map((ws) => [ws.deserializeAttachment?.()?.id, ws]));
    for (const z of zustellungen(r.raum, r.senden, absender)) { try { sockets.get(z.an)?.send(JSON.stringify(z.nachricht)); } catch { /* Verbindung schon weg: der Close-Aufruf räumt auf */ } }
  }

  async speichern() {
    const { spieler, ...inhalt } = this.raum; void spieler; // Verbindungen werden nicht gespeichert
    await this.ctx.storage.put('raum', inhalt);
    await this.ctx.storage.setAlarm(this.u.jetzt() + GRENZEN.verfallTage * TAG_MS);
  }

  /** Aufräumen: ein Raum ohne Nutzung verfällt nach 30 Tagen; solange jemand verbunden ist, bleibt er. */
  async alarm() {
    if (this.ctx.getWebSockets().length) { await this.ctx.storage.setAlarm(this.u.jetzt() + GRENZEN.verfallTage * TAG_MS); return; }
    await this.ctx.storage.deleteAll();
    this.raum = neuerRaum();
  }
}

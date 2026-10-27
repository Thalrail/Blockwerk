// Winziger WebSocket-Baustein (RFC 6455) für den Probedienst tools/live-lokal.js und dessen Tests: Handshake, Frames lesen und schreiben.
// Nur Textnachrichten, Ping/Pong und Schließen; zerstückelte Nachrichten werden nicht unterstützt (die Seite sendet kleine Einzelnachrichten).
import { createHash, randomBytes } from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export const OP = { TEXT: 1, BINAER: 2, SCHLIESSEN: 8, PING: 9, PONG: 10 };

/** Antwort-Schlüssel für den Handshake. */
export const handshakeSchluessel = (schluessel) => createHash('sha1').update(schluessel + GUID).digest('base64');

/** Ein Frame (Server → Client: unmaskiert, Client → Server: mit `maskiert`). */
export function kodiere(opcode, nutzlast, maskiert = false) {
  const daten = Buffer.isBuffer(nutzlast) ? nutzlast : Buffer.from(nutzlast);
  const n = daten.length, kopf = [0x80 | opcode];
  const m = maskiert ? 0x80 : 0;
  if (n < 126) kopf.push(m | n);
  else if (n < 65536) kopf.push(m | 126, n >> 8, n & 255);
  else { const l = Buffer.alloc(8); l.writeBigUInt64BE(BigInt(n)); kopf.push(m | 127, ...l); }
  if (!maskiert) return Buffer.concat([Buffer.from(kopf), daten]);
  const maske = randomBytes(4), aus = Buffer.from(daten);
  for (let i = 0; i < n; i++) aus[i] ^= maske[i % 4];
  return Buffer.concat([Buffer.from(kopf), maske, aus]);
}

/** Liest Frames aus ankommenden Daten. `maxNutzlast` schützt vor riesigen Frames (Fehler „zu groß“). */
export class FrameLeser {
  constructor(maxNutzlast) { this.max = maxNutzlast; this.puffer = Buffer.alloc(0); }
  /** @returns {{opcode: number, nutzlast: Buffer}[]} */
  fuettere(chunk) {
    this.puffer = Buffer.concat([this.puffer, chunk]);
    const frames = [];
    for (;;) {
      const b = this.puffer;
      if (b.length < 2) break;
      const fin = (b[0] & 0x80) !== 0, opcode = b[0] & 15, maskiert = (b[1] & 0x80) !== 0;
      let laenge = b[1] & 127, pos = 2;
      if (laenge === 126) { if (b.length < 4) break; laenge = b.readUInt16BE(2); pos = 4; }
      else if (laenge === 127) { if (b.length < 10) break; const g = b.readBigUInt64BE(2); if (g > BigInt(this.max)) throw new Error('zu groß'); laenge = Number(g); pos = 10; }
      if (laenge > this.max) throw new Error('zu groß');
      if (!fin) throw new Error('zerstückelte Nachrichten werden nicht unterstützt');
      const gesamt = pos + (maskiert ? 4 : 0) + laenge;
      if (b.length < gesamt) break;
      let nutzlast = b.subarray(pos + (maskiert ? 4 : 0), gesamt);
      if (maskiert) { const maske = b.subarray(pos, pos + 4); nutzlast = Buffer.from(nutzlast); for (let i = 0; i < nutzlast.length; i++) nutzlast[i] ^= maske[i % 4]; }
      frames.push({ opcode, nutzlast });
      this.puffer = b.subarray(gesamt);
    }
    return frames;
  }
}

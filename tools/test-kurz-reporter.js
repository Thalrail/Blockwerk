// Kurzer Testbericht: nur Fehlschläge (je höchstens 12 Zeilen) und die Summe. Spart Kontext bei Claude-Läufen.
import { Transform } from 'node:stream';

const fehler = [];
const zaehler = { pass: 0, fail: 0, skipped: 0, todo: 0 };

export default new Transform({
  writableObjectMode: true,
  transform(ereignis, _kodierung, weiter) {
    const { type, data } = ereignis;
    if (type === 'test:pass' && data.details?.type !== 'suite') zaehler[data.skip ? 'skipped' : data.todo ? 'todo' : 'pass']++;
    if (type === 'test:fail' && data.details?.type !== 'suite') {
      zaehler.fail++;
      const meldung = String(data.details?.error?.cause?.stack ?? data.details?.error?.message ?? '').split('\n').slice(0, 12).join('\n');
      fehler.push(`FEHLER ${data.file ? data.file.replace(/^.*[\/]test[\/]/, 'test/') : ''}: ${data.name}\n${meldung}`);
    }
    weiter();
  },
  flush(weiter) {
    this.push(`${fehler.join('\n\n')}${fehler.length ? '\n\n' : ''}Tests: ${zaehler.pass} grün, ${zaehler.fail} fehlgeschlagen, ${zaehler.skipped} übersprungen\n`);
    weiter();
  },
});

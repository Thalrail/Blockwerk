// Ebene 4 – Briefing: der feste Prompt für den Claude-Chat. Jonah gibt ihn mit den Bildern ein und kopiert das JSON zurück.
// Der Prompt wird vollständig aus dem Vokabular erzeugt (Daten, Ebene 2, Ebene 3), damit er nie vom Prüfer abweicht. Deterministisch.
import { zuJson } from './spezifikation.js';

const zahlText = (p) => (p.ganzzahl ? `ganze Zahl ${p.min}–${p.max}` : `Zahl ${p.min}–${p.max}`);

/**
 * @param {{vokabular: ReturnType<typeof import('./vokabular.js').erzeugeVokabular>}} quellen
 */
export function erzeugeBriefing({ vokabular: V }) {
  /** Ein kleines, gültiges Beispiel (der Test lässt es durch den Prüfer laufen). */
  function beispiel() {
    return {
      schema: V.schema,
      version: 1,
      projekt: { name: 'Beispielburg', bauplatz: { breite: 128, hoehe: 96, tiefe: 128 }, massstab: 1 },
      teile: [
        {
          id: 'nordturm', name: 'Nordturm', art: 'turm', wichtigkeit: 'muss',
          form: { baustein: 'form.zylinder', groesse: { breite: 9, tiefe: 9, hoehe: 24 }, proportionen: { hoehe_zu_breite: 2.67 } },
          lage: { bezug: 'projekt', relation: 'ecke-nordost' },
          stil: { stimmung: V.stimmungen[0], farben: ['weiß', 'gold'], bemerkung: 'oben heller als unten' },
          verbindungen: [{ mit: 'haupthalle', art: 'gang' }],
        },
        {
          id: 'haupthalle', name: 'Haupthalle', art: 'halle', wichtigkeit: 'muss',
          form: { baustein: 'form.kuppel', groesse: { breite: 25, tiefe: 25 } },
          lage: { bezug: 'projekt', relation: 'mitte' },
          funktionen: [{ art: 'handelsnischen', menge: 24 }, { art: 'lager', sorten: ['minecraft:cobblestone', 'minecraft:dirt', 'minecraft:sand'] }],
        },
      ],
      offeneFragen: ['Soll die Halle ein Dach aus Glas haben? Auf dem Bild ist es nicht zu erkennen.'],
    };
  }

  const zeilen = {
    bausteine: () => V.bausteine.map((b) => `- ${b.id} (${b.titel}): ${b.parameter.filter((p) => !p.liste).map((p) => `${p.name} = ${zahlText(p)}${p.groessenart === 'menschenmass' ? ' (Menschenmaß, bleibt fest)' : ''}`).join('; ')}`),
    relationen: () => Object.entries(V.relationen).map(([k, t]) => `- ${k}: ${t.replace('{bezug}', 'dem Bezug')}`),
    funktionen: () => [
      ...Object.entries(V.funktionen).map(([art, r]) => (art === 'handelsnischen'
        ? `- handelsnischen: menge = ganze Zahl ${r.menge.min}–${r.menge.max} (Dorfbewohner-Handelszellen); optional beruf = Nummer ${r.beruf.min}–${r.beruf.max}`
        : `- lager: sorten = Liste von Gegenstands-IDs wie "minecraft:cobblestone" (${r.sorten.min}–${r.sorten.max}); nenne immer die Sorten, nicht nur die Zahl`)),
      ...V.funktionenOhneModul.map((a) => `- ${a}: nur die Art nennen (dafür gibt es noch kein fertiges Modul)`),
    ],
  };

  const pr = (x) => `${Math.round(x * 100)} %`;
  const komma = (x) => String(x).replace('.', ',');
  /** Eine Zeile je Messung (Bildmessung ohne KI); der Teil ist nur eine Beschriftung. */
  function messzeile(m) {
    const was = `${m.bild ?? 'Bild'}${m.teil ? `, Teil „${m.teil}“` : ''}`;
    const e = m.ergebnis;
    if (m.art === 'grundriss') return `- ${was} (Grundriss): Form ${e.form}; Breite zu Tiefe ${komma(e.seitenverhaeltnis)}; ${e.kreise} Kreise; ${e.linien.length} gerade Linien`;
    if (m.art === 'aufriss') return `- ${was} (Aufriss): Höhe zu Breite ${komma(e.verhaeltnis)}`;
    return `- ${was} (Farben): ${e.map((x) => `${x.farbe} ${pr(x.anteil)}`).join(', ')}`;
  }

  /**
   * @param {{projekt?: string, bauplatz?: {breite: number, hoehe: number, tiefe: number}, bilder?: string[], text?: string, messungen?: object[]}} [eingabe]
   * @returns {string}
   */
  function prompt({ projekt = '', bauplatz = null, bilder = [], text = '', messungen = [] } = {}) {
    const z = [];
    z.push('Du bist der „Leser“ von Blockwerk, einem Bauplaner für Minecraft Bedrock Edition. Deine einzige Aufgabe: Aus den beigefügten Bildern und dem Text am Ende eine Bauspezifikation als JSON zu erzeugen. Alles Weitere (Lage in Blöcken, Schaltungen, Material) rechnet Blockwerk selbst.');
    z.push('');
    z.push('REGELN');
    z.push('1. Beschreibe nur, WAS gebaut wird, nie WIE: keine Koordinaten, keine Blöcke oder Block-IDs (einzige Ausnahme: Gegenstandssorten im Lager), keine Schaltungen, kein Redstone.');
    z.push('2. Benutze ausschließlich die erlaubten Begriffe unten. Ist etwas nicht dabei, nimm das nächstliegende Teil und schreibe die Frage in „offeneFragen“.');
    z.push('3. Alle Maße sind ganze Zahlen in Blöcken (1 Block = 1 Meter), sofern oben nichts anderes steht. Schätze Größen aus den Bildern; Türen, Gänge und Stufen behalten ihr festes Menschenmaß.');
    z.push('4. Die Lage eines Teils ist nur eine Beziehung („bezug“ = „projekt“ oder die Id eines anderen Teils, „relation“ = eine der erlaubten Lagebeziehungen, optional „abstand“ in Blöcken). Jedes Teil muss über seine Bezüge zuletzt auf „projekt“ zurückführen.');
    z.push('5. Funktionen sind Bedarf („192 Handelsnischen“, „Lager für 48 Gegenstandssorten“), nie Schaltungen.');
    z.push('6. Jedes Teil bekommt eine Wichtigkeit: muss, soll oder kann.');
    z.push('7. Rate nicht. Bei allem, was du aus den Bildern oder dem Text nicht sicher ablesen kannst, trage eine Frage in „offeneFragen“ ein (Liste von Texten). Jonah beantwortet sie, bevor gebaut wird.');
    z.push(`8. Schreibe immer "schema": ${V.schema} und "version": 1 (die erste Fassung; spätere Fassungen zählt Blockwerk hoch).`);
    z.push('9. Antworte nur mit einem einzigen JSON-Block (```json … ```), ohne weiteren Text.');
    z.push('');
    z.push('ERLAUBTE BEGRIFFE');
    z.push(`Teilarten („art“): ${V.teilarten.join(', ')}`);
    z.push(`Wichtigkeit: ${V.wichtigkeiten.join(', ')}`);
    z.push(`Verbindungsarten („verbindungen[].art“): ${V.verbindungsarten.join(', ')}`);
    z.push(`Stimmungen („stil.stimmung“): ${V.stimmungen.join(', ')}`);
    z.push(`Proportionen („form.proportionen“): ${Object.entries(V.proportionen).map(([k, g]) => `${k} (${g.min}–${g.max})`).join(', ')}`);
    z.push(`Bauplatz: breite ${V.bauplatz.breite.min}–${V.bauplatz.breite.max}, hoehe ${V.bauplatz.hoehe.min}–${V.bauplatz.hoehe.max}, tiefe ${V.bauplatz.tiefe.min}–${V.bauplatz.tiefe.max}`);
    z.push('');
    z.push('Lagebeziehungen („lage.relation“):');
    z.push(...zeilen.relationen());
    z.push('');
    z.push('Formen („form.baustein“ mit „form.groesse“; alle Parameter sind optional, sonst gilt der Standard):');
    z.push(...zeilen.bausteine());
    z.push('');
    z.push('Funktionen („funktionen[].art“):');
    z.push(...zeilen.funktionen());
    z.push('');
    z.push('AUFBAU DES JSON (Beispiel, die Werte sind erfunden):');
    z.push('```json');
    z.push(zuJson(beispiel()));
    z.push('```');
    z.push('');
    if (messungen.length) {
      z.push('GEMESSEN (deterministisch aus den Bildern, nicht geschätzt – bitte übernehmen und nicht widersprechen):');
      z.push(...messungen.map(messzeile));
      z.push('');
    }
    z.push('EINGABE');
    z.push(`Projekt: ${projekt || '(bitte aus dem Text oder den Bildern ableiten)'}`);
    z.push(`Bauplatz: ${bauplatz ? `${bauplatz.breite} × ${bauplatz.hoehe} × ${bauplatz.tiefe} Blöcke (Breite × Höhe × Tiefe)` : '(nicht angegeben: schätze oder frage in „offeneFragen“)'}`);
    z.push(`Bilder: ${bilder.length ? bilder.join(', ') : '(keine)'}`);
    z.push('Text:');
    z.push(text || '(kein Text)');
    return z.join('\n');
  }

  return { prompt, beispiel };
}

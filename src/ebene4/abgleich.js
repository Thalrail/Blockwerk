// Ebene 4 – Abgleich der Bildmessung mit der Spezifikation der KI. Widersprüche werden Rückfragen an Jonah (Pfad, Bildname, Optionen), nichts wird geraten.
// Regeln als Daten: data/regeln/leser.json (leser.messung). Ids der Rückfragen: M1, M2, …

const zahlText = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
const prozent = (x) => `${Math.round(x * 100)} %`;

/**
 * @param {{regelwerk: object, vokabular: object}} quellen
 */
export function erzeugeAbgleich({ regelwerk, vokabular: V }) {
  const P = (name) => regelwerk.parameter('leser.messung', name);
  const tol = P('toleranz').verhaeltnis, farbe = P('farbe'), woerter = P('farbwoerter'), form = P('bausteinform');
  const ARTEN = ['grundriss', 'aufriss', 'farben'];

  /** Weicht ein gemessener Wert um mehr als die Toleranz (relativ) vom Sollwert ab? */
  const weicht = (gemessen, soll) => Math.abs(gemessen / soll - 1) > tol;

  /**
   * @param {object} spec  Spezifikation (schon geprüft oder nicht; es werden nur die genannten Felder gelesen)
   * @param {{teil: string, art: 'grundriss'|'aufriss'|'farben', bild?: string, ergebnis: object}[]} messungen
   * @returns {{rueckfragen: object[], hinweise: object[]}}
   */
  function abgleich(spec, messungen) {
    const rueckfragen = [], hinweise = [];
    const frage = (pfad, text, optionen = []) => rueckfragen.push({ id: `M${rueckfragen.length + 1}`, pfad, regel: 'leser.messung', frage: text, optionen: [...optionen, { id: 'anders', text: 'Etwas anderes (bitte beschreiben)' }] });
    const hinweis = (pfad, text) => hinweise.push({ pfad, text });
    const teile = new Map((spec?.teile ?? []).map((t, i) => [t.id, { t, i }]));

    (messungen ?? []).forEach((m, k) => {
      const mp = `messungen[${k}]`;
      const bild = m.bild ? `Bild „${m.bild}“` : 'Das Bild';
      const eintrag = teile.get(m.teil);
      if (!eintrag) { frage(`${mp}.teil`, `${bild} soll zum Teil „${String(m.teil)}“ gehören; ein solches Teil gibt es in der Spezifikation nicht.`, [...teile.keys()].slice(0, 6).map((id) => ({ id: `wert:${id}`, text: `Teil „${id}“`, wert: id }))); return; }
      if (!ARTEN.includes(m.art)) { frage(`${mp}.art`, `${bild}: die Messart „${String(m.art)}“ kennt Blockwerk nicht (erlaubt: ${ARTEN.join(', ')}).`); return; }
      const { t, i } = eintrag;
      const pf = `teile[${i}]`;
      const g = t.form?.groesse ?? {};

      if (m.art === 'grundriss') {
        const r = m.ergebnis;
        const bs = t.form?.baustein;
        const istRund = form.rund.includes(bs), istEckig = form.eckig.includes(bs);
        if ((r.form === 'rund' && istEckig) || (r.form === 'eckig' && istRund)) {
          const passend = (r.form === 'rund' ? form.rund : form.eckig).filter((b) => V.baustein(b));
          frage(`${pf}.form.baustein`, `${bild}: der Grundriss von ${t.name} ist ${r.form}, die Spezifikation nennt aber ${bs} (${r.form === 'rund' ? 'eckig' : 'rund'}). Welche Form stimmt?`,
            [...passend.slice(0, 4).map((b) => ({ id: `wert:${b}`, text: `Form wie im Bild: „${b}“`, wert: b })), { id: 'text', text: `Form wie in der Spezifikation lassen („${bs}“)` }]);
        }
        if (Number.isFinite(g.breite) && Number.isFinite(g.tiefe) && g.tiefe > 0 && Number.isFinite(r.seitenverhaeltnis) && weicht(r.seitenverhaeltnis, g.breite / g.tiefe)) {
          const tiefe = Math.max(1, Math.round(g.breite / r.seitenverhaeltnis));
          frage(`${pf}.form.groesse`, `${bild}: ${t.name} ist im Grundriss ${zahlText(r.seitenverhaeltnis)} mal so breit wie tief, die Spezifikation hat ${g.breite} × ${g.tiefe} (${zahlText(g.breite / g.tiefe)}). Welches Verhältnis gilt?`,
            [{ id: 'bild', text: `Wie im Bild: ${g.breite} × ${tiefe} Blöcke`, wert: { breite: g.breite, tiefe } }, { id: 'text', text: `Wie in der Spezifikation lassen (${g.breite} × ${g.tiefe})` }]);
        }
      } else if (m.art === 'aufriss') {
        const r = m.ergebnis;
        const soll = t.form?.proportionen?.hoehe_zu_breite ?? (Number.isFinite(g.hoehe) && Number.isFinite(g.breite) && g.breite > 0 ? g.hoehe / g.breite : null);
        if (soll !== null && Number.isFinite(r.verhaeltnis) && weicht(r.verhaeltnis, soll)) {
          frage(`${pf}.form.proportionen.hoehe_zu_breite`, `${bild}: ${t.name} ist im Aufriss ${zahlText(r.verhaeltnis)} mal so hoch wie breit, die Spezifikation hat ${zahlText(soll)}. Welches Verhältnis gilt?`,
            [{ id: 'bild', text: `Wie im Bild: ${zahlText(r.verhaeltnis)}`, wert: Math.round(r.verhaeltnis * 100) / 100 }, { id: 'text', text: `Wie in der Spezifikation lassen (${zahlText(soll)})` }]);
        }
      } else {
        const palette = Array.isArray(m.ergebnis) ? m.ergebnis : [];
        const anteil = (f) => palette.find((x) => x.farbe === f)?.anteil ?? 0;
        const genannt = t.stil?.farben ?? [];
        const abgedeckt = new Set();
        genannt.forEach((wort, j) => {
          const klassen = woerter[String(wort).toLowerCase()];
          if (!klassen) { hinweis(`${pf}.stil.farben[${j}]`, `${t.name}: die Farbe „${wort}“ kann die Bildmessung nicht prüfen.`); return; }
          klassen.forEach((c) => abgedeckt.add(c));
          if (!klassen.some((c) => anteil(c) >= farbe.vorhanden)) {
            frage(`${pf}.stil.farben[${j}]`, `${bild}: für ${t.name} nennt die Spezifikation „${wort}“, im Bild kommt ${klassen.join(' oder ')} aber nicht vor (gemessen: ${palette.slice(0, 4).map((x) => `${x.farbe} ${prozent(x.anteil)}`).join(', ') || 'nichts'}). Welche Farbe ist gemeint?`,
              palette.slice(0, 3).map((x) => ({ id: `wert:${x.farbe}`, text: `„${x.farbe}“ statt „${wort}“`, wert: x.farbe })));
          }
        });
        for (const x of palette.filter((y) => y.anteil >= farbe.dominant && !abgedeckt.has(y.farbe))) hinweis(`${pf}.stil.farben`, `${t.name}: im Bild ist ${x.farbe} die Farbe mit ${prozent(x.anteil)}, in der Spezifikation fehlt sie.`);
      }
    });
    return { rueckfragen, hinweise };
  }

  return { abgleich };
}

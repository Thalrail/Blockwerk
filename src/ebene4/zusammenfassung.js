// Ebene 4 – Lesbare Zusammenfassung: die Spezifikation als deutscher Text für Jonah, der sie freigibt, bevor die Planung (Ebene 3) startet.

const WICHTIG = { muss: 'muss', soll: 'soll', kann: 'kann' };
const ART = { turm: 'Turm', halle: 'Halle', mauer: 'Mauer', keller: 'Keller', kuppelbau: 'Kuppelbau', tor: 'Tor', bruecke: 'Brücke', platz: 'Platz', lager: 'Lager', anlage: 'Anlage' };
const zahl = (n) => String(n).replace('.', ',');

/**
 * @param {{vokabular: ReturnType<typeof import('./vokabular.js').erzeugeVokabular>}} quellen
 */
export function erzeugeZusammenfassung({ vokabular: V }) {
  function teilText(t, i, namen) {
    const b = V.baustein(t.form?.baustein);
    const g = t.form?.groesse ?? {};
    const masse = Object.entries(g).map(([k, w]) => `${k} ${zahl(w)}`).join(', ');
    const pr = Object.entries(t.form?.proportionen ?? {}).map(([k, w]) => `${k.replaceAll('_', ' ')} ${zahl(w)}`).join(', ');
    const bezug = t.lage?.bezug === 'projekt' ? 'dem Bauplatz' : `„${namen.get(t.lage?.bezug) ?? t.lage?.bezug}“`;
    const lage = (V.relationen[t.lage?.relation] ?? '').replace('{bezug}', bezug) + (t.lage?.abstand ? `, ${t.lage.abstand} Blöcke Abstand` : '');
    const z = [`${i + 1}. ${t.name} (${ART[t.art] ?? t.art}, ${WICHTIG[t.wichtigkeit] ?? t.wichtigkeit}): ${b ? b.titel : t.form?.baustein}${masse ? `, ${masse} Blöcke` : ''}${pr ? `; Proportionen: ${pr}` : ''}. Lage: ${lage}.`];
    for (const f of t.funktionen ?? []) {
      if (f.art === 'handelsnischen') z.push(`   Bedarf: ${f.menge} Handelsnischen${f.beruf !== undefined ? ` (Beruf Nr. ${f.beruf})` : ''}.`);
      else if (f.art === 'lager') z.push(`   Bedarf: Lager für ${f.sorten?.length ?? 0} Gegenstandssorten.`);
      else z.push(`   Bedarf: ${f.art} (noch ohne fertiges Modul).`);
    }
    if (t.stil) {
      const s = [t.stil.stimmung && `Stimmung ${t.stil.stimmung}`, t.stil.farben?.length && `Farben ${t.stil.farben.join(', ')}`, t.stil.bemerkung].filter(Boolean);
      if (s.length) z.push(`   Stil: ${s.join('; ')}.`);
    }
    if (t.verbindungen?.length) z.push(`   Verbindungen: ${t.verbindungen.map((v) => `${v.art === 'gang' ? 'Gang' : 'Schienenweg'} zu „${namen.get(v.mit) ?? v.mit}“`).join(', ')}.`);
    return z.join('\n');
  }

  /** @returns {string} */
  function zusammenfassung(spec) {
    const p = spec.projekt, namen = new Map(spec.teile.map((t) => [t.id, t.name]));
    const kopf = [
      `Bauspezifikation „${p.name}“, Version ${spec.version}.`,
      `Bauplatz: ${p.bauplatz.breite} × ${p.bauplatz.hoehe} × ${p.bauplatz.tiefe} Blöcke (Breite × Höhe × Tiefe)${p.massstab && p.massstab !== 1 ? `, Maßstab ${zahl(p.massstab)}` : ''}.`,
      `${spec.teile.length} ${spec.teile.length === 1 ? 'Teil' : 'Teile'}: ${['muss', 'soll', 'kann'].map((w) => `${spec.teile.filter((t) => t.wichtigkeit === w).length} ${w}`).join(', ')}.`,
      '',
    ];
    const bedarf = spec.teile.flatMap((t) => t.funktionen ?? []);
    const nischen = bedarf.filter((f) => f.art === 'handelsnischen').reduce((s, f) => s + f.menge, 0);
    const text = [...kopf, ...spec.teile.map((t, i) => teilText(t, i, namen))];
    if (nischen) text.push('', `Zusammen: ${nischen} Handelsnischen.`);
    if (spec.freigabe) text.push('', `Freigegeben von ${spec.freigabe.von} (Version ${spec.freigabe.version}).`);
    return text.join('\n');
  }

  return { zusammenfassung };
}

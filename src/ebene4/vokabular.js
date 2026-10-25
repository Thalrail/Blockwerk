// Ebene 4 – Vokabular: alles, was in einer Spezifikation stehen darf. Kommt aus den Daten (Regel leser.schema), aus den Bausteinen der Ebene 2
// und aus den Bedarfsarten und Stimmungen der Ebene 3, damit Prüfer und Briefing-Prompt nie auseinanderlaufen.

/**
 * @param {{regelwerk: object, ebene0: object, ebene2: object}} quellen
 */
export function erzeugeVokabular({ regelwerk, ebene0, ebene2 }) {
  const S = (name) => regelwerk.parameter('leser.schema', name);
  const arten = regelwerk.parameter('plan.bedarf', 'arten');
  const stimmungen = Object.keys(regelwerk.parameter('plan.palette', 'stimmungen'));

  const bausteine = [...ebene2.bausteine.entries()]
    .filter(([id]) => id.startsWith('form.') || id.startsWith('bau.'))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, b]) => ({ id, titel: b.titel.replace(/\s*\(.*$/, ''), parameter: b.parameter.map((p) => ({ ...p })) }));

  const funktionen = {};
  for (const [art, regel] of Object.entries(S('funktionen'))) funktionen[art] = { ...regel, modul: arten[art] ?? null };
  const ohneModul = S('funktionenOhneModul');

  return {
    schema: S('schema'),
    teilarten: [...S('teilarten')],
    relationen: { ...S('relationen') },
    wichtigkeiten: [...S('wichtigkeiten')],
    verbindungsarten: [...S('verbindungsarten')],
    proportionen: { ...S('proportionen') },
    bauplatz: { ...S('bauplatz') },
    verboteneFelder: [...S('verboteneFelder')],
    farben: { ...S('farben') },
    stimmungen,
    bausteine,
    baustein: (id) => bausteine.find((b) => b.id === id) ?? null,
    funktionen,
    funktionenOhneModul: [...ohneModul],
    funktionsarten: [...Object.keys(funktionen), ...ohneModul],
    gegenstand: (id) => ebene0.register.gegenstaende.includes(id),
    gegenstaende: () => ebene0.register.gegenstaende,
  };
}

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
    .filter(([id, b]) => (id.startsWith('form.') || id.startsWith('bau.')) && !b.intern)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, b]) => ({ id, titel: b.titel.replace(/\s*\(.*$/, ''), parameter: b.parameter.filter((p) => !p.intern).map((p) => ({ ...p })) })); // interne Parameter (Planung, z. B. wandzonen, tiefe bei Tür und Fenster) sieht weder der Leser noch die Oberfläche

  // Bausteinrezepte (Regeln rezepte.<name>, nur Daten): erlaubte Namen und Mindestmaße; die Rezeptschritte kennt nur Ebene 3
  const rezepte = Object.fromEntries(regelwerk.alle().filter((r) => r.id.startsWith('rezepte.')).map((r) => [r.id.slice('rezepte.'.length), { titel: r.titel, mindest: { ...r.parameter.mindest }, ...(r.parameter.merkmale?.geschosse ? { treppenJeGeschoss: Object.fromEntries(Object.entries(r.parameter.merkmale.geschosse.formen).map(([g, o]) => [g, ['auto', ...Object.keys(o.treppen.formen)]])) } : {}), ...(r.parameter.merkmale ? { merkmale: { ...(r.parameter.merkmale.eingang ? { eingang: [...r.parameter.merkmale.eingang.seiten] } : {}), ...(r.parameter.merkmale.fenster ? { fenster: Object.keys(r.parameter.merkmale.fenster.formen) } : {}), ...(r.parameter.merkmale.geschosse ? { geschosse: Object.keys(r.parameter.merkmale.geschosse.formen), treppe: ['auto', ...new Set(Object.values(r.parameter.merkmale.geschosse.formen).flatMap((g) => Object.keys(g.treppen.formen)))] } : {}) } } : {}) }]));

  const funktionen = {};
  for (const [art, regel] of Object.entries(S('funktionen'))) funktionen[art] = { ...regel, modul: arten[art] ?? null };
  const ohneModul = S('funktionenOhneModul');

  return {
    schema: S('schema'),
    teilarten: [...S('teilarten')],
    relationen: { ...S('relationen') },
    kindrelationen: { ...S('kindrelationen') }, // Lage in einem Bauteil (Zone des Trägers): relation → Zonenname
    anker: { ...S('anker') },
    ausrichtungen: { ...S('ausrichtungen') },
    versatz: { ...S('versatz') },
    wichtigkeiten: [...S('wichtigkeiten')],
    verbindungsarten: [...S('verbindungsarten')],
    proportionen: { ...S('proportionen') },
    bauplatz: { ...S('bauplatz') },
    verboteneFelder: [...S('verboteneFelder')],
    farben: { ...S('farben') },
    stimmungen,
    bausteine,
    rezepte,
    baustein: (id) => bausteine.find((b) => b.id === id) ?? null,
    funktionen,
    funktionenOhneModul: [...ohneModul],
    funktionsarten: [...Object.keys(funktionen), ...ohneModul],
    gegenstand: (id) => ebene0.register.gegenstaende.includes(id),
    gegenstaende: () => ebene0.register.gegenstaende,
  };
}

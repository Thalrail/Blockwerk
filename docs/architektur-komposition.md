# D5 Gebäudekomposition: Bestand, Architekturvorschlag, Pakete

Stand: Vorschlag, noch nicht umgesetzt, **nicht beschlossen** (Entscheidung von Jonah steht aus). Diese Datei wird nicht automatisch geladen. Das Ebenenmodell 0 bis 5 bleibt verbindlich; nichts hier ändert Ebene 0. Hinweis zur Namensgebung: In `docs/roadmap-v2.md` standen „D3 bis D5“ für andere Dinge (Gliederungsbausteine, Haus-Rezept, Materialkombinationen). Die tatsächlich umgesetzten D3 (Eingang und Fenster) und D4 (Geschosse und Treppen) haben das überholt; **D5 heißt jetzt Gebäudekomposition**, die frühere Idee „Materialkombinationen, Verwitterung“ ist ein späteres Paket.

## 1. Ziel
Blockwerk soll mehrere Baukörper (Türme, Mauern, Torhäuser, Höfe, Hallen, Brücken) zu einer zusammenhängenden, optisch überzeugenden Gesamtanlage verbinden: deterministisch, ohne Sonderlogik für die Zitadelle, mit Proportionen, die sich an Referenzbildern orientieren können, mit Verbindungen, die geometrisch und funktional stimmen, und mit der optischen Qualität als eigenem Abnahmekriterium. Referenzprojekt ist die Zitadelle (Stufe 1, **ohne Brut- und Handelsmechanik**).

## 2. Bestand (gelesen und gemessen)
| Bereich | Stand |
|---|---|
| Teilarten im Vokabular | `turm, halle, mauer, keller, kuppelbau, tor, bruecke, platz, lager, anlage` sind **nur Etiketten**: weder Geometrie noch Regeln hängen daran. |
| Lage (Ebene 3, `uebersetzung.js`) | Jedes Teil wird ein Abschnitt mit Hülle = Form + Technikstreifen + **4 Blöcke Rand**. Auf dem Bauplatz: `mitte` und Ecken. Bei einem Teil: `neben-…` und `strahl-…` mit **Lücke 8**, Ecken diagonal außen, `ueber`, `unter`. **Hüllen dürfen sich nicht überschneiden** (Übersetzung, Konstrukteur, Einwand `plan.geometrie`). |
| Messung | Turm 13×13×34, Mauer, Turm: **auch mit `abstand: 0` bleiben 8 Blöcke zwischen Turm und Mauer** (Rand 4 plus Rand 4). Anschluss, Einbindung und gemeinsame Wände sind heute **strukturell unmöglich**. |
| Verbindungen | Nur `gang` (3×3, gerade, gleiche Höhe) und `schiene`; die Naht prüft zwei Blöcke am Hüllenrand. Keine Mauer, keine Brücke als Verbindung, keine Höhenanschlüsse. |
| Einbau-Architektur (B+C) | Kinder in Zonen eines **einen** Trägers (`innen`, `wand-<seite>`), Aussparungen und Freihaltungen, stabile Kennungen, Konflikte und Verwaistes bei manuellen Änderungen. Bewährt bei Haus, Tür, Fenster, Treppe, D3 und D4. Nur Eltern-Kind, keine Beziehung zwischen Gleichrangigen. |
| Rezepte (D2 bis D4) | Datengetriebene Kompositionsmuster **vertikal** (Glieder eines Turms) mit Messung gegen die echte Geometrie. Das Muster trägt, ist aber auf ein Teil begrenzt. |
| Zitadelle heute | 20 Teile, Bauplatz **600 × 600** (Referenz: Plateau 240, Hauptgebäude 168 mittig). Ecktürme stehen 4 Blöcke vom Rand: Abstand Nordwest bis Nordost etwa **567 Blöcke statt 151**. Die Viertel hängen mit `neben` und `strahl` an der Rotunde, Portal und Brücken mit `neben` und `abstand` 130. Ergebnis: eine Gruppe von **Inseln**, kein Gebäude. 68.380 Blöcke, Planung etwa 230 Sekunden. |
| Bausteine | `form.zylinder, kegel, kuppel, kugel, scheibe, bogen, tonnengewoelbe, satteldach, walmdach`, `bau.wand` (frei stehende Trennwand), `bau.gang, saeule, tuer, fenster, raum, treppe, wendeltreppe, leiter`, Rezept `turm`. **Es fehlen:** Mauerzug mit Zinnen und Wehrgang, Torhaus mit Durchfahrt, Hof, Gesims und Strebepfeiler. |
| Bilder und Qualität | Ebene 4: Bildmessung (Proportion, Form, Seitenverhältnis, Kreise) und Abgleich Plan gegen Bild. Ebene 3: Gestaltungsprüfer (D1) misst **Einzelteile** (Materialien, Öffnungsanteil, glatte Fläche, Silhouette), nicht Anlagen. |

## 3. Prototyp: Einbindung statt Lücke (Wegwerf, nicht im PR)
Regel: Die Mauer reicht über die Turmwand hinaus in den Turm; Mauerzellen innerhalb der Turmform (Wand und Innenraum) entfallen, der Turm hat Vorrang. Gemessen in drei Größen (Türme 9×9×20, 13×13×34, 17×17×40, Mauern 16 bis 40 lang, 2 bis 3 dick): **0 unverbundene Blöcke, 0 freischwebende, 0 Hilfspunkte** (`messeAufbau`), 72 bis 360 gekürzte Zellen. Das Bild (Grundriss und Aufriss) wirkt wie eine gewachsene Mauer, nicht wie zwei Gebäude mit Spalt. Das Prinzip trägt also geometrisch; es braucht eine feste Regel, wer weicht, und die Reihenfolge der Abschnitte.

## 4. Architekturvorschlag
### Leitidee
**Kompositionsregeln als Daten, aufgelöst gegen die echte Geometrie**, genau wie bei den Rezepten und bei D4, nur zwischen Teilen statt innerhalb eines Teils. Ebene 4 beschreibt weiter nur WAS (Beziehungen), Ebene 2 bleibt blind für Nachbarn (sie liefert Anschlusspunkte und Zonen), Ebene 3 löst auf, Ebene 5 zeigt an.

### Bausteine der Lösung
1. **Anschlusspunkte (Ebene 2/3, Daten):** Jeder Baukörper bietet benannte Anschlüsse mit Art und Höhenband: Turm (`wand-<seite>` gibt es schon, dazu das Band der Wehrgang-Höhe), Mauer (zwei Enden, zwei Seiten, Wehrgang), Torhaus (Durchfahrt), Hof (Rand), Halle (Stirnseiten). Quelle sind die vorhandenen Zonen der Ebene-2-Pakete.
2. **Fügeregeln (Daten `data/regeln/komposition.json`):** je Paar von Anschlussarten eine deterministische Regel: *Einbindung* (Mauer in Turm, Prototyp), *Durchdringung* (Tor in Mauer: Aussparung plus Bogen, Fallgatter optional), *Stoß* (bündige Wand an Wand), *Aufsetzen* (Zinnen, Dach), *Wehrgang-Anschluss* (Tür im Turm auf Wehrganghöhe, Höhenabgleich). Vorrang als Daten (zum Beispiel Turm vor Mauer vor Zinnen); wer weicht, wird **abgeleitet gekürzt** (wie die Aussparung eines Kinds: keine gespeicherte Änderung).
3. **Lageauflösung mit Kontakt (Ebene 3, Konstrukteur):** Hüllen dürfen sich **nur an deklarierten Anschlüssen** berühren oder überschneiden; sonst bleibt alles wie heute (Rand 4, Lücke 8, Überschneidungsverbot). Die Reihenfolge der Abschnitte ist der Vorrang; die Naht prüft zusätzlich die Fügung (kein Spalt, kein Versatz).
4. **Beziehungsvokabular (Ebene 4, Daten, WAS):** `verbindet` (Mauer, Gang, Brücke zwischen zwei Teilen), `in-der-mauer` (Tor, Durchgang), `umschliesst` (Hof, Mauerring), `im-hof` und `innerhalb` mit `strahl-…` im Inneren (die Viertel der Zitadelle), `achsengleich-mit` (Symmetrie), `buendig-mit`. Keine Koordinaten; Abstände nur als relative Blockzahl wie `versatz`.
5. **Neue Bausteine und Rezepte (nach den Fügeregeln, Daten wo möglich):** `bau.mauer` (Dicke, Höhe, Wehrgang, Zinnen als Gliederung), Rezept `torhaus` (zwei Türme plus Durchfahrt auf Anschlüssen), `hof` (Bodenfläche mit Rand, Pflaster und Pfaden), Gesims und Strebepfeiler als Gliederungsbausteine.
6. **Funktionale Wege:** Aus den Anschlüssen entsteht ein **Wegegraph** (Türen, Wehrgänge, Durchfahrten, Brücken). Ebene 1 prüft ihn (`weg` für Spieler, Dorfbewohner, Baby wo nötig). Abnahme: alle Eingänge, Höfe, Türme und Wehrgänge sind begehbar verbunden.
7. **Proportionen aus Bildern:** Die Bildmessung liefert Maßzahlen (Seitenverhältnisse, Höhenstaffel, Abstände). Ein **Stilprofil** (Daten) übersetzt sie in Proportionsregeln der Komposition (Mauerhöhe zu Turmhöhe, Torbreite zu Mauerlänge, Turmabstand, Zinnenraster). Das sind Parameter innerhalb der Spezifikation (`proportionen`), deterministisch; ein **Abgleichsbericht** vergleicht Plan und Bild.
8. **Qualität als eigenes Abnahmekriterium (Anlagen-Metriken, Ebene 3, nur auf Blockdaten):** Silhouette (Höhenstaffelung der Baukörper), Achsensymmetrie der Gesamtanlage, **Anschlussqualität** (Anteil der Fügungen ohne Spalt und Versatz), **Erreichbarkeit** (Wegegraph), Hofanteil und Materialkonsistenz. Dazu ein **visueller Vergleich** (Übersichtsplan, Aufrisse, 3D) gegen die Referenzbilder, den Jonah abnimmt; die Messwerte sind die Mindestschwelle, nicht der Ersatz für den Blick.

### Ebenenzuordnung
| Ebene | Neu |
|---|---|
| 0 | nichts |
| 1 | nur Prüfung der Wege (vorhandene `weg`-Funktion) |
| 2 | Bausteine `bau.mauer`, Gliederung; Anschlüsse und Zonen als Paketfelder (optional, wie `einbauzonen`) |
| 3 | Fügeregeln und Lageauflösung mit Kontakt, Wegegraph, Anlagen-Metriken, Rezepte `torhaus`, `hof` |
| 4 | Beziehungsvokabular, Prüfer, Stilprofil aus Bildmessung, Abgleichsbericht |
| 5 | Übersichtsplan der Anlage, Schalter für Beziehungen, Anzeige der Fügungen und Wege |

### Schutz bestehender Projekte
Alles ist **optional und datengetrieben**: ohne die neuen Beziehungen und Rezepte bleiben Pläne **byte-identisch** (Rand 4 und Lücke 8 bleiben für die alten Relationen). Abgeleitete Kürzungen sind keine Änderungen des Benutzers; eine Einzelblockänderung in einer gekürzten Zelle wird als überholt oder Konflikt gemeldet, wie bei den Aussparungen aus D3 und D4. Anschlüsse bekommen stabile Kennungen (`<teil>.anschluss-<n>`); Planfassung, Verwaistes und Konflikte laufen über die vorhandene Architektur.

## 5. Paketaufteilung
| Paket | Inhalt | Abnahme |
|---|---|---|
| **D5.0** Referenz und Messlatte | Die Zitadelle (Stufe 1, ohne Brut und Handel) als kompakte Referenz aus den Bildern 08, 09, 13, 14: Hauptmaße (Plateau 240, Hauptgebäude 168, Höhen), Referenzspezifikation, Messwerte und Bildabgleich als Baseline; **das Mess- und Vergleichswerkzeug zuerst** | Bericht, reproduzierbar |
| **D5.1** Anschlüsse und Kontakt | Fügeregeln als Daten, Beziehungen `verbindet` und `in-der-mauer`, Konstrukteur mit Kontakt-Hüllen, Kürzen nach Vorrang, Naht prüft die Fügung | Tests, Mauer zwischen zwei Türmen in vielen Größen, Plan unverändert ohne Beziehungen |
| **D5.2** Mauerzug und Gliederung | `bau.mauer` mit Wehrgang und Zinnen, Strebepfeiler, Gesims, Tür im Turm auf Wehrganghöhe | Baubarkeit (`messeAufbau`), Wehrgang begehbar (Ebene 1) |
| **D5.3** Torhaus und Durchfahrt | Rezept `torhaus` auf den Anschlüssen, Tor in der Mauer, Brücke am Tor | Durchfahrt begehbar, Fügung ohne Spalt |
| **D5.4** Hof und Innenlage | `umschliesst`, `im-hof`, `innerhalb` mit `strahl-…` im Inneren, Hofboden und Pfade, Wegegraph | Erreichbarkeit aller Anschlüsse |
| **D5.5** Proportionsprofile und Anlagen-Qualität | Stilprofil aus Bildmessung, Abgleichsbericht, Anlagen-Metriken, visueller Vergleich | Messwerte über Schwelle, Vergleich von Jonah abgenommen |
| **D5.6** Ebene 5 | Übersichtsplan, Beziehungen bearbeiten, Fügungen und Wege anzeigen | Browser- und Windows-Praxistest |
| **D5.7** Zitadelle Stufe 1 (Referenzprojekt) | Die Zitadelle aus Beziehungen statt Streuplan, ohne Brut und Handel (die Viertel als Hallen mit Laufgang, ohne Nischen und Technik) | Prüfstein neu, Vergleich mit den Bildern, Abnahme durch Jonah |

D5.0 vor allem anderen (Messlatte), D5.1 trägt D5.2 bis D5.4, D5.5 kann nach D5.1 parallel zum Rest entstehen (nie auf demselben Branch), D5.7 am Schluss.

## 6. Akzeptanzkriterien (gesamt)
Deterministisch; Pläne ohne die neuen Merkmale byte-identisch; Fügungen ohne Spalt und Versatz (Anschlussqualität 100 Prozent bei Fügungen, die die Regeln zulassen); `messeAufbau` ohne unverbundene Blöcke und ohne unerwartete Hilfspunkte; Wegegraph begehbar (Ebene 1); Anlagen-Metriken über der Schwelle der Referenz; **visueller Vergleich mit den Bildern von Jonah abgenommen**; manuelle Änderungen und stabile Kennungen geschützt; keine Zitadellen-Sonderlogik (die Zitadelle ist nur eine Spezifikation, kein Code); Browser- und Windows-Praxistest; Prüfstein; Codex-Review.

## 7. Risiken
- **Optische Qualität ist teilweise subjektiv.** Metriken sind Mindestschwellen; die Abnahme bleibt der Blick von Jonah. Deshalb D5.0 zuerst.
- **Planungszeit:** Die Zitadelle plant heute rund 230 Sekunden. Fügeregeln und Wegegraph dürfen das nicht vervielfachen (Messung je Paket).
- **Kürzen über Abschnittsgrenzen** ändert Schicht-Abdrücke und Fortschritt (Umbauhinweise nötig); wie bei D3 und D4 nur, wenn die Beziehung eingeschaltet wird.
- **Runde Formen und Mauern:** Einbindung statt Tangente ist im Prototyp sauber, Mehrfachanschlüsse (mehrere Mauern an einem Turm, schräge Mauern) brauchen eigene Regeln (diagonale Mauern sind eine eigene Frage).
- **Referenzbilder sind Konzepte:** maßgeblich sind Zahlen und Beschriftungen (`docs/zitadelle/beschreibung.md`); widersprüchliche Angaben bleiben Rückfragen.
- **Umfang:** D5.7 ohne Handel und Technik; die Handelsnischen, Lorenbahnen und das Untergeschoss bleiben ausdrücklich außen vor.

## 8. Entscheidungen für Jonah
1. **Kompositionsmodell:** (A) Anschlüsse und Fügeregeln als Daten (empfohlen), (B) nur Anlagenrezepte (schnell, aber Zitadellen-nah und starr), (C) Baugruppen-Baum (Teile mit Untergruppen, später als Ergänzung zu A).
2. **Zitadelle Stufe 1 kompakt:** Das Hauptgebäude (168 × 168 im Plateau 240) statt des 600er Streuplans; die Prüfstein-Baseline (68.380 Blöcke) wird dabei neu festgelegt.
3. **Hauptgebäude als Baukörper mit Innenräumen** (Rotunde, Hauptturm, Viertel innen) oder als viele Einzelteile mit Kontakt?
4. **Abnahme der optischen Qualität:** Vorschlag: Messwerte als Mindestschwelle plus Bildvergleich, den Jonah freigibt.

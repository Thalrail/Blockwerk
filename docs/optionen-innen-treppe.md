# Optionen: Treppe über Geschosse und Innenräume (`innen`)

Stand 13.11.2026, Entscheidungsvorlage für Jonah (nach Haus-Sonde, Paket `bau.raum` und Dach). Nichts davon ist umgesetzt. Diese Datei wird nicht automatisch geladen.

## Ausgangslage im Code (gelesen und geprüft)
- **Ein Teil ist ein Abschnitt.** `uebersetzung.js` macht aus jedem Teil der Spezifikation einen Abschnitt mit eigener Hülle (Form + Technikstreifen + 4 Blöcke Rand). `innen` und „mittig bei“ meldet die Übersetzung als „kommt später“.
- **Hüllen dürfen sich nicht überschneiden:** Übersetzung (Rückfrage), Konstrukteur (`gliedere`, `ergaenzeAbschnitt`: `GliederungFehler`) und Einwand-Regel `plan.geometrie` („jeder Block höchstens einem Teil“).
- **Pakete kennen keine Aussparung:** Ein Baustein-Paket hat Blöcke, Anschlüsse, Hülle, Sperrzonen, Wesen, aber kein „hier Luft“. `fuegeBauteilEin` (Ebene 0) schreibt nur. Ebene 0 kann einzelne Blöcke löschen (`loescheBlock`), aber Ebene 2 und 3 nutzen das beim Zusammenbau nicht.
- **Verbindungen sind waagerecht** (`verlege`: Gang und Schiene auf gleicher Bodenhöhe; andere Höhe → Rückfrage „Treppen oder Rampe …“).
- **Innerhalb eines Abschnitts** kann der Architekt mehrere Formwünsche in Zonen setzen (`setzeFormwuensche`, Anker, kein Überschneiden der Hüllkästen). Ein Raum-Teil belegt aber seinen ganzen Kasten, sein Hohlraum ist nicht frei platzierbar.
- Folge für das Wohnhaus: Eine Treppe zwischen Erd- und Obergeschoss braucht (1) eine **Deckenöffnung** im Erdgeschoss, (2) die Treppe selbst im Raum und (3) Platz über der Öffnung im Obergeschoss. Der dritte Punkt ist schon erfüllt (Obergeschoss ohne eigenen Boden).

## Geometrie der Treppe (abgeleitet, im Paket zu bestätigen)
Stufenhöhe 1 und Kopffreiheit 2 sind Menschenmaß. Bei lichter Höhe `h` und Deckenstärke `t` steht man im Obergeschoss auf Höhe `h + t`; die Treppe braucht also `h + t` Stufen, ihre Länge ist `h + t` Blöcke. Über den letzten `t + 2` Stufen muss die Decke geöffnet sein (Kopffreiheit). Beispiel `h = 3`, `t = 1`: 4 Stufen, Öffnung 3 Blöcke lang. Der Raum muss entlang der Treppenwand lang genug sein (mindestens `h + t` plus Absatz).

## Option A: Raum um Treppe und Deckenöffnung erweitern (nur Ebene 2)
`bau.raum` bekommt wenige Parameter: `treppe` (0/1), `treppenwand` (1–4), `treppenbreite`. Der Baustein baut die gerade Treppe an der Wand und schneidet die Deckenöffnung in die eigene Decke. Optional später `trennwand` (Innenwand mit Tür) für einfache Innenräume.
- **Ebene 2:** ein Baustein, kein neues Paketformat. **Ebene 3 und 4:** nur das Vokabular (die Parameter erscheinen von selbst in `groesse`).
- **Vorteil:** klein, sofort nutzbar, ein Teil bleibt ein Teil (einfach für das Bearbeitungsmodell: eine stabile Kennung, Blockänderungen relativ zum Raum). Testbar wie `bau.raum`: Dichtheit, Maße, Begehbarkeit durch die Öffnung bis ins Obergeschoss (Ebene 1).
- **Nachteil:** feste Treppenform (gerade, an einer Wand), jede weitere Innenausstattung wird ein weiterer Parameter (Parameter-Wildwuchs). Keine echte Verschachtelung: Möbel, Technik oder beliebige Bauteile im Raum bleiben unmöglich. Treppe nur im unteren Geschoss definiert.
- **Aufwand:** klein bis mittel.

## Option B: Innenraum als freie Zone (Ebene 2 + 3)
Das Raum-Paket meldet seinen lichten Raum (`innenraum`, ein Quader). Die Übersetzung versteht `innen`: das Kind (z. B. `bau.treppe`, später Technik) wird im Innenraum des Trägers platziert, ohne Rand und Technikstreifen, und ist ein eigenes Teil im Abschnitt des Trägers (Architekt, Zonen). Die Überschneidungsregeln unterscheiden „enthalten“ von „überschneiden“. Die Deckenöffnung bleibt ein Parameter des Raums oder entsteht durch Option C.
- **Vorteil:** beliebige Kinder im Raum, entspricht dem Zonenmodell der Planung; löst auch „Bauelemente ohne 8 Blöcke Abstand“ für Innenräume.
- **Nachteil:** greift in Konstrukteur, Übersetzung, Architekt und Einwand-Regeln ein (Ebene-3-Invarianten ändern sich); die Deckenöffnung ist ohne Aussparung nur Sonderfall.
- **Aufwand:** mittel bis groß, grundlegende Architekturänderung (braucht deine Zustimmung).

## Option C: Aussparungen als allgemeines Paketfeld (Ebene 2 + 3, berührt Ebene 0 nicht)
Ein Paket darf `aussparung` melden (Quader oder Zellen, die beim Einfügen leer werden). Der Zusammenbau (`materialisiere`) wendet Aussparungen auf die Blöcke der Träger an (Reihenfolge und Vorrang festlegen). Damit lassen sich Treppenlöcher, Durchbrüche und **Tür und Fenster als eigene Teile in der Wand** beschreiben.
- **Vorteil:** allgemein; passt zum Bearbeitungsmodell B: Eine Aussparung ist technisch dasselbe wie eine Einzelblockänderung relativ zum Bauteil, beide Mechanismen können eine gemeinsame Grundlage nutzen.
- **Nachteil:** größter Umbau (Paketformat, Zusammenbau, Prüfer, Plan und Fortschritt: ein aus dem Träger ausgespartes Stück ändert dessen Schicht-Abdruck). Muss mit stabilen Teil-Kennungen zusammen entworfen werden.
- **Aufwand:** groß; sinnvoll im Paket „Bearbeitungsmodell“.

## Vergleich
| | A Raum erweitern | B Innenraum-Zone | C Aussparungen |
|---|---|---|---|
| Ebenen | 2 | 2, 3 | 2, 3 |
| Löst Treppe EG→OG | ja (fest) | mit Sonderfall | ja (allgemein) |
| Löst beliebige Innenteile | nein | ja | nur zusammen mit B |
| Löst Tür/Fenster als eigene Teile | nein | teilweise | ja |
| Risiko für Ebene-3-Invarianten | keines | hoch | mittel |
| Aufwand | klein–mittel | mittel–groß | groß |

## Empfehlung
**A jetzt** (nächstes Paket, `bau.raum` mit Treppe und Deckenöffnung, danach die Haus-Sonde mit Treppe), **B und C später** als eine gemeinsame Architekturentscheidung zusammen mit dem Bearbeitungsmodell (stabile Kennungen, Fixierungen/Aussparungen). Die Sonde zeigt dann, ob die feste Treppe für Wohnhäuser genügt. Schlägt A bei einem zweiten Referenzbau (z. B. Burgturm mit Wendeltreppe) an die Grenze, ist das der Anlass für B/C.

## Offene Fragen an Jonah
1. A als nächstes Paket, oder gleich B/C zusammen mit dem Bearbeitungsmodell?
2. Soll die Treppe in A auch eine **Wendeltreppe** im Raum können (rund, eigener Treppenschacht), oder zunächst nur die gerade Treppe?
3. Soll A schon eine einfache **Trennwand mit Tür** (Innenräume) enthalten, oder erst nach der Treppe?

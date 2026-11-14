# Plan: Oberfläche für manuelles Bearbeiten und Konfliktlösung

Stand 14.11.2026, Plan im Auftrag von Jonah (nach PR #51). **Stand: U0 bis U4 umgesetzt (14.11.2026); U5 bis U7 noch nicht.** Diese Datei wird nicht automatisch geladen. Grundlage: gelesener Code der Pakete P1 bis P11 (`src/ebene3/aenderungen.js`, `bestaetigung.js`, `src/ebene5/planfassung.js`, `umbau.js`, `live.js`, `bauplan.js`, `web/app.js`, `web/engine-worker.js`).

## 1. Ausgangslage: was es gibt und was fehlt

**Vorhanden (wiederverwenden, nicht neu bauen):**
| Baustein | Was er kann | Fundstelle |
|---|---|---|
| Änderungen im Entwurf | `setze`, `verwirf`, `verankere`, Status angewandt / überholt / verwaist / Konflikt / ungültig, Einwand `plan.aenderung` mit den Optionen verwerfen / verankern / zulassen | `src/ebene3/aenderungen.js`, `einwand.js`, `bauleiter.js` |
| Technik-Bestätigung | Abdruck je Anlage, Status bestätigt / nicht bestätigt / ungeprüft | `src/ebene3/bestaetigung.js` |
| Planfassung (gemeinsam) | Änderungen je Teil und Rahmenzelle als Vergleichen-und-Setzen (`erwartet` → `neu`), Konflikte, Versionen, Link, Datei, Live-Raum | `src/ebene5/planfassung.js`, `live.js`, `teilen.js` |
| Umbauhinweise | Vergleich zweier Baupläne gegen den Baufortschritt, Bestätigung vor dem Übernehmen | `src/ebene5/umbau.js`, Panel in `web/app.js` |
| Bauplan | Besitz je Zelle (`p`), Aussparungen, Technikstatus, Teile je Abschnitt | `src/ebene5/bauplan.js` |
| Spezifikation von Hand ändern | `pruefe` mit `bearbeitet` → neue Version, Freigabe entfällt, Vergleich zur alten Fassung | `web/engine-worker.js`, `web/eingabe.js` |

**Lücken (hier ist die Arbeit):**
1. `ebene4.baue(spec)` kennt keine Änderungen: der Worker baut den Plan nur aus der Spezifikation. Die Planfassung kommt zwar mit Link und Raum, **fließt aber nirgends in den angezeigten Bauplan ein.** Brücke vorhanden (`ausPlanfassung`), nur nicht verdrahtet.
2. Der Bauplan nennt keine Änderungsstatus (angewandt, verwaist …) und keine Einwände zu Änderungen.
3. Es gibt kein Umrechnen von einer angeklickten Weltzelle in (Teil, Rahmenzelle). Die Gegenrichtung (`zellenInWelt`) gibt es.
4. Eine reine Änderung ändert den Abdruck der Spezifikation nicht. `startProjekt` erkennt eine „neue Fassung“ aber an Name plus Spezifikationsabdruck, ein Umbauhinweis würde also nie entstehen.
5. Eine Verankerung im gemeinsamen Raum besteht aus zwei Operationen (neu setzen, alt löschen), die einzeln angenommen oder als Konflikt abgelehnt werden: halb angewendet wäre ein Verlust.
6. Die Oberfläche hat keine Bedienelemente für all das.

## 2. Leitgedanken (langfristige Vision: universeller Bauplaner)
- **Nichts Zitadellenspezifisches.** Alles arbeitet über Teil-Kennung (`ref`), Rahmenzelle, Rolle und Registerblock. Welche Teile es gibt, bestimmt die Spezifikation.
- **Ebene 5 rechnet nicht.** Jede Änderung geht als Operation nach unten (Planfassung oder Spezifikation); angezeigt wird nur, was Ebene 3 berechnet hat. Ebene 5 darf nie direkt Welt oder Plan ändern.
- **Zwei Wege, je nach Art der Änderung:**
  - *Einzelblock* → Planfassung (relativ zum Teil, Verwaisung, Mehrspieler). 
  - *Teil, Größe, Lage, Stil, Material* → Spezifikation (neue Version, Freigabe, Umbauhinweise). Das ist die bestehende Regel „Änderungswünsche gehen nach unten“.
- **Eine Pipeline für Umbauhinweise:** Jede Änderung, egal welchen Weges, erzeugt einen neuen Bauplan; der bestehende Vergleich (`Umbau.hinweise`) und die Bestätigung bleiben die einzige Stelle, an der gebaute Schichten geöffnet werden.
- **Nichts automatisch bei Verwaistem, Konflikt, Technik.** Entscheidung immer beim Benutzer (Bearbeitungsmodell B).
- **Jedes Paket einzeln test- und prüfbar.** Rechenlogik in `src/` (Node-Tests), Oberfläche dünn, danach Browserprüfung.

## 3. Pakete (Reihenfolge nach deiner Priorität; U0 ist Vorbedingung)

### U0 Entscheidungen und Vorbereitung (klein) – umgesetzt 14.11.2026 (Option A und A, siehe `docs/referenz/`)
- **0a Wand-Ausrichtung** (Empfehlung unten): Regel im Prüfer der Spezifikation, Übersetzung, Test anpassen.
- **0b projektId** (Empfehlung unten): `projekt.id` optional in der Spezifikation, von der Oberfläche beim ersten Freigeben erzeugt (dort darf Zufall sein), mitgeführt in Link, Datei, Raum; Zuordnung der Fassungen und Schlüssel (Fortschritt, Änderungen) darüber, alter Name als Rückfall mit Bestätigung.
- Prüfung: Schema-, Übersetzungs- und Teilen-Tests; Zitadelle-Prüfstein unverändert.

### U1 Änderungen im Bauplan sichtbar (Priorität 1, Grundlage, ohne Oberfläche) – umgesetzt 14.11.2026, siehe `docs/referenz/`
- Worker `baue(spec, messungen, planfassung, lauf)`: Entwurf aus der Spezifikation, `ausPlanfassung`, dann Bauplan mit den Änderungen. Leere Planfassung = bisheriger Plan, Byte für Byte (Regressionstest).
- Bauplan erhält `aenderungen: [{ id, teil, zelle, weltzelle, op, block, status, grund }]` und die offenen Rückfragen der Art `aenderung`.
- Schicht-Abdruck umfasst die geänderten Blöcke bereits (Abdruck über Ort, Block, Richtung, Inhalt): Haken gebauter Schichten fallen von selbst.
- Tests: `test/ebene5/bauplan-einbau` erweitern (Status je Fall, Haus mit Glas, verwaiste Änderung, mehrere Teile).

### U2 Zelle wählen: Welt → (Teil, Rahmenzelle) – umgesetzt 14.11.2026, siehe `docs/referenz/stand-ebene3-und-4.md`
- Reine Funktion (Ebene 3 oder 5 lesend): gegeben Abschnitt, Höhe y, Welt-x, Welt-z → Besitzer-Teil und Rahmenzelle, auch für leere Zellen im Innenraum und in Aussparungen (Besitzkarte plus Hülle). Gegenprobe für alle vier Drehungen, mehrere Teile, Kinder.
- Tests: Hin- und Rückweg mit `zellenInWelt`, Rotation, Randfälle (Zelle außerhalb jedes Teils → Fehlermeldung, keine Änderung).

### U3 Einzelblockänderungen in der Oberfläche (Priorität 1) – umgesetzt 14.11.2026, siehe `docs/referenz/stand-ebene5.md`
- Schichtplan: Klick auf eine Zelle wählt sie; Seitenleiste „Zelle (x, y, z) von Teil …“ zeigt Block, Besitzer, Änderungsstatus.
- Aktionen: *Block ändern* (Suche im Register 1463 Blöcke mit Faithful-Textur, nur gültige Zustände), *Block entfernen* (leeren), *Änderung zurücknehmen*. Jede Aktion = eine Planfassungs-Operation mit `erwartet` (der Stand, den der Benutzer sah) → bei Mitspielern korrekt als Konflikt.
- Eigenes reines Modul `src/ebene5/bearbeiten.js` (Aktion → Operation → neue Planfassung), die Oberfläche ruft es nur.
- Verbindung zu den Umbauhinweisen (Lücke 4): neuer Plan nach einer Änderung läuft über `Umbau.hinweise(alt, neu, fortschritt)`; `startProjekt` erkennt „gleiches Projekt, neue Fassung“ an `projektId` und Planfassungsversion statt nur am Spezifikationsabdruck.
- Persistenz lokal: Planfassung je `projektId` im Browser; Link und Datei tragen sie schon (Limit 200.000 Zeichen bleibt, wird angezeigt).
- Tests: Node-Tests für `bearbeiten.js`, Browserprüfung (Block setzen, Haken fällt, Hinweise erscheinen, Rückgängig).

### U4 Materialien bearbeiten (Priorität 2, Spezifikationsweg) – umgesetzt 14.11.2026 (Option B: Stimmung und Rollenblöcke), siehe `docs/referenz/stand-ebene5.md`
- Formular für Stimmung und Palette je Gesamtprojekt, Abschnitt und Teil (Rollen Wand, Akzent, Boden, Licht, Glas → Block aus dem Register). Es schreibt dieselbe Spezifikation (Felder `stil`), keine Sonderlogik.
- Der bestehende Weg übernimmt: `pruefe` mit `bearbeitet` → neue Version → Freigabe → Bauplan → Umbauhinweise.
- Tests: Spezifikationsvergleich (`vergleiche`), Palette unvollständig → Rückfrage statt stilles Material (bleibt Regel).

### U5 Bauteile bearbeiten (Priorität 2, Spezifikationsweg)
- Teilliste mit Parametern (Größe, Lage `anker`/`versatz`/`ausrichtung`), Teile hinzufügen und entfernen, Kindteile (Tür, Fenster, Treppe, Wand) verschieben. Wertebereiche und Beschriftung kommen aus dem Bausteinpaket (Parameter mit Größenart), nicht aus festem Oberflächencode, damit neue Bausteine ohne Umbau erscheinen.
- Schutz: ein Träger mit Kindern wird nicht stumm entfernt (Regel besteht), die Oberfläche zeigt die Meldung und die Folge für gebundene Änderungen („Änderung C3 wird verwaist“) **vor** dem Übernehmen.
- Tests: Spezifikation → Plan für Größenänderung mit vorhandenen Änderungen (Verwaisung wird vorab gezeigt).

### U6 Verwaistes und Konflikte verstehen und lösen (Priorität 3)
- **Panel „Änderungen“:** Liste nach Status; je Eintrag Teil, Zelle, Block, Grund in einem Satz („Der Block ist in der neuen Fassung weggefallen“, „Das Teil gibt es nicht mehr“).
- **Verwaist:** drei Knöpfe wie in den Optionen: *verwerfen*, *neu verankern* (Zielzelle in der Schicht anklicken), *zulassen und weiterbauen*. Verankern in der Planfassung wird eine **Gruppe**: beide Operationen gelten ganz oder gar nicht (Lücke 5; kleine Erweiterung von `wende`, mit Tests).
- **Mehrspieler-Konflikt:** `aenderung-konflikt` zeigt „Deine Fassung / Fassung von Anna“ und lässt wählen; es wird nie still überschrieben (bleibt wie in P10).
- **Technik:** Liste der Anlagen mit Status; bei „nicht bestätigt“ die Zellen, die sich im Prüfbereich geändert haben (Vergleich der Abdrücke je Zelle statt nur ein Gesamthash), Knopf *neu prüfen* (Ebene 1) → bestätigt oder Fehlerliste mit Koordinate. Ein nicht bestätigtes System wird nie als funktionsfähig angezeigt.
- Tests: je Zustand ein Fall im Panel-Modell (reines Datenmodell in `src/ebene5/`, kein DOM), Browserprüfung der Knöpfe.

### U7 Verbindung und Härtung (Priorität 4, abschließend)
- Ein gemeinsamer Ablauf „Änderung → neuer Plan → Hinweise → Bestätigung → Haken öffnen“ für beide Wege, Statusmeldungen mit Auftragsnummer (besteht).
- Versionierung sichtbar: Planfassungsversion und Spezifikationsversion im Kopf; „Fassung X → Fassung Y“ im Baubericht.
- Link- und Raumgrenzen (200.000 Zeichen, Dienstlimits) in der Oberfläche anzeigen; dauerhafte Projektspeicherung bleibt ein eigenes späteres Paket (Dienst).
- Gesamttests: Zitadelle-Prüfstein (4–6 Minuten), Haus mit Änderungen, Mehrspieler-Szenario, Browser-Durchlauf.

## 4. Abhängigkeiten
`U0` → `U1` → `U2` → `U3` → (`U4` und `U5` unabhängig voneinander möglich) → `U6` → `U7`. U4 und U5 brauchen U1 nur, damit vorhandene Änderungen beim Spezifikationsumbau korrekt als verwaist gezeigt werden.

## 5. Spieltest-Strang (unabhängig)
Bleibt eigener Strang (`docs/spieltests.md`). Zu jedem Paket kommt eine Testanleitung für Jonah: z. B. U3 „Block im Spiel setzen, Plan zeigt dasselbe; Schichtplan-Block Glas ersetzen“, U6 „Redstone-Anlage ändern → Neuprüfung → Ergebnis im Spiel vergleichen“. Status `geprüft` setzt nur Jonah. Offene Spieltests: Raum, Dach, Wand, Treppe (3 freie Blöcke), Technik-Umkreis 8.

## 6. Entscheidungen (entschieden von Jonah am 14.11.2026: Wand-Ausrichtung Option A, projektId Option A; die Tabellen bleiben als Begründung stehen)

### Wand-Ausrichtung (`wand-nord|ost|sued|west` mit `ausrichtung`)
Vor U0 überschrieb eine ausdrückliche `ausrichtung` die Außenrichtung, ein Test schreibt das fest; die Architektur sagt „nach außen“.
| Option | Wirkung | Bewertung |
|---|---|---|
| A: Wandseite gewinnt immer, `ausrichtung` bei `wand-…` wird vom Prüfer abgelehnt (Rückfrage „weglassen?“) | eindeutig, deterministisch; eine Tür sitzt immer so, wie die Wand es sagt; Einzeltest-Anpassung | **Empfehlung.** Kleinste Änderung, passt zu „nur WAS“ |
| B: Ausdrückliche Angabe gewinnt (Ist-Zustand) | flexibel, aber `wand-sued` plus `norden` widerspricht sich selbst; Fehler werden nicht erkannt | nicht empfohlen |
| C: Neues Feld `oeffnung: innen|aussen` für Türen und Fenster | erlaubt nach innen öffnende Türen ohne Widerspruch | später, wenn ein Bedarf entsteht (eigenes Paket, Datenformat) |

### projektId
Vor U0: Fassungen werden über Projektname plus geänderten Abdruck erkannt; Fortschritt wird nach Spezifikationsabdruck gespeichert.
| Option | Wirkung | Bewertung |
|---|---|---|
| A: Stabile `projekt.id` (zufällig, von der Oberfläche beim ersten Freigeben erzeugt), mitgeführt in Spezifikation, Link, Datei, Raum; alte Pläne ohne Id → einmalige Bestätigung „dieselbe Fassungsreihe wie …?“ | Umbenennen verliert nichts, gleiche Namen vermischen sich nicht, Änderungen und Haken haben einen festen Schlüssel | **Empfehlung**, vor U3 (die Planfassung braucht den Schlüssel) |
| B: Name bleibt, Oberfläche fragt vor jeder „neuen Fassung“ | kein Schema, aber ständige Rückfragen, kein fester Schlüssel für Änderungen | Zwischenlösung |
| C: Abdruck der ersten Fassung als Kennung | keine Zufallszahl nötig, aber bricht bei Importen derselben Spezifikation | nicht empfohlen |
Auswirkung A: Schemaänderung in Ebene 4 (optionales Feld, Version der Spezifikation bleibt kompatibel), Übersetzung und Plan unverändert (die Id darf den Plan nicht beeinflussen, Test), Zufall nur in Ebene 5. Jonah entschied sich am 14.11.2026 für Option A.

## 7. Risiken
- **Verankern im Mehrspielerraum** (Lücke 5): ohne Gruppenoperation droht Teilverlust; deshalb in U6 vor der Oberfläche.
- **Link-Größe:** viele Änderungen sprengen 200.000 Zeichen; die Oberfläche zeigt die Grenze und rät zur Datei oder zum Raum.
- **Spezifikationsweg ändert die Teil-Kennung:** bleibt die `ref` erhalten, bleiben Änderungen gebunden; Umbenennen einer `ref` in der Spezifikation verwaist sie. U5 zeigt das vorab.
- **Rechenzeit:** Plan wird bei jeder Änderung neu gebaut (Zitadelle mehrere Sekunden); U3 nutzt den Worker mit Auftragsnummer, Teilneuberechnung nur auf Freigabe von Jonah (Roadmap Punkt 6).

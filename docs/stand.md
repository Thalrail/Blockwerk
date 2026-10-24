# Stand – Blockwerk

Zuletzt aktualisiert: 20.10.2026

## Ausgangslage
- **Neubeginn.** Der frühere M0/M1-Prototyp (ZIP) ist verworfen und wird **nicht** übernommen. Blockplan (claude.ai-Artifact) ist ebenfalls abgelöst.
- Grundlage ist ausschließlich das bestätigte Ebenenmodell in `docs/ebenen.md` und die Entscheidungen in `docs/entscheidungen.md`.
- Schritt 0 und Schritt 1 sind gebaut (PR #1 gemergt). Ebene 1, Teil 2a (Unterbau) ist gebaut und gemergt (PR #2). Teil 2b-1, Schienen (Form und Verbindung), ist gemergt (PR #3). Teil 2b-2, Schienen-Antrieb, ist gemergt (PR #4/#9). Teil 2c, Wasser und Lava, ist gemergt (PR #5/#6). Teil 2d-1, Licht, ist gemergt (PR #7). Teil 2e-1, Lorenbewegung aus Jonahs Messungen, ist gemergt (PR #10). Teil 2d-2, Spawnstellen, ist gemergt (PR #8). Teil 2e-2, fallende Blöcke, ist gemergt (PR #13). Teil 2e-3, Trichter & Blockinhalte, ist gemergt (PR #14). Teil 2f-1, Redstone-Strom, ist gemergt (PR #15). Teil 2f-2, Redstone-Zeit, ist gemergt (PR #16). Teil 2f-3, Lampen, Türen, Beobachter und Tagessensor, ist gemergt (PR #17). Teil 2f-4, Kolben, ist gemergt (PR #18). Teil 2g-1, Bewegung und Erreichbarkeit, ist gemergt (PR #19). Teil 2g-2, Dorfbewohner-Verhalten, ist gemergt (PR #20). Ebene 2, Teil 3a (Baustein-Paket und Formen), ist gemergt (PR #21). Teil 3b (Bogen, Tonnengewölbe, Dachformen) ist gemergt (PR #22). Teil 3c (Bauelemente) ist gemergt (PR #23). Teil 3d-1 (Bahn-Module) ist gebaut: Branch `claude/ebene-2-technik-bahn`. 276 Tests, alle grün (`npm test`).
- Spieltests 1–8 von Jonah am 20.10.2026 ausgewertet: 7 Drehregeln stehen auf `geprüft`, Rest `ungeprüft` (siehe `docs/spieltests.md`).

## Bauplan (Reihenfolge nach Ebenen, von unten nach oben)
| Schritt | Inhalt | Status |
|---------|--------|--------|
| 0 | Projektgerüst: Ordnerstruktur je Ebene, `package.json` (nur `npm test`, Node 22, keine Abhängigkeiten), GitHub Actions für Tests, README mit Faithful-Nennung | **fertig** (gemergt, PR #1) |
| 1 | Ebene 0 – Fundament: Koordinaten/Richtungen, Blockregister Bedrock 1.26.50 (Daten), Wesenregister, Voxelwelt in Chunks, Blockinhalte, Vermesser (Verschieben/Drehen/Spiegeln mit facing), Speichern/Laden | **fertig, Status `entworfen`** (Tests bestanden; Drehregeln teils `geprüft` (7 von 19), Eigenschaften noch `ungeprüft`, siehe unten; `simuliert` gibt es erst mit Ebene 1) |
| 2a | Ebene 1 – Unterbau: Taktgeber (Spieltick, P-/C-Tick), geplante Ticks, Tickbereich, Sandkasten, Regelwerk als Daten mit Quelle/Status, Prüfer-Gerüst (Fackel/Schiene Halt, Tickbereich) | **fertig, Status `simuliert`** (Ausnahmen: `takt.zufallsticks` und `takt.mechanismus-blockupdate` nur `entworfen`; 8 Regeln mit Annahmen sind `ungeprüft`) |
| 2b-1 | Ebene 1 – Schienen: Form und Verbindung (Platzieren wie im Spiel, Prüfer für Verbindungen und Antriebsschienen) | **fertig, Status `simuliert`** (Annahmen `ungeprüft`; gemergt, PR #3) |
| 2b-2 | Ebene 1 – Schienen-Antrieb: Antriebsschienen (Reichweite 8, nur im C-Tick), Prüfer-Hinweis | **fertig, Status `simuliert`** (Annahmen `ungeprüft`; PR wartet auf Abnahme) |
| 2c | Ebene 1 – Wasser und Lava: Weite, Tempo, Fallen, Gefälle, Quellenbildung, Mischen, Wegspülen, Prüfer „Wasser zerstört“ | **fertig, Status `simuliert`** (Annahmen `ungeprüft`; gemergt, PR #5/#6) |
| 2d-1 | Ebene 1 – Licht: Blocklicht und Himmelslicht mit Minimum/Maximum bei unbekannten Filtern | **fertig, Status `simuliert`** (Annahmen `ungeprüft`; gemergt, PR #7) |
| 2d-2 | Ebene 1 – Spawnstellen: wo können Monster spawnen (Licht, Boden, Platz), Prüfer „Spawn möglich“ | **fertig, Status `simuliert`** (Annahmen `ungeprüft`; gemergt, PR #8) |
| 2e-1 | Ebene 1 – Lorenbewegung aus Messtabellen (keine Physik): Auslauf, Abstand der Antriebsschienen, Steighöhe, Fahrzeit, Prüfer „Lore bleibt stehen“ | **fertig**: Messwerte `geprüft` (Jonah, 24.10.2026), Lücken `ungeprüft`; gemergt, PR #10 |
| 2e-2 | Ebene 1 – Fallende Blöcke: Sand, Kies, Betonpulver, Amboss, Drachenei fallen, landen, werden zu Gegenständen oder Beton; Prüfer „Block fällt“ | **fertig, Status `simuliert`** (alle Regeln `ungeprüft`, Java-Platzhalter; gemergt, PR #13) |
| 2e-3 | Ebene 1 – Trichter & Blockinhalte: Cooldown 8 Ticks, Schieben/Ziehen, Redstone-Sperre, Stapelgrößen (Ebene 0), Komparator-Lesewert, Prüfer | **fertig, Status `simuliert`** (alle Regeln `ungeprüft`, Java-Platzhalter; gemergt, PR #14) |
| 2f-1 | Ebene 1 – Redstone-Strom (Gleichgewicht): Staub, Quellen (Block, Hebel, Knopf, Fackel, Detektorschiene), starke/schwache Bestromung, Fackel-Inversion, Aktivierungsschiene, Prüfer | **fertig, Status `simuliert`** (alle Regeln `ungeprüft`; gemergt, PR #15) |
| 2f-2 | Ebene 1 – Redstone-Zeit: Fackel-Verzögerung und Brennen, Repeater (Sperre, Impulse), Komparator, Knopfdauer, Prüfer | **fertig, Status `simuliert`** (alle Regeln `ungeprüft`; gemergt, PR #16) |
| 2f-3 | Ebene 1 – Redstone-Mechanismen: Lampen, Türen/Falltüren/Zauntore, Beobachter, Tagessensor, Prüfer | **fertig, Status `simuliert`** (alle Regeln `ungeprüft`; gemergt, PR #17) |
| 2f-4 | Ebene 1 – Kolben (Schieben bis 12 Blöcke, klebriger Kolben, unbewegliche und zerstörbare Blöcke, Zeit 2 + 2 Ticks im C-Tick), Prüfer | **fertig, Status `simuliert`** (alle Regeln `ungeprüft`; gemergt, PR #18) |
| 2e… | Ebene 1 – weitere Mechaniken, je ein PR: Redstone, Wesen (Reihenfolge entscheidet Jonah) | **als Nächstes** |
| 2g-1 | Ebene 1 – Wesen: Bewegung und Erreichbarkeit (Spieler, Dorfbewohner, Baby): gehen, Stufen, Treppen, springen, fallen, Lücken, Türen, Leitern, Wasser, Prüfer „begehbar“ | **fertig, Status `simuliert`** (alle Regeln `ungeprüft`; gemergt, PR #19) |
| 2g-2 | Ebene 1 – Wesen: Dorfbewohner-Verhalten (Betten, Berufsblock-Suche, Dorf, Iron-Golem-Bedingung), Prüfer | **fertig, Status `simuliert`** (alle Regeln `ungeprüft`; gemergt, PR #20) |
| 3a | Ebene 2 – Baustein-Paket und Formen: Scheibe/Ring, Zylinder, Kugel, Kuppel, Kegel (maßstabsfrei, Tests für alle Größen bis 257) | **fertig, Status `simuliert`** (gemergt, PR #21) |
| 3b | Ebene 2 – Bogen (Segmentbogen, Stich 0,3 × Spannweite), Tonnengewölbe, Satteldach, Walmdach/Zeltdach (maßstabsfrei, Tests über alle Größen) | **fertig, Status `simuliert`** (gemergt, PR #22) |
| 3c | Ebene 2 – Bauelemente: Gang, Treppe, Wendeltreppe, Tür, Fenster, Säule (Menschenmaß fest, formgebundene Blöcke mit Richtung) | **fertig, Status `simuliert`** (Zustandsregel `bau.zustaende` `ungeprüft`; gemergt, PR #23) |
| 3d-1 | Ebene 2 – Technikmodule Bahn: Antriebsstrecke, Steigungsstück, Kurve (nach Jonahs Lorenmessungen, Testszenario in Ebene 1) | **fertig, Status `simuliert`** (nur geprüfte Messwerte; PR wartet auf Abnahme) |
| 3d-2 | Ebene 2 – Technikmodule Handelsnische, Lager (Trichterreihe), Sortierer | als Nächstes |
| 3d-3 | Ebene 2 – Technikmodule Bahnhof, Entladestelle, Brüter | offen |
| 4 | Ebene 3 – Planung: Konstrukteur, Grobdesigner, Techniker, Architekt, Designer, Bauleiter, Einwand-Protokoll, Baubericht | offen |
| 5 | Ebene 4 – Leser: Spezifikationsschema, Spezifikations-Prüfer, Briefing-Prompt, Bildmessung | offen |
| 6 | Ebene 5 – Oberfläche: Desktop, Kompakt-/Vollmodus, 3D-Ansicht, Schichtpläne, Materialliste, Baubericht, Faithful-Texturen | offen |
| 7 | Prüfstein Zitadelle + Spieltest-Schleife | offen |

## Was Ebene 0 jetzt kann (`src/ebene0`)
- `richtungen.js`: x = Ost, z = Süd, y = oben; Richtungen, Drehen/Spiegeln von Richtungen, Chunk-Zuordnung, Höhenbereich −64…319.
- `blockregister.js` + `data/bloecke.json`: 1463 Blöcke, 157 Zustandsarten, Eigenschaften, Behälter-Plätze (Mojang-Daten 1.26.50.4).
- `wesenregister.js` + `data/wesen.json`: 130 Wesen (inkl. Item) mit Hitbox, Loren, Dorfbewohner (erwachsen/Baby), Spieler.
- `welt.js`: Voxelwelt in Chunks (sparse), Blockinhalte, Wesen, Bauteil-Ausschnitte, deterministische Reihenfolge, Kopie.
- `vermesser.js` + `data/drehregeln.json`: Verschieben, Drehen, Spiegeln inkl. Blöcke, Zustände, Inhalte, Wesen (Position + Blick).
- `speichern.js`: versioniertes JSON, verlustfrei, kanonisch.
- `daten-node.js` lädt die Daten unter Node; die Engine selbst liest keine Dateien (Ebene 5 lädt per `fetch`).
- Herkunft der Daten und Lizenz-Hinweis: `docs/daten.md`. Spieltests für Jonah: `docs/spieltests.md`.

## Was Ebene 1 (Teil 2a) jetzt kann (`src/ebene1`)
- `taktgeber.js`: Spieltick-Zähler, P-Tick (ungerade) / C-Tick (gerade), Tickarten (Spieltick, Staub, Übertrager, Mechanismus, Wesen), feste Arbeitsreihenfolge aus den Daten, Übertrager lesen im P- und schreiben im folgenden C-Tick (Verzögerung d: Lesetick + 2·d − 1), geplante Ticks, Protokoll für Tests.
- `geplante-ticks.js`: höchstens 100 je Chunk und Spieltick, Überlauf in den nächsten Tick. `tickbereich.js`: Simulationsdistanz/Tickingarea. `sandkasten.js`: Simulation nur in einer Kopie. `zufall.js`, `weltzeit.js`: deterministischer Zufall, Tag = 24.000 Ticks.
- `regelwerk.js` + `data/regeln/takt.json`, `pruefer.json`: 16 Regeln mit Quelle und Status; 8 davon mit Annahmen (`ungeprüft`, Testanleitungen in `docs/spieltests.md`).
- `pruefer.js`: meldet Verstöße maschinenlesbar mit Koordinate: Fackel/Schiene ohne tragenden Block (nach Jonahs Spieltests), Blöcke/Wesen außerhalb des Tickbereichs.
- Ebene 0 hat dafür drei neue Fakten je Block (`fackelOben`, `fackelSeiten`, `schiene`) und `vermesser.richtungVon` bekommen; doppelte Halbstufen sind jetzt Vollblöcke (vorher fälschlich nicht).
- Noch **keine** konkrete Mechanik (Wasser, Schienenverkehr, Redstone …): sie melden sich künftig beim Taktgeber an.

## Was Schienen (Teil 2b-1) jetzt können (`src/ebene1/schienen.js`)
- `platziere(welt, pos, id)`: legt eine Schiene so, wie das Spiel sie einstellt (einzeln Nord-Süd, Linie verlängern, zwei Nachbarn verbinden, Rampe zu Schienen eine Ebene höher/tiefer, Nachbarn stellen sich ein, volle Nachbarn bleiben). Gibt zurück, was sich geändert hat und womit die neue Schiene verbunden ist.
- `enden`, `gegenstelle`, `formAus`: Enden einer Schiene aus `rail_direction` (von Jonah geprüft, Test 4), Gegenstelle am Ende, Rückweg Enden → Wert.
- Antriebsschienen werden nie zur Kurve; Detektor/Aktivierung wie Antriebsschiene angenommen.
- Prüfer: `pruefer.schiene-verbindung` (einseitige Verbindung und Sackgasse = Hinweis), `pruefer.antriebsschiene-kurve`.
- Regeln: `data/regeln/schiene.json` (11 Regeln, 3 geprüft, 7 mit Annahmen und Testanleitung).
- Schiene auf Halbstufe/Treppe: normale Lage trägt nicht (Verstoß), obere Halbstufe und kopfstehende Treppe tragen (Jonah, 21.10.2026).
- Schienen-Spieltests 21.10.2026 (Jonah): T-Stelle = Ost-Süd vor Ost-Nord, gerade nur ohne weitere Nachbarn (**geprüft**); Rampen: West vor Ost, Süd vor Nord. Antriebsschiene bleibt an der Ecke gerade, die normale Schiene dreht sich zu ihr (**geprüft**). Offen: Detektor-/Aktivierungsschiene, Kurven ohne Ost-Nachbar, Kreuzung.
- Lorenbewegung: siehe Abschnitt „Lorenbewegung (Teil 2e-1)“.

## Was der Schienen-Antrieb (Teil 2b-2) jetzt kann (`src/ebene1/antrieb.js`)
- `aktive(welt, stromQuellen)`: welche Antriebsschienen sind aktiv? Direkt versorgt durch einen angrenzenden Redstone-Block (oder eine von außen übergebene Stromquelle), dazu verbundene Antriebsschienen bis 8 Schienen weit (17 bei Quelle in der Mitte); normale Schienen und Lücken unterbrechen.
- `aktiviere(welt, …)` setzt `rail_data_bit`; `mechanik()` ist eine Taktgeber-Mechanik der Tickart `mechanismus` und schaltet damit **nur im C-Tick** (Bedrock-dokumentiert).
- Prüfer-Hinweis `pruefer.antrieb-ohne-quelle` (nur wenn die Stromquellen übergeben werden).
- **Von Jonah geprüft (24.10.2026):** Reichweite 8 nach links und rechts (17 insgesamt), normale Schiene unterbricht den Strom, Redstone-Block versorgt von allen Seiten. Stromquellen: Redstonefackel seitlich und eingeschalteter Hebel versorgen die Schiene (eingetragen; Fackel vorn/hinten/über/unter und die Lage des Hebels „an angrenzendem Block“ noch offen).
- Schienen in Chunks außerhalb des Tickbereichs schalten nicht (der Taktgeber gibt den Tickbereich an die Mechanik weiter).
- **Wasser/Lava-Logik entspricht Java (Gefälle-Zählung, Abklingen, „unten vor seitlich“, Plus-Form):** Jonah bestätigt am 21.10.2026 aus Erfahrung, dass Bedrock sich gleich verhält (kein gezielter Spieltest, deshalb weiter `ungeprüft`).
- `pruefe()` läuft bei jeder Welt mit Wasser/Lava bis zu 400 Simulationsticks (Kosten wachsen mit der Wassermenge).
- Bekanntes Limit: `aktive()`/`aktiviere()` gehen bei jedem C-Tick über alle Blöcke der Welt (sortiert). Für Zitadelle-Größe (ca. 3,9 Mio. Blöcke) später Schienen je Chunk indexieren.
- Regeln: `data/regeln/antrieb.json` (6 Regeln, 3 geprüft, 2 mit Annahmen und Testanleitung: Fackel, Hebel; `antrieb.c-tick` belegt).
- **Keine Lorenphysik:** Bedrock nennt dazu keine Zahlen. Jonahs Messungen A–F (`docs/messungen-lore.md`) sind die Grundlage für Schritt 2b-3.

## Was Wasser und Lava (Teil 2c) jetzt können (`src/ebene1/fluessigkeit.js`)
- Als Taktgeber-Mechanik über geplante Ticks: Wasser 7 Blöcke weit (Quadrat), 1 Ring alle 5 Ticks; Lava Oberwelt 3 Blöcke / 30 Ticks, Nether 7 Blöcke / 10 Ticks. Darstellung mit `liquid_depth` (0 Quelle, 1–7 Fluss, ab 8 fallend).
- Fließt nach unten ohne Grenze, sucht Gefälle (gerade bis zum 5. Block, diagonal bis (3, 3)), bildet neue Wasserquellen (2 Quellen), Lava nie; Mischen: Obsidian, Bruchstein, Stein; spült Fackeln, Schienen, Teppiche, Redstone-Staub, Pflanzen u. a. weg (Ebene-0-Eigenschaft `fluessigkeit`); Abklingen ohne Nachschub.
- `simuliere(welt)` läuft in einer Kopie bis zum stabilen Zustand. Prüfer `pruefer.wasser-zerstoert`: Verstoß mit Koordinate für alles, was weggespült wird; Hinweis bei Wasser-Lava-Mischungen.
- Regeln: `data/regeln/fluessigkeit.json` (11 Regeln, 2 belegt, 9 mit Annahmen und Testanleitung). Vieles ist im Wiki nicht als Bedrock gekennzeichnet.
- **Jonahs Spieltests 24.10.2026:** Weite 7/3 als **Quadrat** (Ecken mit, Stufe = größter Abstand), Tempo (innerhalb der Stoppuhr-Genauigkeit), Wegspülen (Pflanzenfamilien), Vollblöcke halten auf, Gefälle gerade bis zum 5. Block und diagonal bis (3, 3), Plus-Form sind `geprüft` und in der Simulation umgesetzt (Wegkosten gerade 2, diagonal 3, Grenze 10; Annahmen `fluessigkeit.ecken`, `fluessigkeit.gefaelle-mischwege`). Offen: stilles Wasser + fließende Lava = glatter Stein (Lage der Lava ungeklärt). Details in `docs/spieltests.md`.
- Nicht dabei: Strömung auf Wesen, Waterlogging, Blasensäulen, Eis/Schnee, Lava-Feuer, Dimension im Plan (nur Einstellung der Simulation).
- Annahme mit Wirkung: Eine Quelle über fließendem Wasser breitet sich auch seitlich aus (Plus-Form um eine Quelle in der Luft). Treppen, Halbstufen, Zäune usw. halten Wasser wie feste Blöcke auf, bis getestet.

## Was Licht (Teil 2d-1) jetzt kann (`src/ebene1/licht.js`)
- `lichtkarte(welt, bereich, { himmel })`: Blocklicht und Himmelslicht für einen Bereich (± 15 Rand), je Feld **Minimum und Maximum**. Unbekannte Lichtfilter (Glas, Treppen, Halbstufen, Zäune, Türen, Eis …) und zustandsabhängige Quellen (Kerzen, Seegurken …) werden nicht geraten: Minimum = „blockiert“, Maximum = „lässt durch“. `blocklicht()` sagt `hell` / `dunkel` / `unklar`.
- Blocklicht: Quellen aus Ebene 0 (`licht`), Abnahme max(1, Filter) je Block. Himmelslicht: 15 bei freiem Himmel, senkrecht nur um den Filter schwächer, seitlich und aufwärts −1; „inneres“ Himmelslicht für Spawnregeln: Tag 15, Regen 12, Gewitter 10, Nacht 4 (Rohwerte unter 15: gleicher Abzug, Annahme).
- Ebene 0: neue Eigenschaft `lichtfilter` (0 Luft, 15 undurchsichtige Vollblöcke und doppelte Halbstufen, 2 Laub, 1 Wasser, sonst unbekannt); weitere Lichtquellen (Unterwasser-/Kupfer-/farbige Fackeln, leuchtende Redstone-Erze, Kupferlaternen, Glühflechte, Lichtblöcke).
- Prüfer-Hinweis `pruefer.licht-unklar` für Quellen mit zustandsabhängiger Stärke.
- Glas (außer getöntem) und Teppiche gelten als lichtdurchlässig wie Luft, Lava blockiert, Eis wie Wasser (Wiki „Opacity“, `ungeprüft`). **Java als Ersatz (Jonah, 24.10.2026):** dünne Blöcke (Fackeln, Schienen, Knöpfe, Schilder, Scheiben, Gitter, Türen, Falltüren, Zäune, Mauern, Kerzen, Laternen, Pflanzen, Blumen, Korallen, Köpfe; zusammen rund 360 Blöcke) lassen Licht durch wie Luft; Treppen und Halbstufen haben Filter 0 und sperren das Licht nur über ihre vollen Flächen (Unterseite bzw. Oberseite, bei Treppen auch die Rückseite; `licht.treppen-halbstufen`); Schnee, Pfade, Kolben, getöntes Glas und alles ohne Angabe bleiben unbekannt (Schranken). Fackel: Stärke 14, Reichweite 13. Filterwerte (Laub 2, Wasser 1) werden als Schranken gerechnet, weil das Wiki „Filterwert“ und „−1 zusätzlich“ nebeneinander nennt; Himmelslicht unter 15 fällt in der Obergrenze ungeschwächt, in der Untergrenze −1 je Block.
- Regeln: `data/regeln/licht.json` (6 Regeln, alle mit Annahmen und Testanleitung). Das Wiki nennt für die meisten dünnen Blöcke keine Bedrock-Werte; dort gilt jetzt die Java-Kategorie (siehe oben). Ein Fehler im Spiel wird gezielt in den Daten korrigiert, ohne Codeänderung.
- Bekanntes Limit: die Lichtkarte rechnet nur den angefragten Bereich (± 15); für ganze Zitadelle-Größe bereichsweise anfragen. Nicht dabei: Zeitverlauf von Tag und Nacht, Nether/Ende, Lichtupdate-Verzögerung.

## Was die Spawnstellen (Teil 2d-2) jetzt können (`src/ebene1/spawn.js`)
- `spawnstellen(welt, bereich, { himmel, monster })`: für jede Fuß-Zelle im Bereich das Urteil **möglich** oder **unklar** (sicher unmögliche Zellen werden weggelassen). Bedingungen: Blocklicht 0, inneres Himmelslicht unter 7, Boden mit voller fester Oberseite, Platz für die Hitbox des Monsters (aus dem Wesenregister: Zombie 0,6 × 1,9 → 2 Blöcke hoch, Spinne 1,4 × 0,9 → 1 hoch und 3 breit). Unbekanntes (Lichtfilter, Böden, Pflanzen im Weg) ergibt „unklar“ mit Grund (`boden`, `platz`, `blocklicht`, `himmel`).
- Ebene 0: neue Eigenschaft `spawnBoden` (true: undurchsichtige Vollblöcke und doppelte Halbstufen; false: Teppich, Zaun, Treppe, Verstärker, Truhe; „halbstufe“: untere nein, obere unbekannt; null: Glas, Laub, Seelensand u. a.).
- Prüfer `pruefer.spawn-moeglich` (nur mit übergebenem `spawnBereich`, z. B. den Innenräumen der Zitadelle): Verstoß mit Koordinate, wo Monster sicher spawnen können, Hinweis bei „unklar“.
- Fuß-Zelle: Luft, Gras und Blumen ja, Teppich nein, alle anderen dünnen Blöcke (Schienen, Platten, Schilder, Setzlinge) „unklar“ statt still weggelassen. Himmelslicht: bis 6 sicher ja, ab 8 sicher nein, genau 7 „unklar“ (zwei Wiki-Seiten widersprechen sich).
- Regeln: `data/regeln/spawn.json` (7 Regeln, 3 belegt oder nur Information, 4 mit Annahmen und Testanleitung).
- Nicht dabei: Tiere (Licht ≥ 7), Wasser-/Höhlen-/Sonderspawns, Spawner, Phantome, Spawn-Entfernung und Mob-Caps (nur als Information in `spawn.entfernung`), Zufall der Spawnwahl.

## Was die Lorenbewegung (Teil 2e-1) jetzt kann (`src/ebene1/lore.js`)
- **Keine Physik, nur Jonahs Messtabellen** (`data/regeln/lore.json`, 6 Regeln `geprüft` am 24.10.2026, 2 Lücken `ungeprüft`): `auslauf(n)` (Strecke nach n Antriebsschienen am Stück, linear zwischen den Messpunkten, Sättigung 23), `steighoehe(n)`, `abstandEben(k)` und `abstandSteigung(k, ersteAngetrieben, hoehe)` mit `ja`/`nein`/`unklar`, `luecke(normale, davor)`, `fahrzeit(laenge)` (Richtwert 0,16 s je Block).
- `bahn(welt, start, richtung)` läuft die Schienenverbindung ab (Linie, Kurve, Rampe, Ring ohne Endlosschleife, Ende bei Sackgasse oder einseitiger Verbindung); `analysiere(bahn)` urteilt über ebene Lücken, Rampen und fehlenden Antrieb am Start.
- Prüfer `pruefer.lore-stillstand` (nur mit `loreStart` {pos, richtung}): **Verstoß** mit Koordinate, wo die Lore stehen bleibt; **Hinweis** bei Abstand 9, Rampen über 5 Blöcken, Start ohne Antrieb.
- Konservativ: alle Messungen starten aus dem Stand, eine schon fahrende Lore wird wie aus dem Stand gerechnet (Prüfung eher zu streng, nie zu großzügig).
- Nicht dabei: Tick-Simulation der Lore, Beschleunigungskurve, Trichter-/TNT-Lore, Mob-Einsteigen, Kollisionen, Detektor-/Aktivierungsschiene.

## Was die fallenden Blöcke (Teil 2e-2) jetzt können (`src/ebene1/fallen.js`)
- Diskretes Modell ohne Entität: Ein Block mit `faellt` (Sand, roter Sand, Kies, Betonpulver, Amboss, Drachenei, verdächtiger Sand/Kies), unter dem nichts trägt, beginnt nach 2 Ticks zu fallen und rückt alle 9 Ticks eine Zelle nach unten (Wiki: 0,45 s je Block). Stapel fallen zusammen. Taktgeber-Mechanik über geplante Ticks.
- Er fällt durch Luft, Wasser, Lava und Feuer; durch eine Fackel nur, wenn darunter Luft ist (die Fackel bleibt); in Fackel/Schiene/Staub oder auf Halbstufe/Seelensand wird er zum **Gegenstand**; auf einem festen Vollblock bleibt er liegen; bei unbekannten Blöcken (Treppe, Zaun, Falltür …) bleibt er liegen und wird als „unklar“ gemeldet. Betonpulver wird bei Wasserberührung (fallend oder liegend) zu Beton der gleichen Farbe.
- `simuliere(welt)` läuft in einer Kopie. Prüfer `pruefer.faellt` (Option `fallen`): **Verstoß** mit Koordinate und Landeort für jeden fallenden Block und für Gegenstände; **Hinweis** bei unklarem Boden und bei Pulver → Beton.
- Regeln: `data/regeln/fallen.json` (9 Regeln, alle `ungeprüft` mit Testanleitung; Startverzögerung und Wasserverhalten sind Java-Platzhalter). Ebene 0: Amboss-Stufen sind jetzt `faellt`.
- Nicht dabei: Entitäten (Amboss-Schaden, Spieler getroffen), Gerüst, Tropfstein, Schnee, Kolben/Honig/Schleim, Spinnweben-Bremse, Blasensäule, Despawn nach 600 Ticks.

## Was Trichter & Blockinhalte (Teil 2e-3) jetzt können (`src/ebene1/trichter.js`)
- Ebene 0: neue Stapelgröße je Gegenstand (`register.stapel(id)`: 64, 16 oder 1, Muster in `data/quellen/eigenschaften.json`, Wiki „Item“, `ungeprüft`); `welt.setzeInhalt` lehnt zu große Stapel ab.
- Taktgeber-Mechanik: Jeder Trichter wartet nach einem Vorgang 8 Spielticks; bereit und nicht bestromt (`toggle_bit`) **schiebt** er erst einen Gegenstand in den Behälter, zu dem er zeigt (`facing_direction`), und **zieht** dann einen aus dem Behälter über sich. Gelegt wird links zuerst (gleicher Gegenstand mit Platz, sonst erster leerer Slot), genommen aus dem ersten passenden Slot. Behälter: Kiste, Redstone-Kiste, Fass, Werfer, Spender, Trichter, Shulkerkisten (nicht ineinander), Kupferkisten. Sonderbehälter (Ofen, Braustand, Komposter, Plattenspieler, Pult …) werden nicht bewegt, sondern als „unklar“ gemeldet.
- `simuliere(welt)` läuft in einer Kopie, bis 16 Ticks lang nichts mehr bewegt wurde. `lesewert(welt, pos)`: Komparator-Signalstärke `floor(1 + (Σ Anzahl ÷ Stapelgröße ÷ Slotzahl) × 14)` (leer 0, voll 15; Wiki-Beispiel 300 Blöcke in 9 Slots = 8 ist ein Test).
- Prüfer `pruefer.trichter` (Option `trichter`): Hinweis bei Ziel ohne Behälter, Sonderbehälter, Blick nach oben, Kreis aus Trichtern und Stau (Trichter hält am Ende Gegenstände).
- Regeln: `data/regeln/trichter.json` (9 Regeln, alle `ungeprüft` mit Testanleitung). Nicht dabei: Gegenstands-Entitäten über dem Trichter, Trichter-Loren, Ofen/Braustand/Komposter, Doppelkisten-Verbund, Sortierer (Baustein in Ebene 2).
- Bekanntes Limit: die Reihenfolge mehrerer Trichter im selben Tick folgt den Koordinaten (y, z, x), in Bedrock ist sie nicht dokumentiert. Die Redstone-Sperre wirkt in Bedrock nur im C-Tick; Blockwerk liest `toggle_bit` zu jedem Tick.

## Was der Redstone-Strom (Teil 2f-1) jetzt kann (`src/ebene1/redstone.js`)
- **Gleichgewicht ohne Zeit:** `stromkarte(welt, { loren })` rechnet den stabilen Stromzustand: Quellen (Redstone-Block, eingeschalteter Hebel, gedrückter Knopf, brennende Redstonefackel, Detektorschiene mit Lore) bestromen ihre Nachbarzellen schwach und einen Block stark (Hebel/Knopf: Befestigungsblock, Fackel: Block darüber, Detektorschiene: Block darunter). Staub verteilt Strom (−1 je Block, 15 Blöcke weit), steigt und fällt über Stufen, bestromt den Block darunter und die Blöcke, auf die er zeigt, schwach. Stark bestromte Blöcke speisen Staub, schwach bestromte nicht. Fackeln invertieren ihren Befestigungsblock.
- Schwingt eine Schaltung (Fackel mit Rückkopplung), meldet die Karte die Fackeln als `instabil`, statt einen Zustand zu raten (höchstens 64 Runden). Auswertungen: `staub(x,y,z)`, `blockBestromt`, `blockStark`, `fackelAn`, `staubQuellenFuer(ids)` (Staub, der auf Schienen zeigt, als Quelle für `antrieb.aktive`).
- **Aktivierungsschiene:** `ebene1.aktivierung` (= `erzeugeAntrieb` mit `ids` für die Aktivierungsschiene): Bestromung wie bei der Antriebsschiene, Reichweite 8 (17 insgesamt), Antriebs- und Aktivierungsschienen übertragen nicht untereinander.
- Ebene 0: neue Eigenschaft `leitet` (undurchsichtige Vollblöcke und doppelte Halbstufen ja, Glas/Teilblöcke nein, sonst unbekannt = `null`).
- Prüfer `pruefer.redstone` (Option `redstone`, optional `loren`): Hinweise für Staub ohne Quelle, Leitung zu lang (nach 15 Blöcken Stärke 0), schwingende Fackeln und Blöcke mit unbekannter Leitfähigkeit neben Staub.
- Regeln: `data/regeln/redstone.json` (13 Regeln, alle `ungeprüft` mit Testanleitung). **Jonahs Hebel-Messungen für Antriebsschienen (PR #9) bleiben maßgeblich**: Die Stromkarte liefert der Schiene nur zusätzliche Quellen (Staub). Dass ein Hebel an der Seite eines Nachbarblocks die Schiene nicht versorgt, weicht von „Nachbar stark bestromt“ ab und gilt nur für Antriebsschienen.
- Nicht dabei (Teil 2f-2/2f-3): Verzögerung (2 Spielticks) und Brennen der Fackel, Repeater, Komparator, Knopfdauer, Druckplatten, Kolben, Beobachter, Lampen, Türen, Tagessensor; die 20-Tick-Prüfung der Detektorschiene. Keine Quasi-Konnektivität (Bedrock).

## Was die Redstone-Zeit (Teil 2f-2) jetzt kann (`src/ebene1/redstone-zeit.js`)
- `erzeuge(welt, { loren })` baut im Sandkasten die Taktgeber-Mechaniken: **Staub** wird in jedem Spielstick neu berechnet und in die Welt geschrieben (`redstone_signal`); **Fackel, Repeater, Komparator** sind `uebertrager` (lesen im P-Tick, schreiben im C-Tick nach `2·d − 1` Ticks); **Knöpfe** lösen sich nach 20 (Stein, Polierter Schwarzstein) bzw. 30 Ticks (Holz). `laufe(n)`, `bisRuhe()`, `ereignisse`, `abdruck()`.
- Gemessen im Test: Fackel 2 Spielticks, Kette aus n Fackeln n × 2; Repeater 2/4/6/8; Komparator 2; Staub sofort. **Brennen:** der 9. Wechsel innerhalb von 60 Ticks lässt die Fackel ausbrennen (Tick 18 bei einer Rückkopplung), wieder an im Tick 65 (Java-Platzhalter).
- **Repeater:** 15 am Ausgang, nur von hinten nach vorn, Sperre durch einen bestromten Repeater/Komparator seitlich, An-Impulse mindestens so lang wie die Verzögerung, kurze Aus-Impulse werden unterdrückt. **Komparator:** Vergleichen und Subtrahieren, Rücken = Staub/Quelle/Behälter (auch durch einen Block), Seiten = Staub/Repeater/Komparator/Redstone-Block; die Stärke 0–15 lebt nur im Gedächtnis der Simulation (`output_lit_bit` in der Welt).
- `redstone.stromkarte(welt, { fest })` rechnet im Zeitmodus genau einmal mit vorgegebenen Fackel-/Repeater-/Komparator-Zuständen; `signalVon(von, zu)` liefert die Eingangsstärke.
- Prüfer `pruefer.redstone-zeit` (Option `redstoneZeit`): Hinweis „Fackel brennt im Tick N aus“ mit Koordinate, „läuft als Uhr (Periode N Ticks)“ (Beispiel Repeater + Fackel = 20 Ticks).
- Regeln: `data/regeln/redstone-zeit.json` (9 Regeln, alle `ungeprüft` mit Testanleitung). **Annahmen mit Wirkung:** `minecraft:cardinal_direction` von Repeater/Komparator nennt die Eingangsseite (wie Java „facing“); der Staub verbindet sich nicht seitlich mit Repeatern/Komparatoren (nur über die Zeigerichtung); Komparator liest Behälter nur direkt oder durch einen Block.
- Nicht dabei: Kolben, Beobachter, Lampen, Türen, Tagessensor, Druckplatten (brauchen Wesen), die 20-Tick-Prüfung der Detektorschiene, Redstone-Verhalten an Chunk-Grenzen.

## Was die Redstone-Mechanismen (Teil 2f-3) jetzt können (`src/ebene1/redstone-zeit.js`)
- `redstone.stromkarte(...).bestromtAn(x, y, z)`: Wird eine Zelle bestromt? Staub, der auf sie zeigt, auf ihr liegt oder keine Richtung hat; Quelle daneben (auch oben/unten); brennende Fackel (nicht am eigenen Befestigungsblock); bestromter leitender Block; Ausgabe von Repeater, Komparator, Beobachter, Tagessensor. Neu: Ausgaben mit `schwach: true` bestromen Blöcke nur schwach (Tagessensor).
- **Lampe** (nur im C-Tick): sofort an, 6 Ticks nach dem ersten C-Tick ohne Strom aus (Bedrock; Java 4), zwischendurch wieder bestromt bleibt sie an. **Türen, Falltüren, Zauntore** (C-Tick): `open_bit` = bestromt, bei Türen genügt eine bestromte Hälfte, beide wechseln gemeinsam.
- **Beobachter:** erkennt im P-Tick, wenn sich Block oder Zustand der Zelle vor ihm geändert hat, gibt 2 Ticks lang 15 stark an den Block hinter sich (`minecraft:facing_direction` = beobachtete Seite, Annahme). **Tagessensor:** rechnet alle 20 Ticks nach Java-Formeln (Tageszeit 0 = Sonnenaufgang, Wetter `klar`/`regen`/`gewitter`, Himmelslicht der Zelle darüber aus `licht.js`); Mittag 15, Sonnenauf-/untergang 5, Mitternacht 0; invertiert Mitternacht 11, unter einem Dach 15; bestromt alle sechs Nachbarn schwach.
- Prüfer `pruefer.mechanismus` (Option `redstoneZeit`): Hinweis bei Lampe/Tür, die in der Simulation nie bestromt wird, und bei Tagessensor mit teilweise unbekanntem Himmelslicht.
- Regeln: `data/regeln/mechanismen.json` (8 Regeln, alle `ungeprüft` mit Testanleitung). Nicht dabei: Kolben (2f-4), Zielblock, Druckplatten, Stolperdraht, Dimensionen (Nether/Ende geben in Bedrock kein Tagessensor-Signal; Blockwerk rechnet Oberwelt).

## Was die Kolben (Teil 2f-4) jetzt können (`src/ebene1/kolben.js`)
- Ebene 0: neue Eigenschaft `schiebung` je Block: `beweglich` (alles Übrige, auch Treppen, Halbstufen, Teppiche, Schienen, eingefahrene Kolben, Schleim/Honig), `zerstoert` (Fackeln, Pflanzen, Staub, Hebel, Knöpfe, Druckplatten, Schilder, Türen, Leitern, Banner, Schnee …), `unbeweglich` (Obsidian, Bedrock, Befehlsblöcke, Plattenspieler, Schleifstein, Leitstein, Spawner, Portale, Respawn-Anker …), `behaelter` (Blockentität, unklar), `null` (Luft, Flüssigkeiten, Feuer).
- `schiebeplan(welt, pos)`: sammelt ab der Kopfzelle die Kette (höchstens 12 Blöcke); Abbruch bei unbeweglichem, Behälter/unbekanntem Block, ausgefahrenem Kolben oder Kopf, Weltgrenze; Luft und Flüssigkeit machen Platz, ein zerstörbarer Block am Ende wird entfernt. `fahreAus`/`fahreEin`: Kette um eins schieben (Block-ID und Zustand erhalten), Armblock (`piston_arm_collision`) setzen/entfernen; klebrig zieht beim Einfahren einen beweglichen Block nach.
- Zeit (`redstone-zeit.js`, Tickart `mechanismus` = nur C-Tick): erster C-Tick mit Strom (von jeder Seite außer dem Kopf, keine Quasi-Konnektivität) + 2 Ticks Start + 2 Ticks Dauer, also Ausfahren/Einfahren im Tick 6 nach einem Start im Tick 0 (Test). Blockiert: einmal `kolben-blockiert` mit Grund, bis der Strom wegfällt. Beobachter reagieren auf das Ausfahren.
- Prüfer `pruefer.kolben` (Option `kolben`): Hinweis „Kolben kann nicht ausfahren: …“ oder „zerstört beim Ausfahren …“ mit Koordinate.
- Regeln: `data/regeln/kolben.json` (8 Regeln, alle `ungeprüft` mit Testanleitung). **Annahmen mit Wirkung:** Behälter werden nicht geschoben (Bedrock nicht eindeutig), Türen/Schilder/Leitern/Banner gelten als zerstörbar (Java), alle anderen Blöcke als beweglich (Java-Standard). Nicht dabei: Schleim-/Honigblöcke kleben nicht an Nachbarn, Wesen auf dem Kolben, Null-Tick-Impulse, weiche Inversion, Staub dreht sich zum Kolben (Bedrock).

## Was die Bewegung (Teil 2g-1) jetzt kann (`src/ebene1/bewegung.js`)
- Ebene 0: neue Eigenschaft `kollision` je Block: `voll` (Vollblöcke und alle Blöcke ohne Angabe, Java-Standard), `keine` (Luft, Pflanzen, Fackeln, Staub, Schienen, Teppiche …), `halbstufe`, `treppe`, `hoch` (Zäune, Mauern: 1,5), `tor`, `tuer`, `falltuer`, `leiter`, `wasser`, `lava`; **unklar (null)** bei Teilformen wie Truhen, Betten, Ambosse, Trichter, Kessel, Kerzen, Laternen, Gitter, Glasscheiben, Kolben.
- Modell auf einem Halbblock-Raster: Stehstelle mit tragender Fläche und freiem Platz für die Körperhöhe (Spieler und Dorfbewohner 2 Blöcke, Baby 1, kriechender Spieler 1). Schritte: **gehen** (≤ 0,5), **Stufe** (Treppe von der niedrigen Seite, Halbstufe), **springen** (1 Block, Platz über dem Start), **fallen** (Schaden ab 3 Blöcke: 1 Herzhälfte je Block; Dorfbewohner/Baby nur bis 3; Wasser fängt ab), **Lücke** (nur Spieler, 1 Block breit), **Leiter** (nur Spieler), **schwimmen**, **Türen** (Holz/Kupfer alle, Eisen keiner, Zauntor nur Spieler, Falltür trägt geschlossen). Lava und unklare Blöcke sperren und werden genannt.
- `erreichbar(welt, start, art)` (alle Stehstellen mit Kosten), `weg(welt, von, nach, art)` (Weg, Kosten, Fallschaden, Grund bei Misserfolg: „zu hoch“, „Fallhöhe“, „Weg versperrt“, „Ziel nicht begehbar“), `fallschaden(h)`. Prüfer `pruefer.begehbar` (Option `begehbarkeit: { start, ziele }`): Verstoß für unerreichbare Ziele, Hinweis bei Wegen nur mit Sprung oder Sturz.
- Regeln: `data/regeln/bewegung.json` (10 Regeln, alle `ungeprüft`). **Annahmen mit Wirkung:** Stufenhöhe 0,5, Fallschaden `ceil(h − 3)` (Java), Treppen ohne Richtungsprüfung (Stufen mit Höhenunterschied ≤ 0,5 von jeder Seite), Truhen und andere Teilformen werden nicht betreten. Nicht dabei: Geschwindigkeit/Zeit, Kriechen im Wasser, Honig/Seelensand/Eis, Kanten-Schleichen, Boote und Loren.

## Was das Dorfbewohner-Verhalten (Teil 2g-2) jetzt kann (`src/ebene1/dorf.js`)
- Ebene 0: neue Eigenschaften `beruf` (13 Berufsblöcke → Beruf, auch Hochofen/Räucherofen in der brennenden Form) und `bett` (Bett, Strohbett; Kopf = `head_piece_bit`).
- `betten(welt)`: jedes Bett einmal (Kopfhälfte), **gültig** mit zwei freien Zellen darüber (Kollision `keine`) und wenn ein Dorfbewohner neben Kopf oder Fuß treten kann (Erreichbarkeit aus `bewegung.js`); sonst mit Grund. `zuordnung(welt)`: Dorfbewohner nach Nummer nehmen das nächste erreichbare Bett; nur mit Bett gibt es einen Beruf: der **erste unbeanspruchte Berufsblock** der Liste (y, z, x) im Umkreis **16 waagerecht / 4 senkrecht**, auch wenn er ihn nicht erreicht (Hinweis, Ärger). Babys nehmen weder Bett noch Beruf.
- `dorf(welt)`: Mittelpunkt (erstes gültiges Bett), Grenze 65 × 25 × 65 um jedes gültige Bett (wächst), Höchstbevölkerung = gültige Betten, Vermehrung (`nein`/`unklar`, Futter nicht modelliert), **Iron Golem**: `ja` ab 10 Dorfbewohnern und 20 Betten, `nein` darunter, `unklar` wenn schon Golems im Dorf stehen (Wiki-Seiten widersprechen sich).
- Prüfer `pruefer.dorf` (nur mit Option `dorfPruefen: true`): **Verstoß** für einen Berufsblock, den ein Dorfbewohner beansprucht, aber nicht erreicht; **Hinweise** für Betten, die nicht zählen, Dorfbewohner ohne Bett, Berufsblöcke ohne Dorfbewohner in Reichweite, mehr Dorfbewohner als Betten, mögliche Iron Golems.
- Regeln: `data/regeln/dorf.json` (7 Regeln, alle `ungeprüft`). **Annahmen mit Wirkung:** Berufsvergabe nur mit Bett, nächstes Bett zuerst, Liste nach (y, z, x) (Bedrock nennt keine Reihenfolge), Babys zählen als Dorfbewohner, Berufsblock gilt als erreicht, wenn man daneben oder darauf steht.
- Nicht dabei: Handel, Tagesablauf (Arbeit, Treffen, Schlafen), Alarm/Panik, Zombie-Dörfer, Berufswechsel, Spawnort und Zeitabstand des Golems, Zahl der Golems je Dorfbewohner (nur „unklar“), Dorfgrenze als Würfel statt Zusammenhang der Betten.

## Was Ebene 2, Teil 3a, jetzt kann (`src/ebene2`)
- `baustein.js`: das **Baustein-Paket** (`definiere`, `param`, `pruefePaket`): Parameter mit Größenart (`geometrie`, `menschenmass`, `technik`) und Bereich, Blöcke als **Rollen** (`wand`, `akzent`, `boden`, `licht`; keine Block-IDs), Anschlüsse, Platzbedarf (Hüllquader + Sperrzonen), Testszenario, Status mit Quelle. `platziere(welt, paket, palette, versatz)` schreibt nur über `welt.setzeBlock` (Ebene 0); `TESTPALETTE` ist nur für Tests und Vorschau, das Material entscheidet später Ebene 3.
- `formen.js`: fünf Formen als Abstandsbedingung auf der Blockmitte, erst beim Bauen gerastert: `form.scheibe` (Kreis/Ellipse/Ring), `form.zylinder` (Turmrohr, oben und unten offen), `form.kugel` (Ellipsoid), `form.kuppel` (Höhe = 0,5 × Radius als einstellbare Proportion, unten offen), `form.kegel`. Ungerade Breite: Mitte auf einem Block, gerade: zwischen zwei Blöcken. Hohle Formen sind wasserdicht (Wandstärke 1…32, 6er-Nachbarschaft).
- Regeln: `data/regeln/formen.json` (3 Regeln, `simuliert`, nichts `ungeprüft`, da reine Geometrie nach `docs/ebenen.md` und keine Bedrock-Annahme). Tests für alle Größen von 1 bis 257 (Kugel bis 256): symmetrisch (Spiegelung, Drehung), Rand höchstens ½ Block vom Ideal, hohle Formen lückenlos, Proportionen gleich für r = 12, 20, 100; Mutationen von Rundung, Mittelpunkt und Proportion schlagen an.
- Nicht dabei: Gewölbe, Bogen, Dachformen (3b), Bauelemente (3c), Technikmodule (3d), Spiegeln/Drehen von Anschlüssen (die Blöcke dreht der Vermesser).

## Was Ebene 2, Teil 3b, jetzt kann (`src/ebene2/bogen.js`, `dach.js`)
- `form.bogen`: Segmentbogen in einer Mauer; lichte Weite `spannweite`, Stich = `stichverhaeltnis` × Spannweite (Standard 0,3, höchstens 0,5 = Halbkreis), Pfeiler bis zum Ansatz (`pfeilerhoehe`, **mindestens 2 = Menschenmaß**), Bogenstärke, Mauerdicke `tiefe`. Körper = Außenform (Radius R + Stärke) minus Öffnung, Blockmitte entscheidet; gerade/ungerade Weite ohne schiefe Seite. Anschluss `durchgang` mit lichter Breite und Höhe. `form.tonnengewoelbe`: derselbe Querschnitt über `laenge`, zwei Anschlüsse.
- `form.satteldach` (Giebel offen) und `form.walmdach` (Zeltdach bei quadratischem Grundriss): Höhenfeld mit `neigung` (Höhe ÷ halbe Breite, Standard 1,0 = 45 Grad); hohle Hülle der Dicke `dachstaerke`, wasserdicht, unten offen, aus Vollblöcken gestuft (Glätten mit Treppen/Halbstufen ist Sache von Ebene 3); Rolle `akzent`.
- `raster()` in `formen.js` kann jetzt offene Enden (`offenX`, `offenZ`).
- Regeln: `data/regeln/bogen.json` (2), `dach.json` (1), alle `simuliert`, nichts `ungeprüft`. Tests: Spannweite 1–65, 100, 128 mit Stich 0,15/0,3/0,5, Bogenstärke 1–4; Rand höchstens ½ Block vom Ideal; Öffnung lückenlos (Flutfüllung) und genau die Idealöffnung; **Durchgang mit Ebene 1** (Spieler, Dorfbewohner, Baby gehen hindurch, geschlossene Mauer hält); Dächer Breite 1–65, 100–256, Neigung 0,5/1/2; Mutationen von Stich, Pfeilerhöhe, Neigung, Rundung und Mittelpunkt schlagen an.
- Nicht dabei: Kreuzgewölbe und Rippen, Spitz-/Hufeisenbogen, Pult- und Mansarddach, Gauben, Glätten mit Treppen (Ebene 3).

## Was Ebene 2, Teil 3c, jetzt kann (`src/ebene2/bauelemente.js`)
- **Formbindung im Paket:** ein Block kann `form` (`treppe`, `tuer`, `scheibe`, sonst `voll`) mit `richtung` (Treppe: Aufstiegsrichtung = Seite des Vollblocks; Tür: Himmelsrichtung) tragen; neue Rolle `glas`. `ebene2.platziere(welt, paket, palette, versatz)` wählt den Block je Rolle und Form aus der Palette und berechnet die Zustände (`weirdo_direction`, `minecraft:cardinal_direction`, `door_hinge_bit`, `upper_block_bit`) über die Drehregeln aus Ebene 0; der Vermesser dreht platzierte Treppen und Türen richtig mit.
- `bau.gang` (Länge, lichte Breite ≥ 1, lichte Höhe ≥ 2, Wandstärke; Gehhöhe ist y = 0, Boden darunter), `bau.treppe` (gerade, Stufenhöhe 1, Aufstieg nach Norden), `bau.wendeltreppe` (Stufen auf einem geschlossenen 4-zusammenhängenden Ring aus dem Rand der Kreisscheibe; **Stufen pro Umdrehung = Ringlänge, wächst mit dem Radius**, mindestens 8, Drehsinn wählbar, über jeder Stufe 2 Blöcke frei), `bau.tuer` (1 oder 2 Flügel, 2 Blöcke hoch), `bau.fenster` (Scheiben im Rahmen), `bau.saeule` (Schaft als Zylinder aus 3a, Sockel und Kapitell je 0,1 × Höhe, mindestens 1 Block, 1 Block Überstand).
- Regeln: `data/regeln/bauelemente.json` (6 Regeln, 5 `simuliert`, `bau.zustaende` `ungeprüft`). Tests mit Ebene 1: Spieler, Dorfbewohner und Baby gehen Gang, Treppe (bis 64 Stufen) und Wendeltreppe (Radius 1–12, beide Drehsinne, ohne Sprung) und die Tür (Holz ja, Eisen nein); Mutationen von Stufenhöhe, Ganghöhe, Türhöhe, Mindeststufen und Säulenproportion schlagen an.
- **Annahmen:** Tür-Himmelsrichtung legt die Lage der Türplatte so fest wie angenommen (Testanleitung in `docs/spieltests.md`); Scharnier rechts = `door_hinge_bit` true; Scheiben bekommen keine Verbindungszustände (das Spiel rechnet sie beim Bauen). Ebene 1 sucht Wege standardmäßig nur 64 Blöcke weit: für lange Treppen `{ radius: 200 }` übergeben.
- Nicht dabei: Rampen, Leitern, Falltüren, Zauntore, Halbstufen als Form, Balkone, Mauerwerk-Muster, Material/Stil (Ebene 3).

## Was Ebene 2, Teil 3d-1, jetzt kann (`src/ebene2/technik.js`)
- **Technikblöcke im Paket:** ein Block mit `technik: true` trägt feste `id` und `zustand` (keine Rolle, keine Form); nur das Fundament darunter ist verkleidbar (Rolle `boden`). `platziere` setzt Technikblöcke unverändert. Schienenformen kommen aus `schienen.formAus` (Ebene 1), nicht aus Zahlen im Code.
- `tech.antriebsstrecke`: `abschnitte` × (1 Antriebsschiene mit Redstone-Block darunter + `abstand` normale Schienen). **Technik skaliert über Anzahl.** `abstand` höchstens **7** normale Schienen (Jonahs Messung: jede 8. Schiene angetrieben ist sicher; Ebene 1 zeigt: bei 8 normalen Schienen ist der Auslauf von 7,5 Blöcken überschritten). `tech.steigung`: Rampe 1–5 Blöcke (bis zur gemessenen Höhe), erste Schiene und Ausgang angetrieben, höchstens jede zweite Schiene ohne Antrieb. `tech.kurve`: 90°-Kurve nach Osten oder Westen mit Schenkeln aus Antriebsschienen, Kurvenschiene normal, Abstand ≥ 1 und ≤ 7.
- Regel `tech.bahn` (`data/regeln/technik.json`, `simuliert`, nichts `ungeprüft`): nutzt nur von Jonah geprüfte Werte aus `lore.json`. Tests mit Ebene 1: Lorenbahn `lore.bahn` läuft lückenlos, `lore.analysiere` ohne Befund, `antrieb.aktive` und `aktiviere` bestätigen das Antriebsbit im Paket, Prüfer ohne Verstoß, Steigung in allen vier Himmelsrichtungen (Vermesser); Mutationen von Abstand, Rampenabstand und Rampenhöhe schlagen an.
- Nicht dabei: Bahnhof, Weiche, Kreuzung, Detektor-/Aktivierungsschiene, Überdachung der Bahn, Verlegen von A nach B (Ebene 3).

## Bekannte Lücken / Annahmen in Ebene 1
- Reihenfolge innerhalb eines Spielticks, Überlauf bei mehr als 100 geplanten Ticks, Form des Tickbereichs (Quadrat) und Wirkung von randomTickSpeed sind nicht dokumentiert → `ungeprüft`.
- Simulationsdistanz des Aternos-Servers: 4 Chunks (Jonah, `data/server.json`); die Form des Tickbereichs (Quadrat) bleibt eine Annahme.
- Prüfer: Was Fackel/Schiene hält, ist für Glasblock, Halbstufe, Treppe, Zaun und Glasscheibe von Jonah getestet (20.10.2026, als Fakt in Ebene 0: `fackelOben`, `fackelSeiten`, `schiene`). Alle anderen Formen (Mauer, Falltür, Laub, Eis, Trichter …) bleiben unbekannt → Hinweis statt Verstoß. Dass alle Varianten einer Form gleich reagieren (z. B. jede Holzart), ist eine Annahme.

## Bekannte Lücken / Annahmen in Ebene 0 (alles `ungeprüft`)
- Eigenschaften (Vollblock, durchsichtig, Licht …) sind eine **kuratierte Teilmenge**; unbekannt = `null` bzw. Standardwert, siehe `docs/daten.md`.
- Drehregeln **geprüft** (Jonah, 20.10.2026): `facing_direction`, `weirdo_direction`, `minecraft:cardinal_direction` + `door_hinge_bit` (Türen), `torch_facing_direction` (außer `top`), `multi_face_direction_bits`, `rail_direction` (Test 4 wiederholt).
  Noch offen: `minecraft:corner` (Zustand wirkt per Befehl im Spiel nicht), Schild, Ranken, Hebel, Wandkoralle.
- Drehregeln (Rest): Bedeutung der Zahlenwerte (`weirdo_direction`, `rail_direction`, `facing_direction`, Ranken-/Lichen-Bits, Schild, Wandkoralle)
  ist mit Wiki-Seite je Regel belegt (in `data/drehregeln.json`). **Nicht** gedreht werden `direction`, `rotation`, `huge_mushroom_bits`
  (Zuordnung nicht belegt); `minecraft:sixteen_way_rotation` ist nur analog zum Schild angenommen; `minecraft:corner`-Spiegeln ist Annahme (Spieltest 3).
- Drehen/Spiegeln wirft einen Fehler, wenn ein Block einen Richtungszustand nicht angibt (statt still falsch zu drehen).
- Blockinhalt-Plätze: Regale (`*_shelf`) fehlen noch (Platzanzahl nicht belegt).
- Baby-Hitbox: Mojang gibt Box und Skalierung getrennt an (Dorfbewohner v2: 0,98 × 1,96 mit Skalierung 0,5); Spieltest 6: Baby passt durch 1 Block Höhe, die Skalierung wirkt also auf die Box; der genaue Wert ist nicht gemessen.
- 12 Wesen ohne Hitbox in den Mojang-Daten (`null`).
- Offizielle Mojang-Daten sind „All rights reserved“ (EULA): im Repo liegen nur abgeleitete Fakten, keine Rohkopien.

## Nächster Schritt
**Ebene 2, Teil 3d-2: Handelsnische, Lager (Trichterreihe in Fässer), Sortierer** mit Testszenario in Ebene 1 (Dorfbewohner, Trichter, Redstone). Danach 3d-3 (Bahnhof, Entladestelle, Brüter) und Ebene 3 (Planung).
Nebenbei: Jonah macht die offenen Lore-Tests (Abstand 9, Rampen über 5 Blöcke, Rampe mitten in der Antriebsstrecke) aus `docs/spieltests.md`.
Optional: weitere Spieltests (Schild, Ranken, Hebel, Wandkoralle) erst, wenn ein Baustein sie braucht.

## Offene Entscheidungen
- Desktop-Umsetzung: eigene Desktop-App oder als Desktop-Fenster installierte Webseite (spätestens vor Schritt 6 klären).
- Zitadelle-Bilder (14) legt Jonah in `docs/zitadelle/bilder/` ab.
- Pull Requests #1 (Ebene 0) und #2 (Ebene 1, Unterbau) sind gemergt.

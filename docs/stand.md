# Stand – Blockwerk

Zuletzt aktualisiert: 20.10.2026

## Ausgangslage
- **Neubeginn.** Der frühere M0/M1-Prototyp (ZIP) ist verworfen und wird **nicht** übernommen. Blockplan (claude.ai-Artifact) ist ebenfalls abgelöst.
- Grundlage ist ausschließlich das bestätigte Ebenenmodell in `docs/ebenen.md` und die Entscheidungen in `docs/entscheidungen.md`.
- Schritt 0 und Schritt 1 sind gebaut (PR #1 gemergt). Ebene 1, Teil 2a (Unterbau) ist gebaut und gemergt (PR #2). Teil 2b-1, Schienen (Form und Verbindung), ist gemergt (PR #3). Teil 2b-2, Schienen-Antrieb, ist gebaut (PR #4). Teil 2c, Wasser und Lava, ist gemergt (PR #5/#6). Teil 2d-1, Licht, ist gebaut: Branch `claude/ebene-1-licht`. 174 Tests, alle grün (`npm test`).
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
| 2d-1 | Ebene 1 – Licht: Blocklicht und Himmelslicht mit Minimum/Maximum bei unbekannten Filtern | **fertig, Status `simuliert`** (Annahmen `ungeprüft`; PR wartet auf Abnahme) |
| 2d-2 | Ebene 1 – Spawnstellen: wo können Monster spawnen (Licht, Boden, Platz), Prüfer „Spawn möglich“ | **als Nächstes** |
| 2e… | Ebene 1 – weitere Mechaniken, je ein PR: Lorenbewegung (braucht Jonahs Messungen, `docs/messungen-lore.md`), fallende Blöcke, Trichter & Blockinhalte, Redstone, Wesen (Reihenfolge entscheidet Jonah) | **als Nächstes** |
| 3 | Ebene 2 – Bausteine: Formen (maßstabsfrei, Rundheits-/Symmetrietests r = 1–128), Bauelemente, erste Technikmodule mit Testszenario | offen |
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
- Noch **nicht** da: Antrieb (8 Schienen weit, nur C-Tick), Lorenbewegung, Geschwindigkeit.

## Was der Schienen-Antrieb (Teil 2b-2) jetzt kann (`src/ebene1/antrieb.js`)
- `aktive(welt, stromQuellen)`: welche Antriebsschienen sind aktiv? Direkt versorgt durch einen angrenzenden Redstone-Block (oder eine von außen übergebene Stromquelle), dazu verbundene Antriebsschienen bis 8 Schienen weit (17 bei Quelle in der Mitte); normale Schienen und Lücken unterbrechen.
- `aktiviere(welt, …)` setzt `rail_data_bit`; `mechanik()` ist eine Taktgeber-Mechanik der Tickart `mechanismus` und schaltet damit **nur im C-Tick** (Bedrock-dokumentiert).
- Prüfer-Hinweis `pruefer.antrieb-ohne-quelle` (nur wenn die Stromquellen übergeben werden).
- Schienen in Chunks außerhalb des Tickbereichs schalten nicht (der Taktgeber gibt den Tickbereich an die Mechanik weiter).
- **Wasser/Lava-Logik entspricht Java (Gefälle-Zählung, Abklingen, „unten vor seitlich“, Plus-Form):** Jonah bestätigt am 21.10.2026 aus Erfahrung, dass Bedrock sich gleich verhält (kein gezielter Spieltest, deshalb weiter `ungeprüft`).
- `pruefe()` läuft bei jeder Welt mit Wasser/Lava bis zu 400 Simulationsticks (Kosten wachsen mit der Wassermenge).
- Bekanntes Limit: `aktive()`/`aktiviere()` gehen bei jedem C-Tick über alle Blöcke der Welt (sortiert). Für Zitadelle-Größe (ca. 3,9 Mio. Blöcke) später Schienen je Chunk indexieren.
- Regeln: `data/regeln/antrieb.json` (4 Regeln, 3 mit Annahmen und Testanleitung). Reichweite 8 und „nur verbundene geben Strom weiter“ sind nicht als Bedrock belegt.
- **Keine Lorenphysik:** Bedrock nennt dazu keine Zahlen. Jonahs Messungen A–F (`docs/messungen-lore.md`) sind die Grundlage für Schritt 2b-3.

## Was Wasser und Lava (Teil 2c) jetzt können (`src/ebene1/fluessigkeit.js`)
- Als Taktgeber-Mechanik über geplante Ticks: Wasser 7 Blöcke weit, 1 Block alle 5 Ticks; Lava Oberwelt 3 Blöcke / 30 Ticks, Nether 7 Blöcke / 10 Ticks. Darstellung mit `liquid_depth` (0 Quelle, 1–7 Fluss, ab 8 fallend).
- Fließt nach unten ohne Grenze, sucht Gefälle in bis zu 4 Blöcken, bildet neue Wasserquellen (2 Quellen), Lava nie; Mischen: Obsidian, Bruchstein, Stein; spült Fackeln, Schienen, Teppiche, Redstone-Staub, Pflanzen u. a. weg (Ebene-0-Eigenschaft `fluessigkeit`); Abklingen ohne Nachschub.
- `simuliere(welt)` läuft in einer Kopie bis zum stabilen Zustand. Prüfer `pruefer.wasser-zerstoert`: Verstoß mit Koordinate für alles, was weggespült wird; Hinweis bei Wasser-Lava-Mischungen.
- Regeln: `data/regeln/fluessigkeit.json` (11 Regeln, 2 belegt, 9 mit Annahmen und Testanleitung). Vieles ist im Wiki nicht als Bedrock gekennzeichnet.
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
**Schritt 2d-2: Spawnstellen** (aufbauend auf dem Licht): wo können Monster spawnen (Blocklicht 0, Himmelslicht unter 7, Boden mit voller Oberseite, Platz für die Hitbox); Prüfer „Spawn möglich“ für Innenräume. Danach fallende Blöcke oder Trichter & Blockinhalte – Jonah entscheidet. Lorenbewegung erst nach Jonahs Messungen. Detektor-/Aktivierungsschiene folgen mit der Redstone-Mechanik.
Nebenbei: Jonah macht die Antriebs-Tests und Messungen aus `docs/spieltests.md` und `docs/messungen-lore.md`.
Optional: weitere Spieltests (Schild, Ranken, Hebel, Wandkoralle) erst, wenn ein Baustein sie braucht.

## Offene Entscheidungen
- Desktop-Umsetzung: eigene Desktop-App oder als Desktop-Fenster installierte Webseite (spätestens vor Schritt 6 klären).
- Zitadelle-Bilder (14) legt Jonah in `docs/zitadelle/bilder/` ab.
- Pull Requests #1 (Ebene 0) und #2 (Ebene 1, Unterbau) sind gemergt.

# Stand – Blockwerk

Zuletzt aktualisiert: 20.10.2026

## Ausgangslage
- **Neubeginn.** Der frühere M0/M1-Prototyp (ZIP) ist verworfen und wird **nicht** übernommen. Blockplan (claude.ai-Artifact) ist ebenfalls abgelöst.
- Grundlage ist ausschließlich das bestätigte Ebenenmodell in `docs/ebenen.md` und die Entscheidungen in `docs/entscheidungen.md`.
- Schritt 0 und Schritt 1 sind gebaut (Branch `claude/changes`, Pull Request Thalrail/Blockwerk#1, wartet auf Abnahme). 77 Tests, alle grün (`npm test`).
- Spieltests 1–8 von Jonah am 20.10.2026 ausgewertet: 6 Drehregeln stehen auf `geprüft`, Rest `ungeprüft` (siehe `docs/spieltests.md`).

## Bauplan (Reihenfolge nach Ebenen, von unten nach oben)
| Schritt | Inhalt | Status |
|---------|--------|--------|
| 0 | Projektgerüst: Ordnerstruktur je Ebene, `package.json` (nur `npm test`, Node 22, keine Abhängigkeiten), GitHub Actions für Tests, README mit Faithful-Nennung | **fertig** (wartet auf PR-Abnahme) |
| 1 | Ebene 0 – Fundament: Koordinaten/Richtungen, Blockregister Bedrock 1.26.50 (Daten), Wesenregister, Voxelwelt in Chunks, Blockinhalte, Vermesser (Verschieben/Drehen/Spiegeln mit facing), Speichern/Laden | **fertig, Status `entworfen`** (Tests bestanden; Drehregeln teils `geprüft` (6 von 19), Eigenschaften noch `ungeprüft`, siehe unten; `simuliert` gibt es erst mit Ebene 1) |
| 2 | Ebene 1 – Uhrwerk: Taktgeber (Spieltick, P-/C-Tick), Regelwerk als Daten mit Quelle/Status, Prüfer; dann Mechaniken schrittweise (Schienen, Wasser, Licht, Redstone, Trichter, Wesen) | **als Nächstes** |
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

## Bekannte Lücken / Annahmen in Ebene 0 (alles `ungeprüft`)
- Eigenschaften (Vollblock, durchsichtig, Licht …) sind eine **kuratierte Teilmenge**; unbekannt = `null` bzw. Standardwert, siehe `docs/daten.md`.
- Drehregeln **geprüft** (Jonah, 20.10.2026): `facing_direction`, `weirdo_direction`, `minecraft:cardinal_direction` + `door_hinge_bit` (Türen), `torch_facing_direction` (außer `top`), `multi_face_direction_bits`.
  Noch offen: `rail_direction` (Test 4 wiederholen), `minecraft:corner` (Zustand wirkt per Befehl im Spiel nicht), Schild, Ranken, Hebel, Wandkoralle.
- Drehregeln (Rest): Bedeutung der Zahlenwerte (`weirdo_direction`, `rail_direction`, `facing_direction`, Ranken-/Lichen-Bits, Schild, Wandkoralle)
  ist mit Wiki-Seite je Regel belegt (in `data/drehregeln.json`). **Nicht** gedreht werden `direction`, `rotation`, `huge_mushroom_bits`
  (Zuordnung nicht belegt); `minecraft:sixteen_way_rotation` ist nur analog zum Schild angenommen; `minecraft:corner`-Spiegeln ist Annahme (Spieltest 3).
- Drehen/Spiegeln wirft einen Fehler, wenn ein Block einen Richtungszustand nicht angibt (statt still falsch zu drehen).
- Blockinhalt-Plätze: Regale (`*_shelf`) fehlen noch (Platzanzahl nicht belegt).
- Baby-Hitbox: Mojang gibt Box und Skalierung getrennt an (Dorfbewohner v2: 0,98 × 1,96 mit Skalierung 0,5); Spieltest 6: Baby passt durch 1 Block Höhe, die Skalierung wirkt also auf die Box; der genaue Wert ist nicht gemessen.
- 12 Wesen ohne Hitbox in den Mojang-Daten (`null`).
- Offizielle Mojang-Daten sind „All rights reserved“ (EULA): im Repo liegen nur abgeleitete Fakten, keine Rohkopien.

## Nächster Schritt
**Schritt 2: Ebene 1 – Taktgeber und Regelwerk** (Spieltick, P-/C-Tick, geplante Ticks, Regeln als Daten mit Quelle/Status, Prüfer).
Vorher/nebenbei: Jonah wiederholt Test 4 (Schienen) laut `docs/spieltests.md`.

## Offene Entscheidungen
- Desktop-Umsetzung: eigene Desktop-App oder als Desktop-Fenster installierte Webseite (spätestens vor Schritt 6 klären).
- Zitadelle-Bilder (14) legt Jonah in `docs/zitadelle/bilder/` ab.
- Pull Request #1 ist offen (Thalrail/Blockwerk); Abnahme durch Jonah steht aus.

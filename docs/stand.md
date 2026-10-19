# Stand – Blockwerk

Zuletzt aktualisiert: 19.10.2026

## Ausgangslage
- **Neubeginn.** Im Repo gibt es noch keinen Programmcode, nur die Planung (`CLAUDE.md`, `docs/`).
- Der frühere M0/M1-Prototyp (ZIP) ist verworfen und wird **nicht** übernommen. Blockplan (claude.ai-Artifact) ist ebenfalls abgelöst.
- Grundlage ist ausschließlich das bestätigte Ebenenmodell in `docs/ebenen.md` und die Entscheidungen in `docs/entscheidungen.md`.

## Bauplan (Reihenfolge nach Ebenen, von unten nach oben)
| Schritt | Inhalt | Status |
|---------|--------|--------|
| 0 | Projektgerüst: Ordnerstruktur je Ebene, `package.json` (nur `npm test`, Node 22, keine Abhängigkeiten), GitHub Actions für Tests, README mit Faithful-Nennung | **als Nächstes** |
| 1 | Ebene 0 – Fundament: Koordinaten/Richtungen, Blockregister Bedrock 1.26.50 (Daten), Wesenregister, Voxelwelt in Chunks, Blockinhalte, Vermesser (Verschieben/Drehen/Spiegeln mit facing), Speichern/Laden | offen |
| 2 | Ebene 1 – Uhrwerk: Taktgeber (Spieltick, P-/C-Tick), Regelwerk als Daten mit Quelle/Status, Prüfer; dann Mechaniken schrittweise (Schienen, Wasser, Licht, Redstone, Trichter, Wesen) | offen |
| 3 | Ebene 2 – Bausteine: Formen (maßstabsfrei, Rundheits-/Symmetrietests r = 1–128), Bauelemente, erste Technikmodule mit Testszenario | offen |
| 4 | Ebene 3 – Planung: Konstrukteur, Grobdesigner, Techniker, Architekt, Designer, Bauleiter, Einwand-Protokoll, Baubericht | offen |
| 5 | Ebene 4 – Leser: Spezifikationsschema, Spezifikations-Prüfer, Briefing-Prompt, Bildmessung | offen |
| 6 | Ebene 5 – Oberfläche: Desktop, Kompakt-/Vollmodus, 3D-Ansicht, Schichtpläne, Materialliste, Baubericht, Faithful-Texturen | offen |
| 7 | Prüfstein Zitadelle + Spieltest-Schleife | offen |

## Nächster Schritt
Schritt 0 (Projektgerüst) und danach Schritt 1 (Ebene 0) beginnen.
Vorher Jonah den Plan zeigen: Ordnerstruktur, Datenformat des Blockregisters, Herkunft der Bedrock-1.26.50-Daten (offizielle Mojang-Quelle mit Link).

## Offene Entscheidungen
- Desktop-Umsetzung: eigene Desktop-App oder als Desktop-Fenster installierte Webseite (spätestens vor Schritt 6 klären).
- Zitadelle-Bilder (14) legt Jonah in `docs/zitadelle/bilder/` ab.

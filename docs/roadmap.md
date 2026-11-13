# Roadmap: vom Prüfstein Zitadelle zum universellen Bauplaner

Beschlossen von Jonah am 13.11.2026 (Vision und Reihenfolge). Hintergrund: Bestandsanalyse im Chat vom selben Tag. Diese Datei wird nicht automatisch geladen.

## Produktvision
Blockwerk ist ein **universeller Minecraft-Bedrock-Bauplaner**, kein Zitadellen-Planer. Die Zitadelle bleibt komplexes Referenzprojekt und Belastungstest, bestimmt aber nicht allein die Prioritäten.

Ein Benutzer entwirft aus Bildern und Text beliebige Bauwerke: Abmessungen, Architektur, Stil, Materialien und optional Technik (Redstone, Lorenbahnen, Farmen, Dorfbewohner-Systeme). Optional fließen Seed, Version, Dimension, Baukoordinaten und Gelände ein. Danach bearbeitet er den Entwurf selbst (Blöcke ändern, Materialien tauschen, Bauteile verschieben, Bauabschnitte festlegen). Daraus entstehen exakte Block-für-Block- und Schicht-für-Schicht-Anleitungen, Materiallisten und Fortschrittsanzeigen; mehrere Spieler bauen gemeinsam. **Gebaut wird von Menschen im Spiel, nie automatisch eingefügt.**

## Stand gegen die Vision (13.11.2026)
- **Weitgehend da:** Schichtpläne, Material, Fortschritt, Kompaktmodus, 3D mit Texturen, Teilen und Live-Abhaken.
- **Teilweise:** Eingabe (nur Claude-Chat, Bildmessung nicht kalibriert), Stile (3 Stimmungen, 15 Bausteine), Technik (Lorenstrecke, Handelsnische, Lorenbahn-Nische, Sortierlager; Rest nur Anfragen), Mehrspieler (Live-Dienst, keine mehreren Pläne je Raum).
- **Fehlt:** Gelände, Seed, Dimension, Version als Eingabe; Bearbeiten von Blöcken und Bauteilen in der Oberfläche; Eingabe ohne KI.
- **Mögliche Zitadellen-Kopplung (zu prüfen):** feste Teilarten und Lagebeziehungen, Teile als getrennte Kästen ohne `innen`, Verbindungen nur gerade, kein allgemeiner Quader/Raum/Wand-Baustein gefunden, nur 54 Blöcke mit Textur, Planung 135 s für 65.000 Blöcke (Prüfer über die ganze Welt).

## Phase 0: Abschluss der Infrastruktur
Offene PRs mergen, danach keine weiteren Sicherheitsrunden. Vision in der Doku festhalten (diese Datei).

## Phase 1: Grundlagen für ein beliebiges einfaches Bauwerk
1. **Haus-Sonde (erledigt 13.11.2026, `docs/haus-sonde.md`):** Das Wohnhaus lässt sich mit den vorhandenen Bausteinen nur als offener Tunnel beschreiben; erstes Implementierungspaket **`bau.raum` mit Tür und Fenstern umgesetzt (13.11.2026, `simuliert`, Spieltest offen)**; **zweites Paket Dach bündig mit geschlossenem Giebel (`deckend`, `giebel`) umgesetzt**; nächste Pakete: `innen` und Treppe über Geschosse, Bauelemente ohne Rand, Dachüberstand. Dritter Referenzbau (Burgmauer oder Turm mit Zinnen): später, Auswahl offen.
2. Spezifikation erweitern: Quader, Raum und Wand als Bausteine, `innen`, Öffnungen in Wänden, Etagen und Treppen, freie Abmessungen; Vokabular bleibt Daten.
3. Eingabe ohne KI: Assistent (Abmessungen, Stil, Material, Funktionen) schreibt dieselbe Spezifikation; der Leser wird optional.
4. Stile und Paletten als Daten, mehr Blöcke und Texturen nach Bedarf.
5. Bearbeitungsmodell B (Hybrid), **beschlossen am 13.11.2026** (`docs/entscheidungen.md`): Blockänderungen relativ zum Bauteil, Neuprüfung bei Technikänderung, versionierte Planfassung, Verwaistes entscheidet der Benutzer; Link-Grenze dokumentiert. Voraussetzung: stabile Teil-Kennungen (die Nummern T1, T2 … taugen nicht; Kandidat: Spezifikations-Id, im Arbeitspaket zu prüfen). Umsetzung erst im eigenen Arbeitspaket.
6. Planung beschleunigen: Prüfer nur für Abschnitt und Nachbarn (ändert das Prüfverhalten, nur mit Jonahs Freigabe).
7. Spieltest-Schleife in der Oberfläche und erste echte Bauetappe in Bedrock.

## Phase 2: Bearbeiten und Ort
Block-, Material- und Bauteil-Editor mit Fixierungen, freie Bauabschnitte, Rückgängig, Originalformen im 3D-Bild, Zoom im Plan. Gelände über Messpunkte/Höhenkarte, Fundament und Terrassierung, Baukoordinaten in den Anleitungen. Weitere Technikmodule (Farmen, Redstone-Türen, Brüter nach Klärung der Brutkammer); jedes Modul erst nach Jonahs Spieltest `geprüft`. Mehrspieler: mehrere Pläne je Raum, Test gegen den echten Cloudflare-Dienst.

## Phase 3: langfristig
Dimensionen (Nether, End) und Versionswechsel als Daten. **Seed:** Der Bedrock-Weltgenerator wird nicht nachgebaut; Gelände kommt über Messpunkte oder Import. Eigene Texturpakete, API-Anbindung des Lesers, Rohstoff-Zerlegung, optionaler Export (`.mcstructure`, nachrangig).

## Dauerhafte Grenzen
Jede neue Technik braucht einen Spieltest von Jonah; Testanleitungen gehören in die Oberfläche. Ohne Eingrenzung der Prüfer ist flüssiges Bearbeiten nicht möglich. Ein Assistent ohne KI-Umweg ist wichtiger als weitere Technikmodule.

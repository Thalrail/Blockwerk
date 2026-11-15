# Roadmap v2: Desktop-Anwendung, 3D-Editor, Gelände, Architekturqualität

Beschlossen von Jonah am 15.11.2026 (Entscheidungen A bis E, siehe `docs/entscheidungen.md`). Baut auf `docs/roadmap.md` (Produktvision) auf und ersetzt sie nicht. Diese Datei wird nicht automatisch geladen. Das Ebenenmodell bleibt unverändert; wo ein Paket es berührt, steht es beim Paket.

## Leitplanken
- Jedes Paket: eigener Branch `claude/<name>`, eigener Auftrag über `/blockwerk-auftrag`, vollständige Tests, Codex-Review, keine Parallelarbeit am selben Branch. Kein automatischer Merge nach `main`.
- Reihenfolge der ersten Pakete: **D1**, dann T1 und R1 (zunächst nur vorbereitet), D2 erst nach D1.
- Die Web-Version (GitHub Pages, ohne Build) bleibt erhalten. Die Engine (Ebene 0 bis 4) bekommt keine neue Abhängigkeit.
- **Trennung von Darstellungsqualität und Architekturqualität (verbindlich):**
  - *Architekturqualität* ist eine Eigenschaft der berechneten Blöcke (Plan). Sie wird nur an den Blockdaten gemessen (Gestaltungsprüfer, Ebene 3), nie am Renderbild. Pakete: D-Reihe.
  - *Darstellungsqualität* ist eine Eigenschaft der Zeichnung (Ebene 5: Licht, Ambient Occlusion, Formen von Treppen und Platten, Transparenz). Sie wird nur am Netz gemessen und ändert nie Blöcke. Pakete: R-Reihe.
  - Ein Bericht über „wirkt klobig“ nennt immer, zu welcher der beiden gehört. Rendering-Verbesserungen dürfen keine Architekturmängel verdecken und keine Metrik der D-Reihe beeinflussen.

## Befund Turm (15.11.2026)
Ein Turm (`form.zylinder` 13 × 13 × 34, Stimmung „hell-nordisch“) besteht aus 34 gleichen Ringen zu 36 Blöcken aus einem einzigen Material: kein Dach, Boden, Tür, Fenster, Sockel oder Krone. Ursache ist die Geometrie (konstanter Querschnitt, keine Gliederung, 5 Rollen), nicht das Rendering (verstärkend: feste Schattierung, Vollwürfel statt Treppen und Platten).

## Phase 1: Absichern und Sichtbares
| Paket | Inhalt | Test |
|---|---|---|
| **D1** Gestaltungsprüfer | Metriken auf den Blockdaten (Ebene 3): Anzahl Materialien, Öffnungsanteil, längste glatte Fläche, Silhouettenvariation, Höhenprofil; Basiswerte für Turm und Haus festhalten, nur messen, nichts ändern | automatisch, deterministisch |
| T1 Tauri-Machbarkeitstest | Hülle in `desktop/`, vorhandene Seite unverändert, Installer per GitHub Actions; Entscheidung erst nach Installation auf Jonahs PC | Handtest durch Jonah |
| R1 Freiflug-Kamera | Zweiter Kameramodus, Pointer Lock, WASD, Schalter Orbit/Freiflug; rein berechnete Kamera in `kamera.js` | Kameratests, Handtest |
| D2 Bausteinrezepte (nach D1) | Rezeptsystem (siehe unten), erstes Rezept Turm | Metriken von D1, Regressionstest bestehender Bauwerke |
| G0 Weltimport: Untersuchung | Format, Zugang, Machbarkeit in reinem JS (siehe unten), Ergebnis als Bericht und Prototyp-Spike | Bericht |

## Phase 2: Fundament
R2 Chunk-Netz und Netzbau im Worker (Benchmark mit großem Bauwerk) · R3 Strahl-Auswahl, Anbindung an die Zellenwahl · D3 Gliederungsbausteine (Gesims, Lisene, Zinnen, Dachüberstand) und neue Rollen mit Rückfall · D4 Haus-Rezept · G1 Gelände-Datei (Format, Messpunkte-Eingabe, Höhenkarte, Spezifikationsfeld, Seed, Version, Dimension als Metadaten) · U1 Design-System (Farben, Abstände, Typografie) und Ordnung der Oberfläche.

## Phase 3: Gelände und Ausbau
G2 Fundament, Terrassierung, Platzprüfung aus der Höhenkarte · G3 Weltimport-Reader (nach G0) · R4 Ambient Occlusion, echte Treppen/Platten/Scheiben, Glas · D5 Materialkombinationen, deterministische Verwitterung, weitere Stile · T2 Updater, Dateizuordnung, Signierung · U2 Feinschliff in der Desktop-Hülle.

## Phase 4
Dimensionen (Nether, End) und Versionswechsel als Daten; Hilfen rund um Seeds (Verweis auf externe Seed-Karten).

## Bausteinrezepte (Entscheidung E)
Bedingungen von Jonah, verbindlich:
- Die Spezifikation beschreibt weiterhin nur WAS; sie nennt nie Blöcke, Koordinaten oder Rezeptschritte.
- Der Architekt (Ebene 3) komponiert vorhandene und neue Ebene-2-Bausteine.
- Das System ist universell und erweiterbar (Turm, Haus, Mauer, Halle, Brücke …), Rezepte sind **Daten**, nicht Code im Architekten.
- Bestehende Bauwerke ändern sich nicht unbeabsichtigt: ein Rezept greift nur, wo die Spezifikation es ausdrücklich wählt oder die Teilart es ausdrücklich zuweist; für Bestandsspezifikationen gilt ein Regressionstest (byte-identischer Plan). Wie die Zuweisung versioniert wird, klärt D2 (Vorschlag an Jonah, bevor es das Bestandsverhalten berührt).
- Reproduzierbar (gleiche Eingabe = gleicher Plan), testbar (Gestaltungsprüfer aus D1) und **kompatibel mit manuellen Änderungen** (Einzelblockänderungen hängen an stabilen Bauteil-Kennungen der Komposition, Verwaistes wird wie bisher gemeldet).

## G0: Untersuchung des Bedrock-Weltimports (früh, Jonah-Priorität)
Ergebnis der ersten Recherche (Quellen unten, aus Dritt- und Gemeinschaftsdokumentation; vor dem Bau gegen die aktuelle Wikiseite und echte Dateien prüfen):
- **Zugang:** Aternos bietet auf `aternos.org/worlds` je Welt „Download“ als Zip. Bei Bedrock kann das eine `.mcworld`-Datei sein (ebenfalls ein Zip). Die PS5 selbst bietet keinen Export, die Welt liegt aber auf dem Aternos-Server, nicht auf der Konsole.
- **Format:** Bedrock speichert Weltdaten in einer (modifizierten) LevelDB im Ordner `db`; `level.dat` ist unkomprimiertes NBT in Little Endian. Jeder 16×16×16-Abschnitt (Subchunk) liegt unter einem eigenen Schlüssel (Chunk-X, Chunk-Z, Dimension, Tag, Subchunk-Y), Zahlen Little Endian, Blockpalette je Subchunk. Nicht veränderte oder nie erzeugte Chunks sind nicht gespeichert.
- **Machbarkeit ohne Abhängigkeiten:** Ein eigener Leser in reinem JS ist möglich (LevelDB-Tabellen und Log lesen, Kompression, Palette), aber aufwendig und versionsabhängig. Bestehende Werkzeuge (z. B. Amulet, Rust- und Go-Bibliotheken) gibt es, sind aber für uns nur Vergleichswerkzeuge (neue Abhängigkeit nur nach Rückfrage).
- **Plan:** (1) Jonah exportiert eine kleine Testwelt (Anleitung: `docs/anleitung-weltexport.md`). (2) Spike: Schlüssel auflisten, einen Subchunk dekodieren, eine Höhenkarte für einen Ausschnitt bilden. (3) Entscheidung über Umfang (nur Höhenkarte und Oberflächenblock zuerst). (4) Reader als Werkzeug außerhalb der Engine; die Engine sieht nur die Gelände-Datei (G1).
- Kein eigener Weltgenerator. Das Gelände ist eine Eingabe (WAS), versioniert, im Abdruck.

Quellen: [Aternos: Download your world](https://support.aternos.org/hc/en-us/articles/360027235711-Download-your-world), [Bedrock Edition level format (Spiegel)](https://wikivg.booky.dev/Bedrock_Edition_level_format), [Subchunk-Format (Lodestone)](https://team-lodestone.github.io/Documentation/Bedrock/LevelDB_Output_Array_Formats/Subchunk_Format).

## Produktziel Oberfläche (verbindlich)
Eine moderne, übersichtliche Benutzeroberfläche ist ein verbindliches Produktziel, kein Nebenprodukt: einheitliches Design-System (U1), klare Gliederung der Bildschirme, Kompaktmodus aus der Entfernung lesbar, Desktop-Hülle (T1, T2). Abnahme durch Jonah am Bildschirm.

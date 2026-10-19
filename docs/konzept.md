# Bauplan-Engine – Konzept v1 (Stand 18.10.2026)

> **Hinweis (19.10.2026):** Dieses Dokument ist Hintergrund. Wo es von `docs/ebenen.md` oder `docs/entscheidungen.md`
> abweicht, gelten diese beiden. Überholt sind insbesondere: Abschnitt 3 (Rangfolge und Fachleute – gültig ist Ebene 3
> in `ebenen.md`, inkl. Grobdesigner) und Abschnitt 6 (statt TypeScript/three.js gilt: reines JavaScript ohne
> Abhängigkeiten, ohne Build) und Abschnitt 7 (Meilensteine – gültig ist der Bauplan in `docs/stand.md`).
> Export als .mcstructure ist nachrangig, weil von Hand gebaut wird. Es wird komplett neu gebaut, kein alter Code.

## 1. Diagnose: Warum Blockplan v5 scheitern musste
Blockplan lässt eine KI Block für Block setzen. Eine Sprach-KI hat kein räumliches Gedächtnis und keine Physik: Sie kann "rund" beschreiben, aber nicht zuverlässig Koordinaten dafür liefern. Alle vier Fehler (Ausrichtung, Schienen/Kurven, Redstone, nur eckig/sparsam) haben dieselbe Wurzel: **Geometrie und Physik wurden geraten statt berechnet.** Jonahs Vorschlag (Algorithmen bauen, KI nur lesen) ist deshalb der richtige Kern.

## 2. Grundprinzip
Eine einzige KI-Stelle, alles andere deterministisch (gleiche Eingabe = gleiches Ergebnis, testbar, nachvollziehbar):

Text + Bilder -> [Leser: einzige KI-Stelle] -> Bauspezifikation (JSON, streng geprüft) -> Agenten (reine Algorithmen) -> Voxelwelt -> Prüfung -> Ausgabe (Schichtpläne, Materialliste, optional Export)

Die Bauspezifikation ist eine feste Sprache (Schema). Was nicht ins Schema passt, wird als Rückfrage an den Nutzer gestellt, nicht geraten.

## 3. Die Agenten als Module mit Vetorecht (überholt, siehe ebenen.md Ebene 3)
1. **Architekt** – Geometrie-Bibliothek: Kreis/Ellipse (lückenlos), Zylinder, Kegel, Kuppel (Abstandsfunktion), Gewölbe, Bogen, Wendeltreppe, Dachformen, Wandstärke und Innenräume. Prüft Rundheit, Symmetrie, Proportionen gegen die Vorlage.
2. **Techniker** – Regelwerk als DATEN, jede Regel mit Quelle und Teststatus. Bereiche: Schienen, Redstone (Bedrock ohne Quasi-Konnektivität), Wasser/Lava, Trichter, Lore/Mob-Verhalten (Dorfbewohner: Höhe, Sprung, Berufe, Betten, Golems), Licht/Spawn, Schwerkraft-Blöcke, Halt von Fackeln/Schienen/Türen. Zwei Teile: **Regelprüfer** (statisch) und **Simulatoren** (Schienenweg, Wasserfluss, Redstone-Logik, Erreichbarkeit, Lichtkarte). **Schaltungsbibliothek** (parametrische Module) + **Schaltungssucher** (wählt deterministisch aus der Bibliothek).
3. **Designer** – Paletten mit Farbregeln, Rauschen, Dekomuster, Licht. Darf keine Technik verändern.
4. **Konstrukteur** – Sinnabschnitte, Bauabfolge, Nähte, Begehbarkeit.
5. **Bauleiter** – erzwingt die Rangfolge, Gegenprobe, Rückfragen an Jonah.

**Verhandlungsprotokoll:** Vorschlag → Prüfung → maschinenlesbarer Einwand mit Koordinate → Parameteränderung → erneute Prüfung; höchstens N Runden, dann Rückfrage. Alles landet im Baubericht.

## 4. Ergänzungen
- **Vermesser/Transformationen** als Pflichtbaustein: Drehungen/Spiegelungen drehen facing-Werte mit (Trichter, Verstärker, Treppen, Schienenformen).
- **Prüfstand statt Hoffnung:** Jede Schaltung hat Teststatus; ungeprüfte Module werden deutlich markiert.
- **Golden Tests:** Rundheit, Symmetrie, Schienenverbindung, Wasserweite usw. als automatische Tests (GitHub Actions bei jeder Änderung).
- **Bildverarbeitung getrennt:** Farbpalette und Proportionen deterministisch messen; das Verstehen von Bildinhalten braucht ein Bildmodell (Leser).

## 5. Grenzen, jeweils mit Lösung
- **Bilder verstehen geht nicht ohne Modell.** Lösung: Briefing-Werkzeug (Prompt erzeugen → Claude-Chat → JSON zurückkopieren → strenge Prüfung). Später optional eigener API-Schlüssel.
- **Vollständige Bedrock-Redstone-Simulation** ist groß. Lösung: Stufenplan – erst Regelprüfer + Schienen/Wasser/Erreichbarkeit/Licht, dann Signalstärke und Logik für die Bibliotheksmodule, jeweils im Spiel bestätigt.
- **Schaltungssuche im Internet zur Laufzeit** wäre unzuverlässig. Lösung: Schaltungen werden beim Entwickeln recherchiert, geprüft und parametrisch in die Bibliothek gelegt.
- **Größe:** 161×161×150 ≈ 3,9 Mio. Blöcke – machbar mit Chunk-Arrays und abschnittsweiser Berechnung.
- **Texturen:** Faithful 32x (Bedrock) mit Lizenzpflichten, optional eigenes Paket.

## 6. Technik-Entscheidung (überholt, siehe entscheidungen.md)
Ursprünglich: TypeScript, three.js. Gültig: reines JavaScript (ES-Module), keine Abhängigkeiten, Tests mit `npm test`, GitHub Pages ohne Build.

## 7. Meilensteine (überholt, siehe docs/stand.md)
- M0 Fundament: Repo, CI, Voxelwelt, Blockregister, Drehungen, Export, einfacher Viewer.
- M1 Architekt: Geometrie-Bibliothek + Rundheits-/Symmetrietests.
- M2 Techniker v1: Regeldaten, Schienenplaner (Kurven, Steigung, Antrieb), Wasser, Licht, Erreichbarkeit; erste Schaltungsbibliothek (Nische, Sortierer, Bahnhof, Brüter).
- M3 Konstrukteur + Bauleiter: Abschnitte, Nahtprüfung, Verhandlungsprotokoll, Rückfragen.
- M4 Designer: Paletten, Rauschen, Dekomuster, Lichtgestaltung.
- M5 Leser: Spezifikationsschema, Briefing-Werkzeug, Bild-Messung.
- M6 Oberfläche und Politur, Beispielprojekte (Zitadelle als Referenz).
- M7 Spieltest-Schleife: Testwelt, Ergebnisse zurück in die Bibliothek.

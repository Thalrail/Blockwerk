# Ebenenmodell – Kurzfassung (verbindlich, bestätigt; Volltext: `docs/ebenen.md`)

Grundsatz: Jede Ebene baut nur auf tieferen auf. Höhere Ebenen ändern die Welt nur über Ebene 0. Einzige KI-Stelle ist der Leser (Ebene 4); alles andere ist deterministisch (gleiche Eingabe = gleiches Ergebnis).

## Ebene 0 – Fundament („Welt und Wahrheit“) – BESTÄTIGT
Kopie von Bedrock ohne Simulation und ohne Weltgenerator: Koordinaten (x Ost, z Süd, y oben, Chunk 16×16), Blockregister 1.26.50 (IDs, Zustände, reine Eigenschaften), Wesenregister (Hitboxen), Voxelwelt in Chunks (Blöcke, Wesen, Blockinhalte), Vermesser (verschieben, drehen, spiegeln; facing dreht mit), verlustfreies Speichern/Laden.
Regeln: kennt keine Bauwerke, Stile, Verhalten; deterministisch; alle höheren Ebenen ändern die Welt nur hier; Änderung nur bei Bedrock-Update. Grenzfälle: Eigenschaften („ist Arbeitsblock“) sind hier Fakt, das Prüfen gehört höher; Seed/Gelände nicht hier; Wesen und Blockinhalte als Zustand hier, ihr Verhalten in Ebene 1.

## Ebene 1 – Uhrwerk & Mechanik („Wie verhält sich die Welt?“) – BESTÄTIGT
Simulation, kennt keine Bauwerke. Taktgeber: Spieltick 20/s; Redstone-Tick = 2 Spielticks (P-Tick ungerade: senden, C-Tick gerade: lesen/reagieren); geplante Ticks höchstens 100 je Chunk und Tick; Zufallsticks mit festem Startwert; Tickbereich = Simulationsdistanz (Aternos: 4 Chunks). Mechaniken auf dem Taktgeber: Redstone, Wasser/Lava, Schienen/Loren, Trichter und Blockinhalte, Licht und Spawn, fallende Blöcke, Wesen (Bewegung, Dorfbewohner). Prüfer meldet Verstöße maschinenlesbar mit Koordinate.
Regeln: simuliert nur in einer Kopie (Sandkasten) und über Ebene 0; jede Regel hat eine Bedrock-Quelle, nichts erfunden; „geprüft“ erst nach Jonahs Spielbestätigung; deterministisch. Abgrenzung: gilt für jede Welt mit diesen Blöcken → Ebene 1; fertige Schaltung oder Form → höher.

## Ebene 2 – Bausteine („Die Bibliothek“) – BESTÄTIGT
Einzelne, für sich vollständige und testbare Bauteile: Formen (reine Geometrie), Bauelemente (begehbar), Technikmodule (Schaltungen). Paket: Parameter mit Größenart, Blöcke im eigenen Koordinatensystem (Nullpunkt, Blick Norden), Anschlüsse, Platzbedarf (Hülle plus Sperrzonen), Testszenario für Ebene 1, Status entworfen → simuliert → geprüft mit Quelle. Material nur über Rollen (Wand, Akzent, Boden, Licht, Glas); Technikblöcke sind fest.
Maßstabsfreiheit: Formen per Abstandsfunktion (die Blockmitte entscheidet), Proportionen statt fester Maße, Mittelpunkt auf einem Block oder zwischen zwei Blöcken, symmetrisch gerundet, Test über alle Größen (Abweichung höchstens ½ Block). Drei Größenarten: Geometrie skaliert frei; Menschenmaß bleibt fest (Tür 2, Gang ≥ 2, Stufe 1); Technik skaliert über Anzahl, nie über Größe.
Regeln: kennt weder Standort noch Stil noch Nachbarn; darf aus Bausteinen bestehen; Ausgabe läuft durch den Prüfer aus Ebene 1; deterministisch. Abgrenzung: allein auf leerer Fläche stellbar und testbar → Ebene 2; eine Schienenstrecke von A nach B ist kein Baustein.

## Ebene 3 – Planung („Die Fachleute“) – BESTÄTIGT
Feste Algorithmen (keine KI) setzen aus der Bauspezifikation das Bauwerk Abschnitt für Abschnitt zusammen; gemeinsamer Planentwurf, jeder ändert nur seinen Teil, Höherrangiges ist gesperrt. Konstrukteur (Gliederung, Reihenfolge, Verbindungen, Nähte), Grobdesigner (Zonenplan), Techniker (Module, Sperrzonen, Gesamtbilanz, Schaltungsanfragen), Architekt (Formen und Bauelemente, Messen), Designer (Palette, Gestaltung), Bauleiter (überwacht, stellt Jonah Rückfragen mit Optionen).
Ablauf: Vorlauf (Gliederung, Einspruch des Technikers, Gesamtpalette), je Abschnitt (Zonenplan → Bedarfsprüfung → Module → Formen → Zusammenfügen → Gestaltung → Prüfer), Abschluss mit Gesamtprüfung. Rangfolge bei Streit: Techniker > Grobdesigner > Architekt > Konstrukteur > Designer. Einwand-Protokoll: maschinenlesbar mit Koordinate, höchstens N Runden, dann Rückfrage des Bauleiters; alles im Baubericht. Rückgriff auf fertige Abschnitte entscheidet der Bauleiter.

## Ebene 4 – Leser („Der Übersetzer“) – BESTÄTIGT
Einzige KI-Stelle: übersetzt Bilder und Text in die Bauspezifikation und sonst nichts (Schema: Projekt, Teile mit Form und Lage als Beziehung, Funktionen als Bedarf, Stil je Zone, Wichtigkeit). Bildmessung ohne KI; Prüfer der Spezifikation streng (Rückfragen statt Raten); Briefing-Weg: fester Prompt, Jonah nutzt den Claude-Chat, JSON zurück; Freigabe durch Jonah.
Regeln: nur WAS, nie WIE (keine Koordinaten, Blöcke, Schaltungen); die Spezifikation ist die einzige Verbindung zu Ebene 3; ab Freigabe alles deterministisch; Spezifikationen haben Versionen.

## Ebene 5 – Ausgabe & Oberfläche („Das Overlay“) – BESTÄTIGT
Zeigt, was darunter berechnet wurde, und nimmt Eingaben entgegen; rechnet und entscheidet nichts. Nur Desktop (PC neben der PS5), Webseite ohne Build, Kompaktmodus (aktuelle Schicht, aus Entfernung lesbar) und Vollmodus (3D, Pläne, Bericht); Texturen Faithful 32x mit Nennung (faithfulpack.net). Ausgaben: 3D-Ansicht, Schichtpläne (abhakbar), Materialliste, Baubericht, Status der Bausteine, Testanleitungen. Eingaben: Vorlage und Briefing, Freigabe, Rückfragen, Testergebnisse, Baufortschritt.
Regeln: ändert nie direkt Welt oder Plan (Änderungswünsche gehen nach unten, auch manuelle Änderungen im 3D-Editor als Spezifikationsänderung oder „Fixierung“ an Ebene 3); zeigt nur Berechnetes, Vereinfachungen werden gekennzeichnet.

# Blockwerk – Ebenenmodell (Stand 19.10.2026)

Grundsatz: Jede Ebene baut nur auf den Ebenen darunter auf. Höhere Ebenen verändern die Welt nur über Ebene 0.

## Ebene 0 – Fundament („Welt und Wahrheit“) – BESTÄTIGT
Kurz: eine Kopie von Minecraft Bedrock ohne Simulation und ohne Weltgenerator.

### Inhalt
- Koordinaten & Richtungen: x = Ost, z = Süd, y = oben; 1 Block = 1 Einheit; Chunk = 16×16; feste Namen für Richtungen (north/east/south/west/up/down) und Nullpunkt.
- Blockregister: alle Blöcke von Bedrock 1.26.50 mit ID, erlaubten Zuständen (facing, half, open …) und reinen Eigenschaften (Vollblock, durchsichtig, Lichtstärke, fällt, braucht Halt, ist Arbeitsblock).
- Wesenregister: Lore (alle Arten), Dorfbewohner (erwachsen/Baby), Spieler, Item; je Wesen die Hitbox-Größe als Fakt.
- Voxelwelt: Block setzen, lesen, löschen; Speicherung in Chunks; Luft als Standard. Speichert zusätzlich, wo welches Wesen steht.
- Blockinhalt: Inhalte von Trichter, Fass, Truhe, Werfer, Spender usw. (Gegenstand + Anzahl je Slot).
- Vermesser: Verschieben, Drehen, Spiegeln; alle Richtungswerte werden automatisch mitgedreht.
- Speichern/Laden: Welt (Blöcke, Wesen, Blockinhalte) verlustfrei als Datei sichern und wiederherstellen.

### Regeln
1. Kennt keine Bauwerke, keine Stile, kein Verhalten.
2. Deterministisch: gleiche Eingabe = gleiches Ergebnis.
3. Alle höheren Ebenen verändern die Welt nur über Ebene 0.
4. Änderung nur bei Bedrock-Update oder bewusster Konventionsänderung.

### Abgrenzungstest
Ändert es sich bei einem Mojang-Update → Ebene 0. Ändert es sich bei einem anderen Bauwerk → höhere Ebene.

### Grenzfälle (entschieden)
- Eigenschaften wie „ist Arbeitsblock“, „braucht Halt“ liegen als Fakt in Ebene 0; das Prüfen gehört in eine höhere Ebene.
- Seed/Gelände gehört nicht in Ebene 0; Ebene 0 liefert nur die leere Welt, Gelände kommt später als Eingabe.
- Wesen und Blockinhalte gehören in Ebene 0 (als Zustand der Welt), ihr Verhalten in Ebene 1.

## Ebene 1 – Uhrwerk & Mechanik („Wie verhält sich die Welt?“) – BESTÄTIGT
Kurz: die Simulation, die Ebene 0 fehlt. Kennt weiterhin keine Bauwerke.

### Kern: Taktgeber (Bedrock-Ticklogik)
Alle Mechaniken laufen über den Taktgeber und melden an, in welcher Tickart und Phase sie arbeiten.
- Spieltick: 20 pro Sekunde (0,05 s); ein Tag = 24.000 Ticks.
- Redstone-Tick (Bedrock): 2 Spielticks, getrennt vom Haupt-Loop, zwei feste Phasen:
  - P-Tick (Produce, ungerade Spielticks): Bauteile senden ihr Signal.
  - C-Tick (Consume, gerade Spielticks): Bauteile lesen und reagieren.
- Bauteil-Klassen:
  - Übertrager/Stromquellen (Verstärker, Komparator, Redstonefackel, Beobachter): lesen im P-Tick, schreiben nach ihrer Verzögerung im folgenden C-Tick.
  - Mechanismen (Kolben, Lampe, Tür …): schalten im C-Tick; das Blockupdate läuft im nächsten P-Tick.
  - Redstone-Staub: aktualisiert jeden Spieltick (20×/s).
  - Wesen-Bauteile (Trichterlore, TNT-Lore, Rüstungsständer): reagieren auf P- und C-Ticks.
- Geplante Ticks (Wasser, verzögerte Bauteile): Bedrock höchstens 100 pro Chunk und Spieltick.
- Zufallsticks (Wachstum, Feuer, Eis …): Bedrock-Standard randomTickSpeed = 1 (relative Geschwindigkeit). Damit alles deterministisch bleibt: Zufall mit festem Startwert + zusätzliche Erwartungswert-Rechnung („reif nach ca. X Minuten“).
- Tickbereich: Bedrock tickt alle Chunks in Simulationsdistanz oder in einer Tickingarea → Prüfung, ob eine Anlage beim Spielen läuft.
- Offen/ungeprüft: Reihenfolge innerhalb eines Bedrock-Spielticks ist nicht dokumentiert. Arbeitsreihenfolge festlegen, als „ungeprüft“ markieren, mit Testschaltungen in der Kreativwelt bestätigen.

### Mechaniken (sitzen auf dem Taktgeber)
- Regelwerk als Daten: jede Bedrock-Regel einzeln, mit Quelle und Status geprüft/ungeprüft.
- Redstone (Signalstärke, Verzögerung, Fackeln, Kolben, keine Quasi-Konnektivität).
- Wasser/Lava (Fließweite, Gefälle, geplante Ticks).
- Schienen & Loren (Form aus Nachbarn, Antrieb, Steigung, Aktivierungsschiene).
- Trichter & Blockinhalte (Transport, Sperre durch Strom, Komparator-Lesewert).
- Licht & Spawnstellen.
- Fallende Blöcke.
- Wesen: Bewegung und Verhalten von Spieler und Dorfbewohner (Höhe, Sprung, Fallschaden, Berufssuche, Betten, Golems) als Erreichbarkeits- und Verhaltensmodell.

### Prüfer
Findet Verstöße („Fackel ohne Halt“, „Wasser neben Schiene“, „Deko-Arbeitsblock“) und meldet sie maschinenlesbar mit Koordinate.

### Regeln
1. Simuliert in einer Kopie der Welt (Sandkasten), immer über Ebene 0; der Bauplan selbst bleibt unberührt.
2. Jede Regel braucht eine Bedrock-Quelle; nichts wird erfunden.
3. Eine Regel wird erst „geprüft“, wenn Jonah sie im Spiel bestätigt hat.
4. Deterministisch: gleicher Startwert = gleicher Ablauf.

### Abgrenzungstest
Gilt es für jede Welt mit diesen Blöcken → Ebene 1. Ist es eine fertige Schaltung oder Form (Nische, Sortierer, Kuppel) → höhere Ebene.

### Quelle
Minecraft Wiki, „Tick“: https://minecraft.wiki/w/Tick

## Ebene 2 – Bausteine („Die Bibliothek“) – BESTÄTIGT
Kurz: einzelne, für sich vollständige Bauteile, die man ohne Wissen über das Gesamtbauwerk bauen und testen kann.

### Drei Arten
- Formen: reine Geometrie ohne Funktion (Kreis, Ellipse, Zylinder, Kegel, Kuppel, Gewölbe, Bogen, Dachformen); Rundheit und Symmetrie messbar.
- Bauelemente: begehbare Teile (Treppe, Wendeltreppe, Tür, Gang, Fenster, Säule).
- Technikmodule: Schaltungen (Nische, Sortierer, Bahnhof, Steigungsstück, Kurve, Brüter, Entladestelle).

### Paket jedes Bausteins
1. Parameter (z. B. Radius, Länge, Anzahl Module), jeder mit Größenart gekennzeichnet (siehe unten).
2. Blöcke im eigenen Koordinatensystem (Nullpunkt, Blick nach Norden); Drehen übernimmt der Vermesser aus Ebene 0.
3. Anschlüsse: wo etwas rein-/rausgeht, mit Richtung (Schiene, Trichter, Gang, Wasserkanal).
4. Platzbedarf: Hüllquader plus Sperrzonen (z. B. „keine Arbeitsblöcke im Umkreis von 20“).
5. Testszenario für Ebene 1: Startzustand + erwartetes Ergebnis.
6. Status mit Quelle: entworfen → simuliert (Test in Ebene 1 bestanden) → geprüft (von Jonah im Spiel bestätigt).

### Material über Rollen
Formen und Bauelemente setzen nur Rollen („Wand“, „Akzent“, „Boden“, „Licht“); welcher Block das wird, entscheidet der Designer in Ebene 3. In Technikmodulen sind Technikblöcke (Trichter, Schienen, Redstone) fest; nur als „verkleidbar“ markierte Flächen bekommen Rollen.

### Grundregel: Maßstabsfreiheit
- Formen werden mathematisch beschrieben (Abstandsfunktion), nicht als festes Blockmuster; erst beim Bauen in Blöcke umgerechnet. Gleiche Formel für r = 12, 20, 100.
- Proportionen statt fester Maße (z. B. Kuppelhöhe = 0,5 × Radius, Bogenstich = 0,3 × Spannweite).
- Mittelpunkt auf einem Block oder zwischen zwei Blöcken → gerade und ungerade Durchmesser ohne schiefe Seite.
- Feste Rundungsregel: symmetrisch zum nächsten ganzen Block.
- Automatischer Test über alle Größen (z. B. r = 1 bis 128): lückenlos, symmetrisch, Abweichung vom Ideal höchstens ½ Block.

### Drei Größenarten (jeder Parameter wird gekennzeichnet)
1. Geometrie skaliert frei: Radius, Höhe, Spannweite.
2. Menschenmaß bleibt fest: Türhöhe 2, Ganghöhe mindestens 2, Treppenstufe 1, Wandstärke nach Wahl. Größere Wendeltreppe = mehr Stufen pro Umdrehung, nicht höhere Stufen.
3. Technik skaliert über Anzahl, nie über Größe: Schaltungen werden verdoppelt/wiederholt, nie gestreckt (größere Halle = mehr Nischen, nicht größere).

### Regeln
1. Ein Baustein kennt weder Standort noch Stil noch Nachbarn.
2. Bausteine dürfen aus Bausteinen bestehen (z. B. Nischenreihe = 24 Nischen), solange das Ergebnis eigenständig testbar ist.
3. Jede Ausgabe läuft durch den Prüfer aus Ebene 1.
4. Deterministisch: gleiche Parameter = gleiche Blöcke.

### Abgrenzungstest
Allein auf eine leere Fläche stellbar und testbar → Ebene 2. Braucht Wissen über Position, Verbindung oder Reihenfolge anderer Teile → höhere Ebene.

### Grenzfall (entschieden)
Eine Schienenstrecke von A nach B ist kein Baustein (kennt die Umgebung). Ihre Einzelteile (Kurve, Steigungsstück, Bahnhof) sind Bausteine; das Verlegen übernimmt die Planungsebene darüber.

## Ebene 3 – Planung („Die Fachleute“) – BESTÄTIGT
Kurz: Fachleute setzen aus der Bauspezifikation mit den Bausteinen aus Ebene 2 das ganze Bauwerk zusammen, Abschnitt für Abschnitt.

### Grundsätze
- Die Fachleute sind feste Algorithmen, keine KI. Ihr Wissen steckt in den geprüften Regeln (Ebene 1) und Bausteinen (Ebene 2). Gleiche Vorlage = gleiches Ergebnis.
- Die einzige KI-Stelle ist der Leser (Ebene 4), der Bilder und Texte in die Bauspezifikation übersetzt.
- Alle arbeiten an einem gemeinsamen Planentwurf. Jeder ändert nur seinen eigenen Teil; was ein Höherrangiger festgelegt hat, ist für die anderen gesperrt.

### Die Fachleute
- Konstrukteur: teilt das Projekt in Sinnabschnitte, legt Reihenfolge und Schnittstellen fest, sagt jeweils den nächsten Abschnitt an, fügt Abschnitte zusammen, verlegt Verbindungen (Schienen, Gänge, Kanäle aus Einzelbausteinen), prüft Nähte und Begehbarkeit (Erreichbarkeitsmodell aus Ebene 1).
- Grobdesigner: legt je Abschnitt den Zonenplan fest: Umriss, Höhenebenen, Hauptachsen/Wege, Funktionszonen (Technik, Handel, Verkehr, reine Optik). Bestimmt WO etwas hinkommt, nicht WIE.
- Techniker: Wissen = Regelwerk und Prüfer aus Ebene 1, Schaltungen aus der Bibliothek in Ebene 2. Bedarfsprüfung der Zonen, setzt Module, Technikzonen, Sperrzonen und Anschlüsse. Führt die Gesamtbilanz über alle fertigen Abschnitte (Betten für Golems, Arbeitsblöcke im Umkreis von 16, Sperrzonen). Findet er keine passende Schaltung: Schaltungsanfrage → neues Modul wird entwickelt und durchläuft entworfen → simuliert → geprüft.
- Architekt: setzt Formen und Bauelemente aus Ebene 2 um die Technik herum und misst gegen die Vorlage (Rundheit, Symmetrie, Proportionen).
- Designer: legt im Vorlauf die Gesamtpalette fest; macht je Abschnitt aus Rollen echte Blöcke, Farbkomposition, Deko, Licht. Ändert nur verkleidbare Flächen; verbotene Deko (z. B. Arbeitsblöcke) sperrt der Techniker.
- Bauleiter: überwacht alle, erzwingt die Rangfolge, darf Entscheidungen hinterfragen, pausiert und stellt Jonah eine konkrete Rückfrage mit Optionen, wenn sich ein Problem nicht lösen lässt.

### Ablauf
Vorlauf (einmal für das ganze Projekt):
1. Konstrukteur (Gliederung): Sinnabschnitte nach Logik (z. B. von innen nach außen, Keller vor Erdgeschoss), Reihenfolge, ungefährer Raum je Abschnitt, Schnittstellen zu den Nachbarn.
2. Techniker (Einspruch): prüft die Reihenfolge auf technische Abhängigkeiten (z. B. Lager unter dem Zentrum vor den Einwurfschächten).
3. Designer: Gesamtpalette für alle Abschnitte.

Je Abschnitt (in der Reihenfolge des Konstrukteurs):
1. Grobdesigner: Zonenplan des Abschnitts.
2. Techniker (Bedarfsprüfung): passt die Technik in die Zonen (Platzbedarf aus Ebene 2)? Sonst Einwand mit Mindestmaß → Grobdesigner passt an.
3. Techniker: Module, Technikzonen, Anschlüsse.
4. Architekt: Formen und Bauelemente um die Technik.
5. Konstrukteur (Zusammenfügen): Verbindung zu fertigen Abschnitten, Nähte, Begehbarkeit.
6. Designer: Gestaltung mit der Gesamtpalette.
7. Prüfer aus Ebene 1 über den Abschnitt und seine fertigen Nachbarn.
→ Abschnitt fertig; Konstrukteur sagt den nächsten an, der Ablauf startet von neuem.

Abschluss: Konstrukteur-Gesamtprüfung aller Nähte und Verbindungen + vollständiger Prüfer über das ganze Bauwerk.

### Rangfolge bei Streit
Techniker > Grobdesigner > Architekt > Konstrukteur > Designer; Bauleiter überwacht alle.
Reihenfolge im Ablauf und Rangfolge bei Streit sind getrennt: Die Gliederung des Konstrukteurs ist ein Vorschlag, gegen den der Techniker Einspruch erheben darf.

### Einwand-Protokoll
Verstoß → maschinenlesbarer Einwand mit Koordinate (z. B. „Kurve in Steigung bei x, y, z“) → Zuständiger ändert seine Parameter → erneute Prüfung. Nach höchstens N Runden greift der Bauleiter ein. Jeder Einwand und jede Änderung landet im Baubericht.

### Rückgriff
Braucht ein späterer Abschnitt eine Änderung an einem fertigen, entscheidet der Bauleiter: alten Abschnitt wieder öffnen (sein Ablauf läuft neu) oder den aktuellen anpassen.

### Abgrenzungstest
Braucht es Wissen über Position, Verbindung oder Reihenfolge mehrerer Bausteine → Ebene 3. Ist es ein einzelnes, eigenständig testbares Teil → Ebene 2. Übersetzt es Bilder/Text in die Bauspezifikation → Ebene 4. Zeigt oder exportiert es Ergebnisse → Ebene 5.

## Ebene 4 – Leser („Der Übersetzer“) – BESTÄTIGT
Kurz: die einzige KI-Stelle. Übersetzt die Vorlage (Bilder + Text) in die Bauspezifikation und sonst nichts.

### Inhalt
- Spezifikationsschema (feste Sprache, die Ebene 3 versteht):
  - Projekt: Name, Bauplatzgröße, Nullpunkt, Gesamtmaßstab.
  - Teile: Name, Art (Turm, Halle, Mauer …), Form aus Ebene 2 mit Größe und Proportionen, Lage als Beziehung („steht an Ecke Nordost“, „mittig über dem Zentrum“).
  - Funktionen als Bedarf, nicht als Schaltung („192 Handelsnischen“, „Lager für 48 Gegenstandssorten“, „Brüter“); welche Schaltung das wird, entscheidet der Techniker.
  - Stil je Zone: Farben, Materialwünsche, Stimmung („oben Glanz, Keller dunkel-industriell“).
  - Wichtigkeit je Punkt: muss / soll / kann.
- Bildmessung (ohne KI, deterministisch): Farbpalette, Proportionen, Kreise/Linien im Grundriss; gleicht die Werte der KI damit ab.
- Prüfer der Spezifikation: streng gegen das Schema. Unbekannte Begriffe, unmögliche Werte oder Widersprüche (Text rund, Bild eckig) werden zu Rückfragen an Jonah, nicht geraten.
- Briefing-Weg (entschieden): Die Seite erzeugt einen festen Prompt, Jonah gibt ihn mit den Bildern im Claude-Chat ein und kopiert das JSON zurück. Eigener API-Schlüssel optional später.
- Freigabe: Jonah sieht die Spezifikation als lesbare Zusammenfassung und bestätigt sie, bevor Ebene 3 startet.

### Regeln
1. Der Leser beschreibt nur WAS, nie WIE: keine Koordinaten, keine Blöcke, keine Schaltungen (daran ist Blockplan gescheitert).
2. Die Spezifikation ist die einzige Verbindung in Ebene 3.
3. Ab der freigegebenen Spezifikation ist alles deterministisch; die Schwankung der KI bleibt in Ebene 4.
4. Spezifikationen haben Versionen. Bei einer Änderung entscheidet der Konstrukteur, welche Abschnitte neu geplant werden.

### Abgrenzungstest
Übersetzt es Jonahs Eingaben → Ebene 4. Entscheidet es Lage oder Blöcke → Ebene 3. Zeigt oder exportiert es Ergebnisse → Ebene 5.

### Grenzfälle (entschieden)
- Der Leser darf Teile benennen; die Abschnitte legt der Konstrukteur fest.
- Bauplatz und später Seed/Gelände gehören als Eingabe in die Spezifikation; Ebene 0 bleibt die leere Welt.

## Ebene 5 – Ausgabe & Oberfläche („Das Overlay“) – BESTÄTIGT
Kurz: zeigt, was die Ebenen darunter erzeugt haben, und nimmt Jonahs Eingaben entgegen. Rechnet und entscheidet nichts selbst.

### Form (entschieden)
- Ausschließlich Desktop, keine Handy-App.
- Gespielt wird auf der PS5; Blockwerk läuft auf einem PC/Laptop daneben als Bauplan-Bildschirm.
- Eigenes Fenster, auf Wunsch immer im Vordergrund; Kompaktmodus (aktuelle Schicht + Material dieser Schicht, aus Entfernung gut lesbar) und Vollmodus (3D-Ansicht, Pläne, Bericht).
- Bedienung mit Maus und Tastenkürzeln (Schicht vor/zurück, abhaken, Modus wechseln).
- Technische Umsetzung (Desktop-App oder als Desktop-Fenster installierte Webseite) noch offen.

### Texturen
- Darstellung mit Faithful 32x (Bedrock-Fassung): am nächsten am Original, Lizenz erlaubt Nutzung in eigener Software.
- Pflichten laut Faithful-Lizenz: sichtbare Nennung (Pack-Name + Link faithfulpack.net) in der Oberfläche und im Repo, Lizenztext oder Link beilegen, nur benötigte Texturen verwenden, Blockwerk bleibt kostenlos (kein Paywall), nicht als offiziell darstellen, kein KI-Training mit den Texturen.
- Fehlende Texturen (neue Blöcke): automatische Prüfung gegen das Blockregister aus Ebene 0; fehlende Blöcke bekommen eine eigene Ersatztextur in Originalfarbe und werden markiert.
- Optional: eigenes Texturpaket laden.
- Quelle Lizenz: https://faithfulpack.net/license

### Ausgaben
- 3D-Ansicht: ganzes Bauwerk, Abschnitte, Etagenschnitte; Technik ein-/ausblendbar.
- Schichtpläne: pro Abschnitt in Bau-Reihenfolge, abhakbar, Blocksymbol + Name.
- Materialliste: pro Abschnitt und gesamt, auf Wunsch in Rohstoffe zerlegt, in Stacks/Kisten umgerechnet.
- Baubericht: alle Einwände, Änderungen und Entscheidungen aus Ebene 3, lesbar formuliert.
- Status der Bausteine: entworfen / simuliert / geprüft, deutlich markiert.
- Testanleitung für jedes ungeprüfte Modul (was in der Kreativwelt bauen und beobachten).

### Eingaben
- Vorlage und Briefing (Ebene 4), Freigabe der Spezifikation.
- Rückfragen des Bauleiters mit Optionen zum Anklicken.
- Testergebnisse („funktioniert / funktioniert nicht + Beobachtung“) → hebt Module auf „geprüft“.
- Baufortschritt (abgehakte Schichten), gemeinsames Arbeiten mit den Freunden.

### Regeln
1. Ändert nie direkt Welt oder Plan; Änderungswünsche gehen als Eingabe nach unten.
2. Zeigt nur Berechnetes; Vereinfachungen werden gekennzeichnet.
3. Desktop-Bedienung, Kompaktmodus während des Bauens aus Entfernung lesbar.

### Abgrenzungstest
Zeigt, exportiert oder nimmt es Eingaben entgegen → Ebene 5. Berechnet oder entscheidet es etwas → tiefere Ebene.

### Grenzfall (entschieden)
Manuelle Änderungen im 3D-Editor sind keine direkten Eingriffe: Sie gehen als Änderung der Spezifikation oder als „Fixierung“ an Ebene 3 und werden dort geprüft.

# Spieltests für Jonah – Ebene 0 (Kreativ-Testwelt, Bedrock)

Regeln in `data/drehregeln.json` und Eigenschaften in `data/quellen/eigenschaften.json` sind `ungeprüft`, bis Jonah sie im Spiel bestätigt.
Schick pro Test: „funktioniert / funktioniert nicht + Beobachtung“.

Vorbereitung: Kreativ-Testwelt, Cheats an, Koordinaten anzeigen. **Norden ist −Z (Zahl wird kleiner), Osten ist +X.**
Befehle im Chat eingeben; `~ ~ ~` ist deine Position (setze den Block z. B. auf `~ ~1 ~`).

## Ergebnisse (Jonah, 20.10.2026)

| Nr. | Test | Ergebnis | Status |
|----|------|----------|--------|
| 1 | Trichter `facing_direction` | 0 unten, 2 Nord, 3 Süd, 4 West, 5 Ost. Wert 1 ist im Spiel „undefiniert“ (Wiki: „oben, unbenutzt“) | **geprüft** |
| 2 | Treppe `weirdo_direction` | 0 Ost, 1 West, 2 Süd, 3 Nord | **geprüft** |
| 3 | Treppen-Ecke `minecraft:corner` | Der Befehl setzt eine normale Treppe; der Zustand wirkt im Spiel nicht. Spiegel-Regel für Ecken bleibt Annahme | ungeprüft (Zustand wirkungslos per Befehl) |
| 4 | Schiene `rail_direction` | Erster Versuch: Schienen sprangen ab. Wiederholung mit Steinboden: 0 Nord-Süd, 1 Ost-West, 2–5 Steigung nach Ost/West/Nord/Süd, 6 Süd-Ost, 7 Süd-West, 8 Nord-West, 9 Nord-Ost | **geprüft** |
| 5 | Tür `minecraft:cardinal_direction` + Scharnier | „Stimmt“ | **geprüft** (nur Türen) |
| 6 | Baby-Dorfbewohner | Passt durch einen Gang von genau 1 Block Höhe | bestätigt: Baby-Höhe ≤ 1 (genauer Wert nicht gemessen) |
| 7 | Fackel `torch_facing_direction` | Der Wert nennt die Seite, auf der der Nachbarblock liegt, an dem die Fackel hängt. Beispiel: Befehl bei x = −16 mit `west` → Fackel hängt an der Ostseite des Blocks bei x = −17 und zeigt nach Osten. Ohne angrenzenden Block springt die Fackel ab | **geprüft** (west/east/north/south; `top` nicht getestet) |
| 8 | Glow Lichen `multi_face_direction_bits` | 1 unten, 2 oben, 4 Süd, 8 West, 16 Nord, 32 Ost | **geprüft** |

## Test 4 (Schienen) – Anleitung der Wiederholung, erledigt
Schienen brauchen einen Block unter sich, Steigungen außerdem einen Block auf der hohen Seite.
1. Boden: `/fill 100 70 100 104 70 104 stone` (Koordinaten anpassen, ein freies Feld; Koordinaten anzeigen).
2. Gerade: `/setblock 102 71 102 rail ["rail_direction"=0]`, dann `=1`. Erwartung: 0 Nord-Süd, 1 Ost-West.
3. Steigung nach Osten: `/setblock 103 71 102 stone`, dann `/setblock 102 71 102 rail ["rail_direction"=2]`. Erwartung: Schiene steigt nach Osten an.
   Entsprechend 3 (West, Stein bei 101), 4 (Nord, Stein bei z = 101), 5 (Süd, Stein bei z = 103).
4. Kurven 6–9 (Süd-Ost, Süd-West, Nord-West, Nord-Ost): Eine einzelne Schiene kann sich im Spiel selbst umstellen. Dann dazu je zwei gerade Nachbarschienen setzen und nur melden, was du siehst.

## Weitere Tests (noch offen)
Schilder/16er-Drehung (`ground_sign_direction`), Ranken (`vine_direction_bits`), Hebel (`lever_direction`), Wandkoralle (`coral_direction`).
Anleitung folgt, sobald ein Baustein sie braucht.

## Ergebnisse Halt-Tests (Jonah, 20.10.2026)
| Form | Fackel | Schiene |
|---|---|---|
| Glasblock | an allen Seiten außer unten, oben drauf | geht ganz normal |
| Halbstufe | nur auf ganzer Blockhöhe, seitlich nur an ganzen Blöcken | geht nicht |
| Treppe | nur an der großen Seite | geht nicht |
| Zaun | nur oben drauf | geht nicht |
| Glasscheibe | nur oben drauf | geht nicht |

Eingetragen in Ebene 0 (`fackelOben`, `fackelSeiten`, `schiene`). Halbstufe (von Jonah bestätigt): oben nur auf der oberen Hälfte, seitlich gar nicht.

## Ergebnisse Schienen-Tests (Jonah, 21.10.2026)
| Nr. | Test | Ergebnis |
|---|---|---|
| 1 | Schiene auf oberer Halbstufe / kopfstehender Treppe | bleibt bei beidem liegen → eingetragen |
| 2 | T-Stelle | Wenn möglich wird Ost-Süd gemacht. Gibt es keine Schiene nach Süden, wird Ost-Nord gemacht. Ost-West (gerade) nur, wenn beim Platzieren keine andere Schiene daneben liegt → **geprüft** (`schiene.t-stelle`) |
| 3 | Rampe mit zwei Möglichkeiten | Bei Ost-West steigt sie nach Westen, bei Nord-Süd nach Süden → eingetragen (`schiene.bevorzugung`) |
| 4 | Antriebsschiene an der Ecke | Die Antriebsschiene bleibt gerade, die normale Schiene daneben dreht sich zu ihr → **geprüft** (`schiene.antriebsschiene-gerade`). Detektor- und Aktivierungsschiene sind damit noch nicht getestet |

## Antrieb: die wichtigsten Tests (Ebene 1)
1. **Reichweite:** 20 Antriebsschienen in einer Reihe, Redstone-Block seitlich neben der ersten: wie viele sind aktiv (leuchten)? Blockwerk erwartet 9. Dann den Block neben die zehnte: Blockwerk erwartet 17. (`antrieb.reichweite`)
2. **Normale Schiene dazwischen** (statt einer Antriebsschiene) und **Lücke**: geht der Strom dahinter weiter? Blockwerk erwartet nein. (`antrieb.nur-verbundene`)
3. **Wo darf der Redstone-Block stehen?** Links, rechts, vorn, hinten, unter und über der Schiene. (`antrieb.stromblock`)
4. Lorenphysik: Messungen A–F in `docs/messungen-lore.md` (kein Muss, aber ohne sie gibt es kein Lorenmodell).

## Wasser und Lava: die wichtigsten Tests (Ebene 1)
Alle in der Kreativ-Testwelt auf ebenem Steinboden, mit Video (Zeiten) und Koordinaten.
1. **Weite und Tempo:** Wasserquelle auf ebenem Boden: Wie weit kommt das Wasser (erwartet 7 Blöcke) und wie schnell (erwartet 1 Block je 5 Ticks = 0,25 s)? Dasselbe mit Lava (erwartet 3 Blöcke, 1,5 s je Block). (`fluessigkeit.wasser`, `fluessigkeit.lava-oberwelt`)
2. **Wegspülen:** Wasser neben Fackel, Schiene, Teppich, Redstone-Staub, Knopf, Druckplatte, Leiter, Schild: Welche gehen verloren? (`fluessigkeit.wegspuelen`)
3. **Hindernisse:** Wasser neben Treppe, Halbstufe, Zaun, Glasscheibe, Tür, Falltür: Wird es aufgehalten? (`fluessigkeit.hindernisse`)
4. **Gefälle:** Loch im 3., 4., 5. und 6. Block neben der Quelle: Bis wohin zieht das Wasser dorthin? (`fluessigkeit.gefaelle`)
5. **Wasserquelle in der Luft:** Fällt nur eine Säule, oder entsteht ein Plus aus fünf Säulen? (`fluessigkeit.fallen`)
6. **Abklingen:** Quelle entfernen: Wie lange bis alles Wasser weg ist? (`fluessigkeit.abklingen`)
7. **Mischen:** Wasser neben Lava-Quelle (Obsidian?), Fluss trifft Fluss (Bruchstein?), Lava fällt auf Wasser (Stein?). (`fluessigkeit.mischen`)

## Licht: die wichtigsten Tests (Ebene 1)
Alle in einem geschlossenen dunklen Raum (Höhle oder Raum aus Stein ohne Himmel), Kreativmodus, Koordinaten an. Hilfsmittel: `/give @s light_block` (Lichtblock, Stärke einstellbar) und die Debug-Ansicht ist in Bedrock nicht vorhanden; darum entweder Monsterspawns nachts beobachten oder Pflanzen/Fackeln als Anzeichen nutzen.
1. **Dünne Blöcke:** Fackel hinter einer Reihe aus Schienen, Teppich, Blume, Schild, Redstone-Staub: Ist es dahinter hell? Danach je eine 1-Block-Wand aus Glasscheibe, getöntem Glas, Treppe, Halbstufe (oben/unten), Zaun, Tür, Falltür mit Fackel dahinter: Licht dringt durch, schwächer oder gar nicht? (`licht.unbekannte-filter`)
2. **Reichweite einer Fackel:** wie viele Blöcke weit ist der Boden noch „hell“ (kein Monsterspawn)? Blockwerk erwartet 13. (`licht.blocklicht`)
3. **Kerzen und Seegurken:** wie hell ist 1, 2, 3, 4 Kerzen? Siehe `pruefer.licht-unklar`.

## Ergebnisse Wasser und Lava (Jonah, 24.10.2026)
Original-Meldung, zusammengefasst; eingetragen in `data/regeln/fluessigkeit.json`:
1. **Weite und Tempo:** Wasser 7 Blöcke in jede Richtung vom Zentrum, 2,20 s bis alles ausgebreitet ist, nach Entfernen der Quelle 1,9 s bis alles weg ist. Lava (Oberwelt) 3 Blöcke, 5 s bis ausgebreitet, 5,06 s bis weg. In beiden Fällen „optisch ein Quadrat“. Blockwerk rechnet 1,75 s (Wasser) und 4,5 s (Lava); die Abweichung von rund einer halben Sekunde passt zur Stoppuhr-Genauigkeit. → `fluessigkeit.wasser`, `fluessigkeit.lava-oberwelt` geprüft.
2. **Wegspülen:** Fackeln, Redstone-Staub, alle gepflanzten Samen, Seegurken, Laub (siehe Frage), alle Ranken, alle Setzlinge, alle Bodendecker, alle Korallen, alle Blumen. → `fluessigkeit.wegspuelen-getestet` geprüft.
3. **Aufhalten:** Wasser wird von jedem soliden Block aufgehalten. → `fluessigkeit.vollbloecke-halten` geprüft.
4. **Gefälle:** Erst ab dem 6. Block breitet sich das Wasser wieder in alle Richtungen aus; auf der Diagonalen ist es der 4. Block. → `fluessigkeit.gefaelle` geprüft; Diagonale offen (`fluessigkeit.gefaelle-diagonal`).
5. **Quelle in der Luft:** Es entsteht ein Plus. → `fluessigkeit.plus-form` geprüft.
6. **Abklingen:** siehe 1 (Wasser 1,9 s, Lava 5,06 s). Zeiten passen; „von außen nach innen“ nicht beobachtet, deshalb bleibt `fluessigkeit.abklingen` ungeprüft.
7. **Mischen:** stille Lava + fließendes Wasser = Obsidian; stilles Wasser + fließende Lava = „Cleanstone“ (vermutlich Stein); beides fließend = Bruchstein. Noch nicht eingetragen (offene Fragen), `fluessigkeit.mischen` bleibt ungeprüft.

Antworten von Jonah (24.10.2026): Die Form ist ein Quadrat; mit „Diagonale“ ist ein Loch diagonal zur Quelle gemeint (bis (3, 3) gefunden); „Cleanstone“ = glatter Stein; „Laub“ = Laubstreu (Dekoelement). Die Simulation rechnet jetzt ein Quadrat mit Gefälle-Kosten gerade 2 / diagonal 3; offen sind die Ecken-Stufen und diagonale Lücken (`fluessigkeit.ecken`, `fluessigkeit.gefaelle-mischwege`).

## Ebene 1: Regeln mit Annahmen (ungeprüft)
Diese Regeln hat die Engine umgesetzt, aber Bedrock dokumentiert sie nicht eindeutig oder sie sind abgeleitet. Der Status bleibt `ungeprüft`, bis du sie im Spiel bestätigst. Die Texte stehen auch in `data/regeln/*.json`.

| Regel | Was testen |
|---|---|
| `antrieb.reichweite` – Reichweite: 8 Schienen weit | Kreativ-Testwelt auf ebenem Boden: 20 Antriebsschienen in einer Reihe, einen Redstone-Block seitlich neben die erste setzen: Wie viele Schienen leuchten (aktiviert)? Erwartung: 9 (die erste und 8 weitere). Dann den Redstone-Block neben die zehnte setzen: Erwartung 17 (8 links, 8 rechts, die zehnte). Ergebnis melden. |
| `antrieb.nur-verbundene` – Strom geben nur verbundene Antriebsschienen weiter | Fünf Antriebsschienen in einer Reihe, in der Mitte (dritte) eine normale Schiene statt einer Antriebsschiene, Redstone-Block neben die erste: Leuchten Schiene 4 und 5? Dann die Reihe mit einer Lücke (ein Feld ohne Schiene) wiederholen. Ergebnis melden. |
| `antrieb.stromblock` – Redstone-Block neben der Schiene versorgt sie | Einzelne Antriebsschiene, Redstone-Block nacheinander links, rechts, vor, hinter, unter und über (soweit möglich) der Schiene: In welchen Lagen leuchtet sie? Ergebnis je Lage melden. |
| `fluessigkeit.lava-nether` – Lava (Nether): 7 Blöcke weit, ein Block alle 10 Ticks | Siehe fluessigkeit.lava-oberwelt (Nether-Teil). |
| `fluessigkeit.fallen` – Fließen nach unten ohne Grenze | Wasserfall aus 10 Blöcken Höhe auf ebenen Stein: Wie weit breitet sich das Wasser unten aus (Blockwerk erwartet 7 Blöcke ab dem Aufprallpunkt)? Ergebnis melden. |
| `fluessigkeit.unten-vor-seitlich` – Erst nach unten, seitlich nur ohne Weg nach unten | Quelle direkt über einem Loch (2 Blöcke tief) auf ebenem Stein: Breitet sich Wasser auf der Oberfläche seitlich aus, oder fließt es nur in das Loch? Ergebnis melden. |
| `fluessigkeit.mischen` – Wasser und Lava mischen | Stilles Wasser (Quelle) und fließende Lava: (1) Lava fließt seitlich an die Wasserquelle, (2) Lava fällt von oben auf die Wasserquelle. Was entsteht jeweils (glatter Stein oder Bruchstein), und welcher Block wird verwandelt (die Lava oder das Wasser)? |
| `fluessigkeit.wegspuelen` – Wasser spült bestimmte Blöcke weg | Wasser neben Fackel, Schiene, Teppich, Redstone-Staub, Knopf, Druckplatte, Leiter, Schild, Trichter, Schalter: Welche werden weggespült? Ergebnis je Block melden. |
| `fluessigkeit.abklingen` – Abklingen ohne Nachschub | Wasserquelle auf ebenem Stein, Wasser sich ausbreiten lassen, Quelle entfernen, mit Video messen: Wie lange, bis alles Wasser weg ist? Verschwindet es von außen nach innen oder von innen nach außen? |
| `fluessigkeit.hindernisse` – Nur feste Blöcke halten Flüssigkeit auf | Wasser neben Treppe (Vorder- und Rückseite), Halbstufe (oben/unten), Zaun, Glasscheibe, Leiter, Schild, Tür, Falltür, Mauer: Fließt es hinein, vorbei oder hält der Block es auf? Ergebnis je Block melden. |
| `fluessigkeit.gefaelle-mischwege` – Gefälle bei Wegen aus geraden und diagonalen Schritten | Quelle auf ebenem Stein, ein Loch bei (4, 2), bei (4, 3) und bei (3, 1): Fließt das Wasser gezielt zum Loch oder breitet es sich in alle Richtungen aus? Blockwerk erwartet: (3, 1) und (4, 2) gezielt, (4, 3) nicht. |
| `fluessigkeit.ecken` – Ecken des Quadrats und diagonale Lücken | Wasserquelle auf ebenem Stein: Welche Stufe hat das Wasser bei (7, 7) und (4, 4) (Höhe der Wasserfläche, 1 hoch … 7 niedrig)? Dann Steine auf (1, 0), (0, 1) und (-1, 0), (0, -1), (-1, -1), (1, -1), (-1, 1) um die Quelle legen, nur die Ecke (1, 1) frei: Fließt das Wasser diagonal nach (1, 1)? Ergebnis melden. |
| `licht.blocklicht` – Blocklicht nimmt um 1 je Block ab | Kreativ-Testwelt, dunkle Höhle oder Raum ohne Himmel: Eine Fackel (Stärke 14) in der Mitte eines großen Raums. Mit einem Lichtblock (/give @s light_block ["block_light_level"=…]) oder Beobachtung der Monsterspawns prüfen, wie weit das Licht reicht. Erwartung: 13 Blöcke Entfernung noch Licht 1, ab 14 Blöcken dunkel. |
| `licht.himmelslicht` – Himmelslicht: senkrecht ungeschwächt, seitlich minus 1 | Tagsüber: ein 1×1-Schacht, 20 Blöcke tief, mit Dach daneben. Ganz unten im Schacht ist es hell (Himmelslicht 15). Zeigt der waagerechte Gang vom Schachtboden aus, nach wie vielen Blöcken er dunkel wird (erwartet 15)? Mit Spawn-Beobachtung oder Lichtblock-Vergleich. |
| `licht.filter` – Lichtfilter von Laub, Wasser und Halbstufen | Fackel hinter einer 1-Block-Wand aus Laub, dann aus Wasser (Eimer in einem 1-Block-Loch): Wie viel dunkler ist es dahinter als durch Luft (eine Stufe weniger = Wiki-Filterwert, zwei Stufen weniger = „plus 1“)? Mit Lichtblöcken vergleichen und die Differenz melden. |
| `licht.durchsichtig` – Glas und Teppiche lassen Licht durch wie Luft | Fackel hinter einer 1-Block-Wand aus Glas, aus Teppich (Teppich auf dem Boden, Fackel auf gleicher Höhe wie der Teppich) und aus einem Block Lava: Wird es dahinter hell wie durch Luft? Bei Lava dunkel? Ergebnis je Block melden. |
| `licht.unbekannte-filter` – Unbekannte Lichtfilter werden mit zwei Schranken gerechnet | Der wichtigste Test: Fackel hinter einer Reihe aus Schienen, Teppich, Blume, Schild, Redstone-Staub: Ist es dahinter hell? Dann je Block eine 1-Block-Wand mit Fackel dahinter: (1) Glasscheibe, (2) getöntes Glas, (3) Treppe, (4) untere Halbstufe, (5) obere Halbstufe, (6) Zaun, (7) Tür, (8) Falltür. Je Block melden: Licht dringt durch, schwächer oder gar nicht? |
| `licht.himmel-innen` – Inneres Himmelslicht für Spawnregeln | Siehe licht.himmelslicht; zusätzlich nachts im Freien und in einer Höhle mit schmalem Zugang: Spawnen Monster am Höhleneingang, wo das Himmelslicht schwach ist? |
| `pruefer.braucht-halt-fackel` – Prüfer: Fackel braucht Halt | Noch ungetestete Formen: Fackel oben auf einer Treppe (richtig herum und kopfüber), auf einer oberen Halbstufe, an Mauer, Falltür, Laub, Eis, Trichter, Kessel. Je Form melden: hält oben / hält seitlich / hält nicht. Auch prüfen, ob andere Varianten derselben Form (Stein-Treppe, Birkenzaun, gefärbtes Glas) gleich reagieren. |
| `pruefer.braucht-halt-schiene` – Prüfer: Schiene braucht Boden | Noch ungetestete Formen: Schiene auf Mauer, Falltür, Laub, Eis, Trichter, Kessel, Seelensand, Honigblock. Je Form melden: bleibt liegen / springt ab. |
| `pruefer.tickbereich` – Prüfer: Anlage im tickenden Bereich | Siehe takt.tickbereich. |
| `pruefer.schiene-verbindung` – Prüfer: Schienen sind miteinander verbunden | Eine T-Stelle bauen und die Lore (oder dich in einer Lore) darüberfahren lassen: kommt sie am Abzweig durch, bleibt sie stehen oder fährt sie in die Kurve? Ergebnis melden. |
| `pruefer.antriebsschiene-kurve` – Prüfer: Antriebsschiene nie als Kurve | Siehe schiene.detektor-aktivierung-gerade. |
| `pruefer.antrieb-ohne-quelle` – Prüfer: Antriebsschiene ohne Stromquelle in Reichweite | Siehe antrieb.reichweite. |
| `pruefer.wasser-zerstoert` – Prüfer: Wasser zerstört etwas | Siehe fluessigkeit.wegspuelen. |
| `pruefer.licht-unklar` – Prüfer: Lichtquelle mit zustandsabhängiger Stärke | Kerze (1 bis 4 Kerzen, angezündet), Seegurke (1–4, im Wasser), Respawn-Anker (Ladung 0–4): Wie hell ist es jeweils? Mit einem Lichtblock vergleichen und die Stufe melden. |
| `schiene.linie-verlaengern` – Eine Linie wird in derselben Richtung verlängert | Kreativ-Testwelt auf ebenem Boden: eine Schiene setzen, daneben in Ost-West-Richtung eine zweite, dann eine dritte in derselben Reihe. Erwartung: alle drei liegen Ost-West. Dasselbe in Nord-Süd-Richtung. Abweichungen melden. |
| `schiene.zwei-nachbarn` – Zwei Nachbarn: verbinden, gerade oder als Kurve | Zwei Schienen im rechten Winkel zueinander setzen (z. B. eine im Westen, eine im Norden einer freien Stelle) und dazwischen die Ecke legen: Kurve? Dann die Ecke so legen, dass drei Schienen Nachbarn sind (siehe schiene.t-stelle). |
| `schiene.nachbar-umstellen` – Nachbarschienen stellen sich auf die neue Schiene ein | Eine Ost-West-Linie aus drei Schienen legen, dann an das Ende der Mittelschiene seitlich (Nord) eine vierte setzen: Bleibt die Linie unverändert, oder dreht sich die Mittelschiene? Ergebnis melden. |
| `schiene.kurvenwahl` – Kurvenwahl bei mehreren Möglichkeiten (Reihenfolge der Eck-Paare) | Drei einzelne Schienen so setzen, dass West, Süd und Nord einer freien Stelle belegt sind (kein Ost), dann die Mitte setzen: Welche Kurve entsteht (Blockwerk erwartet West-Süd)? Dann alle vier Nachbarn (Kreuzung): Blockwerk erwartet Ost-Süd. |
| `schiene.rampe` – Rampe zur Schiene eine Ebene höher | Auf Boden einen Block-Absatz bauen: unten drei Schienen in einer Linie, oben am Absatz eine Schiene direkt am Rand der Linie, in der Fluchtlinie. Erwartung: die letzte untere Schiene steigt zur oberen an. Dann umgekehrte Reihenfolge des Setzens und das Ergebnis vergleichen. |
| `schiene.bevorzugung` – Rampen: West vor Ost, Süd vor Nord | Nur noch die Achsen-Mischung offen: links (West) und unten (Süd) je eine Schiene einen Block höher, in der Mitte unten eine Schiene setzen: Steigt sie nach Westen oder nach Süden an? |
| `schiene.detektor-aktivierung-gerade` – Detektor- und Aktivierungsschiene: auch gerade? | Detektorschiene und Aktivierungsschiene jeweils an eine Schiene im rechten Winkel setzen (Ecke): Bleibt sie gerade, oder wird sie eine Kurve? Je Schienenart melden. |
| `takt.uebertrager-verzoegerung` – Übertrager: Schreibzeitpunkt bei Verzögerung d | Kreativ-Testwelt: Hebel → Verstärker mit Verzögerung 4 (4× Rechtsklick) → Lampe. Mit Video (60 fps) die Zeit zwischen Hebelklick und Lampe messen: Erwartung 0,4 s (8 Spielticks); bei Verzögerung 1: 0,1 s. Dann zwei Verstärker (je Verzögerung 1) hintereinander: Erwartung 0,2 s. |
| `takt.geplante-ticks-ueberlauf` – Geplante Ticks: Überlauf | Kreativ-Testwelt: eine große Wasserfläche (z. B. 40×40 Quellblöcke) auf einmal fließen lassen (Block unter dem Becken entfernen) und beobachten, ob sich der Abfluss verlangsamt, ohne dass Wasser fehlt. Ergebnis: schnell/verzögert/Wasser fehlt. |
| `takt.zufallsticks` – Zufallsticks | Wird zusammen mit der ersten Wachstums-Mechanik angelegt (z. B. Weizenreife über eine Zeitspanne messen). |
| `takt.tickbereich` – Tickbereich | Kreativ-Testwelt: Wasserfall- oder Pflanzenfarm bauen, dich 10 Chunks entfernen und zurückkehren: Hat sie sich währenddessen weiterbewegt (z. B. Weizen gewachsen)? Dazu die Simulationsdistanz deines Aternos-Servers nennen. |
| `takt.arbeitsreihenfolge` – Arbeitsreihenfolge innerhalb eines Spielticks | Kreativ-Testwelt: zwei gleichzeitige Ereignisse an einem Block (z. B. Kolben schiebt Block, während ein Beobachter ihn sieht) in beiden Spiegelungen bauen und prüfen, ob das Ergebnis gleich bleibt. Abweichungen melden. |

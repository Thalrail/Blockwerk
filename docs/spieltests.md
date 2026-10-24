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

## Ergebnisse Antrieb (Jonah, 24.10.2026)
| Nr. | Test | Ergebnis | Status |
|---|---|---|---|
| 1 | Reichweite | Von der gepowerten Schiene werden nach rechts wie nach links 8 Schienen mitgepowert, insgesamt 17 | **geprüft** (`antrieb.reichweite`) |
| 2 | Normale Schiene dazwischen | Sobald eine andere Schiene kommt, muss der nächste Abschnitt danach an Antriebsschienen neu gepowert werden | **geprüft** (`antrieb.nur-verbundene`) |
| 3a | Redstone-Block | Rechts und links neben der Schiene, über der Schiene, am Anfang und am Ende; von unten, wenn die Schiene direkt über dem Block liegt | **geprüft** (`antrieb.stromblock`) |
| 3b | Redstonefackel | Links und rechts neben der Schiene; darf von unten stehen oder an einem Nachbarblock hängen (Fotos 1 und 2) | eingetragen (links/rechts geprüft, Rest offen) |
| 3c | Hebel | An allen Seiten der Schiene; auch an einem angrenzenden Block befestigt (Foto 3), dann wird die Schiene immer aktiviert | eingetragen, Lage „angrenzender Block“ noch zu klären |
| 4 | Lorenphysik | Messungen A–F in `docs/messungen-lore.md` – macht Jonah als Nächstes | offen |

**Offen für die Fackel:** vorn und hinten (Anfang/Ende), über und unter der Schiene. **Offen für den Hebel:** Wie genau liegt der Hebel bei „an einem angrenzenden Block befestigt“ (steht er selbst neben der Schiene oder weiter weg)?

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
0. **Seit 24.10.2026 gilt Java für dünne Blöcke (Filter 0, wie Luft).** Nur testen, wenn im Spiel etwas dunkler oder heller aussieht als in Blockwerk: dann melde den Block und die Beobachtung, ich korrigiere genau diesen Eintrag.
1. **Dünne Blöcke:** Fackel hinter einer Reihe aus Schienen, Teppich, Blume, Schild, Redstone-Staub: Ist es dahinter hell? Danach je eine 1-Block-Wand aus Glasscheibe, getöntem Glas, Treppe, Halbstufe (oben/unten), Zaun, Tür, Falltür mit Fackel dahinter: Licht dringt durch, schwächer oder gar nicht? (`licht.unbekannte-filter`)
2. **Reichweite einer Fackel:** wie viele Blöcke weit ist der Boden noch „hell“ (kein Monsterspawn)? Blockwerk erwartet 13. (`licht.blocklicht`)
3. **Kerzen und Seegurken:** wie hell ist 1, 2, 3, 4 Kerzen? Siehe `pruefer.licht-unklar`.

## Spawnstellen: die wichtigsten Tests (Ebene 1)
Alle in einem komplett dunklen Raum aus Stein (Höhle oder Raum ohne Licht und ohne Himmel), Kreativmodus, Schwierigkeit „Normal“ oder höher, Nacht oder ohne Himmel. Warte einige Minuten und beobachte.
1. **Welcher Boden zählt?** Je eine Fläche von 5×5 mit Glas, Laub, oberer Halbstufe, Seelensand, unterer Halbstufe, Teppich, Zaun: Auf welchen spawnen Zombies? (`spawn.boden-unklar`, `spawn.boden`)
2. **Wie viel Platz?** Gänge: 1 breit × 2 hoch, 3 breit × 1 hoch, 3 breit × 2 hoch (alle dunkel): Welche Monster (Zombie, Spinne) spawnen wo? (`spawn.platz`)
3. **Licht:** Eine Fackel mitten im Raum: Bis wohin spawnen keine Monster? Blockwerk erwartet: im Umkreis von 13 Blöcken (Taxi-Abstand) nicht. (`spawn.blocklicht`)

## Lore: Ergebnisse und offene Tests (Ebene 1)
Deine Messungen vom 24.10.2026 stehen in `docs/messungen-lore.md` und als `geprüft` in `data/regeln/lore.json`. Offen sind drei Tests (Standard-Start wie in den Messungen):
1. **Abstand 9 auf ebener Strecke** (jede 9. Schiene eine Antriebsschiene, mindestens 5 Antriebsschienen): kommt die Lore durch? (`lore.abstand-eben`, Blockwerk meldet bisher „unklar“)
2. **Rampen über 5 Blöcke** (8 und 12 Blöcke hoch, Antriebsschiene alle 3 Blöcke, erste Steigschiene angetrieben): kommt sie ganz hoch? (`lore.rampe-ueber-5`)
3. **Rampe mitten in einer langen Antriebsstrecke** (Lore schon voll beschleunigt): reicht Abstand 6 noch, ab wann bleibt sie stehen? (`lore.fahrt-im-antrieb`)

## Ebene 1: Regeln mit Annahmen (ungeprüft)
Diese Regeln hat die Engine umgesetzt, aber Bedrock dokumentiert sie nicht eindeutig oder sie sind abgeleitet. Der Status bleibt `ungeprüft`, bis du sie im Spiel bestätigst. Die Texte stehen auch in `data/regeln/*.json`.

| Regel | Was testen |
|---|---|
| `antrieb.redstonefackel` – Redstonefackel neben der Schiene versorgt sie | Redstonefackel vor und hinter dem Ende einer einzelnen Antriebsschiene (in der Verlängerung der Schiene), außerdem über und unter der Schiene (soweit möglich): Wird die Schiene bestromt? Ergebnis je Lage melden. (Links und rechts hat Jonah bestätigt.) |
| `antrieb.hebel` – Eingeschalteter Hebel an bestimmten Blöcken versorgt die Schiene | Hebel (eingeschaltet) an den genannten Blöcken wie in der Regel beschrieben: Prüfen, ob die Schiene bestromt wird, und besonders, ob Seiten-Hebel (east/west/south/north) an dem Block sitzen, an dem du ihn setzt (Blockwerk nimmt an: der Hebel zeigt von seinem Block weg). Auch Hebel an der Unterseite eines Blocks (Hebel an der Decke) prüfen. Ergebnis melden. |
| `fluessigkeit.lava-oberwelt` – Lava (Oberwelt, Ende): 3 Blöcke weit, ein Block alle 30 Ticks | Kreativ-Testwelt: Lava-Quelle auf ebenem Stein setzen, mit Video messen: Wie weit kommt die Lava (erwartet 3 Blöcke) und wie lange braucht jeder Block (erwartet 1,5 s)? Im Nether: 7 Blöcke, 0,5 s je Block. |
| `fluessigkeit.lava-nether` – Lava (Nether): 7 Blöcke weit, ein Block alle 10 Ticks | Siehe fluessigkeit.lava-oberwelt (Nether-Teil). |
| `fluessigkeit.fallen` – Fließen nach unten ohne Grenze | Wasserfall aus 10 Blöcken Höhe auf ebenen Stein: Wie weit breitet sich das Wasser unten aus? Außerdem: eine Wasserquelle in die Luft setzen (an eine Wand lehnen und dann die Wand entfernen oder mit Blöcken eine Plattform bauen und wegnehmen): Fällt nur eine Säule, oder entsteht eine Plus-Form aus fünf Säulen? Blockwerk erwartet bei der freien Quelle ein Plus. |
| `fluessigkeit.gefaelle` – Gefälle in höchstens 4 Blöcken wird bevorzugt | Quelle auf ebenem Stein, ein Loch (1 Block tief) im 3. Block östlich und ein Loch im 6. Block westlich: Fließt das Wasser nur nach Osten zum Loch und nicht nach Westen? Dann mit dem Loch im 4., 5. und 6. Block östlich wiederholen: Bis zu welchem Block bevorzugt das Wasser die Richtung? Blockwerk erwartet bis zum 5. Block. |
| `fluessigkeit.unten-vor-seitlich` – Erst nach unten, seitlich nur ohne Weg nach unten | Quelle direkt über einem Loch (2 Blöcke tief) auf ebenem Stein: Breitet sich Wasser auf der Oberfläche seitlich aus, oder fließt es nur in das Loch? Ergebnis melden. |
| `fluessigkeit.mischen` – Wasser und Lava mischen | Kreativ-Testwelt: (1) Wasserquelle neben Lava-Quelle, (2) Wasserfluss trifft Lavafluss, (3) Lava fließt von oben auf Wasser, (4) Wasserquelle unter einer Lava-Quelle. Je Fall melden: Obsidian, Bruchstein, Stein oder nichts. |
| `fluessigkeit.wegspuelen` – Wasser spült bestimmte Blöcke weg | Wasser neben Fackel, Schiene, Teppich, Redstone-Staub, Knopf, Druckplatte, Leiter, Schild, Trichter, Schalter: Welche werden weggespült? Ergebnis je Block melden. |
| `fluessigkeit.abklingen` – Abklingen ohne Nachschub | Wasserquelle auf ebenem Stein, Wasser sich ausbreiten lassen, Quelle entfernen, mit Video messen: Wie lange, bis alles Wasser weg ist? Verschwindet es von außen nach innen oder von innen nach außen? |
| `fluessigkeit.hindernisse` – Nur feste Blöcke halten Flüssigkeit auf | Wasser neben Treppe (Vorder- und Rückseite), Halbstufe (oben/unten), Zaun, Glasscheibe, Leiter, Schild, Tür, Falltür, Mauer: Fließt es hinein, vorbei oder hält der Block es auf? Ergebnis je Block melden. |
| `licht.blocklicht` – Blocklicht nimmt um 1 je Block ab | Kreativ-Testwelt, dunkle Höhle oder Raum ohne Himmel: Eine Fackel (Stärke 14) in der Mitte eines großen Raums. Mit einem Lichtblock (/give @s light_block ["block_light_level"=…]) oder Beobachtung der Monsterspawns prüfen, wie weit das Licht reicht. Erwartung: 13 Blöcke Entfernung noch Licht 1, ab 14 Blöcken dunkel. |
| `licht.himmelslicht` – Himmelslicht: senkrecht ungeschwächt, seitlich minus 1 | Tagsüber: ein 1×1-Schacht, 20 Blöcke tief, mit Dach daneben. Ganz unten im Schacht ist es hell (Himmelslicht 15). Zeigt der waagerechte Gang vom Schachtboden aus, nach wie vielen Blöcken er dunkel wird (erwartet 15)? Mit Spawn-Beobachtung oder Lichtblock-Vergleich. |
| `licht.filter` – Lichtfilter von Laub, Wasser und Halbstufen | Fackel hinter einer 1-Block-Wand aus Laub, dann aus Wasser (Eimer in einem 1-Block-Loch): Wie viel dunkler ist es dahinter als durch Luft (eine Stufe weniger = Wiki-Filterwert, zwei Stufen weniger = „plus 1“)? Mit Lichtblöcken vergleichen und die Differenz melden. |
| `licht.durchsichtig` – Glas und Teppiche lassen Licht durch wie Luft | Fackel hinter einer 1-Block-Wand aus Glas, aus Teppich (Teppich auf dem Boden, Fackel auf gleicher Höhe wie der Teppich) und aus einem Block Lava: Wird es dahinter hell wie durch Luft? Bei Lava dunkel? Ergebnis je Block melden. |
| `licht.unbekannte-filter` – Unbekannte Lichtfilter werden mit zwei Schranken gerechnet | Der wichtigste Test: Fackel hinter einer Reihe aus Schienen, Teppich, Blume, Schild, Redstone-Staub: Ist es dahinter hell? Dann je Block eine 1-Block-Wand mit Fackel dahinter: (1) Glasscheibe, (2) getöntes Glas, (3) Treppe, (4) untere Halbstufe, (5) obere Halbstufe, (6) Zaun, (7) Tür, (8) Falltür. Je Block melden: Licht dringt durch, schwächer oder gar nicht? |
| `licht.himmel-innen` – Inneres Himmelslicht für Spawnregeln | Siehe licht.himmelslicht; zusätzlich nachts im Freien und in einer Höhle mit schmalem Zugang: Spawnen Monster am Höhleneingang, wo das Himmelslicht schwach ist? |
| `licht.treppen-halbstufen` – Treppen und Halbstufen sperren Licht über ihre vollen Flächen | Dunkler Raum, Fackel hinter einer Wand mit einem Loch, in das eine Treppe gesetzt wird (Rückseite zur Fackel, von der Fackel weg, zur Seite, kopfstehend) und eine untere/obere Halbstufe: Wird es dahinter hell, wie Blockwerk es sagt (Rückseite zur Fackel oder von ihr weg: dunkel; zur Seite und bei Halbstufen: hell)? Außerdem Decke aus unteren und oberen Halbstufen mit Himmel darüber: Wird es darunter dunkel? Abweichungen melden. |
| `lore.rampe-ueber-5` – Rampen über 5 Blöcke Höhe | Rampen mit 8 und 12 Blöcken Höhe, Antriebsschiene alle 3 Blöcke, erste Steigschiene angetrieben: Kommt die Lore ganz hoch? Dann alle 6 Blöcke: Wie viele Blöcke Höhe schafft sie? |
| `lore.fahrt-im-antrieb` – Fahrt mit Restgeschwindigkeit | Rampe, die mitten in einer langen Antriebsstrecke beginnt (Lore schon voll beschleunigt): Reicht Antrieb alle 6 Blöcke noch, oder darf der Abstand größer sein? Ab welchem Abstand bleibt sie stehen? |
| `pruefer.braucht-halt-fackel` – Prüfer: Fackel braucht Halt | Noch ungetestete Formen: Fackel oben auf einer Treppe (richtig herum und kopfüber), auf einer oberen Halbstufe, an Mauer, Falltür, Laub, Eis, Trichter, Kessel. Je Form melden: hält oben / hält seitlich / hält nicht. Auch prüfen, ob andere Varianten derselben Form (Stein-Treppe, Birkenzaun, gefärbtes Glas) gleich reagieren. |
| `pruefer.braucht-halt-schiene` – Prüfer: Schiene braucht Boden | Noch ungetestete Formen: Schiene auf Mauer, Falltür, Laub, Eis, Trichter, Kessel, Seelensand, Honigblock. Je Form melden: bleibt liegen / springt ab. |
| `pruefer.tickbereich` – Prüfer: Anlage im tickenden Bereich | Siehe takt.tickbereich. |
| `pruefer.schiene-verbindung` – Prüfer: Schienen sind miteinander verbunden | Eine T-Stelle bauen und die Lore (oder dich in einer Lore) darüberfahren lassen: kommt sie am Abzweig durch, bleibt sie stehen oder fährt sie in die Kurve? Ergebnis melden. |
| `pruefer.antriebsschiene-kurve` – Prüfer: Antriebsschiene nie als Kurve | Siehe schiene.detektor-aktivierung-gerade. |
| `pruefer.antrieb-ohne-quelle` – Prüfer: Antriebsschiene ohne Stromquelle in Reichweite | Siehe antrieb.reichweite. |
| `pruefer.wasser-zerstoert` – Prüfer: Wasser zerstört etwas | Siehe fluessigkeit.wegspuelen. |
| `pruefer.licht-unklar` – Prüfer: Lichtquelle mit zustandsabhängiger Stärke | Kerze (1 bis 4 Kerzen, angezündet), Seegurke (1–4, im Wasser), Respawn-Anker (Ladung 0–4): Wie hell ist es jeweils? Mit einem Lichtblock vergleichen und die Stufe melden. |
| `pruefer.spawn-moeglich` – Prüfer: Monster können hier spawnen | Siehe spawn.platz und spawn.boden-unklar. |
| `pruefer.lore-stillstand` – Prüfer: Lore bleibt stehen | Siehe lore.rampe-ueber-5 und lore.fahrt-im-antrieb. |
| `schiene.linie-verlaengern` – Eine Linie wird in derselben Richtung verlängert | Kreativ-Testwelt auf ebenem Boden: eine Schiene setzen, daneben in Ost-West-Richtung eine zweite, dann eine dritte in derselben Reihe. Erwartung: alle drei liegen Ost-West. Dasselbe in Nord-Süd-Richtung. Abweichungen melden. |
| `schiene.zwei-nachbarn` – Zwei Nachbarn: verbinden, gerade oder als Kurve | Zwei Schienen im rechten Winkel zueinander setzen (z. B. eine im Westen, eine im Norden einer freien Stelle) und dazwischen die Ecke legen: Kurve? Dann die Ecke so legen, dass drei Schienen Nachbarn sind (siehe schiene.t-stelle). |
| `schiene.nachbar-umstellen` – Nachbarschienen stellen sich auf die neue Schiene ein | Eine Ost-West-Linie aus drei Schienen legen, dann an das Ende der Mittelschiene seitlich (Nord) eine vierte setzen: Bleibt die Linie unverändert, oder dreht sich die Mittelschiene? Ergebnis melden. |
| `schiene.kurvenwahl` – Kurvenwahl bei mehreren Möglichkeiten (Reihenfolge der Eck-Paare) | Drei einzelne Schienen so setzen, dass West, Süd und Nord einer freien Stelle belegt sind (kein Ost), dann die Mitte setzen: Welche Kurve entsteht (Blockwerk erwartet West-Süd)? Dann alle vier Nachbarn (Kreuzung): Blockwerk erwartet Ost-Süd. |
| `schiene.rampe` – Rampe zur Schiene eine Ebene höher | Auf Boden einen Block-Absatz bauen: unten drei Schienen in einer Linie, oben am Absatz eine Schiene direkt am Rand der Linie, in der Fluchtlinie. Erwartung: die letzte untere Schiene steigt zur oberen an. Dann umgekehrte Reihenfolge des Setzens und das Ergebnis vergleichen. |
| `schiene.bevorzugung` – Rampen: West vor Ost, Süd vor Nord | Nur noch die Achsen-Mischung offen: links (West) und unten (Süd) je eine Schiene einen Block höher, in der Mitte unten eine Schiene setzen: Steigt sie nach Westen oder nach Süden an? |
| `schiene.detektor-aktivierung-gerade` – Detektor- und Aktivierungsschiene: auch gerade? | Detektorschiene und Aktivierungsschiene jeweils an eine Schiene im rechten Winkel setzen (Ecke): Bleibt sie gerade, oder wird sie eine Kurve? Je Schienenart melden. |
| `spawn.himmelslicht` – Inneres Himmelslicht: bis 6 sicher ja, ab 8 sicher nein, 7 unklar | Nur der Grenzwert 7 ist offen (am Tag unter einem Dach, wo das Himmelslicht schwach wird): Spawnen Zombies in einem sonst dunklen Gang, in den von der Seite Tageslicht fällt, dort, wo das Himmelslicht noch 7 beträgt? Praktisch: Tagsüber in einer Höhle mit offenem Eingang die Stelle suchen, bis zu der Monster am Tag noch hineinwandern/spawnen, und die Entfernung zum Eingang melden. |
| `spawn.boden-unklar` – Boden: Glas, Laub, obere Halbstufe, Seelensand | Kreativ-Testwelt, Nacht oder dunkler Raum, ohne Licht: Auf Glas, Laub, oberer Halbstufe und Seelensand je eine Fläche von 5×5 bauen (3 Blöcke Luft darüber, Wände ringsum): Spawnen dort nach einigen Minuten Zombies? Ergebnis je Boden melden. |
| `spawn.fuesse` – Fuß-Zelle: Luft, Gras und Blumen ja, Teppich nein, sonst unklar | Dunkler Raum: Auf einem Steinboden stehen (a) Gras/Blumen, (b) eine Schiene, (c) eine Druckplatte, (d) ein Schild, (e) ein Setzling, (f) ein Teppich auf dem Boden. Spawnen auf diesen Feldern Zombies (Füße im Block)? Je Fall melden. |
| `spawn.platz` – Platz für die Hitbox, Füße in Luft | Kreativ-Testwelt, dunkler Raum: (1) Gang 1 Block breit und 2 hoch, (2) 3 breit und 1 hoch, (3) 3 breit und 2 hoch, jeweils ohne Licht: Welche Monster (Zombie, Spinne) spawnen wo? Ergebnis melden. |
| `takt.uebertrager-verzoegerung` – Übertrager: Schreibzeitpunkt bei Verzögerung d | Kreativ-Testwelt: Hebel → Verstärker mit Verzögerung 4 (4× Rechtsklick) → Lampe. Mit Video (60 fps) die Zeit zwischen Hebelklick und Lampe messen: Erwartung 0,4 s (8 Spielticks); bei Verzögerung 1: 0,1 s. Dann zwei Verstärker (je Verzögerung 1) hintereinander: Erwartung 0,2 s. |
| `takt.geplante-ticks-ueberlauf` – Geplante Ticks: Überlauf | Kreativ-Testwelt: eine große Wasserfläche (z. B. 40×40 Quellblöcke) auf einmal fließen lassen (Block unter dem Becken entfernen) und beobachten, ob sich der Abfluss verlangsamt, ohne dass Wasser fehlt. Ergebnis: schnell/verzögert/Wasser fehlt. |
| `takt.zufallsticks` – Zufallsticks | Wird zusammen mit der ersten Wachstums-Mechanik angelegt (z. B. Weizenreife über eine Zeitspanne messen). |
| `takt.tickbereich` – Tickbereich | Kreativ-Testwelt: Wasserfall- oder Pflanzenfarm bauen, dich 10 Chunks entfernen und zurückkehren: Hat sie sich währenddessen weiterbewegt (z. B. Weizen gewachsen)? Dazu die Simulationsdistanz deines Aternos-Servers nennen. |
| `takt.arbeitsreihenfolge` – Arbeitsreihenfolge innerhalb eines Spielticks | Kreativ-Testwelt: zwei gleichzeitige Ereignisse an einem Block (z. B. Kolben schiebt Block, während ein Beobachter ihn sieht) in beiden Spiegelungen bauen und prüfen, ob das Ergebnis gleich bleibt. Abweichungen melden. |

## Hebel an der Antriebsschiene (Jonah, 24.10.2026)
Schiene bei 96,-60,-4. Der Hebel versorgt sie, wenn er irgendwo an einem dieser Blöcke sitzt: 96,-60,-4; 97,-60,-4; 96,-60,-5; 95,-60,-4; 96,-60,-3; 97,-59,-4; 96,-59,-5; 95,-59,-4; 96,-59,-3; 96,-58,-4. Seit dem Update im Code (antrieb.hebel). Gemeint: „auf“ = Oberseite, „irgendwo an“ = jede Seite (oben, unten, seitlich), solange Platz ist.

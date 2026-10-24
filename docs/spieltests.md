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

## Fallende Blöcke: die wichtigsten Tests (Ebene 1)
Kreativ-Testwelt, Koordinaten an, Video (60 fps) für Zeiten. Alles Java-Platzhalter, also nur prüfen, wenn dir im Spiel etwas anders vorkommt:
1. **Tempo:** Sand 10 Blöcke hoch fallen lassen, Fallzeit messen (Blockwerk: 9 Ticks je Block, also 4,5 s). (`fallen.tempo`)
2. **Fackel, Schiene, Staub, Halbstufe, Seelensand:** Sand von oben darauf: Gegenstand, liegen bleiben oder durchfallen? (`fallen.landen-gegenstand`, `fallen.durch-fackel`)
3. **Betonpulver im Wasser:** neben, über und in Wasser fallen lassen und liegen lassen. (`fallen.betonpulver`)
4. **Treppe, Zaun, Falltür, Glasscheibe darunter:** Sand fallen lassen. (`fallen.unbekannt`)

## Trichter und Blockinhalte: die wichtigsten Tests (Ebene 1)
Kreativ-Testwelt, Video (60 fps) für Zeiten. Alles Java-Platzhalter, nur prüfen, wenn dir im Spiel etwas anders vorkommt:
1. **Tempo:** Kiste mit 64 Gegenständen → Trichter → Kiste. Blockwerk erwartet 8 Ticks je Gegenstand (rund 25,6 s). (`trichter.cooldown`)
2. **Redstone-Sperre:** Redstone-Block neben den Trichter: Bleibt er stehen? Empfängt er von oben? (`trichter.sperre`)
3. **Stapelgrößen:** Enderperlen, Eier, Schilder, Tränke, Schwerter, Betten, Kuchen einzeln in eine Kiste: Wie viele passen in einen Slot? (`trichter.stapel`)
4. **Komparator:** Kiste mit 1, 64, 1728 Steinen und mit 16 Enderperlen je Slot füllen und die Signalstärke ablesen. (`trichter.komparator`)
5. **Ofen:** Trichter über, neben und unter einem Ofen. (`trichter.unklar`)

## Redstone-Strom: die wichtigsten Tests (Ebene 1)
Kreativ-Testwelt auf Stein. Alles Java-Platzhalter, nur prüfen, wenn dir im Spiel etwas anders vorkommt:
1. **Reichweite:** Hebel/Redstone-Block am Anfang einer geraden Staubleitung aus 20 Blöcken: Bei welchem Staubblock geht sie aus? Blockwerk erwartet: 15 leuchten. (`redstone.staub-abnahme`)
2. **Stark/schwach:** Staub → Stein → Staub: Bekommt der zweite Staub Strom? Dasselbe mit einem Hebel am Stein. (`redstone.stark-schwach`)
3. **Fackelturm:** 2 und 3 Fackeln übereinander mit Hebel am untersten Block. (`redstone.fackel-invertiert`)
4. **Hebel-Lagen:** Hebel an allen Seiten eines Steins mit Staub daneben. (`redstone.hebel`)
5. **Aktivierungsschiene:** 20 Schienen, Redstone-Block neben der ersten (erwartet 9) und in der Mitte (17). (`redstone.aktivierungsschiene`)
6. **Detektorschiene:** Lore über die Schiene, Staub daneben. (`redstone.detektorschiene`)

## Redstone-Zeit: die wichtigsten Tests (Ebene 1)
Kreativ-Testwelt, Video (60 fps), Zeiten in Spielticks (1 Tick = 0,05 s). Alles Java-Platzhalter, nur prüfen, wenn dir im Spiel etwas anders vorkommt:
1. **Fackelkette:** Hebel → Stein → Fackel (seitlich) → Stein → Fackel …: Zeit bis zur Lampe am Ende bei 1, 2, 5 Fackeln (erwartet 2, 4, 10 Ticks). (`zeit.fackel-verzoegerung`)
2. **Repeater:** Verzögerung 1, 2, 3, 4 (erwartet 2, 4, 6, 8 Ticks); auf welcher Seite ist der Eingang bei Blick nach N/O/S/W? (`zeit.repeater-verzoegerung`)
3. **Brennen:** Fackel mit Rückkopplung über Staub: Brennt sie aus (erwartet nach 8 Wechseln in 60 Ticks) und geht sie nach etwa 3 Sekunden wieder an? (`zeit.fackel-brennen`)
4. **Komparator:** Behälter hinten, Staub mit Stärke 5, 8, 9 an der Seite, beide Modi (erwartet Vergleich 8, 8, 0; Subtraktion 3, 0, 0). (`zeit.komparator-modi`)
5. **Knöpfe:** Stein (1 s), Holz (1,5 s). (`zeit.knopf-dauer`)

## Redstone-Mechanismen: die wichtigsten Tests (Ebene 1)
Kreativ-Testwelt, Video (60 fps). Alles Java-Platzhalter, nur prüfen, wenn dir im Spiel etwas anders vorkommt:
1. **Lampe:** Hebel – Staub – Lampe: Zeit bis zum Ausgehen nach dem Ausschalten (erwartet 6 Ticks, 0,3 s). (`mech.lampe`)
2. **Lagen der Lampe:** Staub zeigend/wegzeigend/Punkt, Fackel daneben, Redstone-Block oben/unten, Repeater davor. (`mech.bestromung`)
3. **Beobachter:** Block vor ihm setzen/entfernen, Pflanze wachsen lassen: Impuls (erwartet 2 Ticks) und auf welcher Seite er herauskommt. (`mech.beobachter`, `mech.beobachter-richtung`)
4. **Tagessensor:** Signalstärke um 6:00, 9:00, 12:00, 15:00, 18:00, 20:00 und 24:00, mit Regen, mit Dach, invertiert (erwartet mittags 15, nachts 0; invertiert nachts 11). (`mech.tagessensor`, `mech.tagessensor-invertiert`)
5. **Türen:** Tür, Falltür, Zauntor mit Redstone-Block. (`mech.tueren`)

## Kolben: die wichtigsten Tests (Ebene 1)
Kreativ-Testwelt, Video (60 fps). Alles Java-Platzhalter, nur prüfen, wenn dir im Spiel etwas anders vorkommt:
1. **Grenze:** Kolben vor 12 und 13 Steinen: 12 ja, 13 nein. (`kolben.limit`)
2. **Zeit:** Hebel am Kolben, Zeit bis zum Kopf (erwartet 4 Ticks nach dem ersten C-Tick). (`kolben.start`, `kolben.dauer`)
3. **Unbewegliches:** Obsidian, Plattenspieler, Schleifstein, Leitstein, Verzauberungstisch vor dem Kolben. (`kolben.unbeweglich`)
4. **Zerstörbares:** Fackel, Blume, Staub, Knopf, Tür, Leiter, Schild; Teppich und Schiene werden geschoben. (`kolben.zerstoert`)
5. **Behälter:** Truhe (einzeln/doppelt), Fass, Ofen, Trichter, Werfer, Shulkerkiste. (`kolben.behaelter`)
6. **Klebriger Kolben:** was zieht er zurück (Stein, Obsidian, Fackel, zwei Steine)? (`kolben.klebrig`)

## Bewegung: die wichtigsten Tests (Ebene 1)
Kreativ-Testwelt auf Stein; für Dorfbewohner ein Dorfbewohner-Ei oder Handel. Alles Java-Platzhalter, nur prüfen, wenn dir im Spiel etwas anders vorkommt:
1. **Springen:** 1 Block hoch (ja), 1,5 Blöcke (Zaun, nein), 2 Blöcke (nein). (`bewegung.sprung`)
2. **Treppe und Halbstufe:** ohne Sprung hinauf? (`bewegung.stufe`, `bewegung.treppe`)
3. **Fallen:** 3, 4, 5, 10 Blöcke: Herzhälften Schaden; Dorfbewohner von 3 und 4 Blöcken. (`bewegung.fallen`)
4. **Lücken:** 1, 2, 3 Blöcke breit. (`bewegung.luecke`)
5. **Türen:** Holz-, Kupfer-, Eisentür, Falltür, Zauntor mit Dorfbewohner und Spieler. (`bewegung.tueren`)
6. **Gang 1 Block hoch:** Baby, Spieler (kriechend). (`bewegung.hitbox`)

## Formen: Sichttest (Ebene 2)
Die Formen sind reine Mathematik und brauchen keinen Spieltest. Wenn du trotzdem schauen willst, ob eine Rundung im Spiel gut aussieht: Baue in der Kreativwelt einen Kreis mit 11 Blöcken Breite und einen mit 12 Blöcken (Mitte bei 11 auf einem Block, bei 12 zwischen zwei Blöcken) nach dem Schichtplan der Seite und prüfe, ob alle vier Seiten gleich aussehen. Dasselbe mit einer Kuppel von 20 Blöcken Breite (Höhe 5 Schichten).

## Bogen und Dach: Sichttest (Ebene 2)
Reine Mathematik, kein Spieltest nötig. Zum Anschauen in der Kreativwelt: ein Bogen mit 9 Blöcken lichter Weite (Pfeiler 2 hoch, Stich knapp 3) und ein Satteldach mit 11 Blöcken Breite (Firsthöhe 5 bis 6) nach den Querschnitten der Tests nachbauen und prüfen, ob beide Seiten gleich aussehen und ein Spieler unter dem Bogen durchpasst.

## Bauelemente: Türen und Treppen (Ebene 2)
Kreativwelt. Gebaut wird nach den Plänen der Seite; geprüft wird nur die Lage der Blockzustände (`bau.zustaende`):
1. **Tür:** einfache Tür mit Richtung Norden in eine Ost-West-Mauer setzen. Liegt die Türplatte quer zum Weg nach Norden, mit dem Scharnier links, und lässt sie sich durchqueren?
2. **Doppeltür:** zwei Türen nebeneinander, Scharniere außen: öffnen sie beide nach außen?
3. **Treppe:** Aufstieg nach Norden, 4 Stufen: geht es nach Norden hoch? Eine Wendeltreppe mit Radius 1 (8 Stufen je Umdrehung) im Uhrzeigersinn: stimmt die Laufrichtung?

## Bahn-Module: Sichttest (Ebene 2)
Die Abstände stammen aus deinen Messungen (`lore.*`, geprüft). Zum Anschauen: eine Antriebsstrecke mit 4 Abschnitten à 4 normalen Schienen und einer Antriebsschiene mit Redstone-Block darunter nach Norden bauen und eine Lore starten; ebenso eine Rampe 3 Blöcke hoch und eine Kurve mit 3 Schienen je Schenkel. Fährt die Lore durch?

## Handelsnische und Bett: Tests (Ebene 2)
Kreativwelt. Die Nische ist eine Reihe von Zellen (Plan in der Oberfläche später; bis dahin nach den Querschnitten der Tests):
1. **Zelle dicht:** Dorfbewohner (Ei) in eine Zelle setzen, Bett dahinter, Berufsblock davor, darüber Scheiben. Bleibt er drin, bekommt er den Beruf des Blocks? (`tech.nische`)
2. **Handeln durch die Scheibe:** Kann man durch die Scheiben mit ihm handeln? Wenn nicht: welche Blockart vorn funktioniert (Eisenstäbe, Falltür, Zaun)? (`tech.nische`)
3. **Reihenfolge:** Drei Nischen nebeneinander. Berufsblöcke und Dorfbewohner einmal von links nach rechts, einmal in umgekehrter Reihenfolge setzen: Nimmt jeder den Beruf seines eigenen Blocks? Bedrock vergibt den ersten Block der Liste, egal wie weit; welche Reihenfolge ist die „Liste“ im Spiel? (`dorf.zuordnung`)
4. **Bett drehen:** Vier Betten mit dem Kopf nach Süden, Westen, Norden, Osten bauen, als Struktur speichern und um 90° gedreht laden: Zeigt der Kopf in die erwartete Richtung? (Drehregel `minecraft:bed` / `direction`)

## Dorfbewohner: die wichtigsten Tests (Ebene 1)
Kreativ-Testwelt, Dorfbewohner-Ei oder ein Dorf; alles Java-Platzhalter, nur prüfen, wenn dir im Spiel etwas anders vorkommt:
1. **Berufsblock-Reichweite:** Dorfbewohner mit Bett, Lesepult 16 und 17 Blöcke entfernt, 4 und 5 Blöcke höher: Wird er Bibliothekar? (`dorf.berufsblock`)
2. **Berufsblock hinter Glas:** Ärger-Partikel, kein Beruf? (`dorf.berufsblock`)
3. **Bett mit Block darüber:** Beansprucht der Dorfbewohner es? (`dorf.bett`)
4. **Golem:** Dorf mit 9/10 Dorfbewohnern und 19/20 Betten: Spawnt ein Iron Golem? (`dorf.golem`)
5. **Berufe:** Jeder Berufsblock → richtiger Beruf? (`dorf.berufe`)

## Ebene 1: Regeln mit Annahmen (ungeprüft)
Diese Regeln hat die Engine umgesetzt, aber Bedrock dokumentiert sie nicht eindeutig oder sie sind abgeleitet. Der Status bleibt `ungeprüft`, bis du sie im Spiel bestätigst. Die Texte stehen auch in `data/regeln/*.json`.

| Regel | Was testen |
|---|---|
| `antrieb.redstonefackel` – Redstonefackel neben der Schiene versorgt sie | Redstonefackel vor und hinter dem Ende einer einzelnen Antriebsschiene (in der Verlängerung der Schiene), außerdem über und unter der Schiene (soweit möglich): Wird die Schiene bestromt? Ergebnis je Lage melden. (Links und rechts hat Jonah bestätigt.) |
| `antrieb.hebel` – Eingeschalteter Hebel an bestimmten Blöcken versorgt die Schiene | Hebel (eingeschaltet) an den genannten Blöcken wie in der Regel beschrieben: Prüfen, ob die Schiene bestromt wird, und besonders, ob Seiten-Hebel (east/west/south/north) an dem Block sitzen, an dem du ihn setzt (Blockwerk nimmt an: der Hebel zeigt von seinem Block weg). Auch Hebel an der Unterseite eines Blocks (Hebel an der Decke) prüfen. Ergebnis melden. |
| `bau.zustaende` – Zustände von Treppe und Tür | Eine Tür mit Richtung Norden und eine Doppeltür in einer Ost-West-Mauer, eine Treppe mit Aufstieg nach Norden bauen: Stimmt die Lage der Türplatte (Scharnier links/rechts) und zeigt die Treppe nach Norden hoch? |
| `bewegung.hitbox` – Größen von Spieler, Dorfbewohner und Baby | Baby-Dorfbewohner und Spieler durch einen 1 Block hohen Gang (Falltür oder Halbstufe über dem Boden) schicken; Spieler zusätzlich kriechen (Schwimmhaltung): Wer kommt durch? |
| `bewegung.stufe` – Stufen bis 0,5 Blöcke ohne Sprung | Eine Reihe aus Halbstufen und Treppen hinaufgehen, ohne zu springen: Geht es ohne Sprung (Spieler, Dorfbewohner, Baby)? |
| `bewegung.sprung` – Sprunghöhe 1 Block | Spieler, Dorfbewohner und Baby vor eine 1 Block hohe Stufe stellen (Dorfbewohner mit Ziel hinter der Stufe): Springen sie hinauf? Dann 1,5 Blöcke (Zaun oder Halbstufe auf Block): Geht es? |
| `bewegung.treppe` – Treppen | Treppe von vorn, von der Seite und von hinten besteigen: Wann braucht es einen Sprung? Treppen mit zwei Blöcken Höhe nacheinander. |
| `bewegung.fallen` – Fallen und Fallschaden | Aus 3, 4, 5, 10 Blöcken Höhe auf Stein fallen: Wie viele Herzhälften Schaden? Dorfbewohner auf 3 und 4 Blöcke hohen Absatz: Gehen sie herunter? |
| `bewegung.luecke` – Lücken überspringen | Lücken von 1, 2, 3 Blöcken mit und ohne Sprint überspringen: Welche Breite schafft der Spieler? |
| `bewegung.tueren` – Türen, Falltüren, Zauntore | Dorfbewohner eine Holztür, Kupfertür, Eisentür, Falltür, ein Zauntor durchqueren lassen: Welche passieren sie? Spieler zum Vergleich. |
| `bewegung.leiter` – Leitern und Ranken | Dorfbewohner mit Ziel am oberen Ende einer Leiter: Kommt er hinauf? Spieler klettert 10 Blöcke. |
| `bewegung.wasser` – Wasser | Aus 10 Blöcken Höhe in 1 Block tiefes Wasser fallen: Schaden? Spieler schwimmt durch eine Wassersäule nach oben. |
| `bewegung.kosten` – Wegkosten | Dorfbewohner zwischen zwei Wegen (1 Sprung kurz, lang ohne Sprung): Welchen nimmt er? |
| `dorf.definition` – Dorf: Betten, Dorfbewohner, Grenze | Ein Bett mit Dorfbewohner und weitere Betten 31 und 33 Blöcke entfernt: Zählen die entfernten Betten zum selben Dorf (Dorfbewohner-Zahl, Golem-Spawn)? Schwer direkt zu sehen; Hinweis: Dorfbewohner nahe dem Rand ändern ihr Verhalten (Alarm). |
| `dorf.bett` – Bett gültig | Bett mit Vollblock direkt darüber und Bett mit Halbstufe darüber neben einen Dorfbewohner stellen: Beansprucht er sie? Bett hinter einer Mauer, die er nicht überwindet. |
| `dorf.bevoelkerung` – Höchstbevölkerung = Zahl der Betten | Dorf mit 3 Betten und 3 Dorfbewohnern mit Brot füttern: Entsteht ein Baby? Mit 4. Bett? |
| `dorf.berufsblock` – Berufsblock im Umkreis 16 / 4 | Lesepult 16 und 17 Blöcke entfernt, 4 und 5 Blöcke höher: Bekommt der Dorfbewohner den Beruf Bibliothekar? Lesepult hinter Glas: Ärger-Partikel? |
| `dorf.berufe` – Berufsblöcke und Berufe | Je einen Berufsblock neben einen arbeitslosen Dorfbewohner (mit Bett) stellen: Welcher Beruf entsteht? |
| `dorf.zuordnung` – Zuordnung: nächstes Bett, erster freier Block | Zwei Dorfbewohner, ein Bett, ein Berufsblock: Wer bekommt den Beruf? Berufsblock ohne Bett in Reichweite: Wird der Beruf trotzdem vergeben? |
| `dorf.golem` – Iron Golem: 10 Dorfbewohner und 20 Betten | Dorf mit 9, 10 Dorfbewohnern und 19, 20 Betten: Spawnt ein Iron Golem (Wartezeit mehrere Minuten, Spieler in der Nähe)? Mit schon einem Golem im Dorf? |
| `fallen.welche` – Welche Blöcke fallen | Je einen Block (Sand, Kies, roter Sand, Betonpulver, Amboss, Drachenei) 5 Blöcke hoch in die Luft setzen (Stütze wegnehmen): Fallen alle? Was passiert mit Gerüst, Tropfstein und Schneeschicht? |
| `fallen.start` – Startverzögerung | Sandblock auf einen Block setzen, den Block darunter abbauen und mit Video (60 fps) messen: Wie viele Ticks (1/20 s) dauert es, bis der Sand sich löst? Blockwerk erwartet 2 Ticks. |
| `fallen.tempo` – Falltempo | Sand 10 Blöcke hoch fallen lassen und mit Video die Fallzeit messen: Blockwerk erwartet 9 Ticks je Block, also 4,5 s für 10 Blöcke. Ergebnis melden. |
| `fallen.landen-block` – Landen auf festem Block | Drei Sandblöcke übereinander 6 Blöcke hoch, die Stütze wegnehmen: Landen alle drei übereinander auf dem Boden? |
| `fallen.landen-gegenstand` – Fackel, Schiene, Staub, Halbstufe und Seelensand machen einen Gegenstand | Sand 4 Blöcke hoch über: eine Schiene, Redstone-Staub, eine Halbstufe (unten und oben), Seelensand, eine Fackel auf Stein: Wird der Sand jeweils ein Gegenstand, bleibt er liegen oder fällt er durch? Ergebnis je Fall melden. |
| `fallen.durch-fackel` – Durch eine Fackel fallen | Eine Fackel an die Seite eines Blocks hängen (Luft darunter) und Sand von oben darauf fallen lassen: Fällt er durch, und bleibt die Fackel stehen? |
| `fallen.fluessigkeit` – Durch Wasser und Lava | Sand über eine 5 Blöcke tiefe Wasserschicht (und Lava) fallen lassen: Fällt er in derselben Zeit hindurch wie durch Luft? |
| `fallen.betonpulver` – Betonpulver wird im Wasser zu Beton | Betonpulver neben, über und in Wasser fallen lassen und liegen lassen: Wird es sofort zu Beton? Gilt das für alle Seiten (auch von unten)? |
| `fallen.unbekannt` – Unbekannte Blöcke darunter | Sand auf Treppe, Zaun, Falltür, Glasscheibe, Trichter, Kessel fallen lassen: Bleibt er liegen, wird er zum Gegenstand oder fällt er daneben? Ergebnis je Block melden. |
| `fluessigkeit.lava-nether` – Lava (Nether): 7 Blöcke weit, ein Block alle 10 Ticks | Siehe fluessigkeit.lava-oberwelt (Nether-Teil). |
| `fluessigkeit.fallen` – Fließen nach unten ohne Grenze | Wasserfall aus 10 Blöcken Höhe auf ebenen Stein: Wie weit breitet sich das Wasser unten aus (Blockwerk erwartet 7 Blöcke ab dem Aufprallpunkt)? Ergebnis melden. |
| `fluessigkeit.unten-vor-seitlich` – Erst nach unten, seitlich nur ohne Weg nach unten | Quelle direkt über einem Loch (2 Blöcke tief) auf ebenem Stein: Breitet sich Wasser auf der Oberfläche seitlich aus, oder fließt es nur in das Loch? Ergebnis melden. |
| `fluessigkeit.mischen` – Wasser und Lava mischen | Stilles Wasser (Quelle) und fließende Lava: (1) Lava fließt seitlich an die Wasserquelle, (2) Lava fällt von oben auf die Wasserquelle. Was entsteht jeweils (glatter Stein oder Bruchstein), und welcher Block wird verwandelt (die Lava oder das Wasser)? |
| `fluessigkeit.wegspuelen` – Wasser spült bestimmte Blöcke weg | Wasser neben Fackel, Schiene, Teppich, Redstone-Staub, Knopf, Druckplatte, Leiter, Schild, Trichter, Schalter: Welche werden weggespült? Ergebnis je Block melden. |
| `fluessigkeit.abklingen` – Abklingen ohne Nachschub | Wasserquelle auf ebenem Stein, Wasser sich ausbreiten lassen, Quelle entfernen, mit Video messen: Wie lange, bis alles Wasser weg ist? Verschwindet es von außen nach innen oder von innen nach außen? |
| `fluessigkeit.hindernisse` – Nur feste Blöcke halten Flüssigkeit auf | Wasser neben Treppe (Vorder- und Rückseite), Halbstufe (oben/unten), Zaun, Glasscheibe, Leiter, Schild, Tür, Falltür, Mauer: Fließt es hinein, vorbei oder hält der Block es auf? Ergebnis je Block melden. |
| `fluessigkeit.gefaelle-mischwege` – Gefälle bei Wegen aus geraden und diagonalen Schritten | Quelle auf ebenem Stein, ein Loch bei (4, 2), bei (4, 3) und bei (3, 1): Fließt das Wasser gezielt zum Loch oder breitet es sich in alle Richtungen aus? Blockwerk erwartet: (3, 1) und (4, 2) gezielt, (4, 3) nicht. |
| `fluessigkeit.ecken` – Ecken des Quadrats und diagonale Lücken | Wasserquelle auf ebenem Stein: Welche Stufe hat das Wasser bei (7, 7) und (4, 4) (Höhe der Wasserfläche, 1 hoch … 7 niedrig)? Dann Steine auf (1, 0), (0, 1) und (-1, 0), (0, -1), (-1, -1), (1, -1), (-1, 1) um die Quelle legen, nur die Ecke (1, 1) frei: Fließt das Wasser diagonal nach (1, 1)? Ergebnis melden. |
| `kolben.limit` – Höchstens 12 Blöcke | Kolben vor einer Reihe aus 12 Steinen (Platz dahinter) und aus 13 Steinen: Fährt er aus? Erwartet 12 ja, 13 nein. |
| `kolben.start` – Start nach 2 Ticks, nur im C-Tick | Hebel an den Kolben: Wie viele Ticks (Video, 60 fps) vergehen bis der Kopf draußen ist (erwartet 4 Ticks)? Strom von oben, unten, hinten, seitlich ja; vom Kopf her nicht; ein Block mit Strom zwei Blöcke weiter (Quasi) bestromt ihn nicht. |
| `kolben.dauer` – Ausfahren und Einfahren dauern je 2 Ticks | Beobachter vor einem Kolben und Redstone-Lampe hinter dem Beobachter: Zeit zwischen Hebel und Impuls messen (erwartet 4 Ticks bis zum Block-Update). |
| `kolben.unbeweglich` – Unbewegliche Blöcke | Je einen dieser Blöcke vor einen Kolben setzen: Fährt der Kolben aus? Besonders: Schleifstein, Plattenspieler, Leitstein, Verzauberungstisch, ausgefahrener Kolben. |
| `kolben.zerstoert` – Zerstörbare Blöcke am Ende | Kolben vor: Fackel, Blume, Staub, Knopf, Tür, Leiter, Schild, Teppich, Schiene, Schnee. Was passiert mit jedem? |
| `kolben.behaelter` – Behälter | Kolben vor einer Truhe (einzeln und doppelt), einem Fass, Ofen, Trichter, Werfer, Shulkerkiste: Wird der Block geschoben? Mit Inhalt? |
| `kolben.klebrig` – Klebriger Kolben zieht 1 Block | Klebrigen Kolben ausfahren lassen, dann einfahren, mit einem Stein, einem Obsidian, einer Fackel und zwei Steinen hintereinander vor dem Kopf: Was wird zurückgezogen? |
| `kolben.blockiert` – Blockierter Kolben fährt nicht aus | Kolben vor Obsidian bestromen: Passiert etwas (Geräusch, Kopf)? Bleibt er danach bestromt blockiert? |
| `licht.blocklicht` – Blocklicht nimmt um 1 je Block ab | Kreativ-Testwelt, dunkle Höhle oder Raum ohne Himmel: Eine Fackel (Stärke 14) in der Mitte eines großen Raums. Mit einem Lichtblock (/give @s light_block ["block_light_level"=…]) oder Beobachtung der Monsterspawns prüfen, wie weit das Licht reicht. Erwartung: 13 Blöcke Entfernung noch Licht 1, ab 14 Blöcken dunkel. |
| `licht.himmelslicht` – Himmelslicht: senkrecht ungeschwächt, seitlich minus 1 | Tagsüber: ein 1×1-Schacht, 20 Blöcke tief, mit Dach daneben. Ganz unten im Schacht ist es hell (Himmelslicht 15). Zeigt der waagerechte Gang vom Schachtboden aus, nach wie vielen Blöcken er dunkel wird (erwartet 15)? Mit Spawn-Beobachtung oder Lichtblock-Vergleich. |
| `licht.filter` – Lichtfilter von Laub, Wasser und Halbstufen | Fackel hinter einer 1-Block-Wand aus Laub, dann aus Wasser (Eimer in einem 1-Block-Loch): Wie viel dunkler ist es dahinter als durch Luft (eine Stufe weniger = Wiki-Filterwert, zwei Stufen weniger = „plus 1“)? Mit Lichtblöcken vergleichen und die Differenz melden. |
| `licht.durchsichtig` – Glas und Teppiche lassen Licht durch wie Luft | Fackel hinter einer 1-Block-Wand aus Glas, aus Teppich (Teppich auf dem Boden, Fackel auf gleicher Höhe wie der Teppich) und aus einem Block Lava: Wird es dahinter hell wie durch Luft? Bei Lava dunkel? Ergebnis je Block melden. |
| `licht.unbekannte-filter` – Unbekannte Lichtfilter werden mit zwei Schranken gerechnet | Der wichtigste Test: Fackel hinter einer Reihe aus Schienen, Teppich, Blume, Schild, Redstone-Staub: Ist es dahinter hell? Dann je Block eine 1-Block-Wand mit Fackel dahinter: (1) Glasscheibe, (2) getöntes Glas, (3) Treppe, (4) untere Halbstufe, (5) obere Halbstufe, (6) Zaun, (7) Tür, (8) Falltür. Je Block melden: Licht dringt durch, schwächer oder gar nicht? |
| `licht.himmel-innen` – Inneres Himmelslicht für Spawnregeln | Siehe licht.himmelslicht; zusätzlich nachts im Freien und in einer Höhle mit schmalem Zugang: Spawnen Monster am Höhleneingang, wo das Himmelslicht schwach ist? |
| `licht.treppen-halbstufen` – Treppen und Halbstufen sperren Licht über ihre vollen Flächen | Dunkler Raum, Fackel hinter einer Wand mit einem Loch, in das eine Treppe gesetzt wird (Rückseite zur Fackel, von der Fackel weg, zur Seite, kopfstehend) und eine untere/obere Halbstufe: Wird es dahinter hell, wie Blockwerk es sagt (Rückseite zur Fackel oder von ihr weg: dunkel; zur Seite und bei Halbstufen: hell)? Außerdem Decke aus unteren und oberen Halbstufen mit Himmel darüber: Wird es darunter dunkel? Abweichungen melden. |
| `lore.rampe-ueber-5` – Rampen über 5 Blöcke Höhe | Rampen mit 8 und 12 Blöcken Höhe, Antriebsschiene alle 3 Blöcke, erste Steigschiene angetrieben: Kommt die Lore ganz hoch? Dann alle 6 Blöcke: Wie viele Blöcke Höhe schafft sie? |
| `lore.fahrt-im-antrieb` – Fahrt mit Restgeschwindigkeit | Rampe, die mitten in einer langen Antriebsstrecke beginnt (Lore schon voll beschleunigt): Reicht Antrieb alle 6 Blöcke noch, oder darf der Abstand größer sein? Ab welchem Abstand bleibt sie stehen? |
| `mech.bestromung` – Wann ein Mechanismus bestromt wird | Lampe mit: Hebel an der Seite, Staub zeigend / wegzeigend / Punkt, Fackel am Block daneben, Fackel direkt an der Lampe befestigt (Lampe ist kein Befestigungsblock, daher nur ein Test mit Block), Redstone-Block oben und unten, Repeater davor. Welche Lagen schalten sie? |
| `mech.lampe` – Redstone-Lampe | Hebel – Staub – Lampe: Wie viele Ticks (mit Video 60 fps) dauert es nach dem Ausschalten, bis die Lampe aus ist? Erwartet 6 Ticks (0,3 s). Hebel kurz an und aus: Bleibt die Lampe länger an? |
| `mech.tueren` – Türen, Falltüren, Zauntore | Tür mit Hebel an der Seite, mit Strom nur oben (Redstone-Block über der Tür), Falltür und Zauntor: Öffnen sie sich? Schließen sie sich sofort ohne Strom? |
| `mech.beobachter` – Beobachter | Beobachter schaut auf eine Fläche: Block setzen und wegnehmen, Pflanze wachsen lassen, Staub daneben ändern: Gibt er jedes Mal einen Impuls ab? Wie lange (erwartet 2 Ticks)? Mit Staub und Lampe hinter dem Beobachter prüfen. |
| `mech.beobachter-richtung` – Beobachter: Richtung | Beobachter in alle sechs Richtungen setzen: Auf welcher Seite kommt der Impuls heraus, und welche Seite beobachtet er? |
| `mech.tagessensor` – Tagessensor | Tagessensor unter freiem Himmel: Signalstärke (Komparator oder Lampe mit Komparator) um 6:00, 9:00, 12:00, 15:00, 18:00, 20:00, 24:00 ablesen; bei Regen und Gewitter wiederholen; mit Dach darüber. Blockwerk erwartet mittags 15, nachts 0. |
| `mech.tagessensor-invertiert` – Tagessensor invertiert | Invertierten Tagessensor um 12:00 und um 24:00 messen (erwartet 0 bzw. 11) und unter einem Dach (erwartet 15). |
| `mech.tagessensor-dimension` – Tagessensor im Nether und Ende | Tagessensor im Nether und im Ende (normal und invertiert): Signal? |
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
| `pruefer.faellt` – Prüfer: Block fällt | Siehe fallen.landen-block und fallen.landen-gegenstand. |
| `pruefer.trichter` – Prüfer: Trichter ohne Ziel, im Kreis oder verstopft | Siehe trichter.ziel und trichter.behaelter. |
| `pruefer.redstone` – Prüfer: Redstone-Leitung | Siehe redstone.staub-abnahme und redstone.instabil. |
| `pruefer.redstone-zeit` – Prüfer: Redstone läuft ab | Siehe zeit.fackel-brennen. |
| `pruefer.mechanismus` – Prüfer: Mechanismen ohne Strom | Siehe mech.bestromung und mech.tagessensor. |
| `pruefer.kolben` – Prüfer: Kolben kann nicht ausfahren oder zerstört etwas | Siehe kolben.unbeweglich und kolben.zerstoert. |
| `pruefer.begehbar` – Prüfer: Ziel erreichbar? | Siehe bewegung.sprung und bewegung.fallen. |
| `pruefer.dorf` – Prüfer: Dorfbewohner, Betten, Berufsblöcke, Iron Golem | Siehe dorf.berufsblock und dorf.golem. |
| `zeit.staub-sofort` – Staub aktualisiert jeden Spielstick | Hebel – 10 Staubblöcke – Lampe: Leuchtet die Lampe sofort (im selben Tick wie der Hebel)? Mit Video (60 fps) prüfen, ob die Länge der Staubleitung die Zeit ändert (erwartet: nein). |
| `zeit.fackel-verzoegerung` – Fackel: 2 Spielticks | Hebel an einen Stein, daneben eine Fackel an dessen Seite, dahinter Staub und eine Lampe: Zeit zwischen Hebel und Lampe mit Video messen (erwartet 0,1 s = 2 Ticks). Dann eine Kette aus 5 Fackeln (Stein-Fackel-Stein-…): erwartet 10 Ticks (0,5 s). |
| `zeit.fackel-brennen` – Fackel brennt aus | Fackel an einem Stein, der über Staub von der Fackel selbst bestromt wird (Rückkopplung): Brennt sie aus, nach wie vielen Wechseln, und geht sie wieder an? Auch eine Uhr mit Repeater dazwischen testen (Bedrock soll dort nicht ausbrennen). |
| `zeit.repeater-verzoegerung` – Repeater: Verzögerung 1 bis 4 Redstone-Ticks | Repeater mit 1, 2, 3, 4 Verzögerung hinter einem Hebel, vorne Staub und Lampe: Zeit messen (erwartet 2, 4, 6, 8 Ticks). Außerdem: Auf welcher Seite des Blocks leuchtet es (Eingang/Ausgang bei Blickrichtung Nord/Süd/Ost/West)? |
| `zeit.repeater-sperre` – Repeater: Sperre | Repeater (an) und einen zweiten bestromten Repeater seitlich auf ihn gerichtet; Eingang des ersten ausschalten: Bleibt der Ausgang an? Sperre lösen: schaltet er dann aus? |
| `zeit.repeater-impuls` – Repeater: kurze Impulse | Knopf (1 Redstone-Tick Impuls) an einen Repeater mit Verzögerung 4: Wie lang ist der Ausgangsimpuls (erwartet 8 Ticks)? |
| `zeit.komparator-modi` – Komparator: Vergleichen und Subtrahieren | Komparator hinter einer Kiste (Wert 8) und Staub von der Seite mit Stärke 5, 8, 9: Vergleichs- und Subtraktionsmodus. Erwartung Vergleich: 8, 8, 0; Subtraktion: 3, 0, 0. |
| `zeit.komparator-verzoegerung` – Komparator: 2 Spielticks | Hebel – Komparator – Staub – Lampe: Zeit messen (erwartet 2 Ticks). |
| `zeit.knopf-dauer` – Knopfdauer | Stein-Knopf, Holz-Knopf, Bambus-Knopf und Polierter-Schwarzstein-Knopf drücken, Lampe daneben mit Video (60 fps): Wie lange leuchtet sie? Erwartet 1 s (Stein, Polierter Schwarzstein) und 1,5 s (Holzarten). |
| `redstone.staub-abnahme` – Staub verliert 1 Stärke je Block | Gerade Staubleitung aus 20 Blöcken, Hebel am Anfang: Bei welchem Staubblock geht die Leitung aus? Blockwerk erwartet: 15 Staubblöcke leuchten (Stärke 15 bis 1), der 16. nicht. |
| `redstone.staub-verbindung` – Staub verbindet sich mit Staub, Quellen und über Stufen | Staubtreppe über Vollblöcke (rauf) und Luft (runter), einmal mit Glas, einmal mit Stein dazwischen: Wo reißt die Leitung ab? Staub mit Block darüber: Steigt die Leitung dann noch auf? |
| `redstone.stark-schwach` – Starke und schwache Bestromung | Hebel an einem Stein, daneben Staub: leuchtet er? Dann Staub → Stein → Staub (Stein nur durch Staub bestromt): leuchtet der zweite Staub? Dasselbe mit Redstone-Block statt Hebel. |
| `redstone.leitend` – Welche Blöcke leiten | Hebel an einem Block aus Glas, Laub, Eis, Honigblock, Seelensand, Schleimblock, oberer/unterer Halbstufe, Treppe: Wird die Redstone-Lampe oder ein Staub daneben bestromt? Ergebnis je Block melden. |
| `redstone.quelle-block` – Redstone-Block | Redstone-Block neben Staub (leuchtet?), neben einem Stein mit Staub dahinter (leuchtet?), unter und über Staub. |
| `redstone.hebel` – Hebel | Hebel an allen sechs Seiten eines Steins mit Staub daneben: Wann leuchtet der Staub? Besonders die Seitenlagen (Ost/West/Nord/Süd) prüfen, an welchem Block der Hebel hängt. |
| `redstone.knopf` – Knöpfe | Knopf an einem Block mit Staub daneben drücken; Knopf an der Unterseite und Oberseite eines Blocks: Welcher Block wird bestromt? |
| `redstone.fackel-invertiert` – Fackel invertiert den Befestigungsblock | Fackel an einem Block, Hebel am Block: Geht die Fackel aus? Fackelturm aus 2 und 3 Fackeln übereinander: leuchtet die oberste? Staub neben der Fackel: bestromt? |
| `redstone.fackel-richtung` – Fackel: Befestigungsblock | Siehe redstone.fackel-invertiert (Fackel an den vier Seiten und oben eines Blocks). |
| `redstone.instabil` – Schwingende Schaltungen | Fackel an einem Block, daneben Staub, das den Block selbst bestromt (Rückkopplung): Brennt sie aus, flackert sie oder bleibt sie aus? Ergebnis melden. |
| `redstone.detektorschiene` – Detektorschiene als Quelle | Lore über eine Detektorschiene fahren, Staub daneben und Redstone-Lampe: Wie lange leuchtet sie? Bestromt sie den Block darunter (Staub unter dem Block)? |
| `redstone.aktivierungsschiene` – Aktivierungsschiene | 20 Aktivierungsschienen in einer Reihe, Redstone-Block neben der ersten: Wie viele aktivieren sich (erwartet 9)? Redstone-Block in der Mitte: 17? Dann Staub, das auf die Schiene zeigt. |
| `redstone.keine-quasi` – Keine Quasi-Konnektivität | Kolben mit Hebel genau über dem Block über dem Kolben (nicht am Kolben): Fährt er aus? (In Bedrock sollte er das nicht.) |
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
| `tech.nische` – Handelsnische: geschlossene Zelle mit Berufsblock und Bett | Eine Handelsnische nach dem Plan bauen (Dorfbewohner per Boot oder Ei hineinsetzen): Bleibt er in der Zelle, nimmt er den Beruf seines Berufsblocks an, und kann man durch die Scheiben mit ihm handeln? Bei mehreren Nischen nebeneinander: Nimmt jeder den Berufsblock seiner eigenen Zelle? |
| `trichter.cooldown` – Wartezeit nach einem Vorgang | Kiste mit 64 Gegenständen, darunter ein Trichter, der in eine zweite Kiste zeigt. Mit Video (60 fps) die Zeit für 64 Gegenstände messen: Blockwerk erwartet etwa 8 Ticks je Gegenstand (rund 25,6 s). Ergebnis melden. |
| `trichter.reihenfolge` – Erst schieben, dann ziehen | Zwei Trichter nebeneinander, die einander füttern (Kette A → B), mit Gegenständen füllen und beobachten, ob die Gegenstände ohne Stau weiterlaufen. Außerdem: Zwei Trichter in einer senkrechten Säule zwischen zwei Kisten: Wie viele Gegenstände je Sekunde laufen durch? |
| `trichter.slots` – Slots und ein Gegenstand je Vorgang | Kiste mit Gegenständen in verschiedenen Slots (z. B. Slot 3 Kohle, Slot 5 Eisen), Trichter darunter: In welcher Reihenfolge landen sie in der Zielkiste und in welchem Slot? |
| `trichter.ziel` – Trichter schiebt in Blickrichtung und zieht von oben | Je einen Trichter in jede der fünf Richtungen (unten, N, O, S, W) neben eine Kiste setzen und Gegenstände einfüllen: Wohin schiebt er jeweils? |
| `trichter.sperre` – Bestromter Trichter sperrt | Trichter mit Redstone-Block daneben (bestromt) zwischen zwei Kisten: Bleibt er stehen? Empfängt er trotzdem von einem Trichter darüber? Redstone-Block wegnehmen: Läuft er sofort weiter oder mit Verzögerung? |
| `trichter.behaelter` – Welche Behälter bewegt werden | Trichter in eine Doppelkiste: Wird zuerst die linke oder die rechte Kiste gefüllt (Reihenfolge der Slots)? Trichter in eine Shulkerkiste mit einer Shulkerkiste im Trichter: Wird sie abgelehnt? |
| `trichter.komparator` – Komparator-Wert eines Behälters | Kiste (27 Slots) mit 1, 64, 128, 1728 Steinen und mit 16 Enderperlen / 1 Schwert je Slot füllen und den Komparator-Wert (Redstone-Lampe-Stärke oder Signalstärke) ablesen. Dasselbe mit Trichter (5 Slots), Fass, Werfer (9 Slots). |
| `trichter.stapel` – Stapelgrößen | Je 20 Enderperlen, Eier, Schilder, Tränke, Schwerter einzeln in eine Kiste legen: Wie viele passen in einen Slot? Besonders prüfen: Betten, Kuchen, Wasserbecher (Eimer), Bücher, Boote. |
| `trichter.unklar` – Sonderbehälter | Trichter über, neben und unter einem Ofen mit Kohle und Eisenerz: Was wandert wohin? Ergebnis je Seite melden. Das schließt die Lücke für den Ofen. |

## Hebel an der Antriebsschiene (Jonah, 24.10.2026)
Schiene bei 96,-60,-4. Der Hebel versorgt sie, wenn er irgendwo an einem dieser Blöcke sitzt: 96,-60,-4; 97,-60,-4; 96,-60,-5; 95,-60,-4; 96,-60,-3; 97,-59,-4; 96,-59,-5; 95,-59,-4; 96,-59,-3; 96,-58,-4. Seit dem Update im Code (antrieb.hebel). Gemeint: „auf“ = Oberseite, „irgendwo an“ = jede Seite (oben, unten, seitlich), solange Platz ist.

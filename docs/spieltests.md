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

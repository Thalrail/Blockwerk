# Spieltests für Jonah – Ebene 0 (Kreativ-Testwelt, Bedrock)

Alle Regeln in `data/drehregeln.json` (mit Wiki-Quelle je Regel) und alle Eigenschaften in `data/quellen/eigenschaften.json` stehen auf **ungeprüft**.
Sie werden erst „geprüft“, wenn du hier das Ergebnis bestätigst. Schick mir pro Test: „funktioniert / funktioniert nicht + Beobachtung“.

Vorbereitung: Kreativ-Testwelt, Cheats an, Koordinaten anzeigen. **Norden ist −Z (Zahl wird kleiner), Osten ist +X.**
Befehle im Chat eingeben; `~ ~ ~` ist deine Position (stell dich auf eine freie Fläche, setze den Block z. B. `~ ~1 ~`).

| Nr. | Test | Befehl | Erwartung |
|----|------|--------|-----------|
| 1 | Trichter-Richtung `facing_direction` | `/setblock ~ ~1 ~ hopper ["facing_direction"=2]`, dann 3, 4, 5, 0 | Auslauf zeigt bei 2 nach **Norden**, 3 **Süden**, 4 **Westen**, 5 **Osten**, 0 **nach unten** |
| 2 | Treppe `weirdo_direction` | `/setblock ~ ~1 ~ oak_stairs ["weirdo_direction"=0]`, dann 1, 2, 3 | Die **hohe Seite (Vollblock-Seite)** der Treppe zeigt bei 0 nach Osten, 1 Westen, 2 Süden, 3 Norden |
| 3 | Treppen-Ecke | `/setblock ~ ~1 ~ oak_stairs ["minecraft:corner"="inner_left","weirdo_direction"=0]` und `inner_right` | Die beiden Ecken sind Spiegelbilder voneinander |
| 4 | Schienenform `rail_direction` | Auf einen Vollblock: `/setblock ~ ~1 ~ rail ["rail_direction"=N]` für N = 0…9 | 0 Nord-Süd, 1 Ost-West, 2 ansteigend nach Osten, 3 Westen, 4 Norden, 5 Süden, 6 Süd-Ost-Kurve, 7 Süd-West, 8 Nord-West, 9 Nord-Ost |
| 5 | Tür `minecraft:cardinal_direction` + Scharnier | `/setblock ~ ~1 ~ oak_door ["minecraft:cardinal_direction"="north","door_hinge_bit"=false]` (obere Hälfte mit `"upper_block_bit"=true` ein Feld höher), dann `"door_hinge_bit"=true` | Scharnier wechselt die Seite; geschlossene Tür steht in der Blockkante der genannten Himmelsrichtung |
| 6 | Baby-Dorfbewohner-Größe | Dorfbewohner-Baby in einen Gang bauen, der **genau 1 Block hoch** und 1 breit ist | Passt das Baby durch? Register sagt: Höhe ≈ 0,98 (v2) bzw. 0,95 (alt) – die Mojang-Angaben (Box × Skalierung 0,5) sind uneindeutig |
| 7 | Fackel `torch_facing_direction` | `/setblock ~ ~1 ~ torch ["torch_facing_direction"="west"]` neben einer Wand | Laut Wiki ist der Wert die Fläche des Blocks, an der die Fackel befestigt ist (bei `west`: Westseite des Nachbarblocks). Bitte sagen, an welcher Seite sie sitzt und wohin sie sich neigt |
| 8 | Glow-Lichen-Seiten `multi_face_direction_bits` | `/setblock ~ ~1 ~ glow_lichen ["multi_face_direction_bits"=4]`, dann 8, 16, 32 | Laut Wiki: 4 Süd, 8 West, 16 Nord, 32 Ost (1 unten, 2 oben) |

Hinweis: Test 5 und 7 sind knifflig; wenn ein Befehl nicht geht, schick mir die Fehlermeldung, ich passe die Anleitung an.

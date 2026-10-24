# Messungen zur Lorenbewegung (für Jonah, Kreativ-Testwelt)

**Warum?** Wie schnell eine Lore fährt, wie weit sie ohne Strom rollt und wie viele Antriebsschienen eine Steigung braucht, steht im Wiki für Bedrock **nicht mit Zahlen**. Ohne diese Zahlen würde ich raten, und geraten wird nicht (CLAUDE.md). Mit deinen Messungen baue ich danach die Lorenbewegung (Schritt 2b-3), damit der Plan Bahnen mit der richtigen Zahl Antriebsschienen bauen kann.

Das ist kein Muss und eilt nicht. Je mehr du misst, desto genauer wird das Modell. Pro Messung reicht eine kurze Nachricht mit den Zahlen.

**Standard-Start (für alle Messungen gleich, damit die Werte vergleichbar sind):** Die Startschiene ist eine **bestromte Antriebsschiene** (Redstone-Block daneben), direkt dahinter ein **Vollblock** am Ende der Schiene. Lore auf diese Startschiene setzen: Sie wird vom Block weg beschleunigt. Danach folgen die Schienen der jeweiligen Messung. Klappt das bei dir nicht (Lore bleibt liegen oder fährt in die falsche Richtung), schreib kurz, was passiert; dann legen wir einen anderen Start fest. Nicht von Hand anstoßen: im Kreativmodus zerstört ein Schlag die Lore, und jeder Schlag wäre anders stark.

**Vorbereitung:** ebener Boden aus Stein, Koordinaten anzeigen, Kreativmodus. Für Zeiten: Bildschirm aufnehmen (PS5: Aufnahme-Taste) und im Video zählen, oder zählen „Einundzwanzig, Zweiundzwanzig …“. Eine Lore: `/give @s minecart`. Wenn nichts anderes steht, **ohne Mob in der Lore** und **ohne selbst zu fahren** (leere Lore).

## Messung A: Wie weit rollt eine angestoßene Lore auf normalen Schienen?
1. 60 normale Schienen in einer Reihe (Ost-West) legen.
2. Standard-Start (Antriebsschiene + Block davor, danach die 60 normalen Schienen) und Lore auf die Startschiene setzen.
3. Notieren: Auf welcher Schiene (Nummer 1–60) bleibt die Lore stehen?
4. Dreimal wiederholen.

## Messung B: Abstand zwischen Antriebsschienen
1. Standard-Start, danach 60 normale Schienen in einer Reihe. Ab der 5. Schiene jede **k-te** Schiene als Antriebsschiene, jeweils mit einem Redstone-Block daneben (so ist sie sicher bestromt).
2. Lore auf der Startschiene losfahren lassen. Notieren: Kommt sie bis zum Ende, oder bleibt sie stehen (wo)?
3. k = 2, 4, 6, 8, 10 durchprobieren und angeben, ab welchem k die Lore stehen bleibt.

## Messung C: Steigung
1. Eine gleichmäßige Rampe, 5 Blöcke hoch: jede Schiene liegt genau einen Block höher als die vorige (je 1 Block lang, 1 Block hoch, also 5 ansteigende Schienen hintereinander, ohne ebene Stücke dazwischen). Die Schienen steigen wie bei einer normalen Rampe an (siehe Schienen-Test 3).
2. Vor der Rampe der Standard-Start und 10 ebene Schienen, in der Rampe Antriebsschienen mit Redstone-Block in jeder 2. Schiene.
3. Notieren: Schafft sie die 5 Blöcke Höhe? Wenn nicht: wie weit kommt sie? Dann in jeder Schiene bzw. jeder 3. Schiene Antriebsschienen und wiederholen. Ergebnis: Mindestens wie viele Antriebsschienen je Höhenblock?

## Messung D: Fahrzeit auf bestromter Strecke
1. Standard-Start, danach 20 Antriebsschienen in einer Reihe, alle bestromt (Redstone-Block neben der 1., 10. und 20. Schiene).
2. Lore losfahren lassen, mit Video die Zeit von der 1. bis zur 20. Schiene messen (Sekunden, auf 0,1 genau).
3. Dreimal, Durchschnitt angeben.

## Messung E: Kurven
1. Ein Rechteck aus Schienen (4 Kurven) mit je einer Antriebsschiene alle 3 Schienen, bestromt.
2. Standard-Start vor der ersten Geraden, Lore eine Runde fahren lassen: Wie lange dauert eine Runde im Vergleich zu einer geraden Strecke mit gleicher Länge? Verliert sie in den Kurven an Tempo (bleibt sie stehen)?

## Messung F (optional): Mit Dorfbewohner
Gleicher Aufbau wie Messung D, aber ein Dorfbewohner sitzt in der Lore: Ändert sich die Zeit?

## Ergebnisse (Jonah, 24.10.2026) – ausgewertet
Alle Messungen mit leerer Lore, Start aus dem Stand. Eingetragen als geprüfte Regeln in `data/regeln/lore.json`.
- **Messung 1 (Auslauf nach n Antriebsschienen am Stück, Strecke nach der letzten Antriebsschiene):** 1→7,5 · 2→11 · 3→14 · 4→14,75 · 5→16,25 · 6→17 · 7→18 · 8→18,25 · 9→19,25 · 10→19,5 · 11→20 · 12→20,25 · 13→21 · 14→21,25 · 15→21,25 · 16→21,5 · 17→21,75 · 18→21,9 · 19→22 · 27→23 · 37→23 Blöcke.
- **Messung 2 (Abstand auf ebener Strecke):** jede 2., 4., 6., 8. Schiene eine Antriebsschiene: kommt durch; jede 10.: nicht. (Jede 9. nicht gemessen.)
- **Messung 3 (Rampe bis 5 Blöcke hoch):** Abstand 2 geht immer; 3 bis 6 nur, wenn die erste steigende Schiene eine Antriebsschiene ist; 7 geht nicht.
- **Messung 3.1 (Steighöhe nach n Antriebsschienen):** 1→2,5 · 2→4 · 3→5 · 4→5,5 · 5→6 · 6→6,5 · 7→7 · 8→etwas über 7 Blöcke.
- **Messung 4:** 20 bestromte Antriebsschienen in 3,2 s.
- **Messung 5:** Ring 9×9 (32 Schienen plus Start) in 5,01 s, kein Verlust in Kurven; mit Dorfbewohner 4,93 s, ebenfalls kein Verlust.
- **Noch offen** (Tests in `docs/spieltests.md`): Abstand 9 auf ebener Strecke, Rampen über 5 Blöcke, Rampe mitten in einer Antriebsstrecke.

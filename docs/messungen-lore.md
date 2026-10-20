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

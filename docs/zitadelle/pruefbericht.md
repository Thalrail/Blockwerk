# Prüfbericht: Die Zitadelle (Stufe 1: Hülle und Handel)

Erzeugt mit `node tools/pruefstein.js` aus `data/beispiele/zitadelle.json`. Die Freigabe in diesem Lauf ist **technisch** (damit die Planung startet); die echte Freigabe gibt Jonah in der Oberfläche.

## Kurzfassung

- Die Planung läuft **durch**: 20 Abschnitte, 34 Teile, **68.380 Blöcke** im Bauplan.
- Zeit (Node): Planung **230,8 s**, Bauplan und Material 0,6 s, Abschlussprüfung des fertigen Entwurfs 8,6 s; Speicher 555 MB.
- Prüfer der Spezifikation: 0 offene Rückfragen, 9 Hinweise. Einwände während der Planung: 0, Rückgriffe: 0, offene Rückfragen an Jonah: 0.
- **Offene Schaltungsanfragen: 16** (siehe unten). Das ist der ehrliche Stand: Blockwerk hat dafür noch keine Bausteine.

## Abschnitte (in Bau-Reihenfolge)

| Nr. | Abschnitt | Hülle (x × y × z) | Von | Bis | Blöcke |
|----|-----------|-------------------|-----|-----|--------|
| 1 | Eckturm Nordwest | 25 × 80 × 25 | (4, 0, 4) | (28, 79, 28) | 3.840 |
| 2 | Hauptlager mit Sortieranlage (16 Kategorien) | 342 × 22 × 68 | (128, -38, 265) | (469, -17, 332) | 5.132 |
| 3 | Untergeschoss: Dorfbewohner-Anlage und Lorenbahnnetz | 128 × 16 × 128 | (235, -16, 235) | (362, -1, 362) | 5.376 |
| 4 | Zentralhalle (Rotunde) | 41 × 36 × 41 | (279, 0, 279) | (319, 35, 319) | 3.312 |
| 5 | Handelsviertel Nordwest (Kleriker und Pfeilmacher) | 91 × 20 × 38 | (128, 0, 155) | (218, 19, 192) | 3.124 |
| 6 | Handelsviertel West (Steinmetze und Kartografen) | 91 × 20 × 52 | (180, 0, 273) | (270, 19, 324) | 3.922 |
| 7 | Hauptturm | 33 × 110 × 33 | (283, 0, 238) | (315, 109, 270) | 7.480 |
| 8 | Handelsviertel Nord (Bibliothekare) | 80 × 20 × 52 | (259, 0, 178) | (338, 19, 229) | 3.985 |
| 9 | Kuppel der Zentralhalle | 41 × 28 × 41 | (279, 36, 279) | (319, 63, 319) | 2.073 |
| 10 | Handelsviertel Nordost (Rüstungsschmiede) | 80 × 20 × 38 | (379, 0, 161) | (458, 19, 198) | 3.187 |
| 11 | Eingangshalle (Süd, keine Stände) | 33 × 20 × 52 | (283, 0, 328) | (315, 19, 379) | 2.508 |
| 12 | Handelsviertel Ost (Waffen- und Werkzeugschmiede) | 91 × 20 × 52 | (328, 0, 273) | (418, 19, 324) | 3.922 |
| 13 | Handelsviertel Südwest (Fischer, Schäfer und Gerber) | 102 × 20 × 38 | (67, 0, 462) | (168, 19, 499) | 3.147 |
| 14 | Portal (Haupteingang) | 27 × 22 × 14 | (286, 0, 388) | (312, 21, 401) | 612 |
| 15 | Brücke West | 23 × 9 × 54 | (133, 0, 368) | (155, 8, 421) | 1.058 |
| 16 | Eckturm Nordost | 25 × 80 × 25 | (571, 0, 4) | (595, 79, 28) | 3.840 |
| 17 | Eckturm Südwest | 25 × 80 × 25 | (4, 0, 571) | (28, 79, 595) | 3.840 |
| 18 | Brücke Ost | 23 × 9 × 54 | (443, 0, 368) | (465, 8, 421) | 1.058 |
| 19 | Handelsviertel Südost (Bauern und Fleischer) | 91 × 20 × 38 | (435, 0, 462) | (525, 19, 499) | 3.124 |
| 20 | Eckturm Südost | 25 × 80 × 25 | (571, 0, 571) | (595, 79, 595) | 3.840 |

## Material (Gesamt, die größten Posten)

| Block | Anzahl | Umgerechnet |
|-------|--------|-------------|
| Quarzblock | 55.055 | 31 Kisten + 23 Stacks + 15 |
| Polierter Schwarzstein | 9.096 | 5 Kisten + 7 Stacks + 8 |
| Glatter Quarz | 929 | 14 Stacks + 33 |
| Stein | 486 | 7 Stacks + 38 |
| Trichter | 390 | 6 Stacks + 6 |
| Antriebsschiene | 322 | 5 Stacks + 2 |
| Redstone-Block | 322 | 5 Stacks + 2 |
| Hebel | 280 | 4 Stacks + 24 |
| Falltür | 280 | 4 Stacks + 24 |
| Schiene | 251 | 3 Stacks + 59 |
| Redstone-Staub | 195 | 3 Stacks + 3 |
| Aktivierungsschiene | 140 | 2 Stacks + 12 |
| Glasscheibe | 140 | 2 Stacks + 12 |
| Verstärker | 98 | 1 Stack + 34 |
| Komparator | 97 | 1 Stack + 33 |
| … insgesamt 31 Blocksorten | 68.380 | |

## Bilanz (Dorfbewohner, Betten, Berufsblöcke)

Aus allen fertigen Abschnitten (Ebene 1, Dorfmodell): **0 gültige Betten**, **0 Dorfbewohner**, **188 Berufsblöcke**, Iron Golem: **nein**.
Die Zahl der Berufsblöcke enthält auch die Fässer des Sortierlagers (siehe Befund 7). Entschieden (Jonah, 27.10.2026): 140 Handelsnischen (sieben Viertel mit Ständen; die Kenndaten auf Bild 13 mit 160 stimmen nicht), je mit einem Berufsblock. Die Handelsviertel nutzen die Lorenbahn-Nische von Bild 07 (kein Bett, der Dorfbewohner kommt per Lore); deshalb gibt es 0 Betten, und der Iron Golem bleibt „nein“ (Bedingung: 20 Betten).

## Schaltungsanfragen (was es noch nicht gibt)

| Nr. | Abschnitt | Gewünscht |
|-----|-----------|-----------|
| S1 | untergeschoss | bruteranlage |
| S2 | untergeschoss | bahnhof |
| S3 | untergeschoss | entladestelle |
| S4 | untergeschoss | wohnbereich |
| S5 | untergeschoss | felder |
| S6 | untergeschoss | sammelbecken |
| S7 | untergeschoss | lorenbahn-netz |
| S8 | untergeschoss | aufzug |
| S9 | untergeschoss | wasserrueckfuehrung |
| S10 | viertel-nordwest | weichensteuerung |
| S11 | viertel-west | weichensteuerung |
| S12 | viertel-nord | weichensteuerung |
| S13 | viertel-nordost | weichensteuerung |
| S14 | viertel-ost | weichensteuerung |
| S15 | viertel-suedwest | weichensteuerung |
| S16 | viertel-suedost | weichensteuerung |

Bahnhof, Entladestelle und Brüter sind wegen des offenen Brutkammer-Entwurfs zurückgestellt (`docs/offene-fragen.md`). Wohnbereiche, Felder, Sammelbecken, Lorenbahn-Netz, Aufzug und Wasserrückführung haben noch keinen Baustein.

## Einwände und Hinweise während der Planung

Keine Einwände (kein Verstoß gegen die Regeln aus Ebene 1 und die Geometrieregeln).

Hinweise des Prüfers der Spezifikation (9):
- teile[19].funktionen[0]: Untergeschoss: Dorfbewohner-Anlage und Lorenbahnnetz: für „bruteranlage“ gibt es noch kein Modul; der Techniker stellt eine Schaltungsanfrage.
- teile[19].funktionen[1]: Untergeschoss: Dorfbewohner-Anlage und Lorenbahnnetz: für „bahnhof“ gibt es noch kein Modul; der Techniker stellt eine Schaltungsanfrage.
- teile[19].funktionen[2]: Untergeschoss: Dorfbewohner-Anlage und Lorenbahnnetz: für „entladestelle“ gibt es noch kein Modul; der Techniker stellt eine Schaltungsanfrage.
- teile[19].funktionen[3]: Untergeschoss: Dorfbewohner-Anlage und Lorenbahnnetz: für „wohnbereich“ gibt es noch kein Modul; der Techniker stellt eine Schaltungsanfrage.
- teile[19].funktionen[4]: Untergeschoss: Dorfbewohner-Anlage und Lorenbahnnetz: für „felder“ gibt es noch kein Modul; der Techniker stellt eine Schaltungsanfrage.
- teile[19].funktionen[5]: Untergeschoss: Dorfbewohner-Anlage und Lorenbahnnetz: für „sammelbecken“ gibt es noch kein Modul; der Techniker stellt eine Schaltungsanfrage.
- teile[19].funktionen[6]: Untergeschoss: Dorfbewohner-Anlage und Lorenbahnnetz: für „lorenbahn-netz“ gibt es noch kein Modul; der Techniker stellt eine Schaltungsanfrage.
- teile[19].funktionen[7]: Untergeschoss: Dorfbewohner-Anlage und Lorenbahnnetz: für „aufzug“ gibt es noch kein Modul; der Techniker stellt eine Schaltungsanfrage.
- teile[19].funktionen[8]: Untergeschoss: Dorfbewohner-Anlage und Lorenbahnnetz: für „wasserrueckfuehrung“ gibt es noch kein Modul; der Techniker stellt eine Schaltungsanfrage.

## Benutzte Bausteine und Stand der Regeln

Bausteine: `form.bogen` (simuliert), `form.kuppel` (simuliert), `form.tonnengewoelbe` (simuliert), `form.zylinder` (simuliert), `tech.handelsnischen-lore` (simuliert), `tech.sortierlager` (simuliert).
Regeln insgesamt 212: 189 simuliert, 3 entworfen, 20 im Spiel geprüft; **141 enthalten ungeprüfte Annahmen** (Testanleitungen: `docs/spieltests.md`). Im Spiel bestätigt hat Jonah nur die 20 Regeln mit dem Status „geprüft“; die 189 simulierten und 3 entworfenen Regeln sind nur im Test (Ebene 1) belegt, nicht im Spiel. Auch die Zitadelle-Planung selbst ist im Spiel noch nicht vollständig bestätigt, bis Jonah es meldet.

## Befunde: wo die Planung heute an ihre Grenzen stößt

1. **Jedes Teil ist ein eigener Kasten.** Die Zitadelle ist verschachtelt (Handelsviertel, Rotunde, Ecktürme im selben Gebäude). Blockwerk plant Teile als getrennte, sich nicht überschneidende Hüllen, die Technik steht daneben. Die acht Handelsviertel liegen deshalb als Kästen um die Zentralhalle und nicht als gemeinsames Hauptgebäude. Die Himmelsrichtungen und Maße stimmen, die Geometrie des Bildes nicht.
2. **Diagonale Arme** (Nordost, Südost, Südwest, Nordwest) gibt es nur als rechtwinklige Kästen, nicht als 45°-Gänge. Dafür wurde die Lage „strahlenförmig“ eingeführt (nur die Lage; die Form bleibt achsenparallel).
3. **Handelsnische:** gebaut wird die Lorenbahn-Nische von Bild 07 (`tech.handelsnischen-lore`: Lore von oben, Aktivierungsschiene, Deckenklappe, Falltür, Wasserkanal mit Gefälle). Offen bleiben die Weichensteuerung (welche Lore in welchen Stich, je Viertel eine Schaltungsanfrage), das Beladen der Loren, das Sammelbecken am Kanalende und die Kanaltiefe (20 Nischen = 7 Stufen = 8 Blöcke unter dem Boden; sie steht in der Hülle, der Bauplatz wurde dafür auf 600 × 600 vergrößert). Außerdem ist im Modell die Berufsvergabe ohne Bett nicht abgebildet.
4. **Lager:** Das Sortierlager sortiert nach einzelnen Gegenständen (hier 16 Kategorien × 3 Gegenstände = 48 Sorten). Werkzeuge und Rüstung sind nicht stapelbar und deshalb durch stapelbare Stellvertreter ersetzt. Eine Sortierung nach Kategorien (mit Dutzenden Gegenständen je Kategorie) ist nicht umgesetzt.
5. **Maße der Brücken, Portal, Ecktürme, Kuppel** sind übernommen (Länge 46, Breite 13; Portal 15 breit; Türme 80 und 110 hoch; Kuppel Ø 33 bis Höhe 64), aber als einfache Formen (Zylinder, Tonnengewölbe, Bogen, Kuppel); Zierbögen, Zinnen, Banner und Dekoration fehlen.
6. **Hauptlager:** Das Sortierlager für 48 Sorten ist 342 Blöcke lang (je Sorte ein Modul im Raster 6). Es steht deshalb unter dem Untergeschoss und nicht darin.
7. **Berufsblöcke im Lager:** Die Fässer der Sortierlager-Einheiten sind für Dorfbewohner Berufsblöcke (Fischer). Die Bilanz zählt deshalb mehr Berufsblöcke als Nischen (hier: Nischen plus ein Fass je Lagersorte). Sie stehen weit von den Nischen entfernt (Sperrzone 16 waagerecht / 4 senkrecht), der Prüfer meldet daher keinen Verstoß; im Spiel dürfen dort keine arbeitslosen Dorfbewohner hinkommen.

## Reproduzieren

```
node tools/pruefstein.js
```


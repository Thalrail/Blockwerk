# Prüfbericht: Die Zitadelle (Stufe 1: Hülle und Handel)

Erzeugt mit `node tools/pruefstein.js` aus `data/beispiele/zitadelle.json`. Die Freigabe in diesem Lauf ist **technisch** (damit die Planung startet); die echte Freigabe gibt Jonah in der Oberfläche.

## Kurzfassung

- Die Planung läuft **durch**: 20 Abschnitte, 34 Teile, **64.678 Blöcke** im Bauplan.
- Zeit (Node): Planung **133,6 s**, Bauplan und Material 0,4 s, Abschlussprüfung des fertigen Entwurfs 4,3 s; Speicher 527 MB.
- Prüfer der Spezifikation: 0 offene Rückfragen, 9 Hinweise. Einwände während der Planung: 0, Rückgriffe: 0, offene Rückfragen an Jonah: 0.
- **Offene Schaltungsanfragen: 9** (siehe unten). Das ist der ehrliche Stand: Blockwerk hat dafür noch keine Bausteine.

## Abschnitte (in Bau-Reihenfolge)

| Nr. | Abschnitt | Hülle (x × y × z) | Von | Bis | Blöcke |
|----|-----------|-------------------|-----|-----|--------|
| 1 | Eckturm Nordwest | 25 × 80 × 25 | (4, 0, 4) | (28, 79, 28) | 3.840 |
| 2 | Hauptlager mit Sortieranlage (16 Kategorien) | 342 × 22 × 68 | (38, -38, 175) | (379, -17, 242) | 5.132 |
| 3 | Untergeschoss: Dorfbewohner-Anlage und Lorenbahnnetz | 128 × 16 × 128 | (145, -16, 145) | (272, -1, 272) | 5.376 |
| 4 | Zentralhalle (Rotunde) | 41 × 36 × 41 | (189, 0, 189) | (229, 35, 229) | 3.312 |
| 5 | Handelsviertel Nordwest (Kleriker und Pfeilmacher) | 79 × 20 × 38 | (91, 0, 111) | (169, 19, 148) | 2.620 |
| 6 | Handelsviertel West (Steinmetze und Kartografen) | 79 × 20 × 52 | (102, 0, 183) | (180, 19, 234) | 3.418 |
| 7 | Hauptturm | 33 × 110 × 33 | (193, 0, 148) | (225, 109, 180) | 7.480 |
| 8 | Handelsviertel Nord (Bibliothekare) | 76 × 20 × 52 | (171, 0, 88) | (246, 19, 139) | 3.393 |
| 9 | Kuppel der Zentralhalle | 41 × 28 × 41 | (189, 36, 189) | (229, 63, 229) | 2.073 |
| 10 | Handelsviertel Nordost (Rüstungsschmiede) | 76 × 20 × 38 | (251, 0, 111) | (326, 19, 148) | 2.595 |
| 11 | Handelsviertel Südwest (Fischer, Schäfer und Gerber) | 82 × 20 × 38 | (89, 0, 270) | (170, 19, 307) | 2.645 |
| 12 | Eingangshalle (Süd, keine Stände) | 33 × 20 × 52 | (193, 0, 238) | (225, 19, 289) | 2.508 |
| 13 | Handelsviertel Ost (Waffen- und Werkzeugschmiede) | 79 × 20 × 52 | (238, 0, 183) | (316, 19, 234) | 3.418 |
| 14 | Portal (Haupteingang) | 27 × 22 × 14 | (196, 0, 298) | (222, 21, 311) | 612 |
| 15 | Brücke West | 23 × 9 × 54 | (43, 0, 278) | (65, 8, 331) | 1.058 |
| 16 | Eckturm Nordost | 25 × 80 × 25 | (391, 0, 4) | (415, 79, 28) | 3.840 |
| 17 | Eckturm Südwest | 25 × 80 × 25 | (4, 0, 391) | (28, 79, 415) | 3.840 |
| 18 | Handelsviertel Südost (Bauern und Fleischer) | 79 × 20 × 38 | (249, 0, 270) | (327, 19, 307) | 2.620 |
| 19 | Brücke Ost | 23 × 9 × 54 | (353, 0, 278) | (375, 8, 331) | 1.058 |
| 20 | Eckturm Südost | 25 × 80 × 25 | (391, 0, 391) | (415, 79, 415) | 3.840 |

## Material (Gesamt, die größten Posten)

| Block | Anzahl | Umgerechnet |
|-------|--------|-------------|
| Quarzblock | 52.005 | 30 Kisten + 2 Stacks + 37 |
| Polierter Schwarzstein | 9.096 | 5 Kisten + 7 Stacks + 8 |
| Glatter Quarz | 1.465 | 22 Stacks + 57 |
| Stein | 486 | 7 Stacks + 38 |
| Trichter | 390 | 6 Stacks + 6 |
| Bett | 280 | 10 Kisten + 10 Stacks |
| Glasscheibe | 280 | 4 Stacks + 24 |
| Redstone-Staub | 195 | 3 Stacks + 3 |
| Verstärker | 98 | 1 Stack + 34 |
| Komparator | 97 | 1 Stack + 33 |
| Fass | 55 | 55 |
| Truhe | 50 | 50 |
| Redstone-Fackel | 48 | 48 |
| Hochofen | 20 | 20 |
| Lesepult | 20 | 20 |
| … insgesamt 25 Blocksorten | 64.678 | |

## Bilanz (Dorfbewohner, Betten, Berufsblöcke)

Aus allen fertigen Abschnitten (Ebene 1, Dorfmodell): **140 gültige Betten**, **140 Dorfbewohner**, **188 Berufsblöcke**, Iron Golem: **ja**.
Die Zahl der Berufsblöcke enthält auch die Fässer des Sortierlagers (siehe Befund 7). Entschieden (Jonah, 27.10.2026): 140 Handelsnischen (sieben Viertel mit Ständen; die Kenndaten auf Bild 13 mit 160 stimmen nicht), je mit einem Berufsblock. Blockwerks Nische hat ein Bett je Zelle.

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

Bausteine: `form.bogen` (simuliert), `form.kuppel` (simuliert), `form.tonnengewoelbe` (simuliert), `form.zylinder` (simuliert), `tech.handelsnischen` (simuliert), `tech.sortierlager` (simuliert).
Regeln insgesamt 205: 182 simuliert, 3 entworfen, 0 im Spiel geprüft; **136 enthalten ungeprüfte Annahmen** (Testanleitungen: `docs/spieltests.md`). Nichts davon ist im Spiel bestätigt, bis Jonah es meldet.

## Befunde: wo die Planung heute an ihre Grenzen stößt

1. **Jedes Teil ist ein eigener Kasten.** Die Zitadelle ist verschachtelt (Handelsviertel, Rotunde, Ecktürme im selben Gebäude). Blockwerk plant Teile als getrennte, sich nicht überschneidende Hüllen, die Technik steht daneben. Die acht Handelsviertel liegen deshalb als Kästen um die Zentralhalle und nicht als gemeinsames Hauptgebäude. Die Himmelsrichtungen und Maße stimmen, die Geometrie des Bildes nicht.
2. **Diagonale Arme** (Nordost, Südost, Südwest, Nordwest) gibt es nur als rechtwinklige Kästen, nicht als 45°-Gänge. Dafür wurde die Lage „strahlenförmig“ eingeführt (nur die Lage; die Form bleibt achsenparallel).
3. **Handelsnische:** gebaut wird Blockwerks geschlossene Zelle mit Bett und Berufsblock. Die Nische von Bild 07 (Lorenbahn von oben, Deckenöffnung, Falltür, Wasserkanal) ist ein eigener Baustein und braucht neue Regeln in Ebene 1 (Loren mit Dorfbewohnern, Wasserströmung auf Wesen).
4. **Lager:** Das Sortierlager sortiert nach einzelnen Gegenständen (hier 16 Kategorien × 3 Gegenstände = 48 Sorten). Werkzeuge und Rüstung sind nicht stapelbar und deshalb durch stapelbare Stellvertreter ersetzt. Eine Sortierung nach Kategorien (mit Dutzenden Gegenständen je Kategorie) ist nicht umgesetzt.
5. **Maße der Brücken, Portal, Ecktürme, Kuppel** sind übernommen (Länge 46, Breite 13; Portal 15 breit; Türme 80 und 110 hoch; Kuppel Ø 33 bis Höhe 64), aber als einfache Formen (Zylinder, Tonnengewölbe, Bogen, Kuppel); Zierbögen, Zinnen, Banner und Dekoration fehlen.
6. **Hauptlager:** Das Sortierlager für 48 Sorten ist 342 Blöcke lang (je Sorte ein Modul im Raster 6). Es steht deshalb unter dem Untergeschoss und nicht darin.
7. **Berufsblöcke im Lager:** Die Fässer der Sortierlager-Einheiten sind für Dorfbewohner Berufsblöcke (Fischer). Die Bilanz zählt deshalb mehr Berufsblöcke als Nischen (hier: Nischen plus ein Fass je Lagersorte). Sie stehen weit von den Nischen entfernt (Sperrzone 16 waagerecht / 4 senkrecht), der Prüfer meldet daher keinen Verstoß; im Spiel dürfen dort keine arbeitslosen Dorfbewohner hinkommen.

## Reproduzieren

```
node tools/pruefstein.js
```


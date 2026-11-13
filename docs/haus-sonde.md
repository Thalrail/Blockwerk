# Haus-Sonde: Kann Blockwerk heute ein zweigeschossiges Wohnhaus beschreiben und planen?

> **Stand nach dem ersten Paket (13.11.2026): `bau.raum` mit Tür und Fenstern ist umgesetzt** (Ebene 2, `src/ebene2/bauelemente.js`, Tests `test/ebene2/raum.test.js`, Regel `bau.raum`, Status `simuliert`, Annahmen `ungeprüft`, Spieltest-Anleitung in `docs/spieltests.md`). Die Sonde baut die Geschosse jetzt als Räume: Das Haus ist ringsum dicht, Tür und Fenster sitzen in der Wand (Zugang von außen: nein, Test an Koordinaten und per Flutfüllung, drei Größen). Offen bleiben: Treppe im Haus (`innen`), Bauelemente als eigene Teile ohne 8 Blöcke Abstand, bündiges Dach mit geschlossenem Giebel, Farbwünsche, stabile Teil-Kennungen. Der Rest dieses Berichts beschreibt den **Ausgangsbefund vor dem Paket** (mit `bau.gang` als Geschoss) und bleibt als Begründung stehen.

Stand 13.11.2026, im Auftrag von Jonah (erstes Arbeitspaket von Phase 1, `docs/roadmap.md`). Es wurde **nichts an der Engine geändert**: die Sonde (`tools/haus-sonde.js`) nutzt nur öffentliche Schnittstellen (`ebene4.pruefe/freigeben/baue/aktualisiereBau`, `ebene5.bauplan`). Die Freigabe ist technisch (kein Mensch hat sie gegeben). Die Befunde sind als Tests in `test/ebene5/haus-sonde.test.js` festgehalten.

Reproduzieren: `node tools/haus-sonde.js` (JSON mit allen Ergebnissen, einige Sekunden), Tests: `node --test test/ebene5/haus-sonde.test.js`.

## Kurzfassung
- Mit den vorhandenen Bausteinen entsteht **kein Haus, sondern ein Tunnel**: Ein Geschoss ist ein `bau.gang` (Boden, zwei Seitenwände, Decke); **Vorder- und Rückseite sind offen**, der Innenraum ist von außen über Luft erreichbar (Test an Koordinaten: beide Stirnseiten sind Luft, Boden, Decke und Seitenwände fest; dazu Flutfüllung, drei Größen). Das Satteldach hat offene Giebel.
- **Tür, Fenster und Treppe gehen nicht ins Haus:** Bauelemente sind eigene Teile mit 4 Blöcken Rand, sie stehen frühestens 8 Blöcke von der Wand entfernt, `innen` ist nicht übersetzbar. Die Planung fragt (Rückfragen U1 bis U3), sie rät nicht.
- **Veränderbare Abmessungen funktionieren gut:** drei Größen (9 × 7, 13 × 11, 21 × 15 Blöcke außen) und Grenzfälle planen in unter 0,4 s ohne Einwand, ein Maß nachträglich zu ändern ergibt dieselben Schicht-Abdrücke wie ein frischer Lauf.
- Neu aufgefallen und für das Bearbeitungsmodell wichtig: **die Teil-Nummern (T1, T2 …) sind nicht stabil** (die Spezifikations-Id ist ein Kandidat für einen stabilen Anker, aber noch nicht belegt).

## Was die Sonde getan hat
Eine Spezifikation mit drei Teilen (Erdgeschoss, Obergeschoss, Dach) in drei Größen, jeweils einmal als Hülle und einmal um Haustür, Fenster und Treppe ergänzt. Maße sind Parameter der Funktion `hausSpezifikation`, nichts ist fest codiert. Weiter: Abstände, Maßänderung über eine neue Version, Parametergrenzen, Wirkung des Stils.

| Variante (Außenmaß) | Geschoss (lichte Höhe) | Ergebnis Hülle | Blöcke | Mit Tür, Fenster, Treppe |
|---|---|---|---|---|
| klein 9 × 7 | 3 | fertig, 0 Rückfragen, 0 Einwände | 399 | 3 Rückfragen (U1–U3) |
| mittel 13 × 11 | 4 | fertig | 891 | 3 Rückfragen |
| groß 21 × 15 | 5 | fertig | 1845 | 3 Rückfragen |

Grenzen: Außenbreite höchstens 34 (lichte Breite des Gangs höchstens 32), lichte Höhe mindestens 2; 3 × 3 geht (81 Blöcke), 34 × 60 geht (10.920 Blöcke, 0,4 s). Die Prüfer von Ebene 1 meldeten nichts, die Abschlussprüfung ist „fertig“.

## Was bereits funktioniert
- Maße als Parameter in drei Größen und an den Grenzen; Rückfragen mit dem erlaubten Bereich bei Überschreitung (`breite = 33 … ganze Zahl von 1 bis 32`).
- Stapeln über die Lage `ueber` ohne Lücke (Obergeschoss steht auf dem Erdgeschoss, Dach auf dem Obergeschoss).
- **Maße nachträglich ändern** über `aktualisiereBau`: dieselben Abdrücke je Schicht wie ein frischer Lauf (für den Fortschritt wichtig: unveränderte Schichten behalten ihre Haken).
- Stil über die Stimmung je Teil (Dach „dunkel-industriell“ ergibt Schwarzstein und Tiefenschieferziegel, „glanz“ Quarz und Gold).
- Planungszeit: Millisekunden bis wenige Sekunden, kein Vergleich zur Zitadelle.

## Was nur mit Einschränkungen funktioniert
- **Geschosse als `bau.gang`:** Maße stimmen (Außenbreite = lichte Breite + 2 × Wandstärke, Höhe = lichte Höhe + Boden + Decke), aber der Gang ist ein offener Tunnel. Außerdem gilt wegen der Gang-Bereiche eine **Höchstbreite von 34**. Die Zwischendecke ist 2 Blöcke dick (Decke des Erdgeschosses plus Boden des Obergeschosses).
- **Satteldach:** deckt das Haus bei Neigung 1 genau, bei Neigung 0,8 (Variante groß) bleibt es je Seite eine Blockreihe schmaler als das Haus (Befund, Ursache nicht untersucht). Kein Dachüberstand, die Giebel sind offen (laut Referenz Ebene 2 so gebaut).
- **Material:** Die Stimmung bestimmt die Blöcke (nur drei Stimmungen). Ein zusätzlicher Farbwunsch (`stil.farben`) hatte **keine Wirkung** (gleiche Materialliste mit und ohne `rot`).
- **Tür, Fenster, Treppe als eigene Teile:** Jedes Teil bekommt Rand (4) und Technikstreifen; deshalb passen sie nur mit großem Bauplatz, und mit `abstand: 0` stehen sie immer noch **8 Blöcke von der Hauswand entfernt**.

## Was vollständig fehlt
1. **Geschlossener Raum:** kein Quader/Raum/Wand-Baustein. In der Bausteinliste (15 Formen und Bauelemente, 7 Technikbausteine) gibt es nichts mit vier Wänden.
2. **Öffnungen in Wänden:** Fenster und Türen als Aussparung mit eingesetztem Bauteil (Lage an einer Wandseite, Versatz, Maß).
3. **Innenräume und Verschachtelung:** `innen` (Teil in Teil) und „mittig bei“ sind laut Meldung „später“. Hüllen dürfen sich nicht überschneiden.
4. **Treppe zwischen den Geschossen** inklusive Deckenöffnung.
5. **Dichtheit als Prüfung:** Kein Prüfer meldet, dass ein Haus nicht geschlossen ist (die Prüfer von Ebene 1 kennen Schienen, Dorf, Wasser, Licht, Spawn; Spawn nur für einen übergebenen Bereich).
6. **Ein Wohnbereich mit Betten** (Funktionsart `wohnbereich`) hat keinen Baustein und wäre eine Schaltungsanfrage.

## Wiederverwendbar
`bau.gang` (als Muster für Hohlkörper mit Boden/Decke/Wandstärke), `form.satteldach` und `form.walmdach`, `bau.treppe`, `bau.tuer`, `bau.fenster`, `bau.saeule`; Lage `ueber`/`unter`; Palette und Stimmung; Rückfragen- und Neuplanungs-Mechanik (`aktualisiereBau`); Bauplan, Material und Fortschritt unverändert; Dichtheits-Prüfmuster aus Ebene 2 (Flutfüllung bei hohlen Formen).

## Notwendige Erweiterungen (nur das, was die Sonde belegt)
1. **`bau.raum`** (Ebene 2): geschlossener Hohlquader (Maße, Wandstärke, Boden/Decke wählbar), Anschluss je Wandseite. Test über alle Größen auf Dichtheit und Maße.
2. **Wandöffnungen als Parameter** von `bau.raum` (Seite, Versatz, Breite, Höhe; Menschenmaß für Türen: 2 hoch), damit Türen und Fenster an der Wand sitzen und der Raum begehbar ist.
3. **`innen`/Teile ohne Rand in der Übersetzung** (Ebene 3, `plan.uebersetzung`): Bauelemente und eingebettete Teile ohne den Rand von 4 Blöcken, bündig an der Wand.
4. **Dach bündig und mit geschlossenem Giebel** (`form.satteldach`) und **Farbwünsche** im Designer.
5. **Treppe zwischen Geschossen** mit Deckenöffnung.
Nicht notwendig: neue Ebene, Umbau des Ebenenmodells, KI-Änderung, Änderung der Spezifikationsstruktur außer dem Vokabular.

## Vereinbarkeit mit dem Ebenenmodell
- `bau.raum`, Öffnungen, Giebel: **Ebene 2** (allein auf leerer Fläche stellbar und testbar), Material nur über Rollen.
- Verschachtelung, Rand-Regel, Treppe über Geschosse: **Ebene 3** (Konstrukteur, `plan.uebersetzung` als Daten); Ebene 2 muss weder Nachbarn noch Standort kennen.
- Vokabular (`art: haus`, Funktionsarten, Teilarten): **Daten** in `data/regeln/leser.json`; kein neues KI-Wissen, der Leser beschreibt weiter nur WAS.
- Eingabe-Assistent und Bearbeitung: **Ebene 5** schreibt nur Spezifikation oder Fixierungen nach unten; das ändert nichts am Grundsatz „Ebene 5 rechnet nichts“.
- **Entscheidung 1 des Bearbeitungsmodells** (Blockänderung relativ zu einem stabil identifizierten Bauteil) braucht eine stabile, planversionsübergreifende Teil-Kennung. **Belegt:** Die heutigen Nummern (`T1`, `T2` …) folgen der Bau-Reihenfolge und sind dafür ungeeignet: nach Hinzufügen eines Kellers heißt das Erdgeschoss im frischen Lauf `T2` statt `T1`, nach `aktualisiereBau` `T5` (alle vier Teile bekommen neue Nummern; Test). **Nicht belegt:** ob die Spezifikations-Id (`erdgeschoss`) dafür taugt. Sie blieb in allen untersuchten Läufen gleich (Hinweis) und der Prüfer lehnt doppelte Ids ab; Umbenennen, Entfernen und Wiedereinfügen sowie die Beständigkeit über viele Planversionen sind nicht untersucht. Sie ist der naheliegende Kandidat und wird im Arbeitspaket „Bearbeitungsmodell“ zuerst geprüft. Das ändert den Entwurf in Ebene 3, ist aber mit dem Ebenenmodell vereinbar (die Id kommt aus Ebene 4).
- Es gibt keinen Widerspruch zum Ebenenmodell.

## Kleinstes sinnvolles erstes Implementierungspaket
**`bau.raum` mit Wandöffnungen** (Erweiterungen 1 und 2): ein Baustein in Ebene 2, eigene Testdatei, Status `simuliert`. Inhalt: geschlossener Quader mit lichten Maßen und Wandstärke, optional Boden und Decke, bis zu n Öffnungen je Wandseite; dazu der Eintrag im Vokabular des Lesers (Bausteinliste) und die Umstellung der Haus-Sonde auf `bau.raum`.
Abnahme: (a) Tests über alle Größen (Dichtheit per Flutfüllung, Maße, Symmetrie, Spiegeln/Drehen über den Vermesser), (b) mit Ebene 1: Spieler und Dorfbewohner gehen durch die Tür hinein, geschlossene Wand hält, (c) die Befund-Tests der Haus-Sonde („Stirnwände fehlen“) werden durch die Implementierung rot und anschließend in positive Regressionstests für geschlossene Wände und definierte Öffnungen umgeschrieben, (d) 1 Zeile Spieltest-Anleitung für Jonah (Tür und Wandöffnung im Spiel). Aufwand: klein bis mittel, kein Eingriff in Ebene 3.
Danach in dieser Reihenfolge: Dach bündig mit Giebel, dann `innen` und Treppe über Geschosse (Ebene 3), dann die Untersuchung stabiler Teil-Kennungen als Voraussetzung des Bearbeitungsmodells.

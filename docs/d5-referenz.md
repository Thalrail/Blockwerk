# D5.0 – Referenz-Messlatte Zitadelle (Entwurf zur Bestätigung)

Stand 17.11.2026. Grundlage: `docs/architektur-komposition.md` (Vorschlag), Produktrichtung von Jonah (17.11.2026, `docs/entscheidungen.md`), die 14 Referenzbilder in `docs/zitadelle/bilder/` und `docs/zitadelle/beschreibung.md`. Nur Dokumentation: keine Kompositionsengine, kein Code.

**Grundsatz:** Die Zahlen unten sind **Referenz**, keine Systemgrenzen. Das System rechnet mit Verhältnissen und Parametern; 168 und 240 sind der erste Referenzmaßstab. Menschenmaß (Tür 2, Gang ab 2, Stufe 1) bleibt bei jedem Maßstab fest.

Herkunft jeder Zahl:
- **B** = Beschriftung auf einem Bild (zuverlässig, Bildnummer genannt).
- **A** = aus dem Bild abgelesen (Schätzung, Genauigkeit angegeben; Bild 14 hat ein Lineal von 0 bis 240, Bild 09 eines von −120 bis 120).
- **R** = aus B-Werten gerechnet.
- **N** = angenommen (nicht auf den Bildern; Begründung genannt, von Jonah zu bestätigen).

## 1. Maße

### Gesamtanlage
| Maß | Wert | Herkunft |
|---|---|---|
| Plateau | 240 × 240 | B (08, 09, 14) |
| Hauptgebäude | 168 × 168, mittig, Rand 36 rundum | B (14); Rand R |
| Untergeschoss | Y −16 bis 0 | B (09, 10, 11) |
| Hauptebene (Handelsviertel) | Y 0 bis 20 | B |
| Obergeschoss | Y 20 bis 36 | B |
| Kuppel (Rotunde) | bis Y 64 | B |
| Ecktürme | bis Y 80 | B (02, 09) |
| Hauptturm | bis Y 110 | B (09) |
| Himmelsrichtung | Portal Süd, Süden unten im Bild | B (09, 14) |

### Baukörper
| Teil | Maß | Herkunft |
|---|---|---|
| Rotunde | Innendurchmesser 33, mittig (120/120) | B (05, 14); Lage A |
| Hauptturm | Höhe 110; Mitte ≈ 40 nördlich der Rotunden-Mitte auf der Mittelachse (±5) | Höhe B; Lage A (14) |
| Hauptturm, Grundfläche | Ø 21 | **N**: nicht beschriftet, geschätzt aus Bild 09 (etwa das 1,1-fache des Eckturm-Schafts) |
| Eckturm, Höhe | 80; Ebenen 20–36 Durchgang, 36–52 Wohnebene, 52–60 Aussicht, 68–80 Spitze | B (02) |
| Eckturm, Schaft | Ø 17 bis 20; D5.0 nimmt **19** | A (09: Schaft ≈ 17; 02: Kern ≈ 20), Wert N |
| Eckturm, Grundriss mit Erkern | ≈ 30 bis 33 | A (02), nur zur Information |
| Eckturm, Mitte | ≈ 30 von beiden Plateaukanten (±6), also nahe der Gebäudeecke (36/36) | A (14); D5.0 nimmt die Ecke (36/36) als **N**, die Abweichung liegt innerhalb ±6 |
| Portal | Breite 15, Höhe 20, Spitzbogen, Mitte der Südfront (120/204) | B (01); Lage A |
| Brücke West / Ost | Länge 46, 7 Pfeiler (Höhe 28) | B (01) |
| Brücke, Breite | 13 (Bild 01) **oder** Brückenboden 5 breit (Bild 02): Widerspruch, siehe 5 | B/B |
| Handelsviertel | 7 mit Ständen + Eingangshalle (Süd), strahlenförmig in 45°-Schritten um die Rotunde; Laufgang 5 (Hauptviertel) oder 3; je 2 Reihen × 10 Nischen = 20; Innenbreite 23; Deckenhöhe 8 bis 12 | B (06, 12, 13) |
| Handelsnische | innen 1 × 2 × 3, Dorfbewohner-Stellplatz 1 | B (07) |
| Terrassen | Nord, Süd, West, Ost; Größe nicht beschriftet | Vorhandensein B (14), Maß **N**: wird in D5.0b aus Bild 14 gemessen |
| Außen- und Stützmauern | in der Legende von Bild 14 genannt, ohne Maße; Höhe 0 bis 20, Zinnen am Brückenniveau | Vorhandensein B (14, 02), Maße **N** |
| Innenhöfe, Gärten, Wasserbecken | zwischen den Strahlen, in Bild 14 sichtbar, nicht beschriftet | Vorhandensein A, Maße **N** (D5.0b) |

### Gerechnete Proportionen (R, maßstabsfrei, Bezug Hauptgebäudebreite 168 = 1,00)
| Verhältnis | Wert |
|---|---|
| Plateau / Hauptgebäude | 1,43 (Hauptgebäude = 0,70 des Plateaus) |
| Eckturm-Höhe | 0,476 |
| Hauptturm-Höhe | 0,655 |
| Kuppelhöhe | 0,381 |
| Rotunde-Ø | 0,196 |
| Obergeschoss-Oberkante | 0,214 |
| Portalbreite | 0,089 |
| Hauptturm-Höhe / Eckturm-Höhe | 1,375 |
| Kuppelhöhe / Eckturm-Höhe | 0,80 |
| Eckturm-Schaft (19) / Eckturm-Höhe | 0,24 (N-Wert) |
| Höhenstufen der Baukörper über der Hauptebene | 5 (20, 36, 64, 80, 110) |

## 2. Skalierung
Ein **Proportionsprofil** (Abschnitt 1, Proportionen) plus ein Maßstabsparameter ergeben die Abmessungen. Beispiel Halbmaßstab (Hauptgebäude 84): Eckturm 40, Hauptturm 55, Kuppel 32, Rotunde Ø 16 oder 17 (gerundet nach der Mittelpunktregel). Fest bleiben Tür 2, Gang ab 2, Stufe 1, Treppen- und Fenstermaße; Technik skaliert über Anzahl. Wo ein Maß dadurch unter ein Mindestmaß fällt, gibt es eine Rückfrage statt eines stillen Wechsels.

## 3. Zielentwurf (Grundriss, Hauptebene, Stufe 1)
Koordinaten: x Ost, z Süd, Plateau 0 bis 240, Mitte (120/120). Alle Lagen sind **Beziehungen**, die Koordinaten stehen nur zur Nachvollziehbarkeit hier.

```
          N
   Turm NW      Terrasse N      Turm NO
      \   Viertel NW | Nord | NO   /
       \          Hauptturm         /
  Terrasse W — Viertel W — ROTUNDE — Viertel O — Terrasse O
       /          |    Ø 33          \
      /  Viertel SW | Eingangshalle | SO \
   Turm SW          Portal           Turm SO
        Brücke W  <—  Süd-Terrasse —>  Brücke O
          S
```

| Nr. | Teil | Lage (Beziehung) | Anschlüsse (nach `architektur-komposition.md`, Abschnitt 4) |
|---|---|---|---|
| 1 | Rotunde | mittig | 8 Strahlen zu den Vierteln und zur Eingangshalle; Hauptturm Nord (achsengleich) |
| 2 | Hauptturm | 40 nördlich der Rotunde, Mittelachse | Fuß an Viertel Nord; Treppe zum Obergeschoss |
| 3–6 | Ecktürme NW, NO, SW, SO | Ecken des Hauptgebäudes | je ein Gang auf Höhe 20 bis 36 zu den benachbarten Mauern und Vierteln (Bild 02: „Brückenanschluss“) |
| 7 | Portal | Mitte der Südfront | Eingangshalle, Brücken, Südterrasse |
| 8–9 | Brücke West / Ost | vor der Südfront, vom Portal nach West und Ost | Portal; Plateaurand |
| 10–16 | Handelsviertel Nord, NO, O, SO, SW, W, NW | strahlenförmig um die Rotunde | Rotunde (innen), Außenmauer (außen), Terrasse oder Turm am äußeren Ende |
| 17 | Eingangshalle | Süden, Strahl Süd | Portal, Rotunde |
| 18–21 | Terrassen N, S, W, O | am äußeren Ende der Hauptachsen | Außenmauer, Viertel am Strahlende |
| 22–25 | Außenmauer (4 Seiten) mit Zinnen und Wehrgang | Rand des Hauptgebäudes, an den Ecktürmen eingebunden | Ecktürme (Einbindung), Portal (Durchfahrt), Terrassen |
| 26 | Innenhöfe | zwischen den Strahlen | umschlossen von Vierteln und Mauern |

Nicht Teil von Stufe 1: Untergeschoss-Technik, Lorenbahnnetz, Felder, Wohnbereiche, Gelände und Wasserfälle (bleiben Anfragen wie im Prüfbericht).

## 4. Qualitätskriterien
Jede Metrik hat eine feste Formel auf den Blockdaten. **Schwellen und Toleranzen sind hier Vorschlag und gelten erst nach Jonahs Bestätigung.** Ist der Nenner einer Quote 0, gilt die Metrik als „nicht anwendbar“, nie als bestanden.

| Nr. | Metrik | Formel | Vorgeschlagene Schwelle (Referenz) |
|---|---|---|---|
| Q1 | Anschlussqualität | Fügungen ohne Spalt und ohne Versatz / alle Fügungen | 100 %; Mindestzahl Fügungen bei der Zitadelle: 30 (4 Türme, 4 Mauern, Portal, 2 Brücken, 8 Viertel, 4 Terrassen, Hauptturm, Rotunde) |
| Q2 | Erreichbarkeit | vom Portal zu Fuß erreichte Räume (Rotunde, 8 Strahlen, 4 Ecktürme, Hauptturm, 4 Terrassen) / deklarierte Räume, über Ebene 1 `bewegung.weg` (Spieler) | 100 % |
| Q3 | Höhenstaffel | je Baukörperart Verhältnis Höhe / Hauptgebäudebreite gegen Abschnitt 1 | je Verhältnis ±5 % der Referenz; genau 5 Höhenstufen |
| Q4 | Spiegelordnung | Baukörperpaare, die an der Ost-West-Achse spiegelbildlich gleich liegen (Türme, Brücken, Viertel W/O, NW/NO, SW/SO, Terrassenseiten) / alle erwarteten Paare | 100 % der Paare; Abweichung der Lage höchstens ½ Block. Nord–Süd ist bewusst nicht symmetrisch (Portal Süd, Hauptturm Nord) |
| Q5 | Radialordnung | Winkel der 8 Strahlen zur Rotunde | 45° mit höchstens ½ Block Lageabweichung am Strahlende |
| Q6 | Hofanteil | Hof- und Terrassenfläche / Grundfläche des Hauptgebäudes | Referenzwert wird in D5.0b aus Bild 14 gemessen (nicht beschriftet), Toleranz ±20 % relativ |
| Q7 | Materialkonsistenz | Zahl der Materialien je Rolle und Baukörperart; Anteil der Rolle „Wand“ | höchstens die Palette „Glanz“ (Weiß, Gold, Blau + Glas); je Baukörperart höchstens 1 Materialwechsel an der Fuge |
| Q8 | Menschenmaß | Türen 2 hoch, Gänge ab 2 breit, Stufe 1, an jedem Maßstab | 100 % |
| Q9 | Gesamtzusammenhang | `messeAufbau` über die ganze Anlage | 0 unverbundene Blöcke, 0 freischwebende, 0 Hilfspunkte |

**Zweites Kriterium: Jonahs visueller Vergleich.** Die Oberfläche zeigt die Ansichten Süd, Ost und Draufsicht aus dem Blickwinkel der Bilder 09, 08 und 14 neben dem Referenzbild. Jonah entscheidet je Ansicht „passt“ oder „nicht“ mit Anmerkung. Geometrisch fehlerfrei (Q1 bis Q9) ist **nicht** gleich „überzeugend“; beide Kriterien müssen erfüllt sein.

## 5. Offene Punkte und Widersprüche (Jonah)
1. **Brückenbreite:** 13 (Bild 01) gegen Brückenboden 5 (Bild 02, Detail Brückenanschluss). Vorschlag: 13 für die Brücke vor dem Portal, 5 für die Gänge zwischen Eckturm und Gebäude (zwei verschiedene Bauteile).
2. **Brückenlänge:** 46 (Bild 01) gegen Bild 14, wo die Brücken bis zum Plateaurand reichen (mehr als 100). Vorschlag: 46 je Brückenfeld, bei Bedarf mehrere Felder mit Pfeilern.
3. **Eckturm-Mitte:** nach Bild 14 etwa 6 Blöcke außerhalb der Gebäudeecke. Vorschlag: auf der Ecke.
4. **Eckturm-Ebenen:** Bild 02 nennt −14 bis 0, die Hauptbilder −16 bis 0 (Entscheidung 27.10.2026: Hauptmaße gelten).
5. **Hauptturm-Grundfläche, Terrassen, Mauerhöhen, Innenhöfe:** nicht beschriftet, hier N. D5.0b misst Terrassen und Höfe aus Bild 14 mit der vorhandenen Bildmessung, der Rest bleibt Annahme bis zu deiner Bestätigung.

## 6. Modellvergleich A, B, C (Entscheidung 1)
| | **A: Anschlüsse und Fügeregeln als Daten** | **B: Anlagenrezepte** | **C: Baugruppen-Baum** |
|---|---|---|---|
| Idee | Jeder Baustein nennt seine Anschlusspunkte; allgemeine Regeln als Daten sagen, wie zwei Anschlüsse zusammenpassen | Ein Rezept beschreibt eine ganze Anlage („Burg“) fest | Teile werden zu Gruppen mit Untergruppen, die Gruppe verhält sich wie ein Teil |
| Erweiterbarkeit | Neue Bausteine und neue Fügeregeln sind nur Daten; jede Anlage entsteht aus Beziehungen | Jede neue Anlagenart braucht ein neues Rezept; wenig Wiederverwendung | Gut für Großes; die Zusammenarbeit der Gruppen braucht trotzdem A |
| Ebenenmodell | Sauber: Bausteine kennen nur sich (Ebene 2), Fügen und Lage in Ebene 3, die Spezifikation bleibt WAS | Gefahr, dass Zitadellenwissen in Ebene 3 landet (Sonderlogik) | Passt zu Ebene 3, braucht aber Spezifikationsschema für Gruppen (Ebene 4) |
| Zitadelle | Reicht ohne Sonderlogik | Schnell, aber starr und zitadellennah | Überdimensioniert für Stufe 1 |
| Risiko | Mehr Entwurfsarbeit am Anfang (D5.0 bis D5.2) | Widerspricht „keine Sonderimplementierung“ | Zu früh festgelegt |

Empfehlung bleibt **A**; C kommt später als Ergänzung auf A (Gruppen aus Teilen mit definierten Anschlüssen), B entfällt als eigener Weg.

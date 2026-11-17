# Bausteinrezepte (D2): Architektur und Qualitätsnachweis

Stand 15.11.2026. Status: `entworfen` (Proportionen sind ein Blockwerk-Entwurf, kein Bedrock-Wert; Spieltest durch Jonah offen, nie von Agenten auf `geprüft` zu setzen). Entscheidung: `docs/entscheidungen.md` (Roadmap v2, D2-Festlegungen), Paketplan: `docs/roadmap-v2.md`.

## Zweck
Ein Rezept setzt ein Teil aus gestapelten Ebene-2-Formen zusammen (Sockel, Schaft, Krone, Dach) statt aus einem einzigen Rohr. Es ist deterministisch (Ebene 3, Architekt), die Spezifikation bleibt bei WAS.

## Spezifikationsfeld
Optional `teile[].rezept` (z. B. `"turm"`), statt `form.baustein`. Dann nennt `form.groesse` die **Außenmaße** (`breite`, `tiefe`, `hoehe`). Der Prüfer (Ebene 4) lehnt mit Rückfrage ab: Rezept zusammen mit `form.baustein`, `form.proportionen`, oder `funktionen` (`wandstaerke` ist kein Spezifikationsfeld), unbekannter Name, Maße unter dem Mindestmaß, nicht ganzzahlige Maße, Rezept in einem Teil, das in einem anderen Bauteil liegt. Ohne das Feld ändert sich nichts. Der Leser sieht nur Namen und Mindestmaße, nie die Glieder.

## Datenformat (`data/regeln/rezepte.json`, Regel `rezepte.turm`)
```json
{ "id": "rezepte.turm", "parameter": {
  "auflage": 1,
  "mindest": { "breite": 9, "tiefe": 9, "hoehe": 16, "hoeheZuBreite": 1 },
  "glieder": [
    { "id": "sockel", "baustein": "form.zylinder", "einzug": { "anteil": 0, "min": 0 }, "wandstaerke": 2,
      "hoehe": { "anteil": 0.1, "min": 2, "max": 5 }, "rollen": { "wand": "akzent" } },
    { "id": "dach", "baustein": "form.kegel", "einzug": { "anteil": 0, "min": 0 }, "wandstaerke": 2,
      "hoehe": { "zuBreite": 0.8, "min": 5, "maxAnteil": 0.38 } } ] } }
```
Glieder von unten nach oben (sockel, schaft-unten, schaft-oben, krone, dach). Höhe: genau eine Art (`anteil` der Gesamthöhe, `zuBreite` der eigenen Breite, `rest` als Gewicht), `min`/`max`/`maxAnteil` nur bei `anteil` und `zuBreite`; Restglieder teilen den Rest nach Gewicht, jedes bekommt mindestens eine Schicht, Grenzen an ihnen lehnt das Laden ab. Optional `auflage` (0 oder 1, Standard 0) siehe Auswertung. Kaputte Daten werfen beim Laden `RezeptFehler` (Test `rezepte.test.js`).

## Auswertung (`src/ebene3/rezepte.js`)
Breite und Tiefe je Glied = Außenmaß minus doppelter Einzug (Einzug = Anteil der Breite, mindestens `min`; die Parität bleibt, also bleibt jedes Glied mittig). Höhen summieren sich genau zur Gesamthöhe (Reste nach größtem Bruchteil). Die Wand des tragenden (Verjüngung) oder auskragenden Glieds wird mindestens so dick wie der Einzugsunterschied **plus `auflage`** (Turm: 1), damit keine Spalte entsteht und das obere Glied auf dem Ring des unteren aufliegt statt nur an dessen Innenkante zu hängen (Messung mit `messeAufbau`: bei Auflage 0 schwebt die erste Ringschicht über einem Absatz; mit Auflage 1 liegt sie auf). Die Glieder stehen lückenlos übereinander; der Architekt legt sie als Teile an.

## Stabile Kennungen und manuelle Änderungen
Jedes Glied hat die `ref` `<teil>.<glied>` (z. B. `turm.krone`). Einzelblockänderungen (Planfassung) tragen diese Kennung, die Zelle liegt im Koordinatensystem des Glieds. Bleibt die Spezifikation gleich, bleibt die Änderung wirksam; fällt die Zelle bei anderen Maßen weg, wird sie als verwaist gemeldet (Rückfrage: verwerfen, verankern, zulassen). Test: `test/ebene5/rezepte-aenderungen.test.js`. Die Bearbeitungsoberfläche (`src/ebene5/teile.js`) kennt Rezeptteile noch nicht (Baustein ist dort `null`; Größe und Parameter lassen sich nur in der Spezifikation ändern).

## Rückwärtskompatibilität
Ohne `rezept` ist die Planung byte-identisch zu vor D2: `test/ebene3/rezepte-rueckwaerts.test.js` (6 Fälle, Hashes vom Stand `fc950a8`) und `rezepte-regression.test.js` (Turmrohr, Haus, Zitadelle klein). Das D1-Golden `gestaltung-basis.json` bleibt unverändert. **Einzige bekannte Folge für alle:** der Briefing-Prompt (Ebene 4) enthält den neuen Abschnitt „Bauart (rezept)“.

## Grenzen
- Nur das Rezept `turm`; Mindestmaß 9 × 9 × 16 und Höhe mindestens so groß wie die größere Breite.
- Die Krone kragt bei kleinen Breiten einen Block aus; der Einzug ist ein Anteil der Breite, daher bei großen Breiten mehr (bei 45 drei Blöcke). Bewusst so.
- Die Rollen `akzent` (Sockel, Krone) und `wand` wirken nur, wenn die Palette der Stimmung sie liefert; Blockwerk wählt kein Material.
- Keine Innenausstattung, Dekoration. Eingang, Fenster, Geschosse und Treppe nur als optionale Merkmale (siehe unten, D3 und D4).
- Befund (D2.2, behoben in Paket 1a Teil 2): Wandstärke 1 bei runder Form (Schaft oben, Dach) war nur diagonal zusammenhängend (bei 13×13×34 vier, bei 31×31×60 26 Hilfspunkte). Jetzt Wand 2 bei Schaft oben und Dach. Dünne runde Wände sind nur diagonal verbunden, auch beim bisherigen Rohr; der Test (`rezepte-groessenreihe.test.js`) prüft deshalb die 26er-Nachbarschaft. Wand 1 bleibt nur beim bisherigen Rohr; das Turm-Rezept nutzt Wand 2 (Schaft oben, Dach).

## Ein neues Rezept ergänzen
Nur Daten: eine Regel `rezepte.<name>` mit `mindest` und `glieder` in `data/regeln/rezepte.json` (Status `entworfen`, Quelle). Bausteine müssen Ebene-2-Formen sein. Dann Tests ergänzen: Größenreihe, Symmetrie, Rückwärtskompatibilität, Vergleich mit den D1-Metriken. Kein Code im Architekten.

## Qualitätsnachweis (Vorher-Nachher mit D1-Metriken)
`test/ebene3/rezepte-vergleich.test.js` (Golden `rezepte-vergleich.json`, neu nur mit `BLOCKWERK_VERGLEICH_NEU=1`): Rohr (`form.zylinder`) gegen Rezept bei gleichem Außenmaß und gleicher Stimmung. Erzwungen: Dach vorhanden, mehr Querschnitte, `gleichDarunter` unter 0,9, kleinere größte glatte Fläche, Blockzuwachs höchstens +60 %, Außenmaß exakt (nach Paket 1a Teil 2 gemessen +0 bis +39 %).

| Fall | Blöcke Rohr → Rezept | Querschnitte | gleichDarunter | größte glatte Fläche | Dach |
|---|---|---|---|---|---|
| 13×13×34 | 1224 → 1507 (+23 %) | 1 → 7 | 1 → 0,697 | 170 → 55 | nein → ja |
| 21×17×45 | 2340 → 3262 (+39 %) | 1 → 14 | 1 → 0,614 | 315 → 91 | nein → ja |
| 9×9×20 | 480 → 483 (+1 %) | 1 → 5 | 1 → 0,579 | 100 → 18 | nein → ja |

Dazu `test/ebene3/rezepte-groessenreihe.test.js`: acht Größen (9×9×16 bis 45×45×80, 9×45×50) über die ganze Pipeline mit Außenmaß, Symmetrie in x und z, Zusammenhang (26er) und ohne Verstoß des Prüfers aus Ebene 1.

## Aufbau (Paket 1a, Teil 2): messbar baubar
`test/ebene3/rezepte-aufbau.test.js` (Golden `rezepte-aufbau.json`, neu nur mit `BLOCKWERK_AUFBAU_NEU=1`) misst acht Größen mit `messeAufbau` (Regel `ungeprüft`: ein Block wird an die Fläche eines gesetzten Blocks gesetzt, nur diagonale Berührung braucht einen Hilfsblock): keine unverbundenen Teile, Hilfspunkte höchstens 0 (Obergrenze im Test; ein Wert über 0 braucht Begründung im Golden), Blockzuwachs gegen das Rohr höchstens +80 %, Dach 25 bis 40 % der Höhe. Änderungen am Rezept: Dach Wand 2 und Höhe 0,8 × Breite (mindestens 5, höchstens 38 % der Höhe), damit sich die Kegelringe flächig überlappen; Schaft oben Wand 2; Einzüge Schaft unten und Krone 4 %, Schaft oben 7,5 %; `auflage` 1.

| Größe | Blöcke (Rohr) | Hilfspunkte vorher → nachher | Dach (Schichten) |
|---|---|---|---|
| 9×9×16 | 387 (384) | 4 → 0 | 6 |
| 11×11×24 | 799 (672) | 7 → 0 | 9 |
| 13×13×34 | 1507 (1224) | 4 → 0 | 10 |
| 17×17×40 | 2507 (1920) | 7 → 0 | 14 |
| 21×15×45 | 3021 (2160) | 36 → 0 | 17 |
| 21×21×56 | 4647 (3136) | 24 → 0 | 17 |
| 31×31×60 | 7635 (5040) | 26 → 0 | 22 |
| 45×45×80 | 16732 (9920) | 42 → 0 | 30 |

Restwerte: keine. Kosten: bis +69 % Blöcke bei 45×45×80 (dickere Ringe), Mindestmaße unverändert (9 × 9 × 16 bleibt baubar, Dach dort 6 von 16 Schichten). Spieltest offen.

## Merkmale (D3): Eingang und Fensterschlitze
Stand 17.11.2026, `entworfen` (Spieltest offen, nie von Agenten auf `geprüft` zu setzen). Entscheidung: `docs/entscheidungen.md` (Fenster und Türen für das Turm-Rezept).

**Spezifikation (nur WAS):** optional `teile[].merkmale: { "eingang": "nord|ost|sued|west", "fenster": "schlitze" }`, beide einzeln wählbar, nur zusammen mit `rezept`. Ohne das Feld (auch mit `{}`) ist der Entwurf byte-identisch (`test/ebene3/rezepte-merkmale.test.js`). Der Leser sieht nur die Namen (Vokabular `rezepte.turm.merkmale`, Briefing-Abschnitt „Merkmale“); Maße, Lage und Blöcke bestimmt Ebene 3.

**Regeln als Daten** (`data/regeln/rezepte.json`, `parameter.merkmale`, beim Laden geprüft): `eingang` (Seiten, Glied `sockel`, Baustein `bau.tuer`, Flügel nach Parität der Breite der jeweiligen Wand (Breite für Nord und Süd, Tiefe für Ost und West), `sockelMindesthoehe` 3, Regel `tuer.nichtPerHand` mit Quelle) und `fenster.formen.<name>` (Baustein, Parameter, Breite nach Parität, tragende Glieder, Geschosshöhe 5, Schwelle 2, Randzeilen, Seitenfolge). Eine neue Fensterform ist nur ein weiterer Eintrag.

**Platzierung (`src/ebene3/rezepte.js`):** Kinder der Glieder (`turm.eingang`, `turm.fenster-<glied>-<seite>-<n>`, stabile Kennungen) in der Wandzone (`wand-<seite>`, Anker Mitte). Ungerade Breite: eine Spalte, gerade: zwei Spalten um die Mitte (symmetrisch). Die Wanddicke wird an den echten Blöcken des Trägers gemessen; die Öffnung (`bau.tuer`/`bau.fenster`, Parameter `tiefe`) ersetzt an der Vorderseite die Wand, dahinter hält eine Freihaltung den Durchgang frei (ein manuell gesetzter Block dort ist ein Konflikt, nie stilles Zumauern). Mit Eingang ist der Sockel mindestens 3 Schichten hoch (Sturz). Fenster nur in den Schaftgliedern, ganz in einem Glied mit je einer Randzeile zu dessen Kanten (dort liegt das nächste Glied auf); bei sehr kleinen Türmen (9×9×16) passt kein Fenster. Nur Glieder mit Merkmal bekommen den Parameter `wandzonen: 1` (`form.zylinder`), die Blöcke bleiben gleich. Die Soll-Symmetrie der Glieder entfällt nur für die Achse, die der Eingang bricht.

**Tür aus der Palette:** Rolle `akzent`, Form `tuer`. Fehlt sie oder lässt sie sich nicht von Hand öffnen (Eisentür der Stimmung `dunkel-industriell`), gibt Ebene 3 eine Rückfrage mit Quelle statt eines Ersatzblocks; Abhilfe: Eingang weglassen oder `stil.palette.akzent.tuer` (Holz- oder Kupfertür). Hinweis: Die Tür braucht in Bedrock einen tragenden Block darunter (Gelände); der Plan setzt die Schwelle auf Bodenhöhe (`ungeprüft`).

**Manuelle Änderungen:** Eine Änderung genau an der Türzelle oder im Durchgang ist ein Konflikt (die Planung wartet, Jonah entscheidet); beim Abschalten eines Merkmals wird eine Änderung an seinem Kind verwaist gemeldet; Änderungen an den Gliedern bleiben stabil (`test/ebene5/merkmale-aenderungen.test.js`). Geänderte Schichten erscheinen in den Umbauhinweisen.

**Ebene 5 (D3.4):** Reiter „Teile“, Rezeptteil: Auswahl Eingang (Himmelsrichtung oder keiner) und Fenster; läuft wie die Größe über „Prüfen und übernehmen“ (Vorschau, Folgen, Umbauhinweise); `src/ebene5/teile.js` (`setzeMerkmal`, `rezeptMerkmale`, Felder `m-eingang`, `m-fenster`). Abschalten entfernt das Feld ganz.

**Nachweis:** `test/ebene3/rezepte-merkmale.test.js` (13 Größen × 4 Seiten, quadratisch, rechteckig und mit gemischter Parität: mittig, durch die Wand, Durchgang bis in den Innenraum, Außenmaß, Prüfer Ebene 1 ohne Verstoß, `messeAufbau` 0 unverbundene Blöcke und 0 Hilfspunkte, Symmetrie, Determinismus, Palettenkonflikte), `test/ebene2/wandzonen-tiefe.test.js`, `test/ebene5/rezeptmerkmale.test.js`. Echt geprüft im Windows-Fenster (aktivieren, ändern, Neustart, abschalten; Eisentür-Meldung).

## Geschosse und Treppen (D4)
Stand 17.11.2026, Status `entworfen`; **D4 ist von Jonah als Arbeitsstand freigegeben (Entscheidung); der Bedrock-Spieltest ist eine informelle Beobachtung ohne festgehaltene Konfiguration, die allgemeine Regel bleibt `ungeprüft`** (nie von Agenten auf `geprüft` zu setzen; `docs/spieltests.md`). Entscheidung: `docs/entscheidungen.md` (Geschosse und Treppen für das Turm-Rezept).

**Spezifikation (nur WAS):** `teile[].merkmale.geschosse: "standard"` und `merkmale.treppe: "auto" | "wendel" | "gerade" | "leiter"` (nur zusammen mit `geschosse`; ohne Angabe gilt auto). Ohne `geschosse` ist der Entwurf byte-identisch (`test/ebene3/geschosse-treppen.test.js`).

**Etagen (Daten `merkmale.geschosse.formen.standard`):** 5 Blöcke je Etage (4 lichte Höhe plus 1 Decke), das Erdgeschoss steht auf dem Gelände. Die Decken füllen die lichte Innenfläche der Schicht (nach der echten Geometrie des geschlossenen Rohrs, auch im Kegeldach) bis auf die Öffnung der Treppe. Es gibt keine Abschlussdecke über der obersten Ebene; deren Austritt braucht 3 Blöcke lichte Höhe. Wie viele Etagen es gibt, folgt allein aus dem Platz.

**Treppenformen (Daten `treppen`):** `wendel` (`bau.wendeltreppe`, größter passender Ring um die Mitte, Radien aus den Daten), `gerade` (`bau.treppe` im Zickzack auf zwei Spuren, Lauf von 6 Blöcken), `leiter` (`bau.leiter`, an der Wand; Stützblöcke dahinter, wo keine Wand steht). `auto` nimmt die Wendeltreppe, sonst die gerade Treppe, nie die Leiter. Passt die gewählte Form nicht (keine einzige Etage), gibt es eine Rückfrage mit der Begründung aus der Messung („der lichte Querschnitt ist dort nur w Blöcke breit“), den Mindestanforderungen und den Formen, die ginge: nie ein stiller Wechsel. Gemessen (13 Größen, `rezepte` aus der Pipeline): Wendel ab 10×10×20 (1 Etage), 11×11×24: 3, 13×13×34: 5, 31×31×60: 10; gerade Treppe ab etwa 13×13×34 (2), 17×17×40: 6; Leiter bis 9×9×16 (1 Etage, nur Spieler).

**Platzierung (`src/ebene3/geschosse.js`):** Jede Etage ist ein Lauf (Kind mit `traeger` = das Glied der Decke, Zone `innenraum`); überspannt er eine Gliedgrenze, wird er in Segmente zerlegt (Blöcke eines Kinds müssen in der Zone seines Trägers liegen). Die Öffnungen in den Decken sind der Glied-Parameter `deckenLoecher`, die Kinder melden die Kopffreiheit zusätzlich als Freihaltung (Änderung dort = Konflikt). Kennungen: `turm.treppe-<form>-<etage>-<glied>` und `turm.leiter-<etage>-<glied>`; ein Wechsel der Form macht Änderungen an Stufen verwaist statt sie auf eine andere Stufe zu übertragen. Der Raum hinter der Tür bleibt frei. Mit Geschossen sitzen die Fenster 2 Blöcke über dem Fußboden jeder Etage (ohne Geschosse unverändert der D3-Rhythmus); Glieder mit Öffnungen verlieren die Spiegelsymmetrie als Soll.

**Begehbarkeit:** Modellbeweis mit Ebene 1 (`weg` von außen durch die Tür bis auf jede Etage: Spieler, Dorfbewohner, Baby je nach Form; die Leiter nur Spieler). Die Regel `bewegung.treppe` ist eine **Java-Annahme** (`ungeprüft`), das Ergebnis ist kein Bedrock-Beweis. **Spieltest (Jonah, nach PR #73):** Die getesteten Treppen funktionieren in Bedrock wie in Java; bestätigt ist nur die getestete Konfiguration (Größe und Form nicht festgehalten), alle anderen Varianten bleiben `ungeprüft` (`docs/spieltests.md`). Die Leiter kennzeichnen Hinweis und Oberfläche („nur für Spieler“). Ob die Eckverbindungen der Treppenblöcke (`minecraft:corner`) beim Platzieren im Spiel wie geplant einrasten, ist ungeprüft.

**Baubarkeit (`messeAufbau`):** keine unverbundenen oder freischwebenden Blöcke; Hilfspunkte nur an Treppenstufen (höchstens 3 je Etage: eine aufsteigende Stufe berührt die vorige nur diagonal und braucht beim Bauen einen Hilfsblock), ohne Geschosse keine.

**Ebene 5 (D4.4):** Reiter „Teile“: Geschosse (aus/Standard) und Treppenform (Automatisch, Wendeltreppe, Gerade Treppe, Leiter nur für Spieler); die Treppenform hängt an den Geschossen. Läuft wie Eingang und Fenster über „Prüfen und übernehmen“ (Vorschau, Platzproblem-Rückfragen, Umbauhinweise); Abschalten entfernt die Felder.

**Nachweis:** `test/ebene2/geschosse.test.js`, `test/ebene3/geschosse-treppen.test.js` (7 Größen × 4 Formen, Ebene 1, Ausrichtung der Treppenblöcke, `messeAufbau`, Eingang, Fenster und Dach, Determinismus, Rückfragen), `test/ebene5/geschosse-aenderungen.test.js`, `test/ebene5/rezeptmerkmale.test.js`.

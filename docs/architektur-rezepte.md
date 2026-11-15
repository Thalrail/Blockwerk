# Bausteinrezepte (D2): Architektur und Qualitätsnachweis

Stand 15.11.2026. Status: `entworfen` (Proportionen sind ein Blockwerk-Entwurf, kein Bedrock-Wert; Spieltest durch Jonah offen, nie von Agenten auf `geprüft` zu setzen). Entscheidung: `docs/entscheidungen.md` (Roadmap v2, D2-Festlegungen), Paketplan: `docs/roadmap-v2.md`.

## Zweck
Ein Rezept setzt ein Teil aus gestapelten Ebene-2-Formen zusammen (Sockel, Schaft, Krone, Dach) statt aus einem einzigen Rohr. Es ist deterministisch (Ebene 3, Architekt), die Spezifikation bleibt bei WAS.

## Spezifikationsfeld
Optional `teile[].rezept` (z. B. `"turm"`), statt `form.baustein`. Dann nennt `form.groesse` die **Außenmaße** (`breite`, `tiefe`, `hoehe`). Der Prüfer (Ebene 4) lehnt mit Rückfrage ab: Rezept zusammen mit `form.baustein`, `form.proportionen`, oder `funktionen` (`wandstaerke` ist kein Spezifikationsfeld), unbekannter Name, Maße unter dem Mindestmaß, nicht ganzzahlige Maße, Rezept in einem Teil, das in einem anderen Bauteil liegt. Ohne das Feld ändert sich nichts. Der Leser sieht nur Namen und Mindestmaße, nie die Glieder.

## Datenformat (`data/regeln/rezepte.json`, Regel `rezepte.turm`)
```json
{ "id": "rezepte.turm", "parameter": {
  "mindest": { "breite": 9, "tiefe": 9, "hoehe": 16, "hoeheZuBreite": 1 },
  "glieder": [
    { "id": "sockel", "baustein": "form.zylinder", "einzug": { "anteil": 0, "min": 0 }, "wandstaerke": 2,
      "hoehe": { "anteil": 0.1, "min": 2, "max": 5 }, "rollen": { "wand": "akzent" } },
    { "id": "dach", "baustein": "form.kegel", "einzug": { "anteil": 0, "min": 0 }, "wandstaerke": 1,
      "hoehe": { "zuBreite": 0.4, "min": 3, "maxAnteil": 0.3 } } ] } }
```
Glieder von unten nach oben (sockel, schaft-unten, schaft-oben, krone, dach). Höhe: genau eine Art (`anteil` der Gesamthöhe, `zuBreite` der eigenen Breite, `rest` als Gewicht), `min`/`max`/`maxAnteil` nur bei `anteil` und `zuBreite`; Restglieder teilen den Rest nach Gewicht, jedes bekommt mindestens eine Schicht, Grenzen an ihnen lehnt das Laden ab. Kaputte Daten werfen beim Laden `RezeptFehler` (Test `rezepte.test.js`).

## Auswertung (`src/ebene3/rezepte.js`)
Breite und Tiefe je Glied = Außenmaß minus doppelter Einzug (Einzug = Anteil der Breite, mindestens `min`; die Parität bleibt, also bleibt jedes Glied mittig). Höhen summieren sich genau zur Gesamthöhe (Reste nach größtem Bruchteil). Die Wand des tragenden (Verjüngung) oder auskragenden Glieds wird mindestens so dick wie der Einzugsunterschied, damit keine Spalte entsteht. Die Glieder stehen lückenlos übereinander; der Architekt legt sie als Teile an.

## Stabile Kennungen und manuelle Änderungen
Jedes Glied hat die `ref` `<teil>.<glied>` (z. B. `turm.krone`). Einzelblockänderungen (Planfassung) tragen diese Kennung, die Zelle liegt im Koordinatensystem des Glieds. Bleibt die Spezifikation gleich, bleibt die Änderung wirksam; fällt die Zelle bei anderen Maßen weg, wird sie als verwaist gemeldet (Rückfrage: verwerfen, verankern, zulassen). Test: `test/ebene5/rezepte-aenderungen.test.js`. Die Bearbeitungsoberfläche (`src/ebene5/teile.js`) kennt Rezeptteile noch nicht (Baustein ist dort `null`; Größe und Parameter lassen sich nur in der Spezifikation ändern).

## Rückwärtskompatibilität
Ohne `rezept` ist die Planung byte-identisch zu vor D2: `test/ebene3/rezepte-rueckwaerts.test.js` (6 Fälle, Hashes vom Stand `fc950a8`) und `rezepte-regression.test.js` (Turmrohr, Haus, Zitadelle klein). Das D1-Golden `gestaltung-basis.json` bleibt unverändert. **Einzige bekannte Folge für alle:** der Briefing-Prompt (Ebene 4) enthält den neuen Abschnitt „Bauart (rezept)“.

## Grenzen
- Nur das Rezept `turm`; Mindestmaß 9 × 9 × 16 und Höhe mindestens so groß wie die größere Breite.
- Die Krone kragt bei kleinen Breiten einen Block aus; der Einzug ist ein Anteil der Breite, daher bei großen Breiten mehr (bei 45 drei Blöcke). Bewusst so.
- Die Rollen `akzent` (Sockel, Krone) und `wand` wirken nur, wenn die Palette der Stimmung sie liefert; Blockwerk wählt kein Material.
- Keine Fenster, Türen, Innenräume, Dekoration.
- Befund (D2.2): Wandstärke 1 bei runder Form (Schaft oben, Dach) ist nur diagonal zusammenhängend; das Dach liegt der Krone nur an Kanten auf. Dünne runde Wände sind nur diagonal verbunden, auch beim bisherigen Rohr; der Test (`rezepte-groessenreihe.test.js`) prüft deshalb die 26er-Nachbarschaft. Offene Frage an Jonah (Rezeptdaten, nicht in D2.2 geändert).

## Ein neues Rezept ergänzen
Nur Daten: eine Regel `rezepte.<name>` mit `mindest` und `glieder` in `data/regeln/rezepte.json` (Status `entworfen`, Quelle). Bausteine müssen Ebene-2-Formen sein. Dann Tests ergänzen: Größenreihe, Symmetrie, Rückwärtskompatibilität, Vergleich mit den D1-Metriken. Kein Code im Architekten.

## Qualitätsnachweis (Vorher-Nachher mit D1-Metriken)
`test/ebene3/rezepte-vergleich.test.js` (Golden `rezepte-vergleich.json`, neu nur mit `BLOCKWERK_VERGLEICH_NEU=1`): Rohr (`form.zylinder`) gegen Rezept bei gleichem Außenmaß und gleicher Stimmung. Erzwungen: Dach vorhanden, mehr Querschnitte, `gleichDarunter` unter 0,9, kleinere größte glatte Fläche, Blockzuwachs höchstens +60 %, Außenmaß exakt.

| Fall | Blöcke Rohr → Rezept | Querschnitte | gleichDarunter | größte glatte Fläche | Dach |
|---|---|---|---|---|---|
| 13×13×34 | 1224 → 1421 (+16 %) | 1 → 6 | 1 → 0,758 | 170 → 120 | nein → ja |
| 21×17×45 | 2340 → 3065 (+31 %) | 1 → 8 | 1 → 0,75 | 315 → 186 | nein → ja |
| 9×9×20 | 480 → 469 (−2 %) | 1 → 4 | 1 → 0,632 | 100 → 39 | nein → ja |

Dazu `test/ebene3/rezepte-groessenreihe.test.js`: acht Größen (9×9×16 bis 45×45×80, 9×45×50) über die ganze Pipeline mit Außenmaß, Symmetrie in x und z, Zusammenhang (26er) und ohne Verstoß des Prüfers aus Ebene 1.

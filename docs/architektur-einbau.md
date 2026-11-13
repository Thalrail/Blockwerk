# Architektur: Einbau (Innenräume, Kindbauteile, Aussparungen) und Blocküberlagerungen

Stand 13.11.2026, Architekturuntersuchung im Auftrag von Jonah (Entscheidung B + C, `docs/optionen-innen-treppe.md`). **Nichts ist umgesetzt.** Diese Datei wird nicht automatisch geladen. Grundlage sind gelesener Code (Ebene 0, 3, 5) und die Haus-Sonde; Aussagen sind unten als *gelesen*, *abgeleitet* oder *offen* gekennzeichnet. Jonahs Auftrag brach in der Nachricht mitten im letzten Punkt ab („Zerlege die Implement…“); ich habe ihn als „Zerlege die Implementierung in kleine, getrennt prüfbare Pakete“ gelesen (Abschnitt 8).

## 1. Jonahs Vorgaben
1. B und C als zusammenhängendes Konzept. 2. Erste Treppe gerade, Wendeltreppe später ohne Umbau. 3. Trennwände und Türen von Anfang an als unabhängig platzierbare Bauteile. 4. Leere Raumvolumen verursachen keine Blockkollisionen; „ein Block gehört höchstens einem Teil“ bleibt. 5. Aussparungen, Öffnungen und spätere manuelle Einzelblockänderungen auf gemeinsamer, nachvollziehbarer Grundlage. 6. Deterministisch und mit dem Ebenenmodell vereinbar. Dazu die verbindlichen Entscheidungen zum Bearbeitungsmodell B (Anker relativ zum Bauteil, Neuprüfung bei Technikänderung, versionierte Planfassung, Verwaistes entscheidet der Benutzer).

## 2. Kernidee in einem Satz
**Ein Kindbauteil bleibt im Abschnitt seines Trägers, sitzt in einer benannten Einbauzone des Trägers (Innenraum, Wand, Decke) und liefert zusätzlich eine Aussparung (Zellen, die im Träger leer werden). Eine Aussparung und eine manuelle Einzelblockänderung sind dieselbe Operation (`leere`/`setze` einer Zelle im lokalen Koordinatensystem eines Teils), nur mit verschiedener Herkunft.**

Damit bleiben die Abschnitts-Hüllen disjunkt (Kinder haben keine eigene Hülle und keinen Rand), die Blockkollision bleibt der einzige Konflikt, und Leeres kollidiert nie.

## 3. Datenmodell

### 3.1 Ebene 2: Paket (alle Felder optional, bestehende Pakete bleiben gültig)
```
einbauzonen: [{ id, art: 'innenraum'|'wand'|'decke'|'boden', von:{x,y,z}, bis:{x,y,z}, seite?: 'nord'|'ost'|'sued'|'west' }]
aussparungen: [{ art: 'oeffnung'|'freihaltung', von:{x,y,z}, bis:{x,y,z} }]   // Kind-Paket, lokales System; dürfen außerhalb der Paketbegrenzung liegen
```
- `bau.raum` meldet `innenraum`, je Wand `wand-nord/ost/sued/west`, `decke` und `boden`. `bau.wand` (neu): Quader als Trennwand mit eigener Zone `wand` für Türen.
- **Zwei Arten von Aussparung** (Ergebnis der zweiten Review-Runde): `oeffnung` wird aus den Blöcken des Trägers entfernt, das Kind darf eigene Blöcke hineinsetzen (Tür, Fenster); `freihaltung` wird ebenfalls aus dem Träger entfernt und **muss danach für alle leer bleiben**, auch für eigene Blöcke des Kindes und für Benutzeränderungen (Kopffreiheit der Treppe, später der Schacht der Wendeltreppe).
- `bau.tuer`, `bau.fenster`: `oeffnung` (Flügel × 2 bzw. Breite × Höhe); `bau.treppe` (gerade): `freihaltung` = Kopffreiheit über jeder Stufe (2 Blöcke, auch über der höchsten Stufe), damit schneidet sie die Decke des Trägers genau dort, wo sie steigt. Aussparungen liegen **außerhalb der Paketbegrenzung** (die Kopffreiheit über der obersten Stufe ist kein Block des Pakets); sie verschieben den Referenzrahmen nicht (3.6) und haben eigene, geprüfte Grenzen (endliche ganze Zahlen, höchstens eine feste Zellenzahl). `bau.wendeltreppe` später: zylindrischer Schacht als Aussparung, **keine Änderung der Architektur** (Vorgabe 2).
- Ebene 2 kennt weiter keine Nachbarn: Ein Paket behauptet nur, was es selbst belegt und freihalten will.

### 3.2 Ebene 3: Entwurf (Version 2)
```
teil: { id, ref, abschnitt, baustein, parameter, lage:{x,y,z,drehung}, ... ,
        traeger?: <ref>, einbau?: { zone, anker, versatz:{x,y,z}, drehung } }
aenderungen: [{ id, teil: <ref>, zelle:{x,y,z}, op:'setze'|'leere', block?:{id,zustand}, von, quelle:'benutzer', version }]
```
- **`ref` (stabile Kennung)** kommt aus der Spezifikation und ändert sich nie: Teil `erdgeschoss`, Kind `erdgeschoss/treppe`, Tür in Trennwand `erdgeschoss/wand1/tuer`. Die heutigen Nummern `T1, T2 …` bleiben nur als interne Reihenfolge (Befund der Haus-Sonde: sie verschieben sich).
- **`traeger`/`einbau`:** Das Kind sitzt in der Zone `zone` des Trägers, am `anker` (Ecken, Mitte, Wandmitte) mit `versatz`. Die Weltlage `lage` ist **abgeleitet** (eine Funktion `loeseLagen`, deterministisch, nach jeder Änderung); gespeichert und bearbeitet wird nur die Relativlage. Dreht oder verschiebt man den Träger, wandern die Kinder mit.
- **`aenderungen`:** Manuelle Einzelblockänderungen, **lokal am Teil** (Entscheidung 1). Eine Aussparung eines Kindes ist keine gespeicherte Änderung, sondern wird aus dem Kind-Paket abgeleitet und trägt `quelle: 'aussparung:<ref>'`.

### 3.3 Gemeinsame Grundlage: die Zellenoperation und der Zusammenbau je Teil
Alles, was ein Teil in einem anderen oder in sich ändert, ist eine Operation auf Zellen im **Referenzrahmen des Teils** (3.6): `{ teil, zelle, op: 'leere' | 'setze', block?, quelle }`, Quelle ∈ { `paket`, `aussparung:<kind>`, `benutzer:<id>` }.

**Zusammenbau rekursiv je Teil** (Ergebnis der Review-Runde: eine globale Reihenfolge reicht für Raum → Wand → Tür nicht, weil die Aussparung zwischen dem Einfügen der Wand und dem Einfügen der Tür liegen muss). `materialisiere(T)`:
1. **Blöcke von T** aus dem Paket (Rahmen von T → Welt).
2. **Aussparungen der direkten Kinder** von T (Vereinigung, nach `ref` sortiert) werden aus den Blöcken **von T** entfernt (nur von T, nie von Fremden).
3. **Kinder** werden rekursiv materialisiert (nach `ref` sortiert) und zusammengeführt. Kollision zweier Teile in einer Zelle ist ein Einwand `plan.geometrie` (kein stilles Überschreiben).
4. **Benutzeränderungen von T** (nach Id sortiert) wirken nur auf Zellen, die T selbst gehören oder frei sind und in **keiner Freihaltemenge** liegen (`setze`), bzw. auf Blöcke von T (`leere`). Eine Operation auf fremde Blöcke oder in eine Freihaltemenge ist ein Einwand.

Beispiel Raum → Trennwand → Tür: Die Wand wird mit der Türöffnung **ausgespart, bevor** sie in den Raum eingefügt wird; die Tür sitzt dann in der Öffnung. Raum → Treppe schneidet die Decke des Raums, nicht die Wand eines Geschwisters.

**Freihaltemengen:** Aussparungen der Art `freihaltung` sind **dauerhafte Freihalteanforderungen** (Kopffreiheit der Treppe). Nach dem Zusammenbau gilt: In einer Freihaltezelle steht **kein Block irgendeines Teils**, auch nicht des Kindes selbst, und keine Benutzeränderung darf dort `setze` ausführen (Schritt 4 verbietet es). Verletzung ist ein Einwand `plan.freiraum` mit Herkunft; mehrere Kinder dürfen dieselbe Leerzelle beanspruchen (Menge mit Herkunft). `oeffnung`-Zellen sind dagegen nur im Träger leer; das Kind darf sie füllen (Tür).

**Besitzkarte** (`besitz: Zelle → ref`) ist das Ergebnis, nicht die Prüfung: Die Regeln oben (Reihenfolge, Eigentum, Freihaltung) verhindern Überschreiben und Versperren; die Karte beantwortet danach „wem gehört diese Zelle und warum“.

### 3.4 Ebene 4: Spezifikation (Vokabular als Daten)
Neue Lagebeziehungen: `innen` (mit `anker`, `versatz`) und `wand-nord|ost|sued|west` (mit `versatz` entlang der Wand, Standard Mitte). Das Teil nennt weiter nur WAS und wo in Beziehung („Treppe innen im Erdgeschoss an der Ostwand“), keine Weltkoordinaten. Der Träger ergibt sich aus `bezug`.

### 3.5 Trägerwald (Referenzintegrität)
`traeger` bildet einen **Wald**: genau ein Träger je Kind, der Träger existiert, keine Selbstbezüge, keine Zyklen. Der Abschnitt wird transitiv von der Wurzel geerbt (Raum → Wand → Tür liegen alle im Abschnitt des Raums). `pruefeForm` verlangt das (Tests: fehlende Referenz, Selbstbezug, A→B→A, Ketten mit drei und mehr Gliedern). Wird ein Träger entfernt, fragt der Bauleiter mit Optionen für **alle Nachkommen** (mit entfernen, an neuen Träger hängen, abbrechen); nichts wird stumm verwaist.

### 3.6 Koordinatenvertrag
- **Begriffe:** *Abschnittshülle* (Planungskasten mit Rand, nur Wurzelteile haben eine) und *Paketbegrenzung* (kleinster Quader um die Blöcke eines Pakets, auch bei Kindern) sind getrennt.
- **Referenzrahmen eines Teils** = lokales System mit Ursprung an der **Ecke Nordwest unten der Paketbegrenzung** (Quader um die **Blöcke**, ohne Aussparungen und Änderungen); unveränderlich für dieselbe Parameterfassung. Der Paket-Nullpunkt (bei `bau.raum` in der Mitte) wird beim Bauen auf diesen Rahmen umgerechnet.
- **Abbildung:** `Welt = Träger-Welt-Transformation ∘ Einbau-Transformation ∘ Kind-Rahmen` (Drehung 0–3 und Verschiebung über den Vermesser, auch für Blockzustände). Aussparungen des Kindes laufen durch dieselbe Kette in die Welt und werden dort auf die Blöcke des Trägers angewendet; es gibt keine zweite Rechenregel.
- **Tests** (P1, P4): nichtquadratische Pakete, alle 16 Kombinationen aus Träger- und Kinddrehung, Größenänderung des Trägers, Vergleich mit dem direkten Weg über ein fertiges Bauteil.

## 4. Auswirkungen je Ebene
| Ebene | Änderung | Umfang |
|---|---|---|
| 0 | Keine zwingend. Aussparungen werden über `loescheBlock` angewendet (vorhandene Schnittstelle). Zellenlisten werden mit dem Vermesser gedreht, indem sie als Bauteil aus Platzhalterblöcken ohne Richtungszustand durch `drehe`/`verschiebe` laufen. Alternative: `luft`-Liste im Bauteil (Vermesser und `fuegeBauteilEin` kennen sie) — sauberer, aber die Regel „Ebene 0 ändert sich nur bei einem Bedrock-Update“ spricht dagegen. **Entscheidung nötig (Abschnitt 9).** | keine / klein |
| 1 | Keine Regeländerung. Der Prüfer läuft über die fertige Welt. Neu: Eingrenzung auf Teil und Umgebung (Abschnitt 7). | keine |
| 2 | Paketfelder `einbauzonen`, `aussparungen`; Prüfung in `pruefePaket`; Bausteine `bau.wand`, Aussparungen für `bau.tuer`, `bau.fenster`, `bau.treppe`, Zonen für `bau.raum`. Bestehende Parameter von `bau.raum` (Tür, Fenster) bleiben gültig (Rückwärtskompatibilität). | mittel |
| 3 | Entwurf v2 (`ref`, `traeger`, `einbau`, `aenderungen`), `loeseLagen`, `materialisiere` in fester Reihenfolge mit Besitzkarte, neue Einwandregeln, Übersetzung für `innen`/`wand-…`, Architekt: Einbauzone als Platzierungsfläche. | groß |
| 4 | Vokabular (Daten) und Prüfer: Relationen, Anker, Versatz; Rückfragen statt Raten. | klein |
| 5 | Bauplan ordnet Zellen über die Besitzkarte zu (heute: erst `schluessel` der Teile, dann der Blockwert der Welt); Aussparungen sichtbar; Anzeige „nicht bestätigt“. | mittel |

## 5. Invarianten: erhalten und geändert
**Bleiben erhalten**
- Höhere Ebenen ändern die Welt nur über Ebene 0 (gelesen: `fuegeBauteilEin`, `loescheBlock`).
- **Jeder Block gehört höchstens einem Teil** (Einwand `plan.geometrie`, gelesen): bleibt auf Blockebene; Leeres und Aussparungen zählen nicht.
- **Abschnitts-Hüllen überschneiden sich nicht** (Konstrukteur, Übersetzung, gelesen): bleibt, weil Kinder im Abschnitt des Trägers liegen und keine eigene Hülle haben.
- Determinismus: feste Reihenfolge (3.3), keine Uhr, keine Zufallswerte.
- Ebene 2 kennt weder Standort noch Stil noch Nachbarn; der Leser beschreibt nur WAS.

**Müssen geändert werden**
- „Ein Teil, ein Abschnitt“ in der Übersetzung wird zu „ein Teil, ein Abschnitt; Kinder erben den Abschnitt“. Die Rand-/Lücken-Regel (4 Blöcke) gilt nur für Abschnitts-Hüllen, nicht für Kinder.
- Teil-Kennung: `T<n>` (fortlaufend, instabil) wird interne Reihenfolge; Fixierungen, Überlagerungen und Kinder verweisen auf `ref`. Fixierungen (`fixiere(ziel)`) verweisen heute auf `teil:T3`: Migration nötig.
- Reihenfolge im Zusammenbau: heute Abschnittsreihenfolge, dann Teil-Nummer (gelesen); neu: Träger vor Kind, Kinder nach `ref`.
- Bauplan: Besitzkarte statt „Schlüssel des Teils + Blockwert der Welt“ (gelesen: heute wird ein von einem anderen Teil überschriebener Block dem ersten Teil zugerechnet).
- Architekt: Platzierung in der Zone eines Trägers statt nur in Zonen des Abschnitts; der Kasten des Raums sperrt seinen Innenraum nicht mehr.
- Entwurf-Version 1 → 2 mit Migration (`pruefeForm`, kanonische Speicherung).

## 6. Stabile Kennungen, Rotation, Verschiebung, Größenänderung
- **Kennung:** `ref` aus der Spezifikations-Id (und Kind-Namen), eindeutig (Prüfer lehnt doppelte Ids ab, belegt). Umbenennen einer Spezifikations-Id gilt als „entfernt + neu“ (Überlagerungen werden verwaist und gehen an die Rückfrage); Eignung für alle Fälle ist noch zu prüfen (offen, wie in der Haus-Sonde festgehalten).
- **Rotation:** `drehung` des Trägers dreht Kinder, Aussparungen und Überlagerungen mit (lokaler Rahmen, dann Teil-Drehung). Kinder haben nur eine Drehung relativ zum Träger (0–3, wie heute); Spiegeln gibt es im Entwurf bisher nicht (Vermesser kann es).
- **Verschiebung:** Nur die Träger-Lage ändert sich; Kinder folgen über `loeseLagen`.
- **Größenänderung:** Der lokale Rahmen hat seinen Ursprung an der **Hüllen-Ecke Nordwest unten** und nicht am Paket-Nullpunkt (der wandert bei `bau.raum`, weil er in der Mitte liegt: *gelesen*). So bleiben Zellen nahe dieser Ecke stabil. Kinder werden an Zone, Anker und Versatz gebunden (Mitte bleibt Mitte, Ecke bleibt Ecke). Passt nach der Änderung etwas nicht mehr (Kind außerhalb der Zone, Überlagerung außerhalb der Hülle), entsteht eine **Rückfrage mit Optionen** (Entscheidung 4): verwerfen, an den Rand setzen, Maß zurücknehmen; nie automatisch.

## 7. Technische Anlagen und Schicht-Fortschritt
- **Neuprüfung (Entscheidung 2):** Jedes Technikteil bekommt einen `bestaetigung`-Abdruck über den **gesamten prüfrelevanten Bereich**: seine wirksamen Zellen (nach Aussparungen und Änderungen) **und** die Umgebung, von der sein Verhalten abhängt (Sperrzone, Umkreis der Dorf- und Trichterregeln), jeweils mit Blöcken **und Leerzellen**. Verändert eine Aussparung oder Überlagerung irgendetwas in diesem Bereich, stimmt der Abdruck nicht mehr: Status „nicht bestätigt“, die Oberfläche zeigt die Funktion nicht als funktionsfähig, der Abschluss verlangt eine neue Prüfung durch Ebene 1. Das passt zum Paket „Prüfer auf Abschnitt und Nachbarn eingrenzen“ der Roadmap (Prüfen nach Änderung nur lokal, schneller).
- **Fortschritt:** Schlüssel bleibt `Abschnitt | Höhe | Abdruck`. Aussparungen und Änderungen verändern den Inhalt der Schicht, also den Abdruck: Ein Haken einer betroffenen Schicht fällt von selbst, unberührte Schichten behalten ihren Haken (Eigenschaft des heutigen Modells, *gelesen*). In einem **neuen** Plan werden ausgesparte Zellen nie gebaut. Wurde die Schicht nach der alten Fassung **schon gebaut**, stehen die Blöcke aber im Bauwerk: Beim Übernehmen einer neuen Planfassung vergleicht die Oberfläche die zuletzt bestätigte Fassung mit der neuen und zeigt **Umbauhinweise** (Zellen mit Block vorher, leer oder anders jetzt: „entfernen“ oder „ersetzen“); ohne Bestätigung dieser Hinweise wird die neue Fassung nicht übernommen (Paket P11). Eine Treppe im Raum verändert die Decken-Schicht des Erdgeschosses und die Schichten des Treppenverlaufs.

## 8. Zerlegung in kleine, getrennt prüfbare Pakete
Jedes Paket mit eigenem Auftrag, Tests, Codex-Review; die Haus-Sonde ist der gemeinsame Prüfstand.
| Paket | Inhalt | Ebene | Abhängigkeit | Abnahme |
|---|---|---|---|---|
| P1 | Zellenoperationen: Referenzrahmen (3.6), Drehung/Verschiebung über den Vermesser, `leere` über `loescheBlock`; Entscheidung zu Ebene 0 | 0/3 | – | Tests: 16 Rotationskombinationen, nichtquadratische Pakete, Verschiebung stimmen mit dem direkten Bauteil-Weg überein; deterministisch |
| P2 | Paketfelder `einbauzonen`, `aussparungen` (beide Arten), Validierung; `bau.raum` Zonen; `bau.wand` | 2 | P1 | Tests über alle Größen: Zonen liegen im Hohlraum bzw. in der Wand; Aussparungen haben gültige Grenzen und dürfen die Paketbegrenzung verlassen, ohne den Referenzrahmen zu verschieben |
| P3 | Aussparungen für `bau.tuer`, `bau.fenster` (`oeffnung`), gerade `bau.treppe` (`freihaltung`) | 2 | P2 | Tests mit Ebene 1: Tür/Fenster in Wand begehbar bzw. dicht; Treppe bis in die Zone darüber begehbar; die zwei Freihaltezellen über der höchsten Stufe sind Teil der Aussparung |
| P4 | Entwurf v2: `ref`, `traeger` (Wald-Prüfung 3.5), `einbau`, `loeseLagen`, Migration | 3 | P1 | Träger drehen/verschieben: Kinder folgen; Zyklen, Selbstbezug, fehlende Träger, Ketten; Migration v1→v2 verlustfrei |
| P5 | Rekursiver Zusammenbau je Teil (3.3), Freihaltemengen, Besitzkarte, Einwandregeln (Aussparung nur im Träger, Kind in Zone, Block höchstens einem Teil, Freiraum) | 3 | P3, P4 | Abnahmetests Raum → Wand → Tür, Raum → Treppe, mehrere Kinder mit überlappenden Aussparungen, Geschwister und Benutzeränderung der Treppe selbst versperren die Kopffreiheit (`plan.freiraum`), Determinismus (Eingabereihenfolge egal), Mutationen |
| P6 | Spezifikation und Übersetzung: `innen`, `wand-…`, Anker, Versatz; Kinder erben den Abschnitt; Rand-Regel nur für Abschnitte | 3/4 | P5 | Haus-Sonde: Treppe, Trennwand mit Tür, Fenster als Teile planen ohne Rückfrage |
| P7 | Bauplan mit Besitzkarte, Aussparungen sichtbar, Abdruck-Tests | 5 | P5 | Schicht-Haken: nur betroffene Schichten fallen |
| P8 | Benutzeränderungen (`aenderungen`) auf derselben Grundlage, Verwaisung → Rückfrage | 3/5 | P5 | Änderung folgt Drehung/Verschiebung, verwaist bei Verkleinerung, nie stiller Verlust |
| P9 | Neuprüfung technischer Anlagen: `bestaetigung` über Prüfbereich mit Umgebung, Prüfer lokal, Anzeige | 1/3/5 | P5, P8 | Änderung am Technikteil **oder nur in seiner Umgebung** → „nicht bestätigt“ bis zur Prüfung |
| P10 | Planfassung mit Änderungen: Version, Konflikte nicht stillschweigend überschreiben; Link-Grenze dokumentieren | 5 | P8 | Zwei Spieler ändern dieselbe Zelle: Konflikt sichtbar |
| P11 | Umbauhinweise: Differenz zwischen zuletzt bestätigter und neuer Planfassung, Bestätigung vor dem Übernehmen | 5 | P7, P10 | Treppe nachträglich in gebautes Erdgeschoss: Deckenblöcke als „entfernen“ gelistet |
| später | Wendeltreppe (nur Paket), Editor-Oberfläche, Spiegeln | 2/5 | P3, P8 | – |
Empfohlene erste Schritte: **P1 und P2 zusammen als kleinster Anfang** (kein Eingriff in die Planung), dann P3, P4.

## 9. Offene Entscheidungen für Jonah
1. **Ebene 0:** unverändert lassen und Zellenlisten über den Vermesser mit Platzhalterblöcken drehen (meine Empfehlung, keine Regelverletzung), oder eine `luft`-Liste im Bauteil als saubere Erweiterung (verstößt gegen „Ebene 0 ändert sich nur bei einem Bedrock-Update“, wenn du nicht ausnahmsweise zustimmst).
2. **Kinder erben den Abschnitt** des Trägers (Fortschritt, Bauleiter und Abschnittsreihenfolge bleiben unverändert). Alternative: eigener Abschnitt je Kind mit erlaubter Verschachtelung der Hüllen, das wäre eine Änderung der Konstrukteur-Invariante. Ich empfehle das Erben.
3. **Ursprung des lokalen Rahmens:** Hüllen-Ecke Nordwest unten (meine Empfehlung) oder der Paket-Nullpunkt (instabil bei Größenänderung).
4. **Spezifikation:** `innen` und `wand-…` mit `anker` und `versatz` als Beziehungen (der Versatz ist eine relative Blockzahl, keine Weltkoordinate): in Ordnung für „nur WAS“?
5. **Reihenfolge:** P1 und P2 zuerst?

## 10. Risiken und Grenzen
- Die Aussparung darf nur Blöcke des Trägers entfernen (3.3, Schritt 2); Schreiben in fremde Freihaltemengen und Operationen auf fremde Blöcke sind Einwände (nie stilles Überschreiben). Technikteile als Träger sind erlaubt, lösen aber die Neuprüfung aus.
- **Das Codex-Review (13.11.2026) fand sechs Lücken des ersten Entwurfs** (globale Reihenfolge, Freihaltung, Trägerwald, Technik-Abdruck, Umbau nach begonnenem Bau, Koordinatenvertrag); sie sind in 3.3, 3.5, 3.6, 7 und 8 eingearbeitet. Codex konnte den Code nicht lesen (Richtlinie): Die Aussagen „gelesen“ sind von mir belegt, nicht unabhängig bestätigt.
- Dichtheit eines Hauses ist weiter kein Prüfer in Ebene 1 (Haus-Sonde): Eine Aussparung kann ein Haus undicht machen. Eine Dichtheitsprüfung ist ein eigenes Paket.
- Leistung: Der Zusammenbau-Cache (`teilSpeicher`) schlüsselt heute nach Baustein, Parametern, Lage, Palette; er muss Einbau und Änderungen einschließen. Nicht gemessen.
- Die Link-Begrenzung (200.000 Zeichen) gilt auch für `aenderungen` (Entscheidung 5 des Bearbeitungsmodells: dokumentierte Einschränkung).
- Das Modell ist nicht an einem zweiten Referenzbau (Burgturm, Wendeltreppe) erprobt; die Haus-Sonde ist der erste Test, nicht der letzte.

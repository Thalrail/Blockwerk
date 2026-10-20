# Pull Request: Projektgerüst + Ebene 0 (Fundament)

> Dieser Text war die Grundlage des PR (Thalrail/Blockwerk#1). Der PR ist offen; die Hinweise zu Patch-Dateien unten sind überholt.

## Was gebaut wurde
**Schritt 0 – Gerüst:** Ordner je Ebene (`src/ebene0` … `ebene5`), `package.json` (nur `npm test`, Node ≥ 22, keine Abhängigkeiten),
GitHub-Actions-Workflow (Node 22, `npm test`), README mit Faithful-Nennung, `.gitignore`.

**Schritt 1 – Ebene 0:**
- Richtungen/Koordinaten (x Ost, z Süd, y oben; Chunk 16×16; Höhe −64…319).
- Blockregister Bedrock 1.26.50.4: 1463 Blöcke, 157 Zustandsarten, Eigenschaften, Behälter-Plätze (`data/bloecke.json`).
- Wesenregister: 130 Wesen mit Hitbox, Loren, Dorfbewohner (erwachsen/Baby), Spieler, Item (`data/wesen.json`).
- Voxelwelt in Chunks (Luft = Standard), Blockinhalte (Slots), Wesen mit Position, deterministische Reihenfolge, Kopie, Bauteil-Ausschnitte.
- Vermesser: Verschieben, Drehen, Spiegeln; Zustände (facing, Treppen, Schienen, Türen, Schilder, Ranken …) werden nach `data/drehregeln.json` mitgedreht.
- Speichern/Laden: versioniertes JSON, verlustfrei und kanonisch.
- Importskript `tools/baue-register.mjs` (Mojang-Daten → `data/`), Herkunft und Lizenz-Hinweis: `docs/daten.md`.

## Wie getestet
`npm test` → **75 Tests, alle grün** (offline). Unter anderem:
- Richtungen: 4× Drehen = Identität, Spiegeln 2× = Identität, Chunk-Zuordnung negativer Koordinaten.
- Register: Pflichtfelder, Typen und Werte aller Zustände, Stichproben der Eigenschaften, kuratierte IDs existieren.
- Welt: Setzen/Lesen/Löschen über Chunkgrenzen, Höhenbereich, Inhalt-Fehlerfälle, Wesen, alles-oder-nichts beim Einfügen.
- Vermesser: für **alle** Zustandswerte **aller** Blöcke: 4× Drehen = Identität, 2× Spiegeln = Identität, Ergebnis bleibt ein gültiger Zustand;
  Drehen ist umkehrbar; kein Richtungs-Zustand des Registers ohne Regel oder Vermerk; fehlende Richtungszustände werfen einen Fehler.
- Speichern: Roundtrip (auch 50.000 Blöcke), gleiche Welt = gleicher Text, kaputte Dateien werden abgelehnt.
- Architektur: Ebenen importieren nur nach unten, Engine ohne Dateisystem/Zufall/Uhrzeit, keine Abhängigkeiten, keine Mojang-Texturen im Repo.

**Grenze der Tests:** Sie beweisen Gleichmäßigkeit und Gültigkeit, nicht dass z. B. „weirdo_direction 2 = Süd“ im Spiel stimmt.
Das ist je Regel mit einer Wiki-Seite belegt, aber Status bleibt **ungeprüft**, bis du es bestätigst.

## Was du im Spiel testen sollst
Siehe `docs/spieltests.md` (8 kurze Tests mit Befehlen für die Kreativ-Testwelt: Trichter, Treppe, Schiene, Tür, Baby-Dorfbewohner im 1-Block-Gang, Fackel, Glow Lichen).
Schick pro Test „funktioniert / funktioniert nicht + Beobachtung“.

## Bekannte Lücken
Eigenschaften nur kuratierte Teilmenge; `direction`, `rotation`, `huge_mushroom_bits` werden nicht gedreht; Baby-Hitbox-Skalierung ungeklärt;
12 Wesen ohne Hitbox in den Mojang-Daten; Regale ohne Slot-Anzahl. Details: `docs/stand.md`.
Lizenz: Mojang-Daten sind „All rights reserved“ – im Repo liegen nur abgeleitete Fakten, siehe `docs/daten.md`.

Nächster Schritt: Ebene 1 (Taktgeber und Regelwerk).

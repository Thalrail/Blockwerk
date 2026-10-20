# Blockwerk

Bauplaner für **Minecraft Bedrock Edition** (Datenstand 1.26.50). Bauwerke werden nicht eingespielt, sondern von Hand
nach Bauplan (Schicht für Schicht) gebaut. Blockwerk läuft als Bauplan-Bildschirm auf dem Desktop neben der PS5.

Reines JavaScript (ES-Module), keine Abhängigkeiten, kein Build-Schritt.

## Ebenen
Jede Ebene baut nur auf tieferen Ebenen auf (siehe [docs/ebenen.md](docs/ebenen.md)).

| Ebene | Ordner | Inhalt | Stand |
|-------|--------|--------|-------|
| 0 | `src/ebene0` | Fundament: Koordinaten, Blockregister, Wesenregister, Voxelwelt, Vermesser, Speichern/Laden | im Aufbau |
| 1 | `src/ebene1` | Uhrwerk & Mechanik | offen |
| 2 | `src/ebene2` | Bausteine | offen |
| 3 | `src/ebene3` | Planung | offen |
| 4 | `src/ebene4` | Leser (einzige KI-Stelle) | offen |
| 5 | `src/ebene5` | Oberfläche | offen |

Aktueller Fortschritt: [docs/stand.md](docs/stand.md).

## Tests
```
npm test
```
Benötigt Node 22 oder neuer. Die Tests laufen offline.

## Daten
- Blöcke, Zustände und Wesen-IDs stammen aus den offiziellen Mojang-Daten
  ([Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples), Version 1.26.50.4), siehe `docs/daten.md`.
- Erzeugen/Aktualisieren: `node tools/baue-register.mjs` (braucht Internet, nicht Teil der Tests).

## Texturen
Die Darstellung (ab Ebene 5) nutzt das Texturpaket **Faithful 32x (Bedrock)** – <https://faithfulpack.net>,
Lizenz: <https://faithfulpack.net/license>. Blockwerk ist kostenlos und kein offizielles Produkt von Mojang,
Microsoft oder Faithful. Es liegen keine Original-Mojang-Texturen in diesem Repo.

"Minecraft" ist eine Marke von Mojang AB. Blockwerk steht in keiner Verbindung zu Mojang oder Microsoft.

# Daten von Ebene 0 – Herkunft und Stand

## Quelle (offiziell)
Mojang veröffentlicht die Bedrock-Daten im Repo **Mojang/bedrock-samples** (<https://github.com/Mojang/bedrock-samples>).
Verwendeter Stand: Version **1.26.50.4** (15.09.2026, laut `version.json`), Commit `46ba6ea985fb5a92d79a9419198f10dda14c199d` (Branch `main`, 16.09.2026).

| Datei im Repo | erzeugt aus |
|---|---|
| `data/bloecke.json` | `metadata/vanilladata_modules/mojang-blocks.json` (1463 Blöcke, 157 Zustandsarten) + `data/quellen/eigenschaften.json` |
| `data/gegenstaende.json` | `metadata/vanilladata_modules/mojang-items.json` (1623 Gegenstände) |
| `data/wesen.json` | `metadata/vanilladata_modules/mojang-entities.json` + `behavior_pack/entities/*.json` (Feld `minecraft:collision_box`) |
| `data/drehregeln.json` | handgepflegt (minecraft.wiki, Bedrock), Status `ungeprüft` |
| `data/quellen/eigenschaften.json` | handgepflegt (minecraft.wiki, Bedrock), Status `ungeprüft` |

Neu erzeugen (braucht Internet, nicht Teil von `npm test`): `node tools/baue-register.mjs` – zweiter Lauf ergibt dieselben Dateien.
Bei einem Bedrock-Update: Commit-Hash/Version hier und in `datenstand` nachziehen, Skript laufen lassen, `npm test` zeigt,
ob neue Richtungs-Zustände eine Drehregel brauchen.

## Was die Mojang-Daten NICHT enthalten (und wie es gelöst ist)
- **Eigenschaften** (Vollblock, durchsichtig, Lichtstärke, fällt, braucht Halt, Arbeitsblock): nicht in den offiziellen Daten.
  Sie stehen in `data/quellen/eigenschaften.json` als Muster/Listen mit Quelle. Wo nichts bekannt ist: `vollblock`/`durchsichtig` = `null` (unbekannt),
  `licht` = 0, `faellt`/`brauchtHalt`/`arbeitsblock` = `false`. **Lücken sind möglich** und werden bei Bedarf (Ebene 1) ergänzt. Status: `ungeprüft`.
- **Blockinhalt-Plätze** (Trichter 5, Truhe 27 …): ebenfalls kuratiert.
- **Item-Wesen** (Gegenstand am Boden): steht nicht in der Mojang-Wesenliste; Hitbox 0,25 × 0,25 laut Wiki (`ungeprüft`).
- 12 Wesen haben in den Mojang-Definitionen keine `collision_box` (z. B. Kaninchen, Schildkröte): Hitbox = `null` (unbekannt).

## Lizenz-Hinweis (bitte von Jonah beachten)
Das Mojang-Repo trägt „© Mojang AB. All rights reserved“; die Nutzung unterliegt dem Minecraft-EULA. Eine ausdrückliche Weitergabe-Erlaubnis
für die Rohdateien steht dort nicht. Deshalb liegen im Repo **keine Kopien der Rohdateien**, sondern nur abgeleitete Fakten
(Block-/Zustands-/Gegenstands-IDs, Zahlenwerte). Rohdaten landen nur im lokalen Cache `tools/.cache/` (in `.gitignore`).
Wenn du das Repo öffentlich machst: kurz prüfen, ob dir diese Ableitung reicht.

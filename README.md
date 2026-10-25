# Blockwerk

Bauplaner für **Minecraft Bedrock Edition** (Datenstand 1.26.50). Bauwerke werden nicht eingespielt, sondern von Hand
nach Bauplan (Schicht für Schicht) gebaut. Blockwerk läuft als Bauplan-Bildschirm auf dem Desktop neben der PS5.

Reines JavaScript (ES-Module), keine Abhängigkeiten, kein Build-Schritt.

## Ebenen
Jede Ebene baut nur auf tieferen Ebenen auf (siehe [docs/ebenen.md](docs/ebenen.md)).

| Ebene | Ordner | Inhalt | Stand |
|-------|--------|--------|-------|
| 0 | `src/ebene0` | Fundament: Koordinaten, Blockregister, Wesenregister, Voxelwelt, Vermesser, Speichern/Laden | fertig |
| 1 | `src/ebene1` | Uhrwerk & Mechanik (Takt, Wasser, Schienen, Redstone, Trichter, Wesen …) | fertig |
| 2 | `src/ebene2` | Bausteine (Formen, Bauelemente, Technikmodule) | fertig |
| 3 | `src/ebene3` | Planung (Fachleute, Einwand-Protokoll, Ablauf, Rückgriff) | fertig |
| 4 | `src/ebene4` | Leser (Spezifikation, Prüfer, Briefing-Prompt, Bildmessung, Brücke zur Planung) | fertig |
| 5 | `src/ebene5` + `web/` | Oberfläche: Bauplan-Bildschirm (Schichtpläne, Kompaktmodus, Material, Abhaken, Teilen) | im Aufbau (6a fertig) |

Aktueller Fortschritt: [docs/stand.md](docs/stand.md).

## Starten (Bauplan-Bildschirm)
Die Oberfläche ist eine Webseite ohne Build (`index.html`, ES-Module). Lokal ansehen:
```
node tools/serve.js        # dann http://localhost:8080/ öffnen
```
Auf GitHub Pages läuft sie ohne weitere Schritte (Einstellungen → Pages → Branch `main`, Ordner `/`). In Chrome oder Edge lässt sie
sich über „Installieren“ als eigenes Fenster öffnen; der Kompaktmodus kann als kleines Fenster **immer im Vordergrund** bleiben.
Bedienung: Beispielprojekt laden, Schichten abhaken (Leertaste), mit ← → blättern, mit M zwischen Voll- und Kompaktansicht wechseln,
„3D-Ansicht“ zeigt das ganze Bauwerk (drehen mit der Maus; Etagenschnitt, Technik ausblenden, Baufortschritt eingefärbt),
„Link kopieren“ schickt Plan und Fortschritt an Freunde.
„Neue Vorlage“: Briefing-Prompt kopieren, im Claude-Chat mit den Bildern eingeben, die Antwort einfügen, Rückfragen per Klick beantworten,
Bilder messen lassen (optional), die Zusammenfassung lesen und freigeben – dann entsteht der Bauplan.

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
Die Oberfläche zeigt zurzeit Farbflächen mit Block-Namen; für die Darstellung vorgesehen ist das Texturpaket **Faithful 32x (Bedrock)** – <https://faithfulpack.net>,
Lizenz: <https://faithfulpack.net/license>. Blockwerk ist kostenlos und kein offizielles Produkt von Mojang,
Microsoft oder Faithful. Es liegen keine Original-Mojang-Texturen in diesem Repo.

"Minecraft" ist eine Marke von Mojang AB. Blockwerk steht in keiner Verbindung zu Mojang oder Microsoft.

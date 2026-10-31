# Stand – Blockwerk (Kurzfassung)

Zuletzt aktualisiert: 31.10.2026. **Diese Datei wird bei jeder Sitzung und jedem Agenten automatisch geladen und bleibt deshalb klein** (Budget: `test/dokumentation.test.js`). Der ausführliche Stand je Baustein steht in `docs/referenz/` (Index: `docs/referenz/README.md`), nur bei Bedarf und gezielt lesen.

## Lage
- Neubeginn nach dem Ebenenmodell (`docs/kurz/ebenen-kurz.md`). Der frühere Prototyp und Blockplan sind verworfen.
- Ebene 0 bis 5 sind gebaut und bis PR #46 gemergt; Branch `claude/lorenbahn-nische-planung` (HEAD `8243807`) trägt außerdem **uncommittete** Arbeit: Lorenbahn-Nische Schritt 3, Korrekturen #1/#7/#12, Multi-Agenten-Orchestrierung, Skills, Token-Optimierung. **Commit, Push und PR nur mit Jonahs Freigabe.** Eine geprüfte Commit-Aufteilung liegt als Entwurf vor (6 Commits, Lorenbahn → Korrekturen → Orchestrierung → `gesamt` → Skills → Doku).
- Tests: `npm test` (Stand 31.10.2026: 446 grün; kurze Ausgabe: `npm run test:kurz`), `npm run test:orchestrierung` (46, rund 2 Minuten), `npm run test:pruefstein` (Zitadelle, 4 bis 6 Minuten).
- Spieltests von Jonah (20.–24.10.2026): 7 Drehregeln, die Lorenmessungen und einige Wasser-/Schienen-Regeln stehen auf `geprüft`, alles andere `ungeprüft` (siehe `docs/spieltests.md`). Der Status `geprüft` setzt nur Jonah nach einem Spieltest.
- Datenstand Bedrock 1.26.50; Wo Bedrock schweigt, gilt die Java-Regel als Platzhalter mit Status `ungeprüft`, Quelle und Testanleitung.

## Bauplan in Kürze (Detail je Zeile: `docs/referenz/`)
| Bereich | Stand | Detail |
|---|---|---|
| Ebene 0 Fundament (Koordinaten, Register 1463 Blöcke, Welt, Vermesser, Speichern) | fertig, `entworfen`, Drehregeln teils `geprüft` | `stand-ebene0-und-1.md` |
| Ebene 1 Mechanik: Taktgeber, Schienen und Antrieb, Wasser/Lava, Licht, Spawn, Lore (Messtabellen `geprüft`), fallende Blöcke, Trichter und Sperre, Redstone, Kolben, Bewegung, Dorf | fertig, `simuliert`, Annahmen `ungeprüft` | `stand-ebene0-und-1.md` |
| Ebene 2 Bausteine: Formen, Bogen/Tonne/Dächer, Bauelemente, Bahn-Module, Handelsnische, Sortiereinheit und -lager | fertig, `simuliert`; Bahnhof, Entladestelle, Brüter zurückgestellt (Brutkammer offen) | `stand-ebene2.md` |
| Ebene 3 Planung: Entwurf, Konstrukteur, Techniker, Grobdesigner/Architekt/Designer, Ablauf | fertig | `stand-ebene3-und-4.md` |
| Ebene 4 Leser: Schema, Prüfer, Briefing, Bildmessung, Brücke zu Ebene 3 | fertig | `stand-ebene3-und-4.md` |
| Ebene 5 Oberfläche: Bauplan-Bildschirm, 3D, Eingabe, Faithful-Texturen, Live-Abhaken | fertig (Live-Dienst von Jonah eingerichtet und getestet) | `stand-ebene5.md` |
| Prüfstein Zitadelle (Stufe 1 Hülle und Handel, 140 Nischen) | erste Runde fertig, Prüfbericht in `docs/zitadelle/` | `stand-ebene5.md` |
| Lorenbahn-Nische (Bild 07): Passagiere/Strömung, Baustein, Vokabular `bauart`, Techniker, Zitadelle | Schritt 1 und 2 gemergt, Schritt 3 uncommittet; Austrittsseite, Boden, 1-Block-Strömung `ungeprüft` | `stand-lorenbahn.md` |
| Korrekturen #1/#7/#12, Palette ohne stillen Teststein | fertig, uncommittet | `stand-korrekturen-und-orchestrierung.md` |
| Multi-Agenten-Orchestrierung (`/blockwerk-auftrag`), Skills (Ponytail-Regeln, 7 Agent Skills) | fertig, in zwei echten Läufen nachgewiesen | `docs/orchestrierung.md`, `docs/orchestrierung-erweiterungen.md` |
| Token-Optimierung (31.10.2026): schlanker Start, Skills bei Bedarf, Routing, Repo-Karte | umgesetzt, Messwerte in `docs/token-effizienz.md` | `docs/token-effizienz.md` |

## Nächster Schritt
**Jonah:** Commit-Aufteilung freigeben oder anpassen; Bauplatz der Zitadelle 600 × 600 bestätigen; Beschreibung und Prüfbericht in `docs/zitadelle/` ansehen; GitHub Pages einschalten und mit einem Freund live testen. **Danach:** Prüfer auf Abschnitte eingrenzen (schnellere Planung), erste Bauetappe im Spiel (Spieltest-Schleife), Testanleitungen und -ergebnisse in der Oberfläche eingeben. Nebenbei die offenen Lore-Tests aus `docs/spieltests.md` (Abstand 9, Rampen über 5 Blöcken, Rampe mitten in der Antriebsstrecke).

## Offene Entscheidungen
- Brutkammer-Entwurf und Transport der Dorfbewohner in die Zellen (`docs/offene-fragen.md`).
- Graphify (Test im Scratchpad: Ergebnis in `docs/token-effizienz.md`), OmniRoute deaktiviert; Ponytail-Umfang und weitere Skills (`docs/orchestrierung-erweiterungen.md`).
- Opus-Einsatz nur nach ausdrücklicher Freigabe von Jonah (je Fall).

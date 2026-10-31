# Stand – Blockwerk (Kurzfassung)

Zuletzt aktualisiert: 31.10.2026. **Diese Datei wird bei jeder Sitzung und jedem Agenten automatisch geladen und bleibt deshalb klein** (Budget: `test/dokumentation.test.js`). Der ausführliche Stand je Baustein steht in `docs/referenz/` (Index: `docs/referenz/README.md`), nur bei Bedarf und gezielt lesen.

## Lage
- Neubeginn nach dem Ebenenmodell (`docs/kurz/ebenen-kurz.md`). Der frühere Prototyp und Blockplan sind verworfen.
- Ebene 0 bis 5 sind gebaut und bis PR #46 gemergt. Auf dem Branch `claude/lorenbahn-nische-planung` liegen sechs weitere, **committete** Stände (31.10.2026, HEAD `b227685`, **noch nicht gepusht, kein PR**): Lorenbahn-Nische Schritt 3 (`96e2aad`), Korrekturen #1/#7 (`40e0182`), Skills (`1a21f62`), Multi-Agenten-Orchestrierung samt Modell-Routing (`0c81668`), Token-Optimierung und Repo-Karte (`5e523e2`), optionale Graphify-Anbindung (`b227685`). **Die Infrastrukturphase (Orchestrierung, Skills, Token-Optimierung) ist damit abgeschlossen.** Push und PR nur mit Jonahs Freigabe.
- Tests: `npm test` (Stand 31.10.2026: 446 grün; kurze Ausgabe: `npm run test:kurz`), `npm run test:orchestrierung` (47, rund 2 Minuten), `npm run test:pruefstein` (Zitadelle, 4 bis 6 Minuten).
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
| Lorenbahn-Nische (Bild 07): Passagiere/Strömung, Baustein, Vokabular `bauart`, Techniker, Zitadelle | Schritt 1 und 2 gemergt, Schritt 3 committet (`96e2aad`); Austrittsseite, Boden, 1-Block-Strömung `ungeprüft` | `stand-lorenbahn.md` |
| Korrekturen #1/#7/#12, Palette ohne stillen Teststein | fertig, committet (`40e0182`) | `stand-korrekturen-und-orchestrierung.md` |
| Multi-Agenten-Orchestrierung (`/blockwerk-auftrag`), Skills (Ponytail-Regeln, 7 Agent Skills) | fertig, in zwei echten Läufen nachgewiesen; committet (Skills `1a21f62`, Orchestrierung `0c81668`) | `docs/orchestrierung.md`, `docs/orchestrierung-erweiterungen.md` |
| Token-Optimierung (31.10.2026): schlanker Start, Skills bei Bedarf, Routing, Repo-Karte | umgesetzt und committet (`5e523e2`), Startkontext 96.944 → 33.927 Tokens; Graphify optional (`b227685`) | `docs/token-effizienz.md` |

## Nächster Schritt
**Jonah:** Push und PR der sechs Commits freigeben; Bauplatz der Zitadelle 600 × 600 bestätigen; Beschreibung und Prüfbericht in `docs/zitadelle/` ansehen; GitHub Pages einschalten und mit einem Freund live testen. **Danach:** Prüfer auf Abschnitte eingrenzen (schnellere Planung), erste Bauetappe im Spiel (Spieltest-Schleife), Testanleitungen und -ergebnisse in der Oberfläche eingeben. Nebenbei die offenen Lore-Tests aus `docs/spieltests.md` (Abstand 9, Rampen über 5 Blöcken, Rampe mitten in der Antriebsstrecke).

## Offene Entscheidungen
- Brutkammer-Entwurf und Transport der Dorfbewohner in die Zellen (`docs/offene-fragen.md`).
- Graphify ist optional angebunden (`tools/graphify.js`, nur auf Bedarf, Entscheidung 31.10.2026; Nutzung in `docs/token-effizienz.md`), OmniRoute bleibt deaktiviert; Ponytail-Umfang und weitere Skills (`docs/orchestrierung-erweiterungen.md`).
- Opus-Einsatz nur nach ausdrücklicher Freigabe von Jonah (je Fall).

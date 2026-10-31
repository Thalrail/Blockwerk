# Referenz (nicht automatisch geladen)

Ausführliche Stände und Begründungen. **Nur bei Bedarf und gezielt lesen**: erst `grep -n "Stichwort" docs/referenz/*.md`, dann Read mit `offset` und `limit`. Die kurzen, immer geladenen Fassungen sind `CLAUDE.md`, `docs/stand.md`, `docs/kurz/ebenen-kurz.md` und `docs/kurz/entscheidungen-kurz.md`.

| Datei | Inhalt | Lesen, wenn … |
|---|---|---|
| `stand-ebene0-und-1.md` | Was Ebene 0 und Ebene 1 (alle Teile) können, Annahmen, bekannte Lücken, was für Bahnhof/Entladestelle/Brüter fehlt | an Welt, Vermesser, Registern, Taktgeber, Schienen, Wasser, Licht, Spawn, Trichter, Redstone, Kolben, Bewegung, Dorf gearbeitet wird |
| `stand-ebene2.md` | Bausteine: Formen, Bogen/Dach, Bauelemente, Bahn-Module, Handelsnische, Sortiereinheit/-lager | an `src/ebene2` gearbeitet wird |
| `stand-ebene3-und-4.md` | Planung (Entwurf, Fachleute, Ablauf) und Leser (Schema, Prüfer, Bildmessung, Brücke) | an `src/ebene3` oder `src/ebene4` gearbeitet wird |
| `stand-ebene5.md` | Oberfläche (Bauplan, 3D, Eingabe, Texturen, Live) und Prüfstein Zitadelle | an `src/ebene5`, `web/`, `dienst/` oder dem Prüfstein gearbeitet wird |
| `stand-lorenbahn.md` | Lorenbahn-Nische: Passagiere/Strömung, Baustein, Planung und Zitadelle | an `tech.handelsnischen-lore`, `passagiere.js`, `stroemung.js` gearbeitet wird |
| `stand-korrekturen-und-orchestrierung.md` | Korrekturen aus dem Codex-Review, Palette-Absicherung, Orchestrierung | an Palette/Materialisierung oder der Orchestrierung gearbeitet wird |
| `stand-historie.md` | frühere Ausgangslage, vollständige Bauplan-Tabelle, früherer Nächster Schritt | Herkunft eines Schritts (PR-Nummern) gebraucht wird |

Weitere Nachschlagewerke außerhalb dieses Ordners: `docs/ebenen.md` (Volltext Ebenenmodell), `docs/entscheidungen.md` (Volltext mit Begründungen), `docs/konzept.md`, `docs/spieltests.md`, `docs/offene-fragen.md`, `docs/daten.md`, `docs/orchestrierung.md`, `docs/token-effizienz.md`.

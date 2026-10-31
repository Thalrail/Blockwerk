# Token-Effizienz (Stand 31.10.2026)

Ziel (Jonah): bis zu 10 Stunden täglich mit Blockwerk arbeiten, ohne ständig am Claude-Pro-Limit zu hängen. Es gibt **keine belegte Prozentersparnis für das Pro-Limit**: Anthropic nennt keine Gewichtung der Cache-Tokens. Gemessen ist nur der Kontext (Tokens der ersten Modellrunde).

## Messwerte (gemessen, `claude -p`, Claude Code 2.1.308)
| Messung | vorher | nachher |
|---|---|---|
| Startkontext Blockwerk mit Codex-Bridge (Normalbetrieb) | 96.944 | **33.927** |
| Startkontext Blockwerk ohne MCP | – | 32.394 |
| Leerer Ordner (Grundlast von Claude Code) | – | 20.876 (mit Bridge 22.408) |
| Agent `blockwerk-entwickler` (Sonnet), Start | rund 39.000 (4 Skills vorgeladen, +16,9k) | 23.871 |
| Agent `blockwerk-entwickler-leicht` (Haiku), Start | – | 19.283 |
| Agent `blockwerk-dokupruefer` (Haiku), Start | – | 16.100 |

Die Agentenwerte laufen über `--agent` (eigener Systemprompt) und sind nur untereinander vergleichbar, nicht mit dem Startkontext.

Hauptursache war der Import von `docs/stand.md` (111 KB, rund 60 % jedes Starts). Jetzt importiert `CLAUDE.md` nur Kurzfassungen (`docs/kurz/`, `docs/stand.md` mit unter 9 KB); der Rest liegt verlustfrei in `docs/referenz/` und wird gezielt gelesen.

## Umgesetzt
- Kurzfassungen und Referenzordner; Wächter `test/dokumentation.test.js` (Importe, Größenbudgets, Entscheidungs-Schlüssel, Ebenen-Überschriften, Index, Pflichtregeln).
- Entwickler laden nur `einfachheit` vor; `test-driven-development`, `debugging-and-error-recovery`, `code-simplification` holt der Entwickler bei Bedarf über das Skill-Werkzeug.
- Routing (seit 31.10.2026 nach dem Alltagstest verschärft, siehe unten): Haiku (`blockwerk-entwickler-leicht`) nur für rein mechanische Änderungen ohne Entscheidungslogik, Sonnet (`blockwerk-entwickler`) sonst und direkt bei Heuristik, Regex, Zustandslogik, Architektur oder Korrektheitsgarantie, Opus (`blockwerk-entwickler-schwer`) nur nach Rückfrage bei Jonah (`ask` in `.claude/settings.json`). Rechenprüfer jetzt Haiku. Prüfer nur nach Pfadtabelle; Codex-Review risikobasiert (`/blockwerk-auftrag`).
- Ausgaben begrenzen: `npm run test:kurz` (nur Fehler und Summe), `tools/karte.js` (`datei`, `suche`, `abhaengig <pfad> [funktionen]`, `uebersicht`; Tests `test/tools/karte.test.js`). Mit `funktionen` zeigt `abhaengig` Aufrufer als `Datei:Funktion:Zeile`; nicht sicher zuordenbare Fundstellen (Callbacks, Methoden, Namespace-Importe) stehen als `(unklar)`. Es sind Namensfunde ohne Scope; für echte Aufrufketten gibt es `tools/graphify.js`.
- Benchmark-Werkzeug `tools/benchmark/` (`lauf.mjs`, `aufgaben.mjs`: Bugfix, neue Funktion, Codeanalyse; wertet Kontext, Modellrunden, Ausgabe, Dauer, Kosten und eine Abnahme aus).

## Nicht gemessen (ehrlich offen)
- **Benchmark vorher/nachher:** Das Werkzeug steht und die Aufgaben sind geprüft (die eingebaute Mutation wird vom Test erkannt), die Läufe wurden wegen des Nutzungslimits abgebrochen. Es gibt keine Ergebnisse. Aufruf: `node tools/benchmark/lauf.mjs --basis <Ordner> --aufgabe T1|T2|T3 --modell sonnet|haiku` (je Lauf ein echter Claude-Aufruf; bewusst nur auf Jonahs Wunsch).
- **OmniRoute** bleibt deaktiviert.

## Graphify-Test (31.10.2026, einmal lokal, Version 0.9.98)
Lauf: `graphify update .` (nur Codeanalyse, kein LLM, keine Hooks) in einer Kopie von `src`, `tools`, `test` im Scratchpad; nichts im Repo geändert, nichts integriert.
| | Graphify | `tools/karte.js` |
|---|---|---|
| Laufzeit | 49 s kalt für 183 Dateien (1,5 MB Code); Abfrage `explain`/`path` rund 1,2 s | 0,35 s je Abfrage, ohne Vorlauf |
| Ausgabe | `graph.json` 1,3 MB, `graph.html` 1,4 MB, Bericht 20 KB; `explain` rund 1,2 KB je Funktion | `suche` rund 0,8 KB, `abhaengig` wenige Zeilen |
| Erfassung | 1525 Knoten, 3576 Kanten; 1039 Funktionen und Methoden, alle 523 per Regex gezählten `function`-Deklarationen gefunden, zusätzlich Pfeilfunktionen und Methoden | Textsuche und Importe auf Dateiebene |
| Beziehungen | Aufrufer und Aufgerufene je Funktion mit Zeile und Gewissheit (`EXTRACTED` 95 %, `INFERRED` 5 %); `path` zwischen zwei Funktionen | nur Datei-zu-Datei und Fundzeilen |
| Schwächen | Vorlauf muss bei Änderungen erneut laufen; 14 Testdateien ohne Symbole; Gemeinschaftsnamen unbrauchbar (z. B. `git.js` für eine Orchestrierungsgruppe, Beschriftung bräuchte ein LLM); Aufrufe aus anonymen Testfunktionen fehlen als Aufrufer | keine Funktionsebene |
Bewertung: Graphify liest unseren JavaScript-Code korrekt und liefert einen echten Mehrwert auf Funktionsebene (Aufrufer-Ketten, `path`). Für die Navigation im Alltag reicht `karte.js` meist aus und ist schneller.

### Optionale Anbindung (freigegeben 31.10.2026)
- **Standard bleibt `node tools/karte.js`.** Graphify nur bei komplexen Funktionsabhängigkeiten, Aufrufketten oder modulübergreifenden Analysen. Kein Lauf beim Sitzungsstart, keine zusätzlichen Hooks, keine Cloud- oder LLM-Funktionen (der Befehl `update` nutzt kein Modell; Graphify bekommt nur Pfad- und Profilvariablen, keine Schlüssel).
- **Befehle:** `node tools/graphify.js status` (verfügbar? Graph vorhanden/veraltet?), `bauen` (Kopie von `src`, `tools`, `test` im Temp-Ordner, rund 1 Minute), `erklaere <Funktion>` (Aufrufer und Aufgerufene mit Zeile), `pfad <A> <B>` (kürzester Aufrufpfad, ungerichtet). Der Graph liegt außerhalb des Repos (`<Temp>/blockwerk-graphify`).
- **Aktualisierung:** nur auf Bedarf. `status` meldet „Graph veraltet“, sobald eine `.js`-Datei in `src`, `tools` oder `test` neuer ist als der Graph; dann vor der Analyse `bauen`. Es gibt keinen automatischen Neubau.
- **Einrichtung (einmalig, lokal, keine globale Installation):** `python -m venv .werkzeuge/graphify/venv`, dann `.werkzeuge/graphify/venv/Scripts/pip install graphifyy==0.9.98` (Linux/Mac: `bin/pip`). `.werkzeuge/` steht in `.gitignore`. Alternativ zeigt `GRAPHIFY_EXE` auf ein vorhandenes Programm. Lizenz laut Paketangaben Apache-2.0; Graphify wird nicht ins Repo kopiert, nur lokal installiert.
- **Ausfall:** Fehlt Graphify, endet jeder Befehl mit Code 3 und dem Hinweis auf die Karte; Orchestrierung, Skills und Tests laufen unverändert (Tests prüfen das).

## Erkenntnis aus dem Alltagstest (31.10.2026): Haiku war hier zu klein
- **Auftrag:** `tools/karte.js abhaengig <pfad> funktionen` (2 Dateien, rund 90 Zeilen Heuristik). **Aufwand:** 4 Haiku-Läufe (Umsetzung und 3 Korrekturschleifen), zusammen 175.271 Subagent-Tokens und rund 37 Minuten Agentenzeit; dazu 2 Codex-Reviews. Jede Runde behob den zuletzt gemeldeten Randfall, der nächste kam aus dem Review.
- **Ursache:** Die Aufgabe sah klein aus (wenige Dateien), enthielt aber eine Heuristik mit der Garantie „nie falsch sicher“. Haiku lieferte zuerst die naheliegende Lösung; die Randfälle (Namespace-Importe, Methoden, `//` in Strings) fand erst das Review. Der Folgeauftrag („`//` in Strings“) lief mit Sonnet: eine Umsetzung und zwei gezielte Rückfragen, zusammen rund 150.000 Subagent-Tokens. Die Vergleichbarkeit ist begrenzt (andere Teilaufgabe), die Kosten je Runde waren ähnlich, die Rundenzahl nicht belegt kleiner.
- **Regel (von Jonah am 31.10.2026 beschlossen und im Routing umgesetzt: `/blockwerk-auftrag`, `blockwerk-entwickler-leicht`, `CLAUDE.md`):** Haiku nur für rein mechanische Änderungen ohne eigene Entscheidungslogik (Tippfehler, Umbenennen, Kommentar, Doku, Zahl oder Text ändern, ein vorgegebener Einzeltest). Direkt Sonnet bei Heuristik, Regex, Zustandslogik, Architekturentscheidungen oder Korrektheitsgarantien („nie falsch“, „immer konservativ“) und nach einer fehlgeschlagenen Haiku-Umsetzung (statt mehrerer Haiku-Korrekturschleifen). Opus bleibt nur mit ausdrücklicher Zustimmung von Jonah.

## Regeln für die Zukunft
Neue Dokumentation nie in `CLAUDE.md`, `docs/stand.md` oder `docs/kurz/` kippen, sondern nach `docs/referenz/`. Der Wächter-Test bricht bei Überschreitung der Budgets.

# Blockwerk – Arbeitsanweisung für Claude Code

## Wer und was
- Auftraggeber: **Jonah**. Immer mit Namen ansprechen, auf Deutsch antworten.
- Blockwerk ist ein Bauplaner für **Minecraft Bedrock Edition** (Server bei Aternos, gespielt auf PS5).
  Bauwerke werden NICHT eingespielt, sondern von Hand nach Bauplan (Schicht für Schicht) gebaut.
- Blockwerk läuft nur auf dem Desktop (PC/Laptop neben der PS5) als Bauplan-Bildschirm. Keine Handy-App.
- Referenzprojekt/Prüfstein: „Die Zitadelle“ (siehe `docs/`). Reihenfolge: allgemeine Engine zuerst.

## Pflichtlektüre vor jeder Aufgabe (automatisch geladene Kurzfassungen, bewusst klein)
- @docs/kurz/ebenen-kurz.md – Ebenenmodell 0–5 (verbindlich, bestätigt)
- @docs/kurz/entscheidungen-kurz.md – alle getroffenen Entscheidungen (Kurzform)
- @docs/stand.md – aktueller Fortschritt und nächster Schritt (Kurzfassung)
- Volltexte nur bei Bedarf und gezielt (Grep, dann Read mit `offset`/`limit`, nie ganz): `docs/ebenen.md`, `docs/entscheidungen.md` (mit Begründungen), `docs/referenz/` (Detailstand je Baustein, Index `docs/referenz/README.md`), `docs/konzept.md`, `docs/spieltests.md`, `docs/offene-fragen.md`. Im Zweifel zählt der Volltext.
- Neue Entscheidung: in `docs/entscheidungen.md` UND als Zeile in `docs/kurz/entscheidungen-kurz.md`. Neuer Detailstand: in die passende Datei unter `docs/referenz/`; in `docs/stand.md` nur Kurzes (Wächter: `test/dokumentation.test.js`).

## Architektur-Grundsatz (nie verletzen)
- Jede Ebene baut nur auf den Ebenen darunter auf. Höhere Ebenen ändern die Welt nur über Ebene 0.
- Einzige KI-Stelle ist der Leser (Ebene 4). Alles andere ist deterministisch: gleiche Eingabe = gleiches Ergebnis.
- Der Leser beschreibt nur WAS (Bauspezifikation), nie WIE (keine Koordinaten, Blöcke, Schaltungen).
- Bausteine (Ebene 2) sind maßstabsfrei: Formen per Abstandsfunktion, Menschenmaß fest, Technik skaliert über Anzahl.
- Drehen/Spiegeln immer über den Vermesser (Ebene 0); facing-Werte werden automatisch mitgedreht.

## Technik
- Reines JavaScript (ES-Module), **keine Abhängigkeiten** (kein npm install von Paketen ohne Rückfrage an Jonah).
- Tests: `npm test` (Node 22); kurze Ausgabe (nur Fehler und Summe): `npm run test:kurz`. Die Seite läuft über GitHub Pages **ohne Build-Schritt**.
- Engine (Ebenen 0–4) strikt getrennt von der Oberfläche (Ebene 5), Engine per Node testbar.
- Datenstand: Bedrock **1.26.50** aus offiziellen Mojang-Daten.
- Regeln, Paletten, Module als **Daten** (JSON), nicht im Code verstreut.

## Bedrock-Regeln
- Nur Bedrock-Mechanik. Ausnahme (Jonah, 24.10.2026): Wo es für Bedrock keine ausdrückliche Angabe gibt, gilt die Java-Regel als Platzhalter (Status `ungeprüft`, Fehler werden gezielt behoben). Jede Regel braucht eine Quelle (z. B. minecraft.wiki mit Bedrock-Hinweis).
- Status jeder Regel und jedes Bausteins: `entworfen` → `simuliert` (Test in Ebene 1 bestanden) → `geprüft` (nur wenn Jonah es im Spiel bestätigt hat). Nie selbst auf „geprüft“ setzen.
- Unsicheres als `ungeprüft` markieren und eine Testanleitung für Jonah (Kreativ-Testwelt) beilegen.

## Texturen
- Keine Original-Mojang-Texturen im Repo. Darstellung mit **Faithful 32x (Bedrock)**.
- Lizenzpflichten: sichtbare Nennung (Pack-Name + Link faithfulpack.net) in Oberfläche und README, Lizenz-Link beilegen,
  nur benötigte Texturen, Blockwerk bleibt kostenlos, nicht als offiziell darstellen. Quelle: https://faithfulpack.net/license

## Freigabegrenzen und Sicherheit (gelten für alle Agenten, Details `docs/orchestrierung.md`)
- Ohne Rückfrage: Umsetzung im Auftrag, Tests, Routinekorrekturen, Doku. **Vorher Jonahs Zustimmung:** fachliche Architektur, neue externe Abhängigkeiten, grundlegende Bedrock-Entscheidungen, Planungsverhalten außerhalb des Auftrags, **jeder Commit, Push und PR**, nicht sicher auflösbare Konflikte und Datenverlustrisiken, **jeder Einsatz von Opus**.
- Keine Zugangsdaten lesen, ausgeben oder ins Repo legen. Keine globalen Claude-/Codex-Einstellungen ändern. Hooks, Wächter und Berechtigungssperren (`.claude/settings.json`) nie abschwächen oder umgehen; Agenten ändern `.claude/` und `tools/orchestrierung/` nie.
- Codex ist der unabhängige Reviewer (Einzelmodus, nur über das Review-Paket), nie automatisch ein anderer Prüfer.

## Token-Disziplin (Pro-Limit schonen, höchste Priorität seit 31.10.2026)
- Große Dateien nie ganz lesen: erst `node tools/karte.js datei <pfad>` / `suche <Name>` / `abhaengig <pfad>`, dann Read mit `offset`/`limit`.
- Ausgaben begrenzen: `npm run test:kurz`, `git diff --stat`, Grep mit Treffergrenze, `| tail -n 20`; nie volle Testprotokolle oder ganze Diffs einlesen.
- Skills nur bei Bedarf über das Skill-Werkzeug laden; Prüfer-Agenten nur nach der Pfadtabelle in `/blockwerk-auftrag`; rein mechanische Änderungen ohne eigene Entscheidungslogik an `blockwerk-entwickler-leicht` (Haiku); alles mit Heuristik, Regex, Zustandslogik, Architektur oder Korrektheitsgarantie direkt an `blockwerk-entwickler` (Sonnet); nach fehlgeschlagener Haiku-Umsetzung zu Sonnet wechseln.
- Neue Dokumentation nie in die automatisch geladenen Dateien (diese Datei, `docs/stand.md`, `docs/kurz/`) kippen; Messwerte und Budget: `docs/token-effizienz.md`.

## Arbeitsweise (bei JEDER Aufgabe)
1. Zuerst `docs/stand.md` lesen (ist geladen) und kurz sagen, was du vorhast.
2. Unklare Architekturfragen: Jonah mit konkreten Optionen fragen, nicht raten. Sonst Lösungen liefern, kein „geht nicht“.
3. Für jede neue Funktion Tests schreiben (Rundheit, Symmetrie, Schienenverbindung, Wasserweite … als automatische Tests).
4. Vor Abschluss **umfassend prüfen**: `npm test` muss komplett grün sein, eigene Änderungen noch einmal durchlesen,
   Ebenen-Grenzen kontrollieren (greift eine höhere Ebene direkt in die Welt ein? dann falsch).
5. `docs/stand.md` (Kurzfassung) und bei Bedarf die passende Datei in `docs/referenz/` aktualisieren (was fertig, was offen, nächster Schritt).
6. Commit-Nachrichten auf Deutsch, kurz und klar. Arbeit auf eigenem Branch, am Ende Pull Request mit Zusammenfassung
   für Jonah: was gebaut, wie getestet, was er im Spiel testen soll.

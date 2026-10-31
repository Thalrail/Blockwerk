# Blockwerk – Arbeitsanweisung für Claude Code

## Wer und was
- Auftraggeber: **Jonah**. Immer mit Namen ansprechen, auf Deutsch antworten.
- Blockwerk ist ein Bauplaner für **Minecraft Bedrock Edition** (Server bei Aternos, gespielt auf PS5).
  Bauwerke werden NICHT eingespielt, sondern von Hand nach Bauplan (Schicht für Schicht) gebaut.
- Blockwerk läuft nur auf dem Desktop (PC/Laptop neben der PS5) als Bauplan-Bildschirm. Keine Handy-App.
- Referenzprojekt/Prüfstein: „Die Zitadelle“ (siehe `docs/`). Reihenfolge: allgemeine Engine zuerst.

## Pflichtlektüre vor jeder Aufgabe
- @docs/ebenen.md – Ebenenmodell 0–5 (verbindlich, bestätigt)
- @docs/entscheidungen.md – alle getroffenen Entscheidungen
- @docs/stand.md – aktueller Fortschritt und nächster Schritt
- `docs/konzept.md` – Hintergrund und Begründung (bei Bedarf lesen)

## Architektur-Grundsatz (nie verletzen)
- Jede Ebene baut nur auf den Ebenen darunter auf. Höhere Ebenen ändern die Welt nur über Ebene 0.
- Einzige KI-Stelle ist der Leser (Ebene 4). Alles andere ist deterministisch: gleiche Eingabe = gleiches Ergebnis.
- Der Leser beschreibt nur WAS (Bauspezifikation), nie WIE (keine Koordinaten, Blöcke, Schaltungen).
- Bausteine (Ebene 2) sind maßstabsfrei: Formen per Abstandsfunktion, Menschenmaß fest, Technik skaliert über Anzahl.
- Drehen/Spiegeln immer über den Vermesser (Ebene 0); facing-Werte werden automatisch mitgedreht.

## Technik
- Reines JavaScript (ES-Module), **keine Abhängigkeiten** (kein npm install von Paketen ohne Rückfrage an Jonah).
- Tests: `npm test` (Node 22). Die Seite läuft über GitHub Pages **ohne Build-Schritt**.
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

## Arbeitsweise (bei JEDER Aufgabe)
1. Zuerst `docs/stand.md` lesen und kurz sagen, was du vorhast.
2. Unklare Architekturfragen: Jonah mit konkreten Optionen fragen, nicht raten. Sonst Lösungen liefern, kein „geht nicht“.
3. Für jede neue Funktion Tests schreiben (Rundheit, Symmetrie, Schienenverbindung, Wasserweite … als automatische Tests).
4. Vor Abschluss **umfassend prüfen**: `npm test` muss komplett grün sein, eigene Änderungen noch einmal durchlesen,
   Ebenen-Grenzen kontrollieren (greift eine höhere Ebene direkt in die Welt ein? dann falsch).
5. `docs/stand.md` aktualisieren (was fertig, was offen, nächster Schritt).
6. Commit-Nachrichten auf Deutsch, kurz und klar. Arbeit auf eigenem Branch, am Ende Pull Request mit Zusammenfassung
   für Jonah: was gebaut, wie getestet, was er im Spiel testen soll.

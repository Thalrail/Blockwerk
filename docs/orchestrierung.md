# Multi-Agenten-Orchestrierung (Stand 30.10.2026)

Mit **`/blockwerk-auftrag <Auftrag>`** koordiniert die Claude-Hauptsitzung Entwicklung, Tests, unabhängige Reviews und Routinekorrekturen. Jonah gibt den Auftrag und entscheidet an den Freigabegrenzen; Commit, Push und PR gibt es nur auf sein ausdrückliches Ja.

## Rollen
| Rolle | Wer | Aufgabe |
|---|---|---|
| Koordinator | Hauptsitzung (Skill `.claude/skills/blockwerk-auftrag/SKILL.md`) | analysiert, sichert, delegiert, **führt alle Tests selbst aus**, bewertet Befunde gegen den Code, übernimmt, berichtet |
| Entwickler | `blockwerk-entwickler` (Sonnet, Worktree) | setzt den Auftrag um, korrigiert bestätigte Fehler; nie Commit/Push/PR |
| Dokumentationsprüfer | `blockwerk-dokupruefer` (Haiku, nur lesend) | Doku, Regeln und Code passen zusammen |
| Quellenprüfer | `blockwerk-quellenpruefer` (Sonnet, Web, nur lesend) | Bedrock-Regeln, Wiki-Quellen, Fakten |
| Rechenprüfer | `blockwerk-rechenpruefer` (Sonnet, lesend und rechnend) | Zahlen, Einheiten, Tabellen |
| Unabhängiger Reviewer | Codex über die MCP-Bridge (`review_code`, Einzelmodus) | Review des Pakets; Wechsel zu einem anderen Reviewer nie automatisch |

## Ablauf (Kurzfassung; Einzelheiten im Skill)
1. `status`, Tore vorab selbst einschätzen (das Werkzeug prüft Tore ab `runde-ende`), `start --dateien …` (Pflicht) → Snapshot **S0** (ganzer Arbeitsstand, auch uncommittet und unversioniert, ohne Geheimnisse).
2. Entwickler starten. Der Hook `WorktreeCreate` legt seinen Worktree unter `.claude/worktrees/` genau auf S0 an (sonst bricht der Start ab).
3. `runde-ende --worktree …` sichert die Arbeit als Zwischen-Snapshot und prüft die Tore.
4. Tests im Worktree (gezielt, `npm test`, `git diff --check`, Prüfstein nur bei Ebene 3/4).
5. Haiku/Quellen/Rechnen bei Bedarf, dann `paket` und genau ein `review_code` (`base`/`head` im Paket), danach `review-melden`.
6. Befunde einordnen (bestätigt/widerlegt/offen), Routinefehler an einen **neuen** Entwickler-Aufruf: dessen Worktree entsteht aus dem Zwischen-Snapshot und enthält die Vorrunde. Höchstens **drei Korrekturschleifen** (vier Runden; die fünfte verweigert das Werkzeug).
7. `tore` / `uebernehmen`: nur ohne `stopp` und ohne offene Fragen, mit Konfliktprüfung, Journal und Rückgängig; danach Tests im Hauptbaum und `haupt-kontrolle`.
8. `ende` räumt die Worktrees auf; Abschlussbericht und Benachrichtigung.

## Skills (projektlokal, `.claude/skills/`)
Acht Skills ergänzen den Ablauf: `einfachheit` (Regeln nach Ponytail), `test-driven-development`, `debugging-and-error-recovery`, `code-simplification` (alle vier beim Entwickler vorgeladen), `code-review-and-quality` (Dokumentationsprüfer, Koordinator), `source-driven-development` (Quellenprüfer, Koordinator), `context-engineering` und `doubt-driven-development` (nur Koordinator). Sie sind aus Ponytail und agent-skills (MIT) übernommen und angepasst: ohne Git-Schreiben, Installationen, Netz-Downloads, MCP und Cross-Model-Wege; der Block „Blockwerk-Vorrang“ am Anfang jedes Skills und die Freigabegrenzen gehen vor. Ponytail ist **kein** Plugin (keine Hooks, Befehle, Statusleiste, keine Einspritzung in andere Agenten). Graphify und OmniRoute bleiben deaktiviert. Einzelheiten, Gründe und Herkunft: `docs/orchestrierung-erweiterungen.md`, `docs/fremdlizenzen/`.

## Technik (`tools/orchestrierung/`, Node, keine Abhängigkeiten)
| Datei | Zweck |
|---|---|
| `git.js` | Git-Aufrufe ohne Zeilenenden-Umwandlung, Zustandsabdruck (HEAD, Zweig, Stash, Refs, Index, Dateien) |
| `schnappschuss.js` | Snapshot über temporären Index (ändert weder HEAD, Zweig, Index, Stash noch Arbeitsbaum), Secret-Scan, Erlaubnis- und Verbotsliste, Seed |
| `delta.js` | geänderte Pfade, Patch, hinzugefügte Zeilen |
| `uebernehmen.js` | planen (ändert nichts), sichern, anwenden mit Rückgängig, Wiederherstellen nach Absturz, Zeilenenden-Wächter |
| `tore.js` | Freigabegrenzen: `stopp`, `frage`, `info` |
| `review-paket.js` | Review-Paket als eigenes Repository im isolierten Review-Ordner (`~/.codex-review-test/lauf-…`), Blob-Beweis, Secret-Scan |
| `review-pruefung.js` | gültig nur bei `single`, `failover_occurred: false`, Anbieter Codex, genau ein Modell |
| `lauf.js`, `cli.js` | Zustand und Befehle: `start`, `status`, `runde-ende`, `tore`, `paket`, `review-melden`, `uebernehmen`, `haupt-kontrolle`, `wiederherstellen`, `ende` |

Weitere Dateien: `.claude/hooks/worktree-hook.js` (Create/Remove), `.claude/hooks/git-wache.js` (PreToolUse für Agenten), `.claude/settings.json` (Hooks, Sperren, `ask` für `git commit`), `.claude/agents/*.md`, `.claude/skills/blockwerk-auftrag/SKILL.md`. Laufzustand: `.claude/orchestrierung/` (nicht versioniert, nicht im Snapshot), Worktrees: `.claude/worktrees/` (ebenfalls ignoriert).

## Schutz
- Der Hauptarbeitsbaum bleibt während der Entwicklung unverändert (`haupt-kontrolle`); das Ergebnis kommt nur über `uebernehmen`.
- Hook-Fehler brechen den Agentenstart ab (kein stiller Rückfall); ohne aktiven Lauf, bei geändertem HEAD oder fehlender Basis legt der Hook nichts an.
- Der Wächter sperrt für Agenten: Git-Schreiben (auch in eingebetteten Skripten), `gh`, `npm install`/`npx`, Netz-Downloads, `..` und das Hauptverzeichnis, Schreiben (Write/Edit) außerhalb des eigenen Worktrees und an allem unter `.claude/`, an `tools/orchestrierung/` und `.git`. Der Bash-Zweig prüft Schreibziele nicht (zweite Schranke). Bei Zweifel sperrt er (nur Agenten; die Hauptsitzung bleibt frei). Er ist eine zweite Schranke, kein Sandkasten.
- Unterbrochene Übernahmen werden beim nächsten `start` automatisch zurückgesetzt.
- Geheimnisse (Schlüssel, Tokens) bricht der Secret-Scan ab; nicht versionierte Dateien mit verbotenem Namen (`.env`, Schlüssel- und Datenbankdateien, `auth*.json` …) oder aus nicht erlaubten Ordnern kommen nie in einen Snapshot und werden als Tor „nicht-uebernommen“ gemeldet; versionierte Dateien werden aufgenommen und auf Geheimnisse geprüft.

## Freigabegrenzen (Tore)
`stopp` (nie automatisch): Ebenengrenzen verletzt, Status `geprüft` gesetzt, Änderungen an Hooks/Einstellungen/Agenten/Skills/Orchestrierung/`.gitignore`/CI, Zeilenenden geändert. `frage` (nur mit Jonahs Zustimmung): neue Abhängigkeiten, Architektur- und Entscheidungsdokumente, Datenformate, neue Bereiche, Bedrock-Daten und bestehende Bedrock-Regeln, Dateien außerhalb des Auftrags, nicht übernommene Dateien. Alles andere im Auftrag ist Routine.

## Tests
`npm run test:orchestrierung` (46 Tests, rund 2 Minuten, eigene Wegwerf-Repositories): Snapshot, Seed, Runden, Delta, Übernahme mit Fehlern und Absturz, Tore, Review-Paket und Einzelmodus, Hooks als echte Prozesse, Wächter, Kommandozeile, Einstellungen. Nicht Teil von `npm test` (Prozessstarts unter Windows sind langsam).

## Bekannte Grenzen und offene Punkte
- Hooks aus `settings.json` greifen in einer bereits laufenden Sitzung erst nach Überprüfung im `/hooks`-Menü; ein neuer Lauf in einer neuen Sitzung braucht nichts.
- Der Hook-Worktree muss innerhalb des Projekts liegen (außerhalb verweigerte das Write-Werkzeug im Spike).
- Die Prüfer Haiku/Quellen/Rechnen waren im echten Lauf nicht nötig und sind dort noch nicht durchlaufen worden (nur ihre Definitionen sind geprüft).
- Ob der Wächter die Hauptsitzung nie sperrt, ist durch Tests belegt (ohne `agent_id` immer frei).
- Graphify und OmniRoute sind nicht aktiv; vier offene Entscheidungen für Jonah in `docs/orchestrierung-erweiterungen.md`.

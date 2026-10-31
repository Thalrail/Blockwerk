# Multi-Agenten-Orchestrierung (Stand 31.10.2026)

Mit **`/blockwerk-auftrag <Auftrag>`** koordiniert die Claude-Hauptsitzung Entwicklung, Tests, unabhängige Reviews und Routinekorrekturen. Jonah gibt den Auftrag frei; danach arbeitet die Orchestrierung selbstständig bis zur fertigen **Draft-PR** (Entwicklung, Codex-Review jeder Umsetzung, automatische Korrektur bestätigter Fehler, Übernahme, Commit, Push, Draft-PR). Jonah entscheidet nur über den **Merge** und wird vorher gefragt bei grundlegender Architekturänderung, neuer externer Abhängigkeit, Änderung des Auftragsumfangs oder einer nicht sicher lösbaren Lage.

## Rollen
| Rolle | Wer | Aufgabe |
|---|---|---|
| Koordinator | Hauptsitzung (Skill `.claude/skills/blockwerk-auftrag/SKILL.md`) | analysiert, sichert, delegiert, **führt alle Tests selbst aus**, bewertet Befunde gegen den Code, übernimmt, schließt mit Commit, Push und Draft-PR ab, berichtet |
| Entwickler | `blockwerk-entwickler` (Sonnet, Worktree) | setzt den Auftrag um, korrigiert bestätigte Fehler; nie Commit/Push/PR |
| Dokumentationsprüfer | `blockwerk-dokupruefer` (Haiku, nur lesend) | Doku, Regeln und Code passen zusammen |
| Quellenprüfer | `blockwerk-quellenpruefer` (Sonnet, Web, nur lesend) | Bedrock-Regeln, Wiki-Quellen, Fakten |
| Rechenprüfer | `blockwerk-rechenpruefer` (Sonnet, lesend und rechnend) | Zahlen, Einheiten, Tabellen |
| Unabhängiger Reviewer | Codex über die MCP-Bridge (`review_code`, Einzelmodus) | prüft **jede abgeschlossene Umsetzung** (Stufe nach Risiko); Wechsel zu einem anderen Reviewer nie automatisch |

## Ablauf (Kurzfassung; Einzelheiten im Skill)
1. `status`, Tore vorab selbst einschätzen (das Werkzeug prüft Tore ab `runde-ende`), `start --autonom --dateien …` (Pflicht) → Snapshot **S0** (ganzer Arbeitsstand, ohne Geheimnisse). `--autonom` verlangt einen **sauberen Arbeitsbaum**, damit nie fremde uncommittete Änderungen in einen Commit geraten.
2. Entwickler starten. Der Hook `WorktreeCreate` legt seinen Worktree unter `.claude/worktrees/` genau auf S0 an (sonst bricht der Start ab).
3. `runde-ende --worktree …` sichert die Arbeit als Zwischen-Snapshot und prüft die Tore.
4. Tests im Worktree (gezielt, `npm run test:kurz`, `git diff --check`, Prüfstein nur bei Ebene 3/4), danach `tests-ausfuehren` (das Werkzeug startet die Tests selbst und liest Exit-Code und Zähler aus der echten Ausgabe; der Worktree muss byteweise der Basis entsprechen und bleibt unverändert; gemeldete Zahlen gibt es nicht).
5. Haiku/Quellen/Rechnen bei Bedarf, dann `paket` und genau ein `review_code` (`base`/`head` im Paket), danach `review-melden` mit allen Befunden.
6. Jeden Befund gegen den Code einstufen und mit `befund-melden` festhalten (`bestaetigt`, `widerlegt` mit Beleg, `hinweis` nur bei minor/info). Bestätigte Fehler gehen automatisch an einen **neuen** Entwickler-Aufruf: dessen Worktree entsteht aus dem Zwischen-Snapshot und enthält die Vorrunde; danach neues Review für den neuen Stand. Höchstens **drei Korrekturschleifen** (vier Runden; die fünfte verweigert das Werkzeug), dann Rückfrage an Jonah.
7. `tore` / `uebernehmen`: nur ohne `stopp`, ohne offene Fragen **und mit Freigabe** (grüne Tests und gültiges, vollständig eingestuftes Review für exakt denselben Codezustand), mit Konfliktprüfung, Journal und Rückgängig; danach Tests im Hauptbaum und `haupt-kontrolle`.
8. `abschluss`: Branch `claude/<name>`, Commit, Push, Draft-PR (siehe unten); bei Blockade stoppen und berichten.
9. `ende` räumt die Worktrees auf; Abschlussbericht mit PR-Link und Benachrichtigung. **Gemergt wird nie.**

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
| `lauf.js`, `cli.js` | Zustand und Befehle: `start`, `status`, `runde-ende`, `tore`, `paket`, `tests-ausfuehren`, `review-melden`, `befund-melden`, `uebernehmen`, `haupt-kontrolle`, `wiederherstellen`, `ende`, `abschluss`; Freigabe-Gate (`freigabeStatus`); jeder Befehl kennt nur seine eigenen Optionen |
| `abschluss.js` | Autonomer Abschluss: Voraussetzungen, Branch, Commit, Push, Draft-PR (feste Argumente, nie Merge) |

Weitere Dateien: `.claude/hooks/worktree-hook.js` (Create/Remove), `.claude/hooks/git-wache.js` (PreToolUse für Agenten), `.claude/settings.json` (Hooks, Sperren, `ask` für `git commit`), `.claude/agents/*.md`, `.claude/skills/blockwerk-auftrag/SKILL.md`. Laufzustand: `.claude/orchestrierung/` (nicht versioniert, nicht im Snapshot), Worktrees: `.claude/worktrees/` (ebenfalls ignoriert).

## Schutz
- Der Hauptarbeitsbaum bleibt während der Entwicklung unverändert (`haupt-kontrolle`); das Ergebnis kommt nur über `uebernehmen`.
- Hook-Fehler brechen den Agentenstart ab (kein stiller Rückfall); ohne aktiven Lauf, bei geändertem HEAD oder fehlender Basis legt der Hook nichts an.
- Der Wächter sperrt für Agenten: Git-Schreiben (auch in eingebetteten Skripten), `gh`, `npm install`/`npx`, Netz-Downloads, `..` und das Hauptverzeichnis, Schreiben (Write/Edit) außerhalb des eigenen Worktrees und an allem unter `.claude/`, an `tools/orchestrierung/` und `.git`. Der Bash-Zweig prüft Schreibziele nicht (zweite Schranke). Bei Zweifel sperrt er (nur Agenten; die Hauptsitzung bleibt frei). Er ist eine zweite Schranke, kein Sandkasten.
- Unterbrochene Übernahmen werden beim nächsten `start` automatisch zurückgesetzt.
- Geheimnisse (Schlüssel, Tokens) bricht der Secret-Scan ab; nicht versionierte Dateien mit verbotenem Namen (`.env`, Schlüssel- und Datenbankdateien, `auth*.json` …) oder aus nicht erlaubten Ordnern kommen nie in einen Snapshot und werden als Tor „nicht-uebernommen“ gemeldet; versionierte Dateien werden aufgenommen und auf Geheimnisse geprüft.

## Freigabegrenzen (Tore)
`stopp` (nie automatisch): Ebenengrenzen verletzt, Status `geprüft` gesetzt, Änderungen an Hooks/Einstellungen/Agenten/Skills/Orchestrierung/`.gitignore`/CI, Zeilenenden geändert. `frage` (nur mit Jonahs Zustimmung): neue Abhängigkeiten, Architektur- und Entscheidungsdokumente, Datenformate, neue Bereiche, Bedrock-Daten und bestehende Bedrock-Regeln, Dateien außerhalb des Auftrags, nicht übernommene Dateien. Alles andere im Auftrag ist Routine.

## Autonomer Abschluss (31.10.2026)
Der einzige Weg zu Commit, Push und Draft-PR ist `cli.js abschluss`. Die Sperren `Bash(git push *)` und `Bash(gh pr *)` in `.claude/settings.json` bleiben unverändert; das Werkzeug führt die Schritte mit festen Argumenten selbst aus und lässt sich über die Kommandozeile nicht umbiegen (keine Optionen für Remote, Präfix oder Programm; unbekannte Optionen werden abgelehnt).
- **Vor dem ersten Schritt geprüft** (sonst Status `abgelehnt`, nichts verändert): autonomer Lauf mit sauberem Start; Arbeit übernommen; Freigabe (grüne Tests und gültiges, eingestuftes Review, beide für denselben Baum); Hauptbaum byteweise gleich dem geprüften Stand; nur die übernommenen Dateien uncommittet; keine Sicherheitsdateien (`.claude/`, `.github/`, `tools/orchestrierung/`, `.gitignore`); kein Geheimnis; HEAD und Zweig wie beim Start; `origin` ist das Repository Thalrail/Blockwerk; Git-Identität vorhanden; neuer Branch `claude/<kurzname>` (lokal und im Remote frei); **PR-Basis eindeutig**: `main` nur, wenn HEAD in `origin/main` liegt, sonst ein `claude/`-Branch, der im Remote genau auf HEAD steht, sonst Rückfrage.
- **Schritte** (Fortschritt im Laufzustand, ein erneuter Aufruf setzt fort): `git switch -c`; `git add` nur der übernommenen Pfade (das Staging wird verglichen); `git commit` (danach muss der Baum der geprüfte Baum sein, sonst kein Push); `git push -u origin refs/heads/<branch>:refs/heads/<branch>`; `gh pr create --draft --repo Thalrail/Blockwerk --base <Basis> --head <Branch>` mit PR-Text aus dem Lauf (Änderungen, Tests, Review und Befunde, Einschränkungen).
- **Bei Blockade** (`blockiert`: Commit, Push oder gh scheitern): stoppen und Jonah berichten. Es gibt keinen Ersatzweg.
- **Nicht im Werkzeug**: Merge, `ready`, Force, Löschen auf dem Remote, `gh api`, Tags, Umschreiben von Commits.
- **Zweite Schranke**: Der Wächter sperrt das Werkzeug für Agenten; die Kommandozeile lehnt Aufrufe aus einem Agenten-Worktree ab.

### Berechtigungen (`allow` in `.claude/settings.json`, 31.10.2026)
- **Minimal**: je ein Eintrag pro Unterbefehl von `cli.js` (`status`, `start`, `runde-ende`, `tore`, `paket`, `tests-ausfuehren`, `review-melden`, `befund-melden`, `uebernehmen`, `haupt-kontrolle`, `wiederherstellen`, `ende`, `abschluss`) statt `cli.js *`; dazu `node tools/karte.js *`, `npm test`, `npm run test:kurz|test:orchestrierung|test:pruefstein`, `node --test test/*` und die Codex-Werkzeuge `review_code`, `review_status`. Nicht erlaubt: `node tools/graphify.js` (fragt jedes Mal), jedes `git`-Schreiben, `gh`, `node *`. Lesende Git-Befehle brauchen keine Regel (eingebaute Schreibschutz-Liste von Claude Code).
- **Unverändert**: `deny` (`git push`, `gh pr`, `git reset|clean|stash|rebase`) und `ask` (`git commit`, `blockwerk-entwickler-schwer`). `deny` gilt vor `allow`.
- **Was die Regeln leisten und was nicht** (Claude-Code-Dokumentation, Abschnitt Permissions): Bash-Regeln vergleichen den **Befehlstext**, den der Agent an das Bash-Werkzeug übergibt; zusammengesetzte Befehle (`&&`, `;`, `|`) werden einzeln geprüft. Sie sind „kein Sicherheitsrand um das Programm“. Ein `git push`, den `cli.js abschluss` als Unterprozess startet, erscheint nie als Bash-Befehl und wird deshalb von `deny` weder erlaubt noch verhindert. Dass dort nur der eigene Branch gepusht wird, sichern allein die Prüfungen und Tests des Abschluss-Werkzeugs (feste Argumente, Quelltext-Test gegen Force/Merge/ready) und der Wächter, nicht die Berechtigungsregeln. Das ist der gewollte Weg (Entscheidung 31.10.2026), aber keine Umgehung durch Zufall: die direkten Befehle bleiben gesperrt.

### Vertrauensgrenze: Review-Ergebnisse
Die Ergebnisse von Codex (`verdict`, Befunde, Session-ID, Modus, Failover) meldet der **Koordinator** über `review-melden` und `befund-melden`. Das Werkzeug **authentifiziert sie nicht unabhängig**: es prüft Form, Einzelmodus-Kennzeichen, Bindung an den Codezustand (Review-Paket für genau diesen Baum) und die Einstufung jedes Befunds, kann aber nicht beweisen, dass der Aufruf wirklich so stattfand. Der Schutz ist organisatorisch (Skill, PR-Text mit allen Befunden und Belegen, Jonahs Durchsicht der Draft-PR) und kein kryptografischer.

### Befunde und Freigabe
Keine automatische Freigabe bei: Urteil `reject`; Befund nicht eingestuft; Befund `bestätigt` (neue Runde, neues Review); **kritischer Befund (`critical`) in jeder Einstufung** – auch „widerlegt“ genügt nicht, das Urteil über einen kritischen Befund trifft Jonah; `approve` ändert daran nichts. Bleibt ein Befund, geht es nur mit einem neuen Review für einen neuen Codezustand weiter (höchstens drei Korrekturschleifen), sonst Rückfrage.

## Tests
`npm run test:orchestrierung` (70 Tests, einige Minuten, eigene Wegwerf-Repositories und ein lokales Test-Remote; `gh` ist dort eine Attrappe): Snapshot, Seed, Runden, Delta, Übernahme mit Fehlern und Absturz, Tore, Review-Paket und Einzelmodus, Hooks als echte Prozesse, Wächter, Kommandozeile, Einstellungen, Freigabe-Gate und autonomer Abschluss. Nicht Teil von `npm test` (Prozessstarts unter Windows sind langsam).

## Bekannte Grenzen und offene Punkte
- Hooks aus `settings.json` greifen in einer bereits laufenden Sitzung erst nach Überprüfung im `/hooks`-Menü; ein neuer Lauf in einer neuen Sitzung braucht nichts.
- Der Hook-Worktree muss innerhalb des Projekts liegen (außerhalb verweigerte das Write-Werkzeug im Spike).
- Die Prüfer Haiku/Quellen/Rechnen waren im echten Lauf nicht nötig und sind dort noch nicht durchlaufen worden (nur ihre Definitionen sind geprüft).
- Ob der Wächter die Hauptsitzung nie sperrt, ist durch Tests belegt (ohne `agent_id` immer frei).
- Graphify und OmniRoute sind nicht aktiv; vier offene Entscheidungen für Jonah in `docs/orchestrierung-erweiterungen.md`.

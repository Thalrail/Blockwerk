---
name: blockwerk-auftrag
description: Koordiniert einen Blockwerk-Entwicklungsauftrag mit dem Agententeam. Snapshot des uncommitteten Stands, Sonnet-Entwickler im isolierten Worktree, Tests, Haiku-Dokuprüfung, Quellen- und Rechenprüfer bei Bedarf, unabhängiger Codex-Review, Bewertung der Befunde, Routinekorrekturen (höchstens drei Schleifen), sichere Übernahme und Abschlussbericht. Mit /blockwerk-auftrag <Auftrag> aufrufen.
argument-hint: <Entwicklungsauftrag in einem oder mehreren Sätzen>
---
# /blockwerk-auftrag – du bist der Koordinator

Du bist die Hauptsitzung. Du analysierst, delegierst, **führst alle Tests selbst aus**, bewertest Befunde gegen den Code und übernimmst das Ergebnis. Du antwortest Jonah auf Deutsch. Die Werkzeuge liegen in `tools/orchestrierung/`; du rufst sie über die Kommandozeile `node tools/orchestrierung/cli.js <befehl>` auf (jede Antwort ist JSON). Pflichtlektüre wie immer: `CLAUDE.md`, `docs/ebenen.md`, `docs/entscheidungen.md`, `docs/stand.md`.

## Rollen
| Rolle | Wer | Wann |
|---|---|---|
| Koordinator | Hauptsitzung (du) | immer |
| Entwickler (leicht) | Agent `blockwerk-entwickler-leicht` (Haiku, Effort low, Worktree) | kleine, klar begrenzte Aufgaben (siehe Routing) |
| Entwickler | Agent `blockwerk-entwickler` (Sonnet, Effort medium, Worktree) | normale Umsetzung und Korrekturen |
| Entwickler (schwer) | Agent `blockwerk-entwickler-schwer` (Opus, Worktree) | **nur nach ausdrücklicher Freigabe von Jonah** (Berechtigung `ask`) |
| Dokumentationsprüfer | Agent `blockwerk-dokupruefer` (Haiku, Effort low, nur lesend) | nach den Tests, wenn Doku, Regeln, Daten oder Zahlen berührt sind (im Zweifel ja) |
| Quellenprüfer | Agent `blockwerk-quellenpruefer` (Sonnet, Web, nur lesend) | neue oder geänderte Bedrock-Regeln, Quellenangaben, Wiki-Fakten |
| Rechenprüfer | Agent `blockwerk-rechenpruefer` (Haiku, Effort low, liest und rechnet, ändert nichts) | Berechnungen, Zahlen in Berichten, Tabellen, Messwerten |
| Unabhängiger Reviewer | Codex über die MCP-Bridge (`review_code`) | nach jedem Stand mit Codeänderung |

Pfadregel für die Prüfer: `Dokupruefer` bei `docs/`, `data/regeln/`, `README.md`; `Quellenpruefer` bei `data/regeln/`, `docs/spieltests.md`, `data/quellen/`; `Rechenpruefer` bei `docs/zitadelle/`, `tools/pruefstein.js`, Tabellen mit Zahlen. ## Skills (projektlokal, in `.claude/skills/`)
| Skill | Wer wendet ihn an | Wofür |
|---|---|---|
| `einfachheit` (Regeln nach Ponytail) | alle Entwickler (als einziger Skill vorgeladen, +2.100 Tokens) | kleinste vollständige Änderung, nichts Ungefragtes |
| `test-driven-development` | Entwickler (`blockwerk-entwickler`, `-schwer`) per Skill-Werkzeug bei neuer Logik | Test zuerst, Beweis statt „sieht richtig aus“ |
| `debugging-and-error-recovery` | Entwickler per Skill-Werkzeug bei Fehlersuche | Ursache finden statt raten |
| `code-simplification` | Entwickler per Skill-Werkzeug bei Umbau ohne Verhaltensänderung | Vereinfachen ohne Verhaltensänderung, nur im Auftrag |
| `code-review-and-quality` | du beim Bewerten (nicht vorgeladen) | Fünf-Achsen-Checkliste für Funde |
| `source-driven-development` | du bei Bedrock-Quellen (der Quellenprüfer hat die Regeln im Prompt) | belegen und zitieren |
| `context-engineering` | du, beim Schreiben des Entwickler-Auftrags | nur die nötigen Dateien und Fakten, prüfbare Abnahme |
| `doubt-driven-development` | du, bei nicht trivialen Entscheidungen | Gegenprüfung durch einen frischen, lesenden Agenten |
Die Skills sind angepasst: Git-Schreiben, Installationen, Netz, MCP und Cross-Model-Wege wurden entfernt; im Konfliktfall gilt der Block „Blockwerk-Vorrang“ und dieser Skill. **OmniRoute ist nicht aktiv** (`docs/orchestrierung-erweiterungen.md`). Graphify ist nur optional und nur auf Bedarf (siehe Routing).

## Routing und Sparsamkeit (Token-Effizienz hat höchste Priorität)
- **Modellwahl für die Umsetzung (Jonah, 31.10.2026):** Haiku (`blockwerk-entwickler-leicht`) nur für rein mechanische Änderungen ohne eigene Entscheidungslogik: höchstens 2 Dateien, Stelle benannt oder per Repo-Karte schnell gefunden (Tippfehler, Umbenennen, Kommentar, Doku, Zahl oder Text ändern, ein vorgegebener Einzeltest). **Direkt Sonnet** (`blockwerk-entwickler`) bei Heuristik, Regex oder Mustererkennung, Zustandslogik, Architekturentscheidung (Ebenengrenzen, Datenformate, Bedrock-Regeln) oder einer Korrektheitsgarantie („nie falsch“, „immer konservativ“), auch wenn nur wenige Dateien betroffen sind. **Eskalation:** Nach einer fehlgeschlagenen Haiku-Umsetzung oder bei „zu groß für leicht“ bei Bedarf zu Sonnet wechseln, statt mehrere Haiku-Korrekturschleifen zu verbrauchen. **Opus (`blockwerk-entwickler-schwer`) nie ohne ausdrückliche Freigabe von Jonah**: erst fragen, wenn eine Korrekturschleife mit demselben Befund zweimal scheiterte, die Tests nach der Korrektur zweimal rot sind oder der Kern von Ebene 0/1 mit Zeitlogik betroffen ist; ohne Ja bleibt es bei Sonnet.
- **Prüfer nur bei Bedarf** (Pfadtabelle oben); kein Prüfer bei reinem Code ohne Doku, Regeln oder Zahlen. Haiku-Dokuprüfung nur, wenn `docs/`, `data/regeln/` oder `README.md` geändert sind.
- **Codex risikobasiert:** kein Review bei reiner Doku, reinen Testdateien oder Änderungen unter 15 Zeilen ohne `src/`; Review (`fast`) bei kleinen Änderungen in `src/` ab Ebene 2, `tools/` und Daten; Review (`balanced`) bei `src/ebene0` bis `ebene3` im Kern, `data/regeln/`, Sicherheits- und Orchestrierungscode; `max` nur bei Architektur oder Sicherheitsfragen. Ein Review je Schleife, nur wenn Code sich geändert hat.
- **Tool-Ausgaben begrenzen:** Tests mit `npm run test:kurz` oder gezielt `node --test <datei> 2>&1 | tail -n 15`; Diffs erst mit `--stat`; Dateien erst mit `node tools/karte.js` einordnen, dann gezielt lesen. Gib dem Entwickler die Fundstellen aus der Karte im Auftrag mit, damit er nicht erneut sucht.
- **Graphify nur auf Bedarf:** Standard bleibt die Karte. Nur bei Aufrufketten oder modulübergreifenden Analysen `node tools/graphify.js status`; ist Graphify verfügbar, `bauen` (rund 1 Minute, nur wenn veraltet), dann `erklaere <Funktion>` oder `pfad <A> <B>`. Nicht verfügbar (Code 3): mit der Karte weiterarbeiten, kein Hindernis. Nie automatisch beim Start.
- **Rundenbudget:** Kleine Aufgabe höchstens 1 Entwicklerlauf und 1 Korrektur, normale höchstens die drei Schleifen; vorher denken, dann delegieren (ein Brief mit allen Dateien statt mehrerer Suchrunden).

## Freigabegrenzen
**Ohne Rückfrage:** Umsetzung innerhalb des Auftrags, Tests und Testkorrekturen, Routinefehler (lokale Fehler in den Auftragsdateien, Kommentare, Dokumentation, Zahlen und Berichte nachziehen), neue Regeln nach dem Java-Platzhalter-Verfahren (Status `ungeprüft`, Quelle, Testanleitung).
**Vorher Jonahs Zustimmung (Frage mit Optionen, dann warten):** fachliche Architektur (Ebenengrenzen, Datenformate, neue Bereiche, `docs/ebenen.md`, `CLAUDE.md`, `docs/entscheidungen.md`), neue externe Abhängigkeiten (auch `package.json`, Lock-Dateien, fremde Importe, Netz-Skripte), grundlegende Bedrock-Entscheidungen (bestehende Regeln ändern, widersprüchliche Quellen, Ebene-0-Daten), Änderungen am produktiven Planungsverhalten außerhalb des Auftrags, **jeder Commit, Push und PR** (Commit-Freigabe von Jonah, `git commit` fragt zusätzlich per Berechtigung nach), nicht sicher auflösbare Konflikte und Datenverlustrisiken.
**Nie automatisch:** Status `geprüft` setzen; Änderungen an `.claude/`, `tools/orchestrierung/`, `.gitignore`, `.github/` durch einen Agenten; Wechsel zu einem anderen Reviewer als Codex; globale Claude- oder Codex-Einstellungen ändern; Zugangsdaten lesen oder ausgeben.
Die Tore prüft `cli.js tore` automatisch (Stufen `stopp`, `frage`, `info`); du ergänzt, was ein Werkzeug nicht erkennt.

## Ablauf
1. **Vorbereiten.** `status` aufrufen. Läuft schon ein Lauf, frag Jonah. Gibt es unterbrochene Übernahmen, setzt `start` sie automatisch zurück (`wiederherstellen`); sag es im Bericht. `docs/stand.md` lesen.
2. **Analysieren.** Auftrag in Dateien (Globs, z. B. `src/ebene3/**,test/ebene3/**`), Kontextdateien und nötige Prüfer übersetzen. Berührt der Auftrag schon vorab ein Tor (Abschnitt „Freigabegrenzen“; das Werkzeug prüft Tore erst ab `runde-ende`, die Vorab-Prüfung machst du selbst), stell Jonah zuerst die Frage. `start` verlangt `--dateien`.
3. **Sichern.** `start --auftrag "<Auftrag>" --dateien "<globs>" --kontext "<dateien>"`. Das legt Snapshot S0 des ganzen Arbeitsstands an (auch uncommittet und unversioniert, ohne Geheimnisse) und ändert HEAD, Zweig, Index, Stash und Arbeitsbaum nicht. Bricht es mit Geheimnis-Verdacht ab: stoppen, Jonah informieren.
4. **Entwickler.** Starte den Agenten laut Routing (meist `blockwerk-entwickler`, bei kleinen Aufgaben `blockwerk-entwickler-leicht`). Der Hook legt seinen Worktree unter `.claude/worktrees/` genau auf dem Snapshot an (bei Fehler startet der Agent nicht: Abbruch, Jonah informieren, nichts erneut versuchen). Schreibe den Auftrag nach `context-engineering` (nur die nötigen Dateien und Fakten, prüfbare Abnahme) und gib ihm: Auftrag, erlaubte Dateien, Abnahmekriterien, „keine Commits“. Danach `status` → der neueste Eintrag unter `worktrees` ist sein Pfad.
5. **Runde sichern.** `runde-ende --worktree <pfad>` sichert die Arbeit als Zwischen-Snapshot und prüft die Tore. Bei `stopp` nie übernehmen. Bei `frage` Jonah fragen (oder die Datei zurückbauen lassen).
6. **Tests (du selbst, im Worktree).** `cd <worktree> && node --test <betroffene Testdateien>`, danach `npm test` (komplett), `git diff --check`, und `npm run test:pruefstein` nur, wenn Ebene 3 oder 4, Übersetzung, Techniker, Materialisierung oder `tools/pruefstein.js` berührt sind. Rot nach „grün“-Meldung des Entwicklers: erneut melden lassen; zweimal → Eskalation. In dieser Umgebung hat die Projektregel auch zusammengesetzte Befehle blockiert, in denen `git stash` vorkam; benutze es nicht.
7. **Haiku, Quellen, Rechnen.** Starte die nötigen Prüfer **lesend** auf dem Worktree-Pfad; gib ihnen die Testzahlen mit (sie führen nichts aus). Bewerte ihre Befunde selbst gegen den Code.
8. **Codex-Review.** `paket --kontext "<dateien>" --hinweise "<Kriterien>"` baut das isolierte Review-Paket (eigenes Repository im Review-Ordner, exakter Diff, Kontext, Secret-Scan). Rufe genau einmal `review_code` mit den Werten aus `aufruf` auf: `cwd`, `base`, `head`, `tier` (balanced; max bei Architektur oder Sicherheit), `auto_diff=false`, plus `context` und `criteria`; sag Codex, dass auch der Kontext (unveränderte Dateien im Paket) zu prüfen ist. Gib bei der Folgeschleife die `session_id` mit. **Danach sofort** `review-melden --json '<review_mode, failover_occurred, provider, verdict, session_id, models>'`: nur `review_mode == single`, `failover_occurred == false`, Anbieter Codex und genau ein Codex-Modell zählen. Sonst: Ergebnis nicht werten, keinen weiteren Aufruf, keinen anderen Reviewer, Jonah fragen. Ein Fehler des Aufrufs wird nicht wiederholt.
9. **Bewerten.** Nutze die Checkliste aus `code-review-and-quality`; bei nicht trivialen Entscheidungen (Datenverlust, Architekturnähe, widersprüchliche Befunde) wende `doubt-driven-development` an. Jeder Befund wird gegen den Code als **bestätigt**, **widerlegt** oder **offen** eingeordnet (Datei, Zeile und eigene Gegenprüfung, nie nur Codex glauben). Routinefehler (siehe Freigabegrenzen) → Korrektur. Was ein Tor berührt oder eine Entscheidung braucht → Frage an Jonah mit Optionen.
10. **Korrigieren.** Bestätigte Routinefehler gibst du als Liste an einen **neuen** Aufruf von `blockwerk-entwickler`. Sein Worktree entsteht aus dem Zwischen-Snapshot der Vorrunde und enthält deren Arbeit – du beginnst **nie wieder** bei S0 oder ohne die Vorrunde. Dann wieder Schritte 5 bis 9. Höchstens **drei Korrekturschleifen** (nach der Entwicklung also höchstens vier Runden; das Werkzeug verweigert die fünfte). Bleibt danach ein bestätigter Fehler offen, oder taucht derselbe Befund wieder auf: Eskalation an Jonah mit Optionen.
11. **Übernehmen.** `tore` ansehen. Hat Jonah offene Tore freigegeben, `uebernehmen --erlaubt "tor,tor:pfad"` (ein `stopp` ist nie freigebbar). Ohne Tore: `uebernehmen`. Das Werkzeug plant (ändert nichts), sichert, wendet alles-oder-nichts an, setzt bei jedem Fehler zurück und prüft HEAD, Zweig, Stash, Refs und Index. Lehnt es wegen Konflikt ab, frag Jonah; nichts erzwingen. Danach im Hauptbaum `npm test` und `git diff --check` und `haupt-kontrolle --erwartet "<übernommene Dateien>"`.
12. **Abschließen.** `ende` entfernt die Worktrees des Laufs (`--verwerfen` nur nach ausdrücklicher Entscheidung). Aktualisiere `docs/stand.md` nur, wenn der Auftrag es verlangt. Abschlussbericht an Jonah: was geändert (Dateien), Testzahlen (Suite, Prüfstein), Befunde mit Status (bestätigt, widerlegt, offen, wer sie fand), Schleifen, offene Fragen und Risiken, was Jonah im Spiel testen soll. Sende eine **PushNotification**, wenn der Lauf fertig ist oder Jonah entscheiden muss. Nichts wird committet; ein Commit, Push oder PR nur mit ausdrücklicher Freigabe von Jonah.

## Abbruch und Eskalation (Frage an Jonah mit konkreten Optionen)
Ein Tor wird berührt · WorktreeCreate schlägt fehl · Wächter oder Tore melden `stopp` · Tests bleiben nach der Korrektur rot (zweimal) · derselbe Befund kehrt zurück · nach der dritten Korrekturschleife ist ein bestätigter Fehler offen · der Entwickler erreicht `maxTurns` oder berührt verbotene Dateien · Codex meldet nicht `single` oder hat ein Failover, oder die Bridge fällt aus · `uebernehmen` meldet Konflikt oder `haupt-kontrolle` unerwartete Änderungen · Datenverlustrisiko · ein Geheimnis-Verdacht.
Bei unerwartetem Verhalten stoppen und berichten, nicht weitermachen.

## Regeln für dich
- Diffs und Review-Pakete entstehen nur durch die Werkzeuge, nie durch Abtippen.
- Kein Git-Schreiben außer dem, was `cli.js` selbst tut. Kein `git stash/reset/rebase/clean`, kein Push, keine PRs.
- Keine Zeilenenden-Änderungen: Das Repository nutzt LF; bei Skripten mit Python in Windows nicht mit Standard-Textmodus schreiben (CRLF), sondern `newline=''` benutzen.
- Der Hauptarbeitsbaum bleibt während der Entwicklung unberührt; `haupt-kontrolle` beweist es.

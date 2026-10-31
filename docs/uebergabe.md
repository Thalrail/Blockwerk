# Übergabe an das KI-Agententeam (Stand 30.10.2026)

Das Agententeam ist **eingerichtet und wird über den Skill `/blockwerk-auftrag` koordiniert** (Bedienung und Technik: `docs/orchestrierung.md`). Diese Seite sagt, was ein Agent wissen muss und wer was kann.

## Vorhandene Agenten und Prüfer
| Rolle | Wo | Modell | Rechte | Auftrag |
|-------|----|--------|--------|---------|
| Entwickler `blockwerk-entwickler` | `.claude/agents/` (im Projekt) | Sonnet | Lesen, Schreiben, Bash; **isolierter Git-Worktree** | Eine klar umrissene Aufgabe (Code, Tests, Daten, Doku). Nur auf ausdrücklichen Auftrag von Jonah oder des Hauptagenten; nie Commit, Push oder PR; setzt nie selbst `geprüft`. |
| Dokumentationsprüfer `blockwerk-dokupruefer` | `.claude/agents/` (im Projekt) | Haiku | nur Lesen (Read, Grep, Glob) | Prüft, ob `docs/stand.md`, `docs/spieltests.md`, `docs/entscheidungen.md`, `data/regeln` und Code zusammenpassen. Ändert nichts. |
| Quellenprüfer `blockwerk-quellenpruefer` | `.claude/agents/` (im Projekt; die Benutzer-Fassung `quellen-pruefer` bleibt unverändert) | Sonnet | Lesen, Web (Read, WebSearch, WebFetch) | Prüft Bedrock-Regeln, Wiki-Angaben und Faktenbehauptungen gegen Primärquellen. Nennt Java-only-Aussagen als „unbelegt“, setzt nie einen Status. |
| Rechenprüfer `blockwerk-rechenpruefer` | `.claude/agents/` (im Projekt; die Benutzer-Fassung `rechen-pruefer` bleibt unverändert) | Sonnet | Lesen, Rechnen (Read, Grep, Glob, Bash) | Rechnet Zahlen, Einheiten und Rechenwege nach (Blockzahlen, Stacks, Ticks, Testzahlen), wo möglich per Skript. |
| Codex-Review über die MCP-Bridge `codex-bridge` | `~/.claude.json` (Server), Konfiguration `~/.codex-review/reviewbridge.json` | Codex (Tier `balanced` = `gpt-5.6-sol`) | von außen nur Diff und Kontext | Unabhängiger Review (`review_code`, `review_plan`, `review_precommit`). Eigener Ordner `CODEX_HOME`, eigene Datenbank `~/.codex-review-db/reviews.db`; Einzelmodus ohne Failover (`provider: codex`, `fallback: false`). |

Hinweis: Die Hauptsitzung ist der Koordinator (Skill `/blockwerk-auftrag`); die Prüfer entscheiden nichts. Ponytail-Regeln und sieben Agent Skills sind **projektlokal als angepasste Skills aktiv** (`.claude/skills/`, Herkunft `docs/fremdlizenzen/`); Graphify und OmniRoute sind **deaktiviert** (`docs/orchestrierung-erweiterungen.md`).

## Erster unabhängiger Codex-Review (30.10.2026): erfolgreich
- Ein expliziter Diff mit Kontext zu drei Haiku-Befunden (#1, #7, #12), `review_mode: single`, `failover_occurred: false`, Modell `gpt-5.6-sol`. Die Datenbank im eigenen Ordner enthielt danach genau eine Session; der Arbeitsstand blieb unverändert.
- Ergebnis: alle drei Befunde bestätigt oder gestützt; **#1** (Statuszählung `geprüft`) und **#12** (Kommentar Weichensteuerung) behoben; **#7** (stiller Teststein) war ein echter Fehler und ist behoben (Rückfrage statt Teststein, strenge Materialisierung). Details: `docs/stand.md`, Abschnitt „Palette-Absicherung“, und `docs/entscheidungen.md`.
- Lehre: Unveränderte Zeilen müssen im Kontext mitgegeben werden (Codex sieht nur Diff und Kontext), und der Diff muss exakt aus dem Repo kommen (beim ersten Mal hatte ich eine Zeile falsch übertragen).

## Orchestrierung (30.10.2026): fertig, im echten Lauf nachgewiesen, uncommittet (Commit nur mit Jonahs Freigabe)
- **Ablauf:** Auftrag → Tore prüfen → Snapshot S0 des ganzen uncommitteten Stands → Sonnet-Entwickler im Hook-Worktree unter `.claude/worktrees/` → Runde sichern (Zwischen-Snapshot) → Tests durch den Koordinator → Haiku/Quellen/Rechnen bei Bedarf → Codex-Review über das isolierte Review-Paket → Befunde bestätigt/widerlegt/offen → Routinekorrekturen (höchstens drei Schleifen, Folgeagent sieht die Vorrunde) → sichere Übernahme (Journal, alles oder nichts) → Abschlussbericht. Commit, Push und PR nur mit Jonahs Freigabe.
- **Nachweis:** zwei echte Läufe in frischen Claude-Code-Sitzungen (2.1.308): (1) kleiner Entwicklungsauftrag (`zaehleStatus` + `gesamt`) mit Entwickler, Tests, gültigem Codex-Einzelreview (`approve`) und Übernahme; (2) Schleifenmechanik mit drei Runden (jede Folgerunde sah die Arbeit der Vorrunde) und Wächter-Test (fünf verbotene Aufrufe gesperrt, `git status` erlaubt), Hauptbaum und Refs unverändert. Dazu `npm run test:orchestrierung` (46 Tests).
- **Grenzen, die bleiben:** Hooks in `settings.json` wirken erst in einer **neuen** Sitzung (oder nach Überprüfung im `/hooks`-Menü); der Wächter ist eine zweite Schranke, kein Sandkasten; eine Datei, die der Snapshot nicht aufnimmt (verbotener Name, nicht erlaubter Ordner), meldet das Werkzeug als Tor „nicht-uebernommen“; die Wiederaufnahme per `SendMessage` wird nicht gebraucht (jede Runde bekommt einen neuen Worktree auf dem Zwischen-Snapshot).

## Pflichtlektüre (in dieser Reihenfolge)
`CLAUDE.md`, `docs/ebenen.md`, `docs/entscheidungen.md`, `docs/stand.md`, danach `docs/spieltests.md` und `docs/offene-fragen.md`.

## Feste Regeln
- Architektur: jede Ebene baut nur auf tieferen auf; höhere Ebenen ändern die Welt nur über Ebene 0; nur der Leser (Ebene 4) ist KI; keine Abhängigkeiten; Regeln als Daten; `npm test` komplett grün.
- Kein Status `geprüft` ohne Jonahs Spielergebnis. Bedrock-Lücken: Java als Platzhalter, `ungeprüft`, Testanleitung.
- Fachliche und Architekturentscheidungen trifft Jonah. Commit, Push, PR nur mit seiner Freigabe.
- Deutsche Antworten und Commit-Nachrichten, Branch je Aufgabe, PR mit „was gebaut / wie getestet / was im Spiel testen“.

## Prüfungen vor jeder Übergabe
`npm test` (422 Tests, einige Minuten), `npm run test:pruefstein` (Zitadelle, etwa 4 bis 6 Minuten), bei Änderungen an `tools/orchestrierung/` oder `.claude/` zusätzlich `npm run test:orchestrierung` (46 Tests, rund 2 Minuten), `git diff --check`, Mutationsproben für neue Regeln.

## Stand der Lorenbahn-Nische
Schritte 1 bis 3 fertig; Schritt 3 liegt uncommittet auf `claude/lorenbahn-nische-planung`. Offen: Bauplatz 600 × 600 bestätigen, Spieltests aus `docs/spieltests.md`, Weichensteuerung, Beladen der Loren, Sammelbecken, Bahnhof/Entladestelle/Brüter (Brutkammer-Entwurf offen).

## Aufteilung der Arbeit
Engine-Entwicklung (Ebenen 0 bis 4) · Oberfläche (Ebene 5) · unabhängige Prüfung (Codex-Review, Mutationen) · Doku und Spieltest-Anleitungen. Je Aufgabe ein eigener Branch; zwei Schreiber nie an denselben Dateien.

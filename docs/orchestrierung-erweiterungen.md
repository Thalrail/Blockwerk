# Erweiterungen der Orchestrierung (Stand 30.10.2026)

Vier Werkzeuge, die Jonah sich gewünscht hat. **Aktiv sind nur projektlokale Textregeln und Skills** (Ponytail-Regeln und sieben Agent Skills, angepasst); **Graphify und OmniRoute bleiben deaktiviert.** Nichts davon wurde installiert: keine Plugins, keine globale Konfiguration, keine zusätzlichen Hooks, keine neuen Abhängigkeiten, keine Kosten. Gelesen wurden die Originale am 30.10.2026 (nur lesend), pro Skill auf Git-Befehle, Installationen, Netzzugriffe, Werkzeuge und Konflikte mit den Freigabegrenzen geprüft. Herkunft und Lizenzen: `docs/fremdlizenzen/`.

## Regeln für jede Erweiterung
- Die Blockwerk-Freigabegrenzen (`/blockwerk-auftrag`) haben immer Vorrang; jeder übernommene Skill trägt oben den Block „Blockwerk-Vorrang“.
- Keine Commits, Pushes, PRs, Branches; unsere Hooks (`.claude/hooks/git-wache.js`, `worktree-hook.js`) und die Berechtigungssperren in `.claude/settings.json` werden nie überschrieben.
- Keine Änderung an `~/.claude/` oder `~/.config/`; keine neuen Abhängigkeiten, Anbieter oder Kosten ohne Zustimmung.
- Neue, nicht versionierte Dateien eines Werkzeugs kommen nur in den Snapshot, wenn sie in der Erlaubnisliste von `tools/orchestrierung/schnappschuss.js` stehen (Ausgabeordner wie `graphify-out/` gehören nicht dazu).

## Ponytail – [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (MIT, Stand 96608e0): übernommen als Regeln, nicht als Plugin
- **Das Original ist ein Plugin** (Befehle `/ponytail …`, Statusleiste „Band“, zwei Node-Hooks, Dateien in `~/.claude` und `~/.config`, Einspritzung der Regeln in Subagenten). **Nichts davon wurde installiert.**
- **Übernommen** (Skill `.claude/skills/einfachheit/SKILL.md`, auf Deutsch, vom Entwickler vorgeladen): vor dem Schreiben alle betroffenen Stellen auflisten; die Reihenfolge „braucht es das? / gibt es das schon? / Standardbibliothek? / keine neue Abhängigkeit / eine Zeile?“; keine Abstraktion oder Option „für später“; Löschen vor Hinzufügen; vorhandene Struktur behalten; Fehlerbehebung erst alle Aufrufer suchen und die Ursache einmal beheben; verschobener Code behält seine Prüfungen; Abkürzungen mit Grenze kommentieren (`Abkürzung: <Grenze>, <wann ausbauen>`); „nie weglassen“-Liste; Schlusszeilen mit Übersprungenem und Risiko.
- **Nicht übernommen und warum:** Stufen und Befehle (`lite/full/ultra`, `/ponytail-review` …) und der dauerhafte Sitzungsmodus (kein Plugin, keine Hooks); „ultra“ (den Auftrag von Jonah infrage stellen: bei uns Rückfrage statt Widerspruch); „Tests nur bei nicht trivialer Logik“ (Blockwerk verlangt einen Test für jede neue Funktion); „Kommentar nur das Warum, eine Zeile“ (bei uns gilt der Stil der Umgebung); Statusleiste, Band, `audit`, `debt`, `gain`; Schreiben in `~/.claude` und `~/.config/ponytail`; die automatische Einspritzung in andere Agenten.

## Agent Skills – [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT, Stand eb07f19): sieben Skills projektlokal übernommen
Alle sieben wurden Zeile für Zeile auf Git-Befehle, Installationen, Netzzugriffe, Werkzeuge und Konflikte geprüft und in `.claude/skills/<name>/SKILL.md` angepasst. Nicht übernommen wurden die übrigen 18 Skills, die 9 Befehle, die 4 Personas, die Referenz-Checklisten, `hooks/` und der Marketplace-/npx-Weg.

| Skill | Wer | Gefunden | Angepasst oder weggelassen |
|---|---|---|---|
| `test-driven-development` | Entwickler (vorgeladen) | Chrome-DevTools-MCP, Subagenten für Tests, Verweise auf fehlende Dateien | Abschnitte Browser Testing, Subagenten und See Also entfernt; Test-Befehle auf `node --test` und `npm test` |
| `debugging-and-error-recovery` | Entwickler (vorgeladen) | `git bisect` (wechselt Commits im Arbeitsbaum), `npm install` bei Abhängigkeitsfehlern, `npm run build/dev` | Bisect durch lesende Vergleiche ersetzt; Abhängigkeitsfehler = Stopp und Rückfrage; Verifikation mit `node --test`, `npm test`, `git diff --check` |
| `code-simplification` | Entwickler (vorgeladen) | „commit“ im Ablauf, Link auf ein Fremd-Plugin, Python/React-Teile | „weitermachen, kein Commit“; Link und fremde Sprachteile entfernt (Blockwerk ist reines JavaScript) |
| `code-review-and-quality` | Dokumentationsprüfer (vorgeladen), Koordinator | Multi-Model-Review, Abhängigkeits- und Lockfile-Pflege, Verweise auf fehlende Skills und Dateien | Multi-Model durch die Blockwerk-Regel (Codex nur über das Review-Paket) ersetzt; Abhängigkeiten = Tor; Verweise entfernt |
| `source-driven-development` | Quellenprüfer (vorgeladen), Koordinator | holt Framework-Dokumentation aus dem Netz, liest `package.json`-Versionen | auf Blockwerk umgeschrieben (Bedrock-Quellen, Wiki, Java nur als Platzhalter `ungeprüft`); Netz nur für Koordinator und Quellenprüfer, der Entwickler wendet ihn nicht an |
| `doubt-driven-development` | nur Koordinator | Cross-Model über Gemini- und Codex-Kommandozeilen, Persona-Roster, „commit“ | Cross-Model komplett entfernt; frischer, lesender Agentenaufruf des Koordinators; nie in die `skills:`-Liste eines Agenten |
| `context-engineering` | nur Koordinator | MCP-Integrationen (Context7, DevTools, GitHub), `npx`-Beispiel, „vor dem Commit“ | MCP-Abschnitt entfernt; Beispielzeilen angepasst |

## Zuordnung zu den Rollen (aktiv)
| Rolle | Skills |
|---|---|
| Entwickler (Sonnet) | vorgeladen: `einfachheit`, `test-driven-development`, `debugging-and-error-recovery`, `code-simplification` |
| Dokumentationsprüfer (Haiku) | vorgeladen: `code-review-and-quality` |
| Quellenprüfer (Sonnet) | vorgeladen: `source-driven-development` |
| Rechenprüfer (Sonnet) | keine |
| Koordinator (Hauptsitzung) | ruft bei Bedarf auf: `context-engineering` (Entwickler-Auftrag schreiben), `code-review-and-quality` und `doubt-driven-development` (Befunde bewerten, Entscheidungen gegenprüfen), `source-driven-development` (Bedrock-Quellen) |
| Codex-Review | keine (nur Diff und Kontext aus dem Review-Paket) |

Nachweis: In einer frischen Koordinator-Sitzung ordnete der Koordinator vier Situationen den richtigen Skills zu und rief sie mit dem Skill-Werkzeug auf (Fehlersuche → `debugging-and-error-recovery`, neue Funktion → `test-driven-development`, Gegenprüfung → `doubt-driven-development`, Auftrag schreiben → `context-engineering`); der Entwickler meldete genau seine vier vorgeladenen Skills. Tests: `npm run test:orchestrierung` (Dateien, Quellenangaben, verbotene Muster, Zuordnung, keine Zusatz-Hooks).

## Graphify – [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify): bleibt deaktiviert
Quelle bestätigt (die Seite nennt sich „official source repository“; `safishamsi/graphify` zeigt denselben Inhalt; PyPI-Name `graphifyy`, Apache-2.0 und MIT). **Gründe für „deaktiviert“:**
- Es ist ein **externes Python-Werkzeug** (Python ≥ 3.10, `uv` oder `pipx`): eine neue externe Abhängigkeit, die ohne Jonahs Zustimmung nicht installiert wird.
- `graphify claude install` setzt einen **eigenen PreToolUse-Hook** vor Such- und Lese-Aufrufen und schreibt Hinweise in die Konfiguration: das würde mit unserem Wächter und der Hoheit von `CLAUDE.md` kollidieren; `graphify hook install` ändert **Git-Hooks** (bei uns verboten).
- Dokumente, PDFs und Bilder gehen an das konfigurierte Modell (Kosten, Datenabfluss), `graphify add <URL>` lädt aus dem Netz, Abfrage-Protokolle landen in `~/.cache`.
- **Falls Jonah es später freigibt:** nur `--project`, nur Code (`--code-only` bzw. `GRAPHIFY_BACKEND=none`), ohne `claude install` und ohne Git-Hooks; `graphify-out/` in `.gitignore`; Rolle nur lesende Orientierung für Koordinator und Entwickler.

## OmniRoute: bleibt deaktiviert (Quelle nicht bestätigt, nicht integrieren)
- **Quelle offen:** [diegosouzapw/OmniRoute](https://github.com/diegosouzapw/OmniRoute) und [cheaper-inference/OmniRoute](https://github.com/cheaper-inference/OmniRoute) zeigen denselben Inhalt (MIT, Release v3.8.53); das Verhältnis beider Adressen erklärt keine Seite, die npm-Seite war nicht abrufbar (HTTP 403). Drittseiten ([Pinggy](https://pinggy.io/blog/omniroute_ai_gateway_security/)) nennen keine unabhängige Sicherheitsprüfung.
- **Gründe für „deaktiviert“:** selbst gehostetes KI-Gateway, das **eigene Anbieterkonten und Schlüssel** braucht und Free-Tiers anderer Anbieter nutzt (zusätzliche Anbieter und mögliche Kosten); eine **MITM-ähnliche Funktion** (TPROXY mit eigener CA); Schlüssel- und Prompt-Verkehr liefe über den Dienst. Das widerspricht ohne Zustimmung den Regeln „keine zusätzlichen Anbieter oder Kosten“ und „Codex nur über das isolierte Review-Paket, kein automatischer Wechsel des Reviewers“.
- **Rolle, falls Jonah es später will:** höchstens optionales Modell-Gateway für Entwickler oder Prüfer, **nie** für den Codex-Review.

## Offene Entscheidungen für Jonah
1. OmniRoute: Welche Adresse ist die richtige, und soll es überhaupt an die Orchestrierung?
2. Graphify: Ist ein Python-Werkzeug (`uv`/`pipx`, nur Projektumfang, nur Code) als externe Abhängigkeit in Ordnung?
3. Ponytail: Reichen die übernommenen Regeln, oder fehlt etwas aus dem Plugin?
4. Weitere Skills aus agent-skills (zum Beispiel `security-and-hardening` für `dienst/`): Interesse?

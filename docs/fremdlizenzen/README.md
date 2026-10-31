# Fremde Lizenzen und Herkunft

Blockwerk übernimmt aus zwei MIT-lizenzierten Projekten Texte als **projektlokale, angepasste Skills**. Die Lizenztexte stehen hier; jede übernommene Datei nennt Quelle und Stand.

| Projekt | Quelle | Stand | Lizenz | Übernommen in |
|---|---|---|---|---|
| agent-skills (Addy Osmani) | https://github.com/addyosmani/agent-skills | Commit `eb07f19f52c2669f2364897aaa293e2aaddd7b1c` (29.10.2026) | MIT, `agent-skills-MIT.txt` | `.claude/skills/` : test-driven-development, debugging-and-error-recovery, code-review-and-quality, doubt-driven-development, code-simplification, context-engineering (angepasst) und source-driven-development (auf Blockwerk umgeschrieben) |
| Ponytail (Dietrich Gebert) | https://github.com/DietrichGebert/ponytail | Commit `96608e078b2d5ea607c5c3b8b5a54d1c1fba6846` (29.10.2026) | MIT, `ponytail-MIT.txt` | `.claude/skills/einfachheit/` (Auswahl von Regeln, auf Deutsch, ohne Plugin, Hooks und Befehle) |

Es wird nichts installiert und nichts automatisch aktualisiert. Die Originale wurden nur gelesen. Was gegenüber dem Original geändert oder weggelassen wurde, steht in jedem Skill im Block „Blockwerk-Vorrang“ und in `docs/orchestrierung-erweiterungen.md`.

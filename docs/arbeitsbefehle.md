# Arbeitsbefehle für Claude Code (zum Kopieren)

Neue Sitzung auf claude.ai/code, Repository **Thalrail/blockwerk** wählen, Modus **Plan** (beim ersten Mal) oder **Accept edits**.

## Erster Befehl (Neuaufbau starten)
```
Lies CLAUDE.md und alle Dateien in docs/. Blockwerk wird komplett neu nach dem Ebenenmodell
gebaut, es gibt noch keinen Code. Starte mit Schritt 0 (Projektgerüst) und Schritt 1 (Ebene 0)
aus docs/stand.md. Zeig mir zuerst deinen Plan. Danach: bauen, Tests schreiben, npm test
komplett grün, alles umfassend prüfen, docs/stand.md aktualisieren, Pull Request mit
Zusammenfassung (was gebaut, wie getestet, was ich im Spiel testen soll).
```

## Standardbefehl (jeder weitere Chat)
```
Lies CLAUDE.md und docs/stand.md. Arbeite den „Nächsten Schritt“ aus docs/stand.md ab.
Zeig mir zuerst deinen Plan. Danach: bauen, Tests schreiben, npm test komplett grün,
alles umfassend prüfen, docs/stand.md aktualisieren, Pull Request mit Zusammenfassung.
```

## Gezielter Befehl
```
Lies CLAUDE.md. Aufgabe: <z. B. Vermesser: Drehen um 90° mit facing-Werten für Trichter,
Treppen, Schienen>. Gleicher Ablauf wie immer (Plan, Tests, Prüfung, stand.md, Pull Request).
```

## Nach einem Spieltest
```
Lies CLAUDE.md. Testergebnis aus der Kreativwelt: <Modul> – <funktioniert / funktioniert nicht> –
Beobachtung: <...>. Trag das ein (Status nur auf „geprüft“, wenn es funktioniert hat), behebe Fehler,
Pull Request.
```

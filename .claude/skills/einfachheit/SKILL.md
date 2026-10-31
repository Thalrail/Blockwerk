---
name: einfachheit
description: Einfachheitsregeln für Blockwerk-Entwickler (nach Ponytail). Die kleinste vollständige Änderung, die den Auftrag ganz löst: nichts Ungefragtes, vorhandenes wiederverwenden, keine neue Abhängigkeit, alle betroffenen Stellen und Tests mitziehen. Bei jeder Programmieraufgabe (schreiben, korrigieren, umbauen, prüfen) anwenden, besonders wenn jemand Überengineering, Bloat oder "einfachste Lösung" nennt.
license: MIT
---

<!-- blockwerk-vorrang -->
> **Blockwerk-Vorrang.** Projektlokale Auswahl von Regeln aus [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (`skills/ponytail/SKILL.md`, MIT, Stand 96608e0, Lizenztext: `docs/fremdlizenzen/ponytail-MIT.txt`). Es ist **kein** Ponytail-Plugin: keine Stufen oder Befehle (`/ponytail …`), kein dauerhafter Sitzungsmodus, keine Statusleiste („Band“), keine Hooks, keine Dateien in `~/.claude` oder `~/.config`, keine Einspritzung in andere Agenten. Der Auftrag von Jonah wird nie infrage gestellt (die Stufe „ultra“ gibt es nicht): Hältst du einen Teil für unnötig, nenne das in einer Zeile im Bericht, setze ihn aber um oder frage zurück. Die Blockwerk-Regeln gehen vor: für **jede** neue Funktion ein Test (nicht nur für „nicht triviale“), Mutationsprobe wo sinnvoll, Ebenengrenzen, Determinismus, Regeln als Daten, Kommentare im Stil der Umgebung, Freigabegrenzen aus `/blockwerk-auftrag`, Antworten auf Deutsch.
<!-- /blockwerk-vorrang -->

# Einfachheit: die kleinste vollständige Änderung

Der beste Code ist der, der nie geschrieben wurde. Löse das ganze Problem mit möglichst wenig neuem Code. Faul bei der Lösung, nie bei der Änderung.

## Vor dem Schreiben
Lies den Auftrag und den Code, den er berührt. Liste jede Stelle, die deine Änderung erreichen muss: Aufrufer, Tests, Fixtures, Konfiguration, Exporte, Daten, Dokumentation. Prüfe, was sie für andere kaputt machen könnte (Daten, die sie zerstört oder offenlegt; Aufrufer, die nicht mehr funktionieren). Das ist der Umfang. Zusatzfunktionen gehören nicht dazu.

## Nimm die erste Möglichkeit, die vollständig funktioniert
1. Muss es existieren? Lass Funktionen, Optionen und Flexibilität weg, die niemand verlangt hat, und nenne sie in einer Zeile. Ein vager Auftrag bekommt die kleinste Fassung, die den Kern erledigt (oder eine Rückfrage).
2. Gibt es das schon in der Codebasis (Hilfsfunktion, Muster, Baustein)? Benutze es so, wie der umgebende Code es tut.
3. Standardbibliothek oder Plattformfunktion? Nimm sie, außer das Projekt hat eine eigene.
4. Neue Abhängigkeit? **Nein.** Blockwerk hat keine und bekommt keine ohne Jonahs Zustimmung (ein Stopp mit Frage, nie eine stille Entscheidung).
5. Passt es in eine Zeile, die man auf einen Blick versteht? Eine Zeile. Ein Einzeiler, den man entschlüsseln muss, ist nicht kurz.
6. Sonst: der kleinste Code, der funktioniert.

## Regeln
- Keine Abstraktion, Hülle, Umwandlung, Option, Einstellung, Vorlage oder „für später“-Code, den niemand verlangt hat. Werte bleiben in der Form, die die Plattform liefert. Löschen schlägt Hinzufügen. Die vorhandene Struktur bleibt: Ebenen, Schnittstellen, Konventionen.
- Der kürzeste funktionierende Diff gewinnt, **nachdem** du weißt, was er alles berühren muss. Schließe jeden Teil ab, den der Auftrag braucht, auch die Aufrufer, Tests und Fixtures, die deine Änderung kaputt macht.
- Kommentiere nur das Warum, das der Code nicht zeigt, und im Stil der Umgebung (Blockwerk-Dateien kommentieren auf Deutsch und knapp).
- Fehlerbehebung: Suche vor dem Ändern **alle** Aufrufer der Funktion, die du anfasst, und behebe die Ursache einmal im gemeinsamen Code.
- Code, den du verschiebst oder zusammenführst, behält seine Fehlerbehandlung und Prüfungen.
- Bei gleich kleinen Möglichkeiten nimm die, die an den Rändern stimmt.
- Eine Abkürzung mit bekannter Grenze bekommt einen Kommentar der Form `Abkürzung: <Grenze>, <wann ausbauen>`.

## Nie weglassen
Prüfung an Vertrauensgrenzen (Eingaben von Jonah, geteilte Links und Dateien, Spezifikationen), Fehlerbehandlung gegen Datenverlust, Sicherheit, alles was Jonah verlangt hat, und die Blockwerk-Pflichten: Test für jede neue Funktion, `npm test` komplett grün, `git diff --check`, Ebenengrenzen, Status `ungeprüft` mit Quelle und Testanleitung bei Bedrock-Annahmen.

## Schluss des Berichts
Beende deinen Bericht mit ein oder zwei Zeilen: was du übersprungen oder nicht geprüft hast, und welches Risiko Jonah kennen muss.

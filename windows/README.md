# Blockwerk für Windows (Prototyp W1)

Blockwerk als eigenständiges Windows-Programm (Tauri 2). Das Fenster zeigt die vorhandene Weboberfläche (`index.html`, `web/`, `src/`, `data/`) unverändert; die Planungslogik wird nicht angefasst. Der Browserbetrieb (GitHub Pages, `node tools/serve.js`) bleibt wie er ist.

## Installieren und benutzen
1. `Blockwerk_0.1.0_x64-setup.exe` ausführen. Installation nur für deinen Benutzer, kein Administrator nötig. Der Installer ist **nicht signiert**: Windows SmartScreen warnt beim ersten Start („Weitere Informationen“ → „Trotzdem ausführen“).
2. Blockwerk aus dem Startmenü starten. Es braucht keinen Server und keine Internetverbindung (nur Live-Abhaken braucht das Netz).
3. **3D-Ansicht → Freiflug:** ins Bild klicken fängt die Maus; Maus = umsehen, W/A/S/D = bewegen, Leertaste = hoch, Umschalt = runter, **Esc** gibt die Maus frei (ebenso ein Wechsel in ein anderes Fenster).
4. **Projekte:** werden automatisch im Programm gespeichert und sind nach einem Neustart wieder da. „Datei sichern“ öffnet den Windows-Dialog „Speichern unter“ (Vorschlag `<Projekt>.blockwerk.json`) und meldet den Pfad; Abbrechen schreibt nichts. „Datei öffnen“ lädt die Datei wieder.
5. **Wichtig:** Der Programmspeicher ist vom Browser getrennt. Projekte aus dem Browser kommen per „Datei sichern“ (Browser) und „Datei öffnen“ (Programm) hinüber.

## Selbst bauen (Entwickler)
Voraussetzungen: Rust (MSVC-Toolchain), Visual-Studio-Build-Tools mit „Desktopentwicklung mit C++“, WebView2 (in Windows 11 enthalten), und die Tauri-Kommandozeile in der festgelegten Version:
```
cargo install tauri-cli --version 2.12.4 --locked
```
Bauen (im Ordner `windows/`):
```
node kopiere-dist.mjs
cargo tauri build
```
Ergebnis: `windows/src-tauri/target/release/bundle/nsis/Blockwerk_0.1.0_x64-setup.exe` und `…/release/blockwerk-windows.exe`. `kopiere-dist.mjs` kopiert nur `index.html`, `manifest.webmanifest`, `web/`, `src/`, `data/` nach `windows/dist` (keine Git-Daten, Dokumentation, Datenbanken, versteckten Dateien). `Cargo.lock` ist eingecheckt (reproduzierbarer Build). Tests: `npm test` (`test/windows.test.js`).

## Geprüft (11/2026, Windows 11, WebView2 157)
Start ohne Server; Engine-Worker und `fetch` aus `data/`; Zitadelle (klein) berechnet und angezeigt; 3D-Ansicht; Freiflug: Klick fängt die Maus, Blick ohne gedrückte Taste, W/A/S/D, echtes Esc gibt frei, Fokuswechsel gibt frei; Projekt nach vollständigem Neustart wieder da; Export über den Speichern-Dialog (Datei geschrieben, Abbruch geprüft); Import einer exportierten Datei.

## Noch nicht unterstützt / Grenzen
- Kein Signieren, kein automatisches Update, nur Windows (x64), nur NSIS (kein MSI).
- Der Kompaktmodus („Immer im Vordergrund“, Fenster im Vordergrund) nutzt `documentPictureInPicture`; in WebView2 vorhanden, aber im Alltag noch nicht erprobt.
- Kein Zugriff auf Minecraft-Welten oder Gelände (nicht Teil von W1).
- Der Programmspeicher ist vom Browser getrennt (siehe oben); kein automatischer Abgleich.
- Live-Abhaken braucht Netz und den eingerichteten Dienst. Weil die Dienst-Adresse per Link frei wählbar ist, erlaubt die Inhaltsrichtlinie (`connect-src`) beliebige `https:`/`wss:`-Ziele (Codex-Hinweis); eine Einschränkung auf feste Dienste wäre eine Produktentscheidung für später.
- Spieltest mit längerer Nutzung (Maus bei Mehrfenster-Betrieb, mehrere Bildschirme) steht aus.

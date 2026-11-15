# Anleitung: Welt vom Aternos-Server exportieren (für Blockwerk, Untersuchung G0)

Stand 15.11.2026. Grundlage: Aternos-Hilfeartikel „Download your world“ und Foren-Hinweise von Moderatoren. Der Hilfeartikel selbst ließ sich beim Recherchieren nicht abrufen; die Schritte stammen aus Suchergebnissen und sind daher **von dir beim ersten Mal zu bestätigen**. Wichtig: Die PS5 kann keine Welt exportieren, die Welt liegt aber auf dem Aternos-Server, und von dort geht der Download.

## Schritte
1. **Welt sichern, nichts verändern:** Server in Aternos starten, bei Bedarf kurz Spiel beenden und den Server **stoppen**, damit der letzte Stand gespeichert ist (Forenberichte nennen manchmal veraltete Downloads).
2. Im Browser `aternos.org/worlds` öffnen (eingeloggt, Server ausgewählt).
3. Bei der gewünschten Welt auf **Download** klicken. Nach einigen Minuten kommt eine Zip-Datei (bei Bedrock eventuell `.mcworld`; das ist ebenfalls ein Zip, sonst nur die Endung ändern auf `.zip`). Nicht mehrfach klicken.
4. Datei nicht verändern und nicht öffnen. Lege sie unter `docs/weltproben/` oder einem Ordner deiner Wahl ab; **nicht ins Repo committen** (groß, enthält Spielerdaten).
5. Sicherheitskopie: Zip an einen zweiten Ort kopieren.

## Prüfen, ob es die richtige Datei ist
Beim Entpacken (in eine Kopie) sollten sichtbar sein: ein Ordner `db` (mit Dateien wie `CURRENT`, `MANIFEST-…`, `….ldb`, `….log`), die Datei `level.dat` und meist `levelname.txt`. Fehlt `db`, bitte melden.

## Was ich von dir brauche
- Die Zip-Datei (oder besser zunächst eine **kleine** Testwelt: neuer Server, wenig erkundet).
- Die Bedrock-Version des Servers (steht in Aternos) und Seed, falls bekannt.
- Die Koordinaten eines Bauplatzes (in Minecraft: Einstellungen → „Koordinaten anzeigen“).

## Falls es nicht klappt
Download-Knopf reagiert nicht: einmal klicken und mehrere Minuten warten. Alter Stand: Server starten und sauber stoppen, dann erneut herunterladen. Alternativ im Aternos-Backup-Bereich eine Sicherung laden (enthält den ganzen Server, nicht nur die Welt).

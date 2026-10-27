# Blockwerk-Dienst für Live-Abhaken (Cloudflare)

Der Dienst ist ein winziger Raum-Server: Jeder Raum hält den **freigegebenen Plan** und alle **Haken**; wer den Raum-Link hat, sieht Änderungen sofort. Er läuft als Cloudflare Worker mit einem Durable Object je Raum (WebSocket). Alles Fachliche (Prüfen, Mischen, Planversionen) steht in `src/ebene5/live.js` und ist mit Tests abgedeckt; `worker.js` ist nur die Verdrahtung mit Cloudflare.

**Wichtig:** Der Worker selbst ist nur mit Attrappen getestet (`test/dienst/`), nicht gegen echtes Cloudflare. Probiere ihn nach dem Einrichten mit einem Freund aus.

## Ohne Cloudflare ausprobieren (nur auf deinem Rechner)
```
node tools/live-lokal.js
```
In Blockwerk: **Live** → Adresse `ws://localhost:8787` → **Raum starten**. Den Link kannst du in einem zweiten Browserfenster öffnen (am besten unter `http://127.0.0.1:8080`, damit der Browserspeicher getrennt ist).

## Einrichten (einmalig, durch dich, mit deinem Cloudflare-Konto)
1. Konto anlegen: <https://dash.cloudflare.com/sign-up> (die kostenlose Stufe reicht; Durable Objects mit SQLite sind darin enthalten).
2. In `dienst/wrangler.toml` bei `ERLAUBTE_URSPRUENGE` die Adresse eintragen, unter der Blockwerk läuft (nur Adresse ohne Pfad, z. B. `https://thalrail.github.io`; mehrere mit Komma). Nur diese Seiten dürfen sich verbinden.
3. Hochladen (im Ordner `dienst/`; `npx` lädt das Werkzeug **Wrangler** vorübergehend, es kommt nicht ins Repo):
   ```
   npx wrangler login
   npx wrangler deploy
   ```
   Wrangler öffnet den Browser zur Anmeldung. Die Zugangsdaten bleiben bei dir und gehören **nie** ins Repo oder in einen Chat.
4. Wrangler zeigt die Adresse an, z. B. `https://blockwerk-live.<dein-name>.workers.dev`. Diese Adresse in Blockwerk bei **Live** eintragen (Blockwerk macht daraus `wss://…`).
5. **Raum starten**, **Link kopieren**, an Freunde schicken. Fertig.

## Wie es funktioniert und was du wissen solltest
- **Der Link ist der Zugang.** Die Raum-Nummer ist eine zufällige 128-Bit-Nummer; wer den Link hat, kann abhaken und neue Planversionen vorschlagen. Es gibt keine Konten. Gib den Link nur an Leute, denen du das erlaubst.
- Der Dienst speichert pro Raum: freigegebener Plan, Haken (mit Spielername und logischer Uhr). Nichts anderes, keine Protokolle. Ein Raum ohne Nutzung wird nach **30 Tagen** gelöscht.
- Grenzen: 12 Spieler je Raum, höchstens 5 000 Haken, Plan höchstens 200 000 Zeichen, 40 Nachrichten je 10 Sekunden je Verbindung.
- Eine neue Planversion wird nur angenommen, wenn der Absender die aktuelle Version kannte und die Freigabe zum Inhalt passt; sonst bekommt er den aktuellen Stand. Die anderen im Raum **übernehmen** eine neue Version selbst (Banner), unveränderte Schichten behalten ihre Haken.
- Kosten: die kostenlose Stufe von Cloudflare reicht für kleine Gruppen. Ändert Cloudflare seine Bedingungen, ist das deren Sache; der Dienst lässt sich jederzeit mit `npx wrangler delete` entfernen.

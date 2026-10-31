// Prüfstein: lässt eine Spezifikation (Standard: die Zitadelle, Stufe 1) den ganzen Weg durch die Engine laufen und schreibt einen ehrlichen Prüfbericht.
// Aufruf:  node tools/pruefstein.js [Spezifikation.json] [Bericht.md]     (Standard: data/beispiele/zitadelle.json → docs/zitadelle/pruefbericht.md)
// Die „Freigabe“ in diesem Lauf ist technisch (damit die Planung startet); die echte Freigabe gibt Jonah in der Oberfläche.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ladeEngine, erzeugeEbene5 } from '../src/ebene5/index.js';
import { berichtAlsText } from '../src/ebene3/index.js';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const holeJson = async (pfad) => JSON.parse(readFileSync(join(wurzel, pfad), 'utf8'));
const specPfad = process.argv[2] ?? 'data/beispiele/zitadelle.json';
const berichtPfad = process.argv[3] ?? 'docs/zitadelle/pruefbericht.md';

const mb = () => Math.round(process.memoryUsage().rss / 1048576);
const sek = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
const zahl = (n) => n.toLocaleString('de-DE');

const t0 = Date.now();
const e = await ladeEngine(holeJson);
const texturen = await holeJson('data/texturen.json').catch(() => null);
const e5 = erzeugeEbene5({ ebene0: e.ebene0, ebene3: e.ebene3, darstellungsdaten: await holeJson('data/darstellung.json'), texturen });
const spec0 = await holeJson(specPfad);
const pr = e.ebene4.pruefe(spec0);
const freigegeben = e.ebene4.freigeben(spec0, 'pruefstein-technisch');
const t1 = Date.now();
const r = e.ebene4.baue(freigegeben);
const tBau = Date.now() - t1;
if (r.status !== 'fertig') { console.error(`Planung nicht fertig (Status ${r.status}):`); for (const q of r.rueckfragen ?? []) console.error(` - ${q.id}: ${q.frage}`); process.exit(1); }
const t2 = Date.now();
const plan = e5.bauplan(r.entwurf);
const material = e5.material(plan);
const tPlan = Date.now() - t2;
const t3 = Date.now();
const abschluss = e.ebene3.ablauf.abschliessen ? e.ebene3.ablauf.abschliessen(r.entwurf) : null;
const tAbschluss = Date.now() - t3;
const b = e.ebene3.techniker.bilanz(r.entwurf).werte;

const regeln = e.ebene1.regelwerk.alle();
const zaehl = { simuliert: 0, entworfen: 0, geprueft: 0, ungeprueft: 0 };
for (const x of regeln) { zaehl[x.status] = (zaehl[x.status] ?? 0) + 1; if (x.ungeprueft) zaehl.ungeprueft++; }
const bausteine = [...e.ebene2.bausteine.values()].map((x) => ({ id: x.id, status: x.status ?? 'entworfen' }));
const benutzt = [...new Set(r.entwurf.teile.map((t) => t.baustein))].sort();
const rueckgriffe = r.entwurf.bericht.filter((x) => x.art === 'rueckgriff' || /öffnet den Abschnitt/.test(x.satz)).length;
const einwandRegeln = new Map();
for (const w of r.entwurf.einwaende) einwandRegeln.set(w.regel, (einwandRegeln.get(w.regel) ?? 0) + 1);
const gesamtBloecke = plan.bloecke;
const t = (s) => String(s).replaceAll('|', '/');

const z = [];
z.push('# Prüfbericht: Die Zitadelle (Stufe 1: Hülle und Handel)', '');
z.push(`Erzeugt mit \`node tools/pruefstein.js\` aus \`${specPfad}\`. Die Freigabe in diesem Lauf ist **technisch** (damit die Planung startet); die echte Freigabe gibt Jonah in der Oberfläche.`, '');
z.push('## Kurzfassung', '');
z.push(`- Die Planung läuft **durch**: ${r.entwurf.abschnitte.length} Abschnitte, ${r.entwurf.teile.length} Teile, **${zahl(gesamtBloecke)} Blöcke** im Bauplan.`);
z.push(`- Zeit (Node): Planung **${sek(tBau)}**, Bauplan und Material ${sek(tPlan)}, Abschlussprüfung des fertigen Entwurfs ${abschluss ? sek(tAbschluss) : 'nicht gemessen'}; Speicher ${mb()} MB.`);
z.push(`- Prüfer der Spezifikation: ${pr.rueckfragen.length} offene Rückfragen, ${pr.hinweise.length} Hinweise. Einwände während der Planung: ${r.entwurf.einwaende.length}, Rückgriffe: ${rueckgriffe}, offene Rückfragen an Jonah: ${r.rueckfragen.length}.`);
z.push(`- **Offene Schaltungsanfragen: ${r.offeneAnfragen.length}** (siehe unten). Das ist der ehrliche Stand: Blockwerk hat dafür noch keine Bausteine.`, '');

z.push('## Abschnitte (in Bau-Reihenfolge)', '', '| Nr. | Abschnitt | Hülle (x × y × z) | Von | Bis | Blöcke |', '|----|-----------|-------------------|-----|-----|--------|');
const abschnittePlan = new Map(plan.abschnitte.map((a) => [a.id, a]));
r.entwurf.abschnitte.slice().sort((a, c) => a.reihenfolge - c.reihenfolge).forEach((a, i) => {
  const h = a.huelle, ap = abschnittePlan.get(a.id);
  z.push(`| ${i + 1} | ${t(a.name)} | ${h.bis.x - h.von.x + 1} × ${h.bis.y - h.von.y + 1} × ${h.bis.z - h.von.z + 1} | (${h.von.x}, ${h.von.y}, ${h.von.z}) | (${h.bis.x}, ${h.bis.y}, ${h.bis.z}) | ${zahl(ap?.bloecke ?? 0)} |`);
});

z.push('', '## Material (Gesamt, die größten Posten)', '', '| Block | Anzahl | Umgerechnet |', '|-------|--------|-------------|');
for (const m of material.gesamt.slice(0, 15)) z.push(`| ${t(m.name)} | ${zahl(m.anzahl)} | ${t(m.text)} |`);
z.push(`| … insgesamt ${material.gesamt.length} Blocksorten | ${zahl(gesamtBloecke)} | |`);

z.push('', '## Bilanz (Dorfbewohner, Betten, Berufsblöcke)', '');
z.push(`Aus allen fertigen Abschnitten (Ebene 1, Dorfmodell): **${b.betten} gültige Betten**, **${b.dorfbewohner} Dorfbewohner**, **${b.berufsbloecke} Berufsblöcke**, Iron Golem: **${b.golem}**.`);
z.push('Die Zahl der Berufsblöcke enthält auch die Fässer des Sortierlagers (siehe Befund 7). Entschieden (Jonah, 27.10.2026): 140 Handelsnischen (sieben Viertel mit Ständen; die Kenndaten auf Bild 13 mit 160 stimmen nicht), je mit einem Berufsblock. Die Handelsviertel nutzen die Lorenbahn-Nische von Bild 07 (kein Bett, der Dorfbewohner kommt per Lore); deshalb gibt es 0 Betten, und der Iron Golem bleibt „nein“ (Bedingung: 20 Betten).');

z.push('', '## Schaltungsanfragen (was es noch nicht gibt)', '', '| Nr. | Abschnitt | Gewünscht |', '|-----|-----------|-----------|');
for (const q of r.offeneAnfragen) z.push(`| ${t(q.id)} | ${t(q.abschnitt)} | ${t(q.art)} |`);
z.push('', 'Bahnhof, Entladestelle und Brüter sind wegen des offenen Brutkammer-Entwurfs zurückgestellt (`docs/offene-fragen.md`). Wohnbereiche, Felder, Sammelbecken, Lorenbahn-Netz, Aufzug und Wasserrückführung haben noch keinen Baustein.');

z.push('', '## Einwände und Hinweise während der Planung', '');
if (!einwandRegeln.size) z.push('Keine Einwände (kein Verstoß gegen die Regeln aus Ebene 1 und die Geometrieregeln).');
else for (const [k, n] of einwandRegeln) z.push(`- ${k}: ${n}`);
z.push('', `Hinweise des Prüfers der Spezifikation (${pr.hinweise.length}):`);
for (const h of pr.hinweise.slice(0, 12)) z.push(`- ${h.pfad}: ${h.text}`);

z.push('', '## Benutzte Bausteine und Stand der Regeln', '');
z.push(`Bausteine: ${benutzt.map((id) => `\`${id}\` (${bausteine.find((x) => x.id === id)?.status ?? '?'})`).join(', ')}.`);
z.push(`Regeln insgesamt ${regeln.length}: ${zaehl.simuliert} simuliert, ${zaehl.entworfen} entworfen, ${zaehl.geprueft} im Spiel geprüft; **${zaehl.ungeprueft} enthalten ungeprüfte Annahmen** (Testanleitungen: \`docs/spieltests.md\`). Nichts davon ist im Spiel bestätigt, bis Jonah es meldet.`);

z.push('', '## Befunde: wo die Planung heute an ihre Grenzen stößt', '');
z.push('1. **Jedes Teil ist ein eigener Kasten.** Die Zitadelle ist verschachtelt (Handelsviertel, Rotunde, Ecktürme im selben Gebäude). Blockwerk plant Teile als getrennte, sich nicht überschneidende Hüllen, die Technik steht daneben. Die acht Handelsviertel liegen deshalb als Kästen um die Zentralhalle und nicht als gemeinsames Hauptgebäude. Die Himmelsrichtungen und Maße stimmen, die Geometrie des Bildes nicht.');
z.push('2. **Diagonale Arme** (Nordost, Südost, Südwest, Nordwest) gibt es nur als rechtwinklige Kästen, nicht als 45°-Gänge. Dafür wurde die Lage „strahlenförmig“ eingeführt (nur die Lage; die Form bleibt achsenparallel).');
z.push('3. **Handelsnische:** gebaut wird die Lorenbahn-Nische von Bild 07 (`tech.handelsnischen-lore`: Lore von oben, Aktivierungsschiene, Deckenklappe, Falltür, Wasserkanal mit Gefälle). Offen bleiben die Weichensteuerung (welche Lore in welchen Stich, je Viertel eine Schaltungsanfrage), das Beladen der Loren, das Sammelbecken am Kanalende und die Kanaltiefe (20 Nischen = 7 Stufen = 8 Blöcke unter dem Boden; sie steht in der Hülle, der Bauplatz wurde dafür auf 600 × 600 vergrößert). Außerdem ist im Modell die Berufsvergabe ohne Bett nicht abgebildet.');
z.push('4. **Lager:** Das Sortierlager sortiert nach einzelnen Gegenständen (hier 16 Kategorien × 3 Gegenstände = 48 Sorten). Werkzeuge und Rüstung sind nicht stapelbar und deshalb durch stapelbare Stellvertreter ersetzt. Eine Sortierung nach Kategorien (mit Dutzenden Gegenständen je Kategorie) ist nicht umgesetzt.');
z.push('5. **Maße der Brücken, Portal, Ecktürme, Kuppel** sind übernommen (Länge 46, Breite 13; Portal 15 breit; Türme 80 und 110 hoch; Kuppel Ø 33 bis Höhe 64), aber als einfache Formen (Zylinder, Tonnengewölbe, Bogen, Kuppel); Zierbögen, Zinnen, Banner und Dekoration fehlen.');
z.push('6. **Hauptlager:** Das Sortierlager für 48 Sorten ist 342 Blöcke lang (je Sorte ein Modul im Raster 6). Es steht deshalb unter dem Untergeschoss und nicht darin.');
z.push('7. **Berufsblöcke im Lager:** Die Fässer der Sortierlager-Einheiten sind für Dorfbewohner Berufsblöcke (Fischer). Die Bilanz zählt deshalb mehr Berufsblöcke als Nischen (hier: Nischen plus ein Fass je Lagersorte). Sie stehen weit von den Nischen entfernt (Sperrzone 16 waagerecht / 4 senkrecht), der Prüfer meldet daher keinen Verstoß; im Spiel dürfen dort keine arbeitslosen Dorfbewohner hinkommen.');
z.push('', '## Reproduzieren', '', '```', 'node tools/pruefstein.js', '```', '');
writeFileSync(join(wurzel, berichtPfad), `${z.join('\n')}\n`);
console.log(`Bericht geschrieben: ${berichtPfad} (Planung ${sek(tBau)}, ${mb()} MB, ${zahl(gesamtBloecke)} Blöcke)`);
void berichtAlsText; void t0;

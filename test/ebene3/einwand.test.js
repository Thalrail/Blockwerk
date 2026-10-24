import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene3 } from '../hilfe.js';
import { neuerEntwurf, entwurfZuJson, berichtAlsText } from '../../src/ebene3/index.js';

const e3 = ebene3();
const e1 = e3.ebene1;
const aendere = (e, wer, a) => e3.aendere(e, wer, a).entwurf;
const teil = (baustein, lage = {}, parameter = {}, extra = {}) => ({ art: 'setze-teil', teil: { abschnitt: 'A1', baustein, parameter, lage: { x: 0, y: 0, z: 0, drehung: 0, ...lage }, ...extra } });

function grund() {
  return aendere(neuerEntwurf({ name: 'Probe' }), 'konstrukteur', { art: 'setze-abschnitt', abschnitt: { id: 'A1', name: 'Halle', reihenfolge: 1 } });
}
const ZYL = { breite: 3, tiefe: 3, hoehe: 3, wandstaerke: 0 };
/** Antriebsstrecke (Techniker) mit einem Zylinder des Architekten, der drei Schienen überdeckt. */
function mitUeberschneidung() {
  let e = grund();
  e = aendere(e, 'techniker', teil('tech.antriebsstrecke', {}, { abschnitte: 1, abstand: 7 }));
  e = aendere(e, 'architekt', teil('form.zylinder', { z: -3 }, ZYL));
  return e;
}
const verschiebe = (z) => (ew) => ({ art: 'aendere-teil', id: ew.ziel.slice(5), felder: { lage: { z } } });

test('Einwand: Quellen und Zuständigkeit', () => {
  const ZUSTAENDIG = ['techniker', 'grobdesigner', 'architekt', 'konstrukteur', 'designer'];
  const regeln = e1.regelwerk.alle().map((r) => r.id).filter((id) => id.startsWith('pruefer.'));
  assert.ok(regeln.length >= 18);
  for (const id of regeln) assert.ok(ZUSTAENDIG.includes(e3.einwaende.zustaendig(id)), `${id} hat einen Zuständigen`);
  assert.deepEqual(['pruefer.begehbar', 'pruefer.tickbereich', 'pruefer.lore-stillstand', 'pruefer.dorf', 'pruefer.licht-unklar', 'pruefer.spawn-moeglich', 'pruefer.wasser-zerstoert'].map((r) => e3.einwaende.zustaendig(r)),
    ['konstrukteur', 'konstrukteur', 'techniker', 'techniker', 'designer', 'designer', 'techniker']);
  assert.equal(e3.einwaende.zustaendig('pruefer.gibtsnicht'), 'bauleiter', 'Unbekanntes geht an den Bauleiter');

  // Lorenstrecken in allen Drehungen und an verschobener Stelle: der Prüfstart dreht mit, es gibt keinen Einwand
  for (const [baustein, parameter] of [['tech.antriebsstrecke', { abschnitte: 3, abstand: 5 }], ['tech.steigung', { hoehe: 5 }], ['tech.kurve', { schenkel: 4 }]]) {
    for (let drehung = 0; drehung < 4; drehung++) {
      let e = grund();
      e = aendere(e, 'techniker', teil(baustein, { x: 20, y: 5, z: -12, drehung }, parameter));
      const { einwaende, hinweise } = e3.einwaende.sammle(e);
      assert.deepEqual(einwaende, [], `${baustein} gedreht um ${drehung * 90}°`);
      assert.ok(Array.isArray(hinweise));
    }
  }

  // Prüfer aus Ebene 1: ein unerreichbares Ziel wird zu einem Einwand an den Konstrukteur, mit Koordinate
  let e = grund();
  e = aendere(e, 'konstrukteur', teil('bau.gang', {}, { laenge: 9 }, { verbindung: true }));
  e = aendere(e, 'konstrukteur', { art: 'setze-pruefung', pruefung: { id: 'P1', art: 'begehbar', start: { x: 0, y: 0, z: 4 }, ziele: [{ pos: { x: 0, y: 0, z: -8 }, art: 'spieler' }] } });
  const { einwaende } = e3.einwaende.sammle(e);
  assert.equal(einwaende.length, 1);
  assert.deepEqual([einwaende[0].regel, einwaende[0].an, einwaende[0].von, einwaende[0].ort, einwaende[0].schwere], ['pruefer.begehbar', 'konstrukteur', 'bauleiter', { x: 0, y: 0, z: -8 }, 'verstoss']);
  assert.match(einwaende[0].text, /erreicht \(0, 0, -8\) nicht/);

  // Der Konstrukteur löst ihn, indem er seine Verbindung verlängert (sein eigenes Teil)
  const r = e3.laufe(e, { konstrukteur: () => ({ art: 'aendere-teil', id: 'T1', felder: { parameter: { laenge: 17 } } }) });
  assert.deepEqual([r.erledigt.length, r.eskaliert.length, r.runden], [1, 0, 1]);
  assert.equal(r.entwurf.teile[0].parameter.laenge, 17);
  assert.equal(r.entwurf.einwaende[0].status, 'erledigt');
  // ohne Fachmann-Antwort bleibt der Verstoß stehen und geht an Jonah
  const stumm = e3.laufe(e, {});
  assert.deepEqual([stumm.erledigt.length, stumm.eskaliert.length], [0, 1]);
  assert.equal(stumm.rueckfragen[0].ort.z, -8);
});

test('Einwand: Überschneidung, Sperrzone und Zone', () => {
  // Überschneidung: Techniker hat Vorrang, der Einwand geht an den Architekten, mit Koordinate und Anzahl
  let e = mitUeberschneidung();
  let { einwaende } = e3.einwaende.sammle(e);
  assert.equal(einwaende.length, 1);
  assert.deepEqual([einwaende[0].regel, einwaende[0].von, einwaende[0].an, einwaende[0].ziel, einwaende[0].ort], ['plan.geometrie', 'techniker', 'architekt', 'teil:T2', { x: 0, y: 0, z: -4 }]);
  assert.match(einwaende[0].text, /belegen 3 gemeinsame Blöcke/);
  // gleicher Besitzer: der Bauleiter erhebt ihn, zuständig bleibt der Besitzer des später gesetzten Teils
  let g = grund();
  g = aendere(g, 'architekt', teil('form.zylinder', {}, ZYL));
  g = aendere(g, 'architekt', teil('form.zylinder', { x: 1 }, ZYL));
  ({ einwaende } = e3.einwaende.sammle(g));
  assert.deepEqual([einwaende[0].von, einwaende[0].an, einwaende[0].ziel], ['bauleiter', 'architekt', 'teil:T2']);
  // Drehung zählt: die um 90° gedrehte Strecke läuft in x-Richtung und schneidet den Zylinder bei x = −3 statt z = −3
  let d = grund();
  d = aendere(d, 'techniker', teil('tech.antriebsstrecke', { drehung: 1 }, { abschnitte: 1, abstand: 7 }));
  d = aendere(d, 'architekt', teil('form.zylinder', { x: 3 }, ZYL));
  d = aendere(d, 'architekt', teil('form.zylinder', { z: -3 }, ZYL));
  ({ einwaende } = e3.einwaende.sammle(d));
  assert.deepEqual(einwaende.map((x) => x.ziel), ['teil:T2'], 'nur der Zylinder auf der gedrehten Strecke schneidet');

  // Lösung in einer Runde
  const r = e3.laufe(e, { architekt: verschiebe(-30) });
  assert.deepEqual([r.erledigt, r.eskaliert, r.runden], [['E1'], [], 1]);
  assert.deepEqual(r.entwurf.bericht.map((b) => b.art), ['aenderung', 'aenderung', 'aenderung', 'einwand', 'aenderung', 'erledigt']);

  // Sperrzone des Technikers: Formen nicht, Technik schon
  let s = grund();
  s = aendere(s, 'techniker', { art: 'setze-sperrzone', sperrzone: { id: 'S1', von: { x: 5, y: 0, z: 4 }, bis: { x: 7, y: 2, z: 6 }, verbot: 'alles' } });
  s = aendere(s, 'techniker', teil('tech.antriebsstrecke', { x: 4, z: 6 }, { abschnitte: 1, abstand: 7 }));
  s = aendere(s, 'architekt', teil('form.zylinder', { x: 6, z: 5 }, ZYL));
  ({ einwaende } = e3.einwaende.sammle(s));
  assert.equal(einwaende.length, 1);
  assert.deepEqual([einwaende[0].von, einwaende[0].an, einwaende[0].ziel], ['techniker', 'architekt', 'teil:T2']);
  assert.match(einwaende[0].text, /Sperrzone S1 \(nur Technik erlaubt\)/);
  const ps = e3.laufe(s, { architekt: verschiebe(40) });
  assert.deepEqual([ps.erledigt.length, ps.eskaliert.length], [1, 0]);

  // Sperrzone „arbeitsblock“: Berufsblöcke einer Handelsnische als Technik erlaubt, als Verbindung des Konstrukteurs nicht
  const nische = (verbindung) => {
    let n = grund();
    n = aendere(n, 'techniker', { art: 'setze-sperrzone', sperrzone: { id: 'S2', von: { x: -2, y: 0, z: -2 }, bis: { x: 4, y: 3, z: 2 }, verbot: 'arbeitsblock' } });
    return aendere(n, verbindung ? 'konstrukteur' : 'techniker', teil('tech.handelsnischen', {}, { anzahl: 2 }, verbindung ? { verbindung: true } : {}));
  };
  assert.deepEqual(e3.einwaende.sammle(nische(false)).einwaende, [], 'Technik darf Arbeitsblöcke in der Sperrzone haben');
  const na = e3.einwaende.sammle(nische(true)).einwaende;
  assert.deepEqual(na.map((x) => [x.von, x.an, x.regel]), [['techniker', 'konstrukteur', 'plan.geometrie']]);
  assert.match(na[0].text, /keine Arbeitsblöcke/);

  // Zone des Grobdesigners: Teile eines Abschnitts bleiben in dessen Zone
  let z = grund();
  z = aendere(z, 'grobdesigner', { art: 'setze-zone', zone: { id: 'Z1', abschnitt: 'A1', von: { x: -5, y: 0, z: -5 }, bis: { x: 5, y: 9, z: 5 } } });
  z = aendere(z, 'architekt', teil('form.zylinder', { x: 5, z: 0 }, ZYL));
  ({ einwaende } = e3.einwaende.sammle(z));
  assert.deepEqual([einwaende[0].von, einwaende[0].an, einwaende[0].ort], ['grobdesigner', 'architekt', { x: 6, y: 0, z: -1 }]);
  assert.match(einwaende[0].text, /ragt aus der Zone Z1/);
  const pz = e3.laufe(z, { architekt: () => ({ art: 'aendere-teil', id: 'T1', felder: { lage: { x: 0 } } }) });
  assert.deepEqual([pz.erledigt.length, pz.eskaliert.length], [1, 0]);

  // Rang entscheidet den Streit um dasselbe Teil: der Einwand des Techniker kommt zuerst, der des Grobdesigners wird in derselben Runde zurückgestellt
  let streit = grund();
  streit = aendere(streit, 'techniker', teil('tech.antriebsstrecke', {}, { abschnitte: 1, abstand: 7 }));
  streit = aendere(streit, 'grobdesigner', { art: 'setze-zone', zone: { id: 'Z1', abschnitt: 'A1', von: { x: -20, y: -1, z: -7 }, bis: { x: 20, y: 9, z: 7 } } });
  streit = aendere(streit, 'architekt', teil('form.zylinder', { z: -7 }, ZYL));
  const ew = e3.einwaende.sammle(streit).einwaende;
  assert.deepEqual(ew.map((x) => x.von), ['techniker', 'grobdesigner'], 'Techniker vor Grobdesigner');
  const angefragt = [];
  const rs = e3.laufe(streit, { architekt: (x) => {
    angefragt.push(x.schluessel.split('|')[1]);
    return x.schluessel.includes('|zone|') ? verschiebe(5)(x) : verschiebe(-20)(x);
  } });
  assert.deepEqual([rs.erledigt.length, rs.eskaliert.length, rs.runden], [2, 0, 2]);
  assert.deepEqual(angefragt, ['ueberschneidung', 'zone'], 'Runde 1: nur der höherrangige Einwand wird bearbeitet, Runde 2 der andere');
  const abgelehnt = rs.entwurf.bericht.filter((b) => b.art === 'abgelehnt');
  assert.equal(abgelehnt.length, 1);
  assert.match(abgelehnt[0].satz, /zurückgestellt: ein höherrangiger Einwand hat dieses Teil in dieser Runde schon geändert/);
});

test('Einwand: Runden, Änderung, Eskalation und Rückfrage', () => {
  assert.equal(e1.regelwerk.parameter('plan.runden', 'maximum'), 3);
  const e = mitUeberschneidung();

  // Eskalation: der Architekt schweigt, drei Runden lang; danach fragt der Bauleiter Jonah mit Optionen
  const stumm = e3.laufe(e, {});
  assert.deepEqual([stumm.erledigt.length, stumm.eskaliert, stumm.rueckfragen.length, stumm.runden], [0, ['E1'], 1, 3]);
  const r = stumm.rueckfragen[0];
  assert.deepEqual([r.id, r.einwand, r.ort, r.ziel], ['R1', 'E1', { x: 0, y: 0, z: -4 }, 'teil:T2']);
  assert.ok(r.optionen.length >= 3 && r.optionen.every((o) => o.id && o.text.length > 20), 'konkrete Optionen zum Anklicken');
  assert.match(r.frage, /\(bei \(0, 0, -4\), Regel plan\.geometrie\)\. Wie soll es weitergehen\?/);
  assert.equal(stumm.entwurf.einwaende[0].status, 'eskaliert');
  const arten = stumm.entwurf.bericht.map((b) => b.art);
  assert.equal(arten.filter((a) => a === 'einwand').length, 3, 'jede Runde steht im Baubericht');
  assert.deepEqual(arten.slice(-2), ['eskalation', 'rueckfrage']);
  assert.match(stumm.entwurf.bericht.at(-2).satz, /nach 3 Runden nicht gelöst; der Bauleiter fragt Jonah/);
  assert.match(berichtAlsText(stumm.entwurf), /Frage an Jonah \(R1\)/);

  // Eine Änderung, die nichts löst, verbraucht die Runden: Verschieben um einen Block bleibt überschneidend
  const zaeh = e3.laufe(e, { architekt: verschiebe(-2) });
  assert.deepEqual([zaeh.eskaliert.length, zaeh.runden], [1, 3]);

  // Runden aus den Daten: 0 Runden = sofort Eskalation, 1 Runde reicht für die einfache Lösung
  assert.deepEqual([e3.laufe(e, { architekt: verschiebe(-30) }, { maxRunden: 0 }).eskaliert, e3.laufe(e, { architekt: verschiebe(-30) }, { maxRunden: 1 }).erledigt], [['E1'], ['E1']]);

  // Fehlversuche (Recht) werden im Bericht begründet, der Einwand bleibt offen
  const falsch = e3.laufe(e, { architekt: () => ({ art: 'aendere-teil', id: 'T1', felder: { lage: { z: 50 } } }) });
  assert.equal(falsch.eskaliert.length, 1);
  assert.ok(falsch.entwurf.bericht.some((b) => b.art === 'abgelehnt' && /darf teil:T1 nicht ändern \(gehört dem techniker\)/.test(b.satz)));
  // eine gesperrte Änderung (Fixierung durch Jonah) wird ebenfalls abgelehnt
  const fix = e3.fixiere(e, 'teil:T2', 'bleibt genau hier').entwurf;
  const gesperrt = e3.laufe(fix, { architekt: verschiebe(-30) });
  assert.equal(gesperrt.eskaliert.length, 1);
  assert.ok(gesperrt.entwurf.bericht.some((b) => b.art === 'abgelehnt' && /gesperrt/.test(b.satz)));

  // deterministisch: gleicher Ablauf = gleiches Ergebnis und gleicher Bericht; das Original bleibt unverändert
  const vorher = entwurfZuJson(e);
  const a = e3.laufe(e, { architekt: verschiebe(-30) }), b = e3.laufe(e, { architekt: verschiebe(-30) });
  assert.equal(entwurfZuJson(a.entwurf), entwurfZuJson(b.entwurf));
  assert.deepEqual(a.entwurf.bericht, b.entwurf.bericht);
  assert.equal(entwurfZuJson(e), vorher);
  // ein sauberer Entwurf braucht keine Runde
  const sauber = e3.laufe(a.entwurf, {});
  assert.deepEqual([sauber.erledigt, sauber.eskaliert, sauber.runden], [[], [], 0]);
});

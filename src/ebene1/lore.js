// Ebene 1 – Lorenbewegung aus Jonahs Messungen (24.10.2026)
// Bedrock nennt zur Lorenphysik keine Zahlen. Blockwerk rechnet deshalb KEINE Physik, sondern übernimmt die gemessenen Tabellen
// aus data/regeln/lore.json (Regeln lore.*, Status „geprüft“) und urteilt damit über Bahnen: ja / nein / unklar.
// Alle Messungen starten aus dem Stand mit leerer Lore; wo eine Lore schneller ankommt, ist die Prüfung strenger als nötig, nie zu locker.
// Die Welt wird nur über Ebene 0 und die Schienen-Funktionen gelesen.

/**
 * @param {{regelwerk: import('./regelwerk.js').Regelwerk, schienen: ReturnType<typeof import('./schienen.js').erzeugeSchienen>, antrieb: ReturnType<typeof import('./antrieb.js').erzeugeAntrieb>}} quellen
 */
export function erzeugeLore({ regelwerk, schienen, antrieb }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  const auslaufTabelle = Object.entries(P('lore.auslauf', 'tabelle')).map(([n, w]) => [Number(n), w]).sort((a, b) => a[0] - b[0]);
  const saettigung = P('lore.auslauf', 'saettigung');
  const hoehenTabelle = P('lore.steighoehe', 'tabelle');
  const jaBisK = P('lore.abstand-eben', 'sicherJaBisK');
  const neinAbK = P('lore.abstand-eben', 'sicherNeinAbK');
  const rampe = {
    immer: P('lore.abstand-steigung', 'immer'),
    mitAntrieb: P('lore.abstand-steigung', 'mitAntriebErsteSchiene'),
    nieAb: P('lore.abstand-steigung', 'nieAb'),
    bisHoehe: P('lore.abstand-steigung', 'getestetBisHoehe'),
  };
  const sekundenProBlock = P('lore.fahrzeit', 'sekundenProBlock');

  /** Auslaufstrecke (Blöcke) nach n Antriebsschienen am Stück; zwischen den Messpunkten linear, über der letzten Messung gesättigt. */
  function auslauf(n) {
    if (!Number.isInteger(n) || n < 0) throw new Error('n muss eine ganze Zahl >= 0 sein');
    if (n === 0) return 0;
    const letzte = auslaufTabelle[auslaufTabelle.length - 1];
    if (n >= letzte[0]) return saettigung;
    for (let i = 0; i < auslaufTabelle.length; i++) {
      const [n1, w1] = auslaufTabelle[i];
      if (n === n1) return w1;
      if (n < n1) {
        const [n0, w0] = auslaufTabelle[i - 1];
        return w0 + ((w1 - w0) * (n - n0)) / (n1 - n0);
      }
    }
    return saettigung;
  }

  /** Steighöhe (Blöcke) nach n Antriebsschienen am Stück vor einer Rampe aus normalen Schienen; ab 8 „mindestens 7“. */
  function steighoehe(n) {
    if (!Number.isInteger(n) || n < 0) throw new Error('n muss eine ganze Zahl >= 0 sein');
    if (n === 0) return 0;
    return hoehenTabelle[String(Math.min(n, 8))];
  }

  /**
   * Kommt die Lore über `normale` normale Schienen zwischen zwei bestromten Abschnitten, nach einem Abschnitt aus `davor`
   * Antriebsschienen am Stück? 'ja', wenn die Strecke in die gemessene Auslaufstrecke passt (Jonah zählte ab dem Ende der letzten Antriebsschiene), 'nein' ab einem Block mehr als der aufgerundeten Strecke, dazwischen 'unklar'.
   */
  function luecke(normale, davor = 1) {
    const a = auslauf(davor);
    if (normale <= a) return 'ja';
    if (normale >= Math.ceil(a) + 1) return 'nein';
    return 'unklar';
  }

  /** Abstand k der Antriebsschienen (jede k-te Schiene) bei einzelnen Antriebsschienen auf ebener Strecke. */
  function abstandEben(k) {
    if (!Number.isInteger(k) || k < 1) throw new Error('k muss eine ganze Zahl >= 1 sein');
    if (k <= jaBisK) return 'ja';
    if (k >= neinAbK) return 'nein';
    return 'unklar';
  }

  /** Abstand k auf einer Rampe; `hoehe` = Rampenhöhe in Blöcken (über der getesteten Höhe: 'unklar'). */
  function abstandSteigung(k, erstePowered, hoehe = 0) {
    if (!Number.isInteger(k) || k < 1) throw new Error('k muss eine ganze Zahl >= 1 sein');
    let urteil;
    if (k <= rampe.immer) urteil = 'ja';
    else if (k >= rampe.nieAb) urteil = 'nein';
    else urteil = erstePowered && k <= rampe.mitAntrieb ? 'ja' : 'nein';
    if (urteil === 'ja' && hoehe > rampe.bisHoehe) return 'unklar';
    return urteil;
  }

  /** Richtwert für die Fahrzeit über `laenge` Blöcke bestromter Strecke (Sekunden). */
  function fahrzeit(laenge) {
    if (!(laenge >= 0)) throw new Error('Länge muss >= 0 sein');
    return Math.round(laenge * sekundenProBlock * 100) / 100;
  }

  const key = (p) => `${p.x},${p.y},${p.z}`;

  /**
   * Läuft die Schienenverbindung ab Startschiene in Fahrtrichtung ab.
   * @param {import('../ebene0/welt.js').Welt} welt
   * @param {{x:number,y:number,z:number}} start Position der Startschiene
   * @param {string} richtung Himmelsrichtung, in die die Lore die Startschiene verlässt (north/east/south/west)
   * @param {{aktiv?: Set<string>}} [optionen] aktive Antriebsschienen („x,y,z“); ohne Angabe zählt rail_data_bit
   * @returns {{schienen: {pos:object, id:string, antrieb:boolean, hoch:number}[], ende: 'ring'|'leer'|'einseitig'|'start'}}
   */
  function bahn(welt, start, richtung, { aktiv = null } = {}) {
    const s0 = schienen.schieneBei(welt, start);
    if (!s0) throw new Error(`Bei ${key(start)} liegt keine Schiene`);
    const enden0 = schienen.enden(s0.zustand);
    if (!enden0) throw new Error('Startschiene ohne rail_direction');
    let aus = enden0.find((e) => e.richtung === richtung);
    if (!aus) throw new Error(`Die Startschiene hat kein Ende nach ${richtung}`);
    const liste = [];
    const besucht = new Set();
    let aktuelle = s0;
    let ende = 'leer';
    for (;;) {
      besucht.add(key(aktuelle.pos));
      const istAntrieb = antrieb.istAntriebsschiene(aktuelle.id)
        && (aktiv ? aktiv.has(key(aktuelle.pos)) : aktuelle.zustand.rail_data_bit === true);
      const alleEnden = schienen.enden(aktuelle.zustand) ?? [];
      // hoch: +1, wenn die Lore die Schiene über das hohe Ende verlässt (steigt), −1, wenn sie über das hohe Ende hereinkommt (fällt)
      const hochAus = aus.dy === 1;
      const hochEin = alleEnden.some((e) => e.dy === 1 && !(e.richtung === aus.richtung && e.dy === aus.dy));
      liste.push({ pos: { ...aktuelle.pos }, id: aktuelle.id, antrieb: istAntrieb, hoch: hochAus ? 1 : hochEin ? -1 : 0 });
      const g = schienen.gegenstelle(welt, aktuelle.pos, aus);
      if (g.art !== 'verbunden') { ende = g.art; break; }
      const p = g.partner;
      if (besucht.has(key(p.pos))) { ende = key(p.pos) === key(s0.pos) ? 'ring' : 'schleife'; break; }
      // das andere Ende der Partnerschiene (nicht das, das zurückzeigt)
      const pEnden = schienen.enden(p.zustand) ?? [];
      const zurueck = pEnden.find((e) => {
        const gg = schienen.gegenstelle(welt, p.pos, e);
        return gg.art === 'verbunden' && key(gg.partner.pos) === key(aktuelle.pos);
      });
      const weiter = pEnden.find((e) => e !== zurueck);
      if (!zurueck || !weiter) { ende = 'einseitig'; break; }
      aktuelle = p;
      aus = weiter;
    }
    return { schienen: liste, ende };
  }

  /**
   * Urteilt über eine abgelaufene Bahn. Liefert Befunde { art, urteil: 'nein'|'unklar', index, pos, meldung }.
   * ebene Lücken: normale/unbestromte Schienen zwischen bestromten Abschnitten; Rampen: Abstand der Antriebsschienen bzw. Steighöhe.
   */
  function analysiere(b) {
    const liste = b.schienen;
    const befunde = [];
    const melde = (art, urteil, index, meldung) => befunde.push({ art, urteil, index, pos: liste[Math.min(Math.max(index, 0), liste.length - 1)].pos, meldung });
    const antriebe = liste.map((s, i) => (s.antrieb ? i : -1)).filter((i) => i >= 0);
    if (!antriebe.length) {
      melde('start', 'unklar', 0, 'Die Bahn hat keine bestromte Antriebsschiene: die Lore muss anders gestartet werden');
      return befunde;
    }
    if (antriebe[0] > 0) melde('start', 'unklar', 0, `Die ersten ${antriebe[0]} Schienen haben keinen Antrieb: die Lore muss anders gestartet werden`);

    // Abschnitte bestromter Schienen am Stück
    const laeufe = [];
    for (const i of antriebe) {
      const letzter = laeufe[laeufe.length - 1];
      if (letzter && letzter.ende === i - 1) { letzter.ende = i; letzter.laenge += 1; } else laeufe.push({ anfang: i, ende: i, laenge: 1 });
    }
    // 1. ebene Lücken (ohne Rampe dazwischen)
    for (let j = 0; j + 1 < laeufe.length; j++) {
      const von = laeufe[j], nach = laeufe[j + 1];
      const dazwischen = liste.slice(von.ende + 1, nach.anfang);
      if (dazwischen.some((s) => s.hoch !== 0)) continue; // Rampen: eigener Abschnitt
      const urteil = luecke(dazwischen.length, von.laenge);
      if (urteil === 'ja') continue;
      const stopp = Math.min(von.ende + Math.floor(auslauf(von.laenge)) + 1, nach.anfang - 1);
      melde('luecke', urteil === 'nein' ? 'nein' : 'unklar', stopp, urteil === 'nein'
        ? `Die Lore bleibt hier stehen: ${dazwischen.length} Schienen ohne Antrieb nach ${von.laenge} Antriebsschiene(n) (Auslauf höchstens ${auslauf(von.laenge)} Blöcke)`
        : `Ob die Lore ${dazwischen.length} Schienen ohne Antrieb nach ${von.laenge} Antriebsschiene(n) schafft, ist nicht gemessen`);
    }
    // 2. Rampen: zusammenhängende ansteigende Schienen
    let i = 0;
    while (i < liste.length) {
      if (liste[i].hoch <= 0) { i += 1; continue; }
      let j = i;
      while (j + 1 < liste.length && liste[j + 1].hoch > 0) j += 1;
      const hoehe = j - i + 1;
      const erste = liste[i].antrieb;
      const davor = laeufe.filter((l) => l.ende < i).pop();
      const innen = antriebe.filter((a) => a >= i && a <= j);
      if (innen.length) {
        // Abstände: Anfang der Rampe zählt als Antrieb, wenn die erste Schiene angetrieben ist; sonst zählt die letzte Antriebsschiene davor
        const punkte = [...(erste || !davor ? [] : [davor.ende]), ...innen];
        let kMax = 0, stelle = i;
        for (let p = 0; p + 1 < punkte.length; p++) if (punkte[p + 1] - punkte[p] > kMax) { kMax = punkte[p + 1] - punkte[p]; stelle = punkte[p] + 1; }
        if (kMax > 0) {
          const u = abstandSteigung(kMax, erste, hoehe);
          if (u !== 'ja') melde('rampe', u === 'nein' ? 'nein' : 'unklar', stelle, u === 'nein'
            ? `Die Lore bleibt auf der Rampe stehen: Antriebsschienen im Abstand ${kMax}${erste ? '' : ' und die erste ansteigende Schiene hat keinen Antrieb'}`
            : `Rampe über ${rampe.bisHoehe} Blöcke Höhe (${hoehe}): nicht gemessen`);
        } else if (hoehe > rampe.bisHoehe) melde('rampe', 'unklar', i, `Rampe über ${rampe.bisHoehe} Blöcke Höhe (${hoehe}): nicht gemessen`);
      } else if (davor) {
        const h = steighoehe(davor.laenge);
        if (hoehe > h + 1) melde('rampe', 'nein', i + Math.floor(h), `Die Lore kommt nur etwa ${h} Blöcke hoch (${davor.laenge} Antriebsschiene(n) davor), die Rampe ist ${hoehe} hoch`);
        else if (hoehe > h) melde('rampe', 'unklar', i + Math.floor(h), `Rampe ${hoehe} hoch, gemessene Steighöhe ${h}: knapp`);
      } else {
        melde('rampe', 'nein', i, 'Rampe ohne Antriebsschiene davor oder darin: die Lore kommt nicht hoch');
      }
      i = j + 1;
    }
    return befunde;
  }

  return { auslauf, steighoehe, luecke, abstandEben, abstandSteigung, fahrzeit, bahn, analysiere };
}

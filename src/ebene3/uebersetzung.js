// Ebene 3 – Übersetzung: aus der freigegebenen Bauspezifikation (Ebene 4, reines JSON nach dem Vokabular der Regel leser.schema) wird die Vorgabe des Ablaufs.
// Das ist Arbeit des Konstrukteurs: Der Leser sagt nur WAS und die Lage als Beziehung; Abschnitte, Hüllen, Reihenfolge und Zellen der Verbindungen legt die Planung fest.
// Fester Algorithmus: gleiche Spezifikation = gleiche Vorgabe. Alles, was sich nicht eindeutig übersetzen lässt, wird eine Rückfrage (Ids U1 …), nichts wird geraten.
// Regeln als Daten: data/regeln/planung.json (plan.uebersetzung), Vokabular: leser.schema, leser.messung (rund/eckig).

const ID = (x) => x;
const komma = (x) => String(x).replace('.', ',');
const mitte = (a, b) => a + Math.floor(b / 2);
const huelleAus = (x0, y0, z0, w, d, h) => ({ von: { x: x0, y: y0, z: z0 }, bis: { x: x0 + w - 1, y: y0 + h - 1, z: z0 + d - 1 } });
const ueberschneiden = (a, b) => ['x', 'y', 'z'].every((k) => a.von[k] <= b.bis[k] && b.von[k] <= a.bis[k]);
const norm = (w) => JSON.stringify(w ?? null, (k, v) => (Array.isArray(v) || v === null || typeof v !== 'object' ? v : Object.fromEntries(Object.keys(v).sort().filter((x) => v[x] !== undefined).map((x) => [x, v[x]]))));

/**
 * @param {{regelwerk: object, ebene2: object, techniker: object}} quellen
 */
export function erzeugeUebersetzung({ regelwerk, ebene2, techniker }) {
  const P = (name) => regelwerk.parameter('plan.uebersetzung', name);
  const rand = P('rand'), luecke = P('luecke'), toleranz = P('toleranz'), erlaubtProjekt = P('relationenProjekt'), erlaubtTeil = P('relationenTeil'), strahlen = P('strahlen');
  const alleRelationen = Object.keys(regelwerk.parameter('leser.schema', 'relationen'));
  const rund = regelwerk.parameter('leser.messung', 'bausteinform').rund;
  void ID;

  /** @param {any} spec */
  function uebersetze(spec) {
    const rueckfragen = [], hinweise = [];
    const frage = (pfad, text, optionen = []) => rueckfragen.push({ id: `U${rueckfragen.length + 1}`, pfad, regel: 'leser.uebersetzung', frage: text, optionen: [...optionen, { id: 'anders', text: 'Etwas anderes (bitte beschreiben)' }] });
    const wahl = (werte) => werte.map((w) => ({ id: `wert:${w}`, text: `„${w}“ verwenden`, wert: w }));
    const leer = () => ({ vorgabe: null, rueckfragen, hinweise });
    if (!spec || !Array.isArray(spec.teile) || !spec.teile.length || !spec.projekt?.bauplatz) { frage('', 'Die Spezifikation hat kein Projekt mit Bauplatz oder keine Teile.'); return leer(); }

    const { breite: BB, hoehe: BH, tiefe: BT } = spec.projekt.bauplatz;
    const np = { x: 0, y: 0, z: 0, ...(spec.projekt.nullpunkt ?? {}) };
    const bauplatz = huelleAus(np.x, np.y, np.z, BB, BT, BH);
    const teile = spec.teile;
    const byId = new Map(teile.map((t, i) => [t.id, { t, i }]));

    // ---- 1. Maße je Teil: Form, Bedarf, Technikstreifen, Rand ----
    const info = new Map();
    teile.forEach((t, i) => {
      const pf = `teile[${i}]`;
      const bs = t.form?.baustein, defn = ebene2.bausteine.get(bs);
      if (!defn) { frage(`${pf}.form.baustein`, `${t.name}: den Baustein „${String(bs)}“ gibt es nicht.`); return; }
      const groesse = { ...(t.form?.groesse ?? {}) };
      const ratio = t.form?.proportionen?.hoehe_zu_breite;
      const hoeheParam = defn.parameter.find((p) => p.name === 'hoehe');
      if (ratio !== undefined && hoeheParam && groesse.breite !== undefined) {
        const soll = groesse.breite * ratio;
        if (groesse.hoehe === undefined) {
          const h = Math.round(soll);
          if (h < hoeheParam.min || h > hoeheParam.max) { frage(`${pf}.form.proportionen.hoehe_zu_breite`, `${t.name}: Höhe zu Breite ${komma(ratio)} ergibt bei Breite ${groesse.breite} die Höhe ${h}; möglich sind ${hoeheParam.min} bis ${hoeheParam.max}.`); return; }
          groesse.hoehe = h;
        } else if (Math.abs(groesse.hoehe / soll - 1) > toleranz) {
          frage(`${pf}.form.proportionen.hoehe_zu_breite`, `${t.name}: Höhe ${groesse.hoehe} bei Breite ${groesse.breite} widerspricht der Proportion Höhe zu Breite ${komma(ratio)} (ergäbe ${komma(Math.round(soll * 10) / 10)}). Welche Angabe gilt?`,
            [{ id: 'masse', text: `Maße gelten (Proportion weglassen)` }, { id: 'proportion', text: `Proportion gilt (Höhe ${Math.round(soll)})`, wert: Math.round(soll) }]);
          return;
        }
      }
      let huelle;
      try { huelle = ebene2.baue(bs, groesse).platzbedarf.huelle; } catch (f) { frage(`${pf}.form.groesse`, `${t.name}: ${f.message}`); return; }
      const form = { w: huelle.bis.x - huelle.von.x + 1, d: huelle.bis.z - huelle.von.z + 1, h: huelle.bis.y - huelle.von.y + 1 };
      const bedarf = [];
      for (const f of t.funktionen ?? []) {
        if (f.art === 'handelsnischen') bedarf.push({ art: 'handelsnischen', anzahl: f.menge, ...(f.beruf !== undefined ? { beruf: f.beruf } : {}) });
        else if (f.art === 'lager') bedarf.push({ art: 'lager', sorten: f.sorten });
        else bedarf.push({ art: f.art });
      }
      let mind = null;
      try { mind = techniker.mindestmass(bedarf.map((b, k) => ({ id: `${t.id}-${k}`, ...b }))); } catch (f) { frage(`${pf}.funktionen`, `${t.name}: ${f.message}`); return; }
      const wt = mind?.breite ?? 0;
      const w0 = form.w + wt + 2 * rand;
      const W = wt ? w0 + Math.ceil(w0 / 50) : w0;
      const D = Math.max(form.d + 2 * rand, mind?.tiefe ?? 0), H = Math.max(form.h, mind?.hoehe ?? 0);
      info.set(t.id, { t, i, bs, groesse, form, bedarf, mind, wt, W, D, H, hoeheParam });
    });
    if (rueckfragen.length) return leer();

    // ---- 2. Lage: Reihenfolge der Bezüge (Wurzeln zuerst, dann nach Id) ----
    const offen = new Map(info), fertig = new Map(), reihenfolge = [];
    while (offen.size) {
      const bereit = [...offen.values()].filter((x) => x.t.lage.bezug === 'projekt' || fertig.has(x.t.lage.bezug)).sort((a, b) => (a.t.id < b.t.id ? -1 : 1));
      if (!bereit.length) { frage(`teile[${[...offen.values()][0].i}].lage.bezug`, `Die Lagebezüge von ${[...offen.keys()].sort().join(', ')} führen nicht auf den Bauplatz zurück.`); return leer(); }
      const x = bereit[0];
      offen.delete(x.t.id);
      fertig.set(x.t.id, x);
      reihenfolge.push(x);
    }
    const huellen = new Map();
    for (const x of reihenfolge) {
      const { t, i, W, D, H } = x;
      const pf = `teile[${i}].lage`;
      const rel = t.lage.relation, bezug = t.lage.bezug;
      const abstand = t.lage.abstand;
      const projekt = bezug === 'projekt';
      const erlaubt = projekt ? erlaubtProjekt : erlaubtTeil;
      if (!alleRelationen.includes(rel) || !erlaubt.includes(rel)) {
        frage(`${pf}.relation`, projekt
          ? `${t.name}: „${rel}“ passt nicht zum Bauplatz. Auf dem Bauplatz sind nur ${erlaubtProjekt.join(', ')} möglich.`
          : `${t.name}: „${rel}“ lässt sich bei „${byId.get(bezug).t.name}“ nicht übersetzen (die Hüllen dürfen sich nicht überschneiden; „innerhalb von“ und „mittig bei“ kommen später). Möglich: ${erlaubtTeil.join(', ')}.`, wahl(erlaubt.slice(0, 5)));
        continue;
      }
      let x0, y0, z0;
      if (projekt) {
        const a = abstand ?? 0;
        y0 = np.y;
        if (rel === 'mitte') { x0 = mitte(np.x, BB - W); z0 = mitte(np.z, BT - D); }
        else {
          x0 = rel.endsWith('west') ? np.x + a : np.x + BB - a - W;
          z0 = rel.includes('nord') ? np.z + a : np.z + BT - a - D;
        }
      } else {
        const h = huellen.get(bezug), bw = h.bis.x - h.von.x + 1, bd = h.bis.z - h.von.z + 1;
        const g = abstand ?? luecke;
        const cx = mitte(h.von.x, bw - W), cz = mitte(h.von.z, bd - D);
        y0 = h.von.y;
        if (rel === 'ueber') { x0 = cx; z0 = cz; y0 = h.bis.y + 1 + (abstand ?? 0); }
        else if (rel === 'unter') { x0 = cx; z0 = cz; y0 = h.von.y - H - (abstand ?? 0); }
        else if (rel.startsWith('strahl-')) {
          // mittig auf dem Strahl von der Mitte des Bezugs: so nah, dass die Hüllen mit Lücke g nicht überlappen (acht Richtungen, Richtungsvektoren als Daten)
          const [dx, dz] = strahlen[rel.slice(7)], n = Math.hypot(dx, dz);
          const bx = (h.von.x + h.bis.x) / 2, bz = (h.von.z + h.bis.z) / 2;
          for (let s = 0; s < 8192; s++) {
            const px = Math.round(bx + (dx / n) * s - (W - 1) / 2), pz = Math.round(bz + (dz / n) * s - (D - 1) / 2);
            if (px + W - 1 + g < h.von.x || px > h.bis.x + g || pz + D - 1 + g < h.von.z || pz > h.bis.z + g) { x0 = px; z0 = pz; break; }
          }
        } else if (rel.startsWith('neben')) {
          x0 = cx; z0 = cz;
          if (rel === 'neben-osten') x0 = h.bis.x + 1 + g;
          if (rel === 'neben-westen') x0 = h.von.x - g - W;
          if (rel === 'neben-norden') z0 = h.von.z - g - D;
          if (rel === 'neben-sueden') z0 = h.bis.z + 1 + g;
        } else {
          x0 = rel.endsWith('west') ? h.von.x - g - W : h.bis.x + 1 + g;
          z0 = rel.includes('nord') ? h.von.z - g - D : h.bis.z + 1 + g;
        }
      }
      const hu = huelleAus(x0, y0, z0, W, D, H);
      if (hu.von.x < bauplatz.von.x || hu.bis.x > bauplatz.bis.x || hu.von.z < bauplatz.von.z || hu.bis.z > bauplatz.bis.z || hu.bis.y > bauplatz.bis.y || hu.von.y < -64) {
        frage(`${pf}.relation`, `${t.name} braucht mit Rand und Technik ${W} × ${D} × ${H} Blöcke und läge bei (${hu.von.x}, ${hu.von.y}, ${hu.von.z}) bis (${hu.bis.x}, ${hu.bis.y}, ${hu.bis.z}); das passt nicht auf den Bauplatz (${BB} × ${BH} × ${BT}). Was soll geändert werden?`,
          [{ id: 'bauplatz', text: 'Den Bauplatz größer machen' }, { id: 'lage', text: 'Die Lage oder den Abstand ändern' }, { id: 'groesse', text: 'Das Teil kleiner machen' }]);
        continue;
      }
      for (const [id, andere] of huellen) {
        if (ueberschneiden(hu, andere)) { frage(`${pf}.relation`, `${t.name} läge mit seiner Hülle im selben Raum wie „${byId.get(id).t.name}“ (beide ${rel === 'mitte' ? 'mittig' : 'an derselben Stelle'}). Wohin soll es?`, [{ id: 'lage', text: 'Eine andere Lage oder einen anderen Abstand wählen' }]); break; }
      }
      huellen.set(t.id, hu);
    }
    if (rueckfragen.length) return leer();

    // ---- 3. Verbindungen: Hüllenrand zu Hüllenrand auf gleicher Bodenhöhe ----
    const verb = new Map(teile.map((t) => [t.id, []]));
    const seiten = new Map(teile.map((t) => [t.id, new Set()]));
    const gesehen = new Set();
    for (const t of teile) {
      (t.verbindungen ?? []).forEach((v, j) => {
        const pf = `teile[${info.get(t.id).i}].verbindungen[${j}]`;
        const schluessel = `${[t.id, v.mit].sort().join('|')}|${v.art}`;
        if (gesehen.has(schluessel)) return;
        gesehen.add(schluessel);
        const a = huellen.get(t.id), b = huellen.get(v.mit);
        const nameB = byId.get(v.mit).t.name;
        if (a.von.y !== b.von.y) { frage(pf, `${t.name} und ${nameB} stehen auf verschiedener Höhe (${a.von.y} und ${b.von.y}); ein ${v.art === 'gang' ? 'Gang' : 'Schienenweg'} verbindet nur gleiche Bodenhöhe. Treppen oder Rampen als Verbindung kommen später.`, [{ id: 'entfernen', text: 'Die Verbindung weglassen' }]); return; }
        const ax = (a.von.x + a.bis.x) / 2, az = (a.von.z + a.bis.z) / 2, bx = (b.von.x + b.bis.x) / 2, bz = (b.von.z + b.bis.z) / 2;
        const waagerecht = Math.abs(bx - ax) >= Math.abs(bz - az);
        const y = a.von.y;
        let von, nach;
        if (waagerecht) {
          const lo = Math.max(a.von.z, b.von.z), hi = Math.min(a.bis.z, b.bis.z);
          if (lo > hi) { frage(pf, `${t.name} und ${nameB} liegen nicht auf einer Linie (ihre Hüllen überlappen sich in Nord-Süd-Richtung nicht); eine gerade Verbindung ist nicht möglich.`, [{ id: 'lage', text: 'Die Lage eines der beiden Teile ändern' }]); return; }
          const z = Math.floor((lo + hi) / 2), ost = bx > ax;
          von = { x: ost ? a.bis.x : a.von.x, y, z }; nach = { x: ost ? b.von.x : b.bis.x, y, z };
          seiten.get(t.id).add(ost ? 'ost' : 'west'); seiten.get(v.mit).add(ost ? 'west' : 'ost');
        } else {
          const lo = Math.max(a.von.x, b.von.x), hi = Math.min(a.bis.x, b.bis.x);
          if (lo > hi) { frage(pf, `${t.name} und ${nameB} liegen nicht auf einer Linie (ihre Hüllen überlappen sich in Ost-West-Richtung nicht); eine gerade Verbindung ist nicht möglich.`, [{ id: 'lage', text: 'Die Lage eines der beiden Teile ändern' }]); return; }
          const x = Math.floor((lo + hi) / 2), sued = bz > az;
          von = { x, y, z: sued ? a.bis.z : a.von.z }; nach = { x, y, z: sued ? b.von.z : b.bis.z };
          seiten.get(t.id).add(sued ? 'sued' : 'nord'); seiten.get(v.mit).add(sued ? 'nord' : 'sued');
        }
        verb.get(t.id).push({ von, nach, art: v.art });
      });
    }
    if (rueckfragen.length) return leer();

    // ---- 4. Abhängigkeiten (nach): Bezug zuerst, Keller („unter“) vor dem Bezug ----
    const nach = new Map(teile.map((t) => [t.id, new Set()]));
    for (const t of teile) {
      if (t.lage.bezug === 'projekt') continue;
      if (t.lage.relation === 'unter') nach.get(t.lage.bezug).add(t.id);
      else nach.get(t.id).add(t.lage.bezug);
    }

    // ---- 5. Vorgabe ----
    const stimmungen = new Map();
    for (const t of teile) if (t.stil?.stimmung) stimmungen.set(t.stil.stimmung, (stimmungen.get(t.stil.stimmung) ?? 0) + 1);
    const gesamt = [...stimmungen.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0];
    const abschnitte = teile.map((t) => {
      const x = info.get(t.id), hu = huellen.get(t.id);
      let zonen = [{ funktion: 'optik', anteil: 100 }];
      if (x.mind) {
        const p = Math.min(99, Math.ceil((100 * x.wt) / x.W));
        zonen = seiten.get(t.id).has('west') ? [{ funktion: 'optik', anteil: 100 - p }, { funktion: 'technik', anteil: p }] : [{ funktion: 'technik', anteil: p }, { funktion: 'optik', anteil: 100 - p }];
      }
      const soll = {};
      if (rund.includes(x.bs)) soll.symmetrie = ['x', 'z'];
      const ratio = t.form.proportionen?.hoehe_zu_breite;
      if (ratio !== undefined && x.hoeheParam && x.groesse.breite !== undefined) soll.verhaeltnis = { hoehe_zu_breite: ratio, toleranz: Math.max(0.5, toleranz * x.groesse.breite * ratio) };
      hinweise.push({ pfad: `teile[${x.i}]`, text: `${t.name}: Abschnitt „${t.id}“ von (${hu.von.x}, ${hu.von.y}, ${hu.von.z}) bis (${hu.bis.x}, ${hu.bis.y}, ${hu.bis.z}), ${x.W} × ${x.D} × ${x.H} Blöcke.` });
      return {
        id: t.id, name: t.name, huelle: hu, nach: [...nach.get(t.id)].sort(),
        zonen, ...(x.bedarf.length ? { bedarf: x.bedarf } : {}),
        formen: [{ baustein: x.bs, parameter: x.groesse, zone: 'optik', anker: 'mitte', ...(Object.keys(soll).length ? { soll } : {}) }],
        ...(verb.get(t.id).length ? { verbindungen: verb.get(t.id) } : {}),
        ...(t.stil?.stimmung ? { stimmung: t.stil.stimmung } : {}),
      };
    });
    return {
      vorgabe: { name: spec.projekt.name, bauplatz: { ...spec.projekt.bauplatz }, nullpunkt: np, ...(gesamt ? { stimmung: gesamt } : {}), abschnitte },
      rueckfragen, hinweise,
    };
  }

  /** Was ändert sich zwischen zwei Vorgaben? Betroffen sind geänderte und neue Abschnitte und alle, die von ihnen abhängen. */
  function vergleicheVorgaben(alt, neu) {
    const a = new Map(alt.abschnitte.map((x) => [x.id, x])), b = new Map(neu.abschnitte.map((x) => [x.id, x]));
    const neuIds = [...b.keys()].filter((id) => !a.has(id)).sort();
    const entfernt = [...a.keys()].filter((id) => !b.has(id)).sort();
    const geaendert = [...b.keys()].filter((id) => a.has(id) && norm(a.get(id)) !== norm(b.get(id))).sort();
    const betroffen = new Set([...geaendert, ...neuIds]);
    for (let wachsen = true; wachsen;) {
      wachsen = false;
      for (const x of b.values()) if (!betroffen.has(x.id) && (x.nach ?? []).some((n) => betroffen.has(n))) { betroffen.add(x.id); wachsen = true; }
    }
    return { neu: neuIds, entfernt, geaendert, betroffen: [...betroffen].sort() };
  }

  return { uebersetze, vergleicheVorgaben };
}

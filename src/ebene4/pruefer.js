// Ebene 4 – Prüfer der Spezifikation: streng gegen das Schema. Alles Unklare wird eine Rückfrage an Jonah (mit Pfad und Optionen), nichts wird geraten.
// Fester Algorithmus: gleiche Spezifikation = gleiche Rückfragen in gleicher Reihenfolge. Regeln als Daten: data/regeln/leser.json.

const ID_MUSTER = /^[a-z0-9][a-z0-9-]*$/;
const TEIL_FELDER = ['id', 'name', 'art', 'form', 'lage', 'funktionen', 'stil', 'wichtigkeit', 'verbindungen'];
const OBER_FELDER = ['schema', 'version', 'projekt', 'teile', 'offeneFragen', 'freigabe'];

const istObjekt = (w) => w !== null && typeof w === 'object' && !Array.isArray(w);
const ganz = (n) => Number.isInteger(n);
const zahl = (n) => typeof n === 'number' && Number.isFinite(n);

/** Editierabstand (Levenshtein) für Vorschläge bei Tippfehlern. */
function abstand(a, b) {
  let vor = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const jetzt = [i];
    for (let j = 1; j <= b.length; j++) jetzt[j] = Math.min(vor[j] + 1, jetzt[j - 1] + 1, vor[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    vor = jetzt;
  }
  return vor[b.length];
}

/**
 * @param {{regelwerk: object, vokabular: ReturnType<typeof import('./vokabular.js').erzeugeVokabular>}} quellen
 */
export function erzeugePruefer({ regelwerk, vokabular: V }) {
  const vorschlaege = regelwerk.parameter('leser.pruefer', 'vorschlaege');
  const hoechstAbstand = regelwerk.parameter('leser.pruefer', 'hoechstAbstand');

  /** Die ähnlichsten erlaubten Begriffe (nach Editierabstand, dann alphabetisch). */
  function aehnliche(wert, erlaubt) {
    const s = String(wert).toLowerCase();
    return erlaubt
      .map((e) => ({ e, d: abstand(s, e.toLowerCase()) }))
      .filter((x) => x.d <= hoechstAbstand)
      .sort((x, y) => x.d - y.d || (x.e < y.e ? -1 : 1))
      .slice(0, vorschlaege)
      .map((x) => x.e);
  }

  /** @param {unknown} spec */
  function pruefe(spec) {
    const rueckfragen = [], hinweise = [];
    const frage = (pfad, regel, text, optionen = []) => {
      rueckfragen.push({ id: `Q${rueckfragen.length + 1}`, pfad, regel, frage: text, optionen: [...optionen, { id: 'anders', text: 'Etwas anderes (bitte beschreiben)' }] });
    };
    const hinweis = (pfad, text) => hinweise.push({ pfad, text });
    const wahl = (werte) => werte.map((w) => ({ id: `wert:${w}`, text: `„${w}“ verwenden`, wert: w }));
    /** Unbekannter Begriff: Frage mit den ähnlichsten erlaubten Begriffen (sonst mit allen, wenn es wenige sind). */
    const unbekannt = (pfad, regel, was, wert, erlaubt) => {
      let vor = aehnliche(wert, erlaubt);
      if (!vor.length && erlaubt.length <= 12) vor = erlaubt;
      frage(pfad, regel, `${was} „${String(wert)}“ kennt Blockwerk nicht (erlaubt: ${erlaubt.length > 14 ? `${erlaubt.slice(0, 14).join(', ')} …` : erlaubt.join(', ')}). Was ist gemeint?`, wahl(vor));
    };

    if (!istObjekt(spec)) { frage('', 'leser.schema', 'Die Spezifikation ist kein JSON-Objekt.'); return { rueckfragen, hinweise }; }
    for (const k of Object.keys(spec)) if (!OBER_FELDER.includes(k)) frage(k, 'leser.schema', `Das Feld „${k}“ kennt das Schema nicht (erlaubt: ${OBER_FELDER.join(', ')}).`, [{ id: 'entfernen', text: 'Feld weglassen' }]);
    if (spec.schema !== V.schema) frage('schema', 'leser.schema', `Die Schema-Version ist ${JSON.stringify(spec.schema)}, Blockwerk versteht Schema ${V.schema}.`, wahl([V.schema]));
    if (!ganz(spec.version) || spec.version < 1) frage('version', 'leser.schema', `Die Versionsnummer der Spezifikation ${JSON.stringify(spec.version)} ist nicht möglich (ganze Zahl ab 1; die erste Fassung ist 1).`, wahl([1]));

    // ---- Projekt ----
    const p = spec.projekt;
    if (!istObjekt(p)) frage('projekt', 'leser.schema', 'Das Projekt fehlt (Name, Bauplatzgröße).');
    else {
      if (typeof p.name !== 'string' || !p.name.trim()) frage('projekt.name', 'leser.schema', 'Das Projekt braucht einen Namen.');
      const b = p.bauplatz;
      if (!istObjekt(b)) frage('projekt.bauplatz', 'leser.schema', 'Der Bauplatz fehlt (breite, hoehe, tiefe in Blöcken).');
      else {
        for (const a of ['breite', 'hoehe', 'tiefe']) {
          const g = V.bauplatz[a];
          if (!ganz(b[a]) || b[a] < g.min || b[a] > g.max) frage(`projekt.bauplatz.${a}`, 'leser.schema', `Die Bauplatz-${a} ${JSON.stringify(b[a])} ist nicht möglich (ganze Zahl von ${g.min} bis ${g.max} Blöcke).`);
        }
      }
      if (p.nullpunkt !== undefined && !(istObjekt(p.nullpunkt) && ['x', 'y', 'z'].every((a) => ganz(p.nullpunkt[a])))) frage('projekt.nullpunkt', 'leser.schema', 'Der Nullpunkt braucht ganze Zahlen x, y, z (oder weglassen).');
      if (p.massstab !== undefined) {
        if (!zahl(p.massstab) || p.massstab <= 0) frage('projekt.massstab', 'leser.schema', `Der Maßstab ${JSON.stringify(p.massstab)} ist nicht möglich (Zahl größer 0).`);
        else if (p.massstab !== 1) hinweis('projekt.massstab', `Maßstab ${p.massstab}: nur Geometrie wird skaliert, das Menschenmaß (Türen, Gänge, Stufen) bleibt fest.`);
      }
    }

    // ---- Teile ----
    const teile = Array.isArray(spec.teile) ? spec.teile : null;
    if (!teile || !teile.length) frage('teile', 'leser.schema', 'Die Spezifikation braucht mindestens ein Teil.');
    const ids = new Map();
    (teile ?? []).forEach((t, i) => {
      if (istObjekt(t) && typeof t.id === 'string') ids.set(t.id, (ids.get(t.id) ?? 0) + 1);
    });
    const bekannteIds = [...ids.keys()].sort();

    (teile ?? []).forEach((t, i) => {
      const pf = `teile[${i}]`;
      if (!istObjekt(t)) { frage(pf, 'leser.schema', `Teil ${i + 1} ist kein Objekt.`); return; }
      // verbotene Felder (nur WAS, nie WIE), überall im Teil
      const suche = (w, pfad) => {
        if (Array.isArray(w)) w.forEach((x, j) => suche(x, `${pfad}[${j}]`));
        else if (istObjekt(w)) {
          for (const [k, x] of Object.entries(w)) {
            if (V.verboteneFelder.includes(k.toLowerCase())) frage(`${pfad}.${k}`, 'leser.nur-was', `„${k}“ beschreibt, wie gebaut wird (Koordinaten, Blöcke, Schaltungen), nicht was. Der Leser nennt nur Form, Größe, Lage als Beziehung und Funktion als Bedarf.`, [{ id: 'entfernen', text: 'Angabe weglassen' }]);
            else suche(x, `${pfad}.${k}`);
          }
        }
      };
      suche(t, pf);
      for (const k of Object.keys(t)) if (!TEIL_FELDER.includes(k) && !V.verboteneFelder.includes(k.toLowerCase())) frage(`${pf}.${k}`, 'leser.schema', `Das Feld „${k}“ kennt das Schema bei einem Teil nicht (erlaubt: ${TEIL_FELDER.join(', ')}).`, [{ id: 'entfernen', text: 'Feld weglassen' }]);

      const name = typeof t.name === 'string' && t.name ? t.name : null;
      const wer = name ?? t.id ?? `Teil ${i + 1}`;
      if (typeof t.id !== 'string' || !ID_MUSTER.test(t.id)) frage(`${pf}.id`, 'leser.schema', `Die Id von ${wer} muss aus Kleinbuchstaben, Ziffern und Bindestrichen bestehen (zum Beispiel „nordturm“).`);
      else if (ids.get(t.id) > 1) frage(`${pf}.id`, 'leser.schema', `Die Id „${t.id}“ kommt mehrfach vor; sie muss eindeutig sein.`);
      if (!name) frage(`${pf}.name`, 'leser.schema', `Teil ${i + 1} braucht einen Namen.`);
      if (!V.teilarten.includes(t.art)) unbekannt(`${pf}.art`, 'leser.schema', `Die Art von ${wer}`, t.art, V.teilarten);
      if (t.wichtigkeit === undefined) frage(`${pf}.wichtigkeit`, 'leser.schema', `Wie wichtig ist ${wer}?`, wahl(V.wichtigkeiten));
      else if (!V.wichtigkeiten.includes(t.wichtigkeit)) unbekannt(`${pf}.wichtigkeit`, 'leser.schema', `Die Wichtigkeit von ${wer}`, t.wichtigkeit, V.wichtigkeiten);

      // Form
      const f = t.form;
      if (!istObjekt(f)) frage(`${pf}.form`, 'leser.schema', `${wer} braucht eine Form (baustein, groesse).`);
      else {
        const bs = typeof f.baustein === 'string' ? V.baustein(f.baustein) : null;
        if (!bs) {
          if (typeof f.baustein === 'string' && f.baustein.startsWith('tech.')) frage(`${pf}.form.baustein`, 'leser.nur-was', `„${f.baustein}“ ist eine Schaltung. Schaltungen gehören nicht in die Spezifikation: nenne den Bedarf bei „funktionen“, der Techniker wählt die Schaltung.`, [{ id: 'entfernen', text: 'Angabe weglassen' }]);
          else unbekannt(`${pf}.form.baustein`, 'leser.schema', `Die Form von ${wer}`, f.baustein, V.bausteine.map((x) => x.id));
        } else {
          const g = f.groesse;
          if (g === undefined || (istObjekt(g) && !Object.keys(g).length)) hinweis(`${pf}.form.groesse`, `${wer}: keine Größe angegeben, es gelten die Standardwerte von ${bs.id}.`);
          else if (!istObjekt(g)) frage(`${pf}.form.groesse`, 'leser.schema', `Die Größe von ${wer} muss eine Zuordnung Parameter → Zahl sein.`);
          else {
            for (const [k, w] of Object.entries(g)) {
              const par = bs.parameter.find((x) => x.name === k && !x.liste);
              if (!par) { unbekannt(`${pf}.form.groesse.${k}`, 'leser.schema', `Der Parameter von ${bs.id}`, k, bs.parameter.filter((x) => !x.liste).map((x) => x.name)); continue; }
              if (!zahl(w) || w < par.min || w > par.max || (par.ganzzahl && !ganz(w))) frage(`${pf}.form.groesse.${k}`, 'leser.schema', `${k} = ${JSON.stringify(w)} ist bei ${bs.id} nicht möglich (${par.ganzzahl ? 'ganze Zahl' : 'Zahl'} von ${par.min} bis ${par.max}).`);
            }
          }
          const pr = f.proportionen;
          if (pr !== undefined) {
            if (!istObjekt(pr)) frage(`${pf}.form.proportionen`, 'leser.schema', `Die Proportionen von ${wer} müssen eine Zuordnung Name → Zahl sein.`);
            else for (const [k, w] of Object.entries(pr)) {
              const grenze = V.proportionen[k];
              if (!grenze) { unbekannt(`${pf}.form.proportionen.${k}`, 'leser.schema', 'Die Proportion', k, Object.keys(V.proportionen)); continue; }
              if (!zahl(w) || w < grenze.min || w > grenze.max) frage(`${pf}.form.proportionen.${k}`, 'leser.schema', `${k} = ${JSON.stringify(w)} ist nicht möglich (Zahl von ${grenze.min} bis ${grenze.max}).`);
            }
          }
        }
      }

      // Lage
      const l = t.lage;
      if (!istObjekt(l)) frage(`${pf}.lage`, 'leser.schema', `${wer} braucht eine Lage als Beziehung (bezug, relation).`);
      else {
        if (l.bezug !== 'projekt' && !ids.has(l.bezug)) {
          const opt = ['projekt', ...bekannteIds.filter((x) => x !== t.id)];
          const nah = typeof l.bezug === 'string' ? aehnliche(l.bezug, opt) : [];
          frage(`${pf}.lage.bezug`, 'leser.schema', `${wer} bezieht sich auf „${String(l.bezug)}“; ein solches Teil gibt es nicht („projekt“ meint den Bauplatz). Worauf bezieht es sich?`, wahl(nah.length ? nah : opt.slice(0, 6)));
        } else if (l.bezug === t.id) frage(`${pf}.lage.bezug`, 'leser.schema', `${wer} kann sich nicht auf sich selbst beziehen.`, wahl(['projekt']));
        if (!V.relationen[l.relation]) unbekannt(`${pf}.lage.relation`, 'leser.schema', `Die Lagebeziehung von ${wer}`, l.relation, Object.keys(V.relationen));
        if (l.abstand !== undefined && !(ganz(l.abstand) && l.abstand >= 0 && l.abstand <= V.bauplatz.breite.max)) frage(`${pf}.lage.abstand`, 'leser.schema', `Der Abstand ${JSON.stringify(l.abstand)} ist nicht möglich (ganze Zahl ab 0 in Blöcken).`);
      }

      // Funktionen (Bedarf)
      if (t.funktionen !== undefined && !Array.isArray(t.funktionen)) frage(`${pf}.funktionen`, 'leser.schema', `Die Funktionen von ${wer} müssen eine Liste sein.`);
      (Array.isArray(t.funktionen) ? t.funktionen : []).forEach((fu, j) => {
        const fp = `${pf}.funktionen[${j}]`;
        if (!istObjekt(fu)) { frage(fp, 'leser.schema', 'Eine Funktion muss ein Objekt mit „art“ sein.'); return; }
        if (!V.funktionsarten.includes(fu.art)) { unbekannt(`${fp}.art`, 'leser.schema', `Die Funktion von ${wer}`, fu.art, V.funktionsarten); return; }
        if (V.funktionenOhneModul.includes(fu.art)) { hinweis(fp, `${wer}: für „${fu.art}“ gibt es noch kein Modul; der Techniker stellt eine Schaltungsanfrage.`); return; }
        const regel = V.funktionen[fu.art];
        if (fu.art === 'handelsnischen') {
          const m = regel.menge;
          if (!ganz(fu.menge) || fu.menge < m.min || fu.menge > m.max) frage(`${fp}.menge`, 'leser.schema', `Die Zahl der Handelsnischen von ${wer} (${JSON.stringify(fu.menge)}) ist nicht möglich (ganze Zahl von ${m.min} bis ${m.max}).`);
          else {
            // das Höchstmaß je Modul hängt von der Bauart ab (wie beim Techniker: Daten plan.bedarf); unbekannte Bauart gilt als Standard
            const max = (regel.modul.bauarten?.[fu.bauart] ?? regel.modul).maximum;
            if (fu.menge > max) hinweis(fp, `${wer}: ${fu.menge} Handelsnischen werden in ${Math.ceil(fu.menge / max)} Module zu höchstens ${max} geteilt.`);
          }
          if (fu.bauart !== undefined && !regel.bauart.werte.includes(fu.bauart)) unbekannt(`${fp}.bauart`, 'leser.schema', `Die Bauart der Handelsnischen von ${wer}`, fu.bauart, regel.bauart.werte);
          if (fu.beruf !== undefined && !(ganz(fu.beruf) && fu.beruf >= regel.beruf.min && fu.beruf <= regel.beruf.max)) frage(`${fp}.beruf`, 'leser.schema', `Der Beruf ${JSON.stringify(fu.beruf)} ist nicht möglich (Nummer ${regel.beruf.min} bis ${regel.beruf.max}).`);
        } else if (fu.art === 'lager') {
          if (!Array.isArray(fu.sorten)) frage(`${fp}.sorten`, 'leser.schema', `Welche Gegenstandssorten soll das Lager von ${wer} aufnehmen${zahl(fu.menge) ? ` (genannt wurde nur die Zahl ${fu.menge})` : ''}? Blockwerk braucht die Liste, zum Beispiel „minecraft:cobblestone“.`);
          else {
            if (!fu.sorten.length || fu.sorten.length > regel.sorten.max) frage(`${fp}.sorten`, 'leser.schema', `Das Lager von ${wer} hat ${fu.sorten.length} Sorten; möglich sind ${regel.sorten.min} bis ${regel.sorten.max}.`);
            const gesehen = new Set();
            fu.sorten.forEach((s, k) => {
              if (typeof s !== 'string' || !V.gegenstand(s)) { unbekannt(`${fp}.sorten[${k}]`, 'leser.schema', 'Die Gegenstandssorte', s, typeof s === 'string' ? V.gegenstaende() : []); return; }
              if (gesehen.has(s)) frage(`${fp}.sorten[${k}]`, 'leser.schema', `Die Sorte „${s}“ steht im Lager von ${wer} doppelt.`, [{ id: 'entfernen', text: 'Doppelten Eintrag weglassen' }]);
              gesehen.add(s);
            });
            if (fu.sorten.length > regel.modul.maximum) hinweis(fp, `${wer}: ${fu.sorten.length} Sorten werden in ${Math.ceil(fu.sorten.length / regel.modul.maximum)} Lager-Module zu höchstens ${regel.modul.maximum} geteilt.`);
          }
        }
      });

      // Stil
      const st = t.stil;
      if (st !== undefined) {
        if (!istObjekt(st)) frage(`${pf}.stil`, 'leser.schema', `Der Stil von ${wer} muss ein Objekt sein.`);
        else {
          if (st.stimmung !== undefined && !V.stimmungen.includes(st.stimmung)) unbekannt(`${pf}.stil.stimmung`, 'leser.schema', `Die Stimmung von ${wer}`, st.stimmung, V.stimmungen);
          if (st.farben !== undefined && !(Array.isArray(st.farben) && st.farben.length <= V.farben.maximum && st.farben.every((c) => typeof c === 'string' && c))) frage(`${pf}.stil.farben`, 'leser.schema', `Die Farben von ${wer} müssen eine Liste von höchstens ${V.farben.maximum} Namen sein.`);
          if (st.bemerkung !== undefined && typeof st.bemerkung !== 'string') frage(`${pf}.stil.bemerkung`, 'leser.schema', `Die Bemerkung zum Stil von ${wer} muss Text sein.`);
        }
      }

      // Verbindungen
      if (t.verbindungen !== undefined && !Array.isArray(t.verbindungen)) frage(`${pf}.verbindungen`, 'leser.schema', `Die Verbindungen von ${wer} müssen eine Liste sein.`);
      (Array.isArray(t.verbindungen) ? t.verbindungen : []).forEach((v, j) => {
        const vp = `${pf}.verbindungen[${j}]`;
        if (!istObjekt(v)) { frage(vp, 'leser.schema', 'Eine Verbindung muss ein Objekt mit „mit“ und „art“ sein.'); return; }
        if (!ids.has(v.mit) || v.mit === t.id) frage(`${vp}.mit`, 'leser.schema', `${wer} soll mit „${String(v.mit)}“ verbunden werden; ein solches anderes Teil gibt es nicht.`, wahl((typeof v.mit === 'string' ? aehnliche(v.mit, bekannteIds.filter((x) => x !== t.id)) : []).slice(0, vorschlaege)));
        if (!V.verbindungsarten.includes(v.art)) unbekannt(`${vp}.art`, 'leser.schema', `Die Art der Verbindung von ${wer}`, v.art, V.verbindungsarten);
      });
    });

    // Lagebezüge: jede Kette muss beim Bauplatz enden (kein Kreis)
    const bezug = new Map((teile ?? []).filter((t) => istObjekt(t) && typeof t.id === 'string' && istObjekt(t.lage)).map((t) => [t.id, t.lage.bezug]));
    const imKreis = new Set();
    for (const start of bezug.keys()) {
      const weg = [];
      let jetzt = start;
      while (jetzt !== undefined && jetzt !== 'projekt' && bezug.has(jetzt) && !weg.includes(jetzt)) { weg.push(jetzt); jetzt = bezug.get(jetzt); }
      if (weg.includes(jetzt) && weg.length > 1) weg.slice(weg.indexOf(jetzt)).forEach((x) => imKreis.add(x));
    }
    if (imKreis.size) {
      const kette = [...imKreis].sort();
      const i = (teile ?? []).findIndex((t) => t?.id === kette[0]);
      frage(`teile[${i}].lage.bezug`, 'leser.schema', `Die Lagebezüge von ${kette.join(', ')} verweisen im Kreis aufeinander; irgendein Teil muss sich auf den Bauplatz („projekt“) beziehen.`, wahl(['projekt']));
    }

    // Fragen, die der Leser selbst gestellt hat
    if (spec.offeneFragen !== undefined && !Array.isArray(spec.offeneFragen)) frage('offeneFragen', 'leser.schema', 'Die offenen Fragen müssen eine Liste sein.');
    (Array.isArray(spec.offeneFragen) ? spec.offeneFragen : []).forEach((q, i) => {
      const text = typeof q === 'string' ? q : istObjekt(q) && typeof q.frage === 'string' ? q.frage : null;
      if (!text) frage(`offeneFragen[${i}]`, 'leser.schema', 'Eine offene Frage braucht Text.');
      else frage(`offeneFragen[${i}]`, 'leser.offene-frage', `Der Leser war unsicher: ${text}`);
    });

    return { rueckfragen, hinweise };
  }

  return { pruefe, aehnliche };
}

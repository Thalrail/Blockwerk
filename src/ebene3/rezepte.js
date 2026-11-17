// Ebene 3 – Bausteinrezepte (D2): ein Rezept setzt ein Bauwerk aus gestapelten Ebene-2-Formen („Gliedern“, von unten nach oben) zusammen.
// Die Rezepte sind Daten (data/regeln/rezepte.json, Regel rezepte.<name>); hier steht nur die feste, deterministische Auswertung. Gleiche Eingabe = gleiches Ergebnis.
// Die Spezifikation (Ebene 4) wählt nur den Namen und nennt die Außenmaße; die Glieder, ihre Maße und Lagen kennt allein dieses Rezept.

import { erzeugeGeschosse } from './geschosse.js';

const PRAEFIX = 'rezepte.';
const ganz = (n) => Number.isSafeInteger(n);
const OBJEKT = (w) => w !== null && typeof w === 'object' && !Array.isArray(w);
const ID = /^[a-z0-9-]+$/;
const SEITEN = ['nord', 'ost', 'sued', 'west'];
const WANDSEITE = { nord: 0, ost: 1, sued: 2, west: 3 }; // Drehung des Kinds: Bausteine blicken im Paket nach Norden, die Wandseite legt die Blickrichtung nach außen fest (wie in uebersetzung.js)
const NACH = 3; // höchste Vergrößerung je Maß beim Anpassen der Hülle (Breite/Tiefe: 2 × NACH Blöcke, Höhe: NACH Schichten)

/** Fehler eines Rezepts: unbekannter Name, Maße zu klein oder nicht stimmig (kein stilles Raten, die Meldung geht als Rückfrage an Jonah). */
export class RezeptFehler extends Error {
  constructor(nachricht) { super(`Rezept: ${nachricht}`); this.name = 'RezeptFehler'; }
}

/**
 * @param {{regelwerk: object, ebene2: object}} quellen
 */
export function erzeugeRezepte({ regelwerk, ebene2 }) {
  const G = erzeugeGeschosse({ ebene2 });
  const rollenErlaubt = regelwerk.parameter('plan.palette', 'rollen');
  const regeln = () => regelwerk.alle().filter((r) => r.id.startsWith(PRAEFIX));
  const namen = () => regeln().map((r) => r.id.slice(PRAEFIX.length));

  /** Prüft die Daten eines Rezepts beim Laden (ein kaputtes Rezept darf nie still falsch bauen). */
  function pruefeDaten(name, d) {
    const f = (m) => { throw new RezeptFehler(`„${name}“: ${m}`); };
    if (!ID.test(name)) f('der Name darf nur aus Kleinbuchstaben, Ziffern und Bindestrichen bestehen');
    if (!OBJEKT(d?.mindest) || !['breite', 'tiefe', 'hoehe'].every((k) => ganz(d.mindest[k]) && d.mindest[k] >= 1)) f('mindest braucht ganze breite, tiefe, hoehe ab 1');
    if (d.mindest.hoeheZuBreite !== undefined && !(Number.isFinite(d.mindest.hoeheZuBreite) && d.mindest.hoeheZuBreite > 0)) f('mindest.hoeheZuBreite muss eine Zahl über 0 sein');
    // Nur 0 oder 1: verdickt wird nur die Wand eines Glieds, eine zweiblockbreite Auflage wäre bei dünner Wand des anderen Glieds nicht garantiert.
    if (d.auflage !== undefined && d.auflage !== 0 && d.auflage !== 1) f('auflage muss 0 oder 1 sein');
    if (!Array.isArray(d.glieder) || !d.glieder.length) f('glieder fehlt');
    const ids = new Set();
    for (const g of d.glieder) {
      if (!OBJEKT(g) || typeof g.id !== 'string' || !ID.test(g.id) || ids.has(g.id)) f(`Glied-Id fehlt, ungültig oder doppelt (${String(g?.id)})`);
      ids.add(g.id);
      const b = ebene2.bausteine.get(g.baustein);
      if (!b || !g.baustein.startsWith('form.')) f(`Glied ${g.id}: ${String(g.baustein)} ist keine Form`);
      for (const p of ['breite', 'tiefe', 'hoehe', 'wandstaerke']) if (!b.parameter.some((x) => x.name === p)) f(`Glied ${g.id}: ${g.baustein} hat keinen Parameter „${p}“`);
      if (!OBJEKT(g.einzug) || !(Number.isFinite(g.einzug.anteil) && g.einzug.anteil >= 0 && g.einzug.anteil < 0.5) || !(ganz(g.einzug.min) && g.einzug.min >= 0)) f(`Glied ${g.id}: einzug braucht anteil (0 bis unter 0,5) und min (ganz, ab 0)`);
      if (!(ganz(g.wandstaerke) && g.wandstaerke >= 0)) f(`Glied ${g.id}: wandstaerke muss eine ganze Zahl ab 0 sein`);
      const h = g.hoehe;
      const arten = OBJEKT(h) ? ['anteil', 'zuBreite', 'rest'].filter((k) => h[k] !== undefined) : [];
      if (arten.length !== 1) f(`Glied ${g.id}: hoehe braucht genau eines von anteil, zuBreite, rest`);
      if (!(Number.isFinite(h[arten[0]]) && h[arten[0]] > 0)) f(`Glied ${g.id}: hoehe.${arten[0]} muss eine Zahl über 0 sein`);
      if (arten[0] === 'rest' && (h.min !== undefined || h.max !== undefined || h.maxAnteil !== undefined)) f(`Glied ${g.id}: hoehe.min, max und maxAnteil gibt es nur bei anteil und zuBreite (Restglieder teilen den Rest nach Gewicht)`);
      if (arten[0] !== 'rest' && ((h.min !== undefined && !(ganz(h.min) && h.min >= 1)) || (h.max !== undefined && !(ganz(h.max) && h.max >= (h.min ?? 1))))) f(`Glied ${g.id}: hoehe.min/max ungültig`);
      if (h.maxAnteil !== undefined && !(Number.isFinite(h.maxAnteil) && h.maxAnteil > 0 && h.maxAnteil <= 1)) f(`Glied ${g.id}: hoehe.maxAnteil muss eine Zahl über 0 bis 1 sein`);
      if (g.rollen !== undefined && !(OBJEKT(g.rollen) && Object.entries(g.rollen).every(([von, nach]) => rollenErlaubt.includes(von) && rollenErlaubt.includes(nach)))) f(`Glied ${g.id}: rollen ordnet nur Rollen (${rollenErlaubt.join(', ')}) einander zu`);
    }
    if (!d.glieder.some((g) => g.hoehe.rest !== undefined)) f('mindestens ein Glied braucht hoehe.rest (sonst ergibt die Summe nicht die Gesamthöhe)');
    if (d.merkmale !== undefined) pruefeMerkmale(name, d, f);
  }

  /** Daten der optionalen Merkmale (Eingang, Fensterformen): jede Angabe wird beim Laden geprüft, nichts davon rät die Auswertung. */
  function pruefeMerkmale(name, d, f) {
    const m = d.merkmale;
    if (!OBJEKT(m) || Object.keys(m).some((k) => !['eingang', 'fenster', 'geschosse'].includes(k))) f('merkmale darf nur eingang, fenster und geschosse enthalten (die Treppenformen stehen in geschosse.formen.*.treppen)');
    const gliedIds = new Set(d.glieder.map((g) => g.id));
    const seiten = (x, wo) => { if (!Array.isArray(x) || !x.length || x.some((q) => !SEITEN.includes(q)) || new Set(x).size !== x.length) f(`${wo}: Seiten aus ${SEITEN.join(', ')} (ohne Doppelte)`); };
    const baustein = (id, wo, params) => {
      const b = ebene2.bausteine.get(id);
      if (!b || id.startsWith('form.')) f(`${wo}: ${String(id)} ist kein Bauelement`);
      for (const p of params) if (!b.parameter.some((x) => x.name === p)) f(`${wo}: ${id} hat keinen Parameter „${p}“`);
    };
    // Jeder Wert aus den Daten muss in den Bereich des Bauelement-Parameters passen (ganzzahlig, min bis max), sonst scheitert erst die Planung.
    const imBereich = (id, name, wert, wo) => {
      const p = ebene2.bausteine.get(id).parameter.find((x) => x.name === name);
      if (!Number.isFinite(wert) || (p.ganzzahl && !Number.isInteger(wert)) || wert < p.min || wert > p.max) f(`${wo}: ${name} = ${String(wert)} passt nicht zu ${id} (${p.min} bis ${p.max})`);
    };
    const paritaet = (x, wo, id, name) => {
      if (!OBJEKT(x) || !ganz(x.ungerade) || !ganz(x.gerade) || x.ungerade < 1 || x.gerade < 1) f(`${wo}: braucht ganze Zahlen ab 1 für ungerade und gerade Breite der jeweiligen Wand`);
      imBereich(id, name, x.ungerade, wo); imBereich(id, name, x.gerade, wo);
    };
    const e = m.eingang;
    if (e !== undefined) {
      if (!OBJEKT(e)) f('merkmale.eingang muss ein Objekt sein');
      seiten(e.seiten, 'merkmale.eingang.seiten');
      if (!gliedIds.has(e.glied) || d.glieder.find((g) => g.id === e.glied).baustein !== 'form.zylinder') f('merkmale.eingang.glied muss ein Zylinder-Glied des Rezepts sein');
      baustein(e.baustein, 'merkmale.eingang.baustein', ['fluegel', 'tiefe']);
      paritaet(e.fluegel, 'merkmale.eingang.fluegel', e.baustein, 'fluegel');
      if (!(ganz(e.sockelMindesthoehe) && e.sockelMindesthoehe >= 3)) f('merkmale.eingang.sockelMindesthoehe: ganze Zahl ab 3 (zwei Blöcke Tür und mindestens ein Block Sturz)');
      if (!OBJEKT(e.tuer) || !Array.isArray(e.tuer.nichtPerHand) || e.tuer.nichtPerHand.some((x) => typeof x !== 'string' || !x) || !['ungeprueft', 'geprueft'].includes(e.tuer.status) || typeof e.tuer.quelle !== 'string' || !/^https?:\/\/\S+$/.test(e.tuer.quelle)) f('merkmale.eingang.tuer braucht nichtPerHand (Liste), status und quelle (nur die Adresse, Erläuterungen gehören in hinweis)');
    }
    const fe = m.fenster;
    if (fe !== undefined) {
      if (!OBJEKT(fe) || !OBJEKT(fe.formen) || !Object.keys(fe.formen).length) f('merkmale.fenster.formen braucht mindestens eine Fensterform');
      for (const [fn, fo] of Object.entries(fe.formen)) {
        const wo = `merkmale.fenster.formen.${fn}`;
        if (!ID.test(fn) || !OBJEKT(fo) || typeof fo.titel !== 'string') f(`${wo}: Name (Kleinbuchstaben) und titel nötig`);
        if (!OBJEKT(fo.parameter) || !ganz(fo.parameter.hoehe) || fo.parameter.hoehe < 1) f(`${wo}.parameter: braucht ein Objekt mit ganzer hoehe ab 1`);
        baustein(fo.baustein, wo, [...Object.keys(fo.parameter), 'breite', 'tiefe']);
        for (const [k, v] of Object.entries(fo.parameter)) imBereich(fo.baustein, k, v, `${wo}.parameter`);
        paritaet(fo.breite, `${wo}.breite`, fo.baustein, 'breite');
        if (!Array.isArray(fo.glieder) || !fo.glieder.length || fo.glieder.some((g) => !gliedIds.has(g) || d.glieder.find((x) => x.id === g).baustein !== 'form.zylinder')) f(`${wo}.glieder: Zylinder-Glieder des Rezepts`);
        // Die Auswertung nimmt das erste Glied als untere, das letzte als obere Grenze: die Liste muss in der Reihenfolge des Rezepts (von unten nach oben) stehen, ohne Doppelte
        const stelle = fo.glieder.map((g) => d.glieder.findIndex((x) => x.id === g));
        if (stelle.some((q, i) => i > 0 && q <= stelle[i - 1])) f(`${wo}.glieder: in der Reihenfolge des Rezepts (von unten nach oben), ohne Doppelte`);
        for (const k of ['geschoss', 'schwelle', 'randUnten', 'randOben']) if (!(ganz(fo[k]) && fo[k] >= (k === 'geschoss' ? 1 : 0))) f(`${wo}.${k}: ganze Zahl`);
        if (!Array.isArray(fo.seitenfolge) || !fo.seitenfolge.length) f(`${wo}.seitenfolge fehlt`);
        fo.seitenfolge.forEach((q, i) => seiten(q, `${wo}.seitenfolge[${i}]`));
      }
    }
    const ge = m.geschosse;
    if (ge !== undefined) {
      if (!OBJEKT(ge) || !OBJEKT(ge.formen) || !Object.keys(ge.formen).length) f('merkmale.geschosse.formen braucht mindestens eine Geschossform');
      for (const [gn, go] of Object.entries(ge.formen)) {
        const wo = `merkmale.geschosse.formen.${gn}`;
        if (!ID.test(gn) || !OBJEKT(go) || typeof go.titel !== 'string' || !go.titel) f(`${wo}: Name (Kleinbuchstaben) und titel nötig`);
        if (!(ganz(go.etage) && go.etage >= 5 && go.etage <= 16)) f(`${wo}.etage: ganze Zahl von 5 bis 16 (mindestens 4 lichte Höhe und 1 Block Decke)`);
        if (!(ganz(go.obersteMindestlicht) && go.obersteMindestlicht >= 3 && go.obersteMindestlicht <= go.etage - 1)) f(`${wo}.obersteMindestlicht: ganze Zahl ab 3 (Kopffreiheit auf der obersten Ebene), höchstens die lichte Höhe`);
        if (!(ganz(go.hoechstZellen) && go.hoechstZellen >= 1000)) f(`${wo}.hoechstZellen: ganze Zahl ab 1000 (größtes Bauwerk, für das die Geschosse geplant werden: Breite × Tiefe × Höhe)`);
        if (!OBJEKT(go.fenster) || !(ganz(go.fenster.schwelleAbBoden) && go.fenster.schwelleAbBoden >= 0 && go.fenster.schwelleAbBoden <= go.etage - 3)) f(`${wo}.fenster.schwelleAbBoden: ganze Zahl ab 0 innerhalb der Etage`);
        const tr = go.treppen;
        if (!OBJEKT(tr) || !OBJEKT(tr.formen) || !Object.keys(tr.formen).length) f(`${wo}.treppen.formen braucht mindestens eine Treppenform`);
        if (!Array.isArray(tr.auto) || !tr.auto.length || tr.auto.some((q) => !Object.hasOwn(tr.formen, q)) || tr.auto.includes('leiter')) f(`${wo}.treppen.auto: Treppenformen aus formen, nie die Leiter (die gilt nur bei ausdrücklicher Wahl)`);
        for (const [tn, to] of Object.entries(tr.formen)) {
          const w2 = `${wo}.treppen.formen.${tn}`;
          if (!ID.test(tn) || tn === 'auto' || !OBJEKT(to) || !['wendel', 'gerade', 'leiter'].includes(to.art) || typeof to.titel !== 'string' || !to.titel) f(`${w2}: Name (nicht „auto“), art (wendel, gerade, leiter) und titel nötig`);
          if (!Array.isArray(to.begehbar) || !to.begehbar.length || to.begehbar.some((q) => !['spieler', 'dorfbewohner', 'baby'].includes(q))) f(`${w2}.begehbar: Liste aus spieler, dorfbewohner, baby`);
          const b = ebene2.bausteine.get(to.baustein);
          if (!b || to.baustein.startsWith('form.')) f(`${w2}.baustein: ${String(to.baustein)} ist kein Bauelement`);
          if (to.art === 'wendel') {
            if (!Array.isArray(to.radien) || !to.radien.length) f(`${w2}.radien: Liste ganzer Radien`);
            for (const r of to.radien) imBereich(to.baustein, 'radius', r, w2);
            imBereich(to.baustein, 'stufen', go.etage + 1, w2);
          } else if (to.art === 'gerade') { imBereich(to.baustein, 'stufen', go.etage, w2); imBereich(to.baustein, 'breite', 1, w2); }
          else imBereich(to.baustein, 'hoehe', go.etage, w2);
        }
      }
    }
  }
  for (const n of namen()) pruefeDaten(n, regelwerk.regel(PRAEFIX + n).parameter);

  /** Die Daten des Rezepts; unbekannter Name → RezeptFehler mit den bekannten Namen. */
  function rezept(name) {
    if (typeof name !== 'string' || !regelwerk.hat(PRAEFIX + name)) throw new RezeptFehler(`„${String(name)}“ kennt Blockwerk nicht (bekannt: ${namen().join(', ')})`);
    return regelwerk.regel(PRAEFIX + name).parameter;
  }

  /** Höhen der Glieder (Summe = Gesamthöhe): feste zuerst, der Rest nach Gewicht (größter Bruchteil, bei Gleichstand das untere Glied). */
  function hoehen(name, d, b, H, ueber = {}) {
    const h = new Array(d.glieder.length).fill(0);
    d.glieder.forEach((g, i) => {
      const q = g.hoehe;
      if (q.rest !== undefined) return;
      const roh = Math.round(q.anteil !== undefined ? q.anteil * H : q.zuBreite * b[i]);
      const oben = Math.min(q.max ?? Infinity, q.maxAnteil !== undefined ? Math.floor(q.maxAnteil * H) : Infinity);
      h[i] = Math.max(q.min ?? 1, ueber[g.id] ?? 0, Math.min(oben, roh)); // das Mindestmaß geht vor (ein Merkmal kann es anheben, z. B. der Sturz über der Tür)
    });
    const rest = d.glieder.map((g, i) => (g.hoehe.rest !== undefined ? i : -1)).filter((i) => i >= 0);
    const uebrig = H - h.reduce((s, x) => s + x, 0);
    if (uebrig < rest.length) throw new RezeptFehler(`„${name}“ braucht bei der Höhe ${H} mehr Platz: für die Glieder mit Restgewicht bleiben nur ${Math.max(0, uebrig)} Schichten`);
    const summe = rest.reduce((s, i) => s + d.glieder[i].hoehe.rest, 0);
    const teile = rest.map((i) => ({ i, a: Math.floor((uebrig * d.glieder[i].hoehe.rest) / summe), bruch: ((uebrig * d.glieder[i].hoehe.rest) % summe) / summe }));
    let frei = uebrig - teile.reduce((s, t) => s + t.a, 0);
    for (const t of [...teile].sort((p, q) => q.bruch - p.bruch || p.i - q.i)) if (frei > 0) { t.a++; frei--; }
    // Bekäme ein Restglied keine Schicht, obwohl der Platz für eine je Glied reicht (uebrig >= Anzahl, oben geprüft), geben die Glieder ab, die mehr als eine haben (größte zuerst, bei Gleichstand das untere)
    for (const t of teile) {
      while (t.a < 1) {
        const geber = [...teile].filter((x) => x.a > 1).sort((p, q) => q.a - p.a || p.i - q.i)[0];
        geber.a--; t.a++;
      }
    }
    for (const t of teile) {
      if (t.a < 1) throw new RezeptFehler(`„${name}“ braucht bei der Höhe ${H} mehr Platz: Glied ${d.glieder[t.i].id} bekäme keine Schicht`);
      h[t.i] = t.a;
    }
    return h;
  }

  /**
   * Parameter eines Glieds, dessen echte Hülle (Ebene 2) genau das Soll-Maß b × t × h trifft. Runde Hohlformen mit Spitze (Kegel) bleiben unten und oben schmaler als ihre Parameter;
   * deshalb werden Breite und Tiefe um gerade Zahlen (Parität bleibt) und die Höhe um ganze Schichten vergrößert, die kleinste Vergrößerung zuerst. Trifft keine, ist das Rezept dafür nicht anwendbar.
   */
  function passend(name, g, b, t, h, wand) {
    const stufen = [];
    for (let j = 0; j <= NACH; j++) for (let kx = 0; kx <= NACH; kx++) for (let kz = 0; kz <= NACH; kz++) stufen.push({ j, kx, kz });
    stufen.sort((p, q) => p.j + p.kx + p.kz - (q.j + q.kx + q.kz) || p.j - q.j || p.kx - q.kx || p.kz - q.kz);
    let letzte = '';
    for (const s of stufen) {
      const parameter = { breite: b + 2 * s.kx, tiefe: t + 2 * s.kz, hoehe: h + s.j, wandstaerke: wand };
      let hu;
      try { hu = ebene2.baue(g.baustein, parameter).platzbedarf.huelle; } catch (f) { letzte = f.message; continue; }
      const maß = [hu.bis.x - hu.von.x + 1, hu.bis.z - hu.von.z + 1, hu.bis.y - hu.von.y + 1];
      if (maß[0] === b && maß[1] === t && maß[2] === h) return parameter;
      letzte = `Hülle ${maß.join(' × ')}`;
    }
    throw new RezeptFehler(`„${name}“, Glied ${g.id}: ${g.baustein} lässt sich bei ${b} × ${t} × ${h} Blöcken nicht auf das Soll-Maß bringen (${letzte}); die Außenmaße etwas ändern`);
  }

  /**
   * Wendet ein Rezept auf die Außenmaße an.
   * @param {string} name Rezeptname (Regel rezepte.<name>)
   * @param {{breite: number, tiefe: number, hoehe: number}} groesse Außenhülle des fertigen Bauwerks in Blöcken
   * @param {string} [praefix] Vorsatz der stabilen Kennungen der Teile (`<praefix>.<glied>`), Standard der Rezeptname
   * @returns {{rezept: string, huelle: {breite: number, tiefe: number, hoehe: number}, teile: {glied: string, ref: string, baustein: string, parameter: object, versatz: {x: number, y: number, z: number}, rollen?: object}[]}}
   */
  function wendeRezeptAn(name, groesse, praefix = name, merkmale = {}) {
    const d = rezept(name);
    const mm = waehleMerkmale(name, d, merkmale);
    const { breite: B, tiefe: T, hoehe: H } = groesse ?? {};
    if (![B, T, H].every(ganz)) throw new RezeptFehler(`„${name}“ braucht ganze Außenmaße breite, tiefe und hoehe`);
    const m = d.mindest;
    const hoeheMin = Math.max(m.hoehe, Math.ceil((m.hoeheZuBreite ?? 0) * Math.max(B, T)));
    if (B < m.breite || T < m.tiefe || H < hoeheMin) throw new RezeptFehler(`„${name}“ braucht mindestens ${m.breite} × ${m.tiefe} × ${hoeheMin} Blöcke (Breite × Tiefe × Höhe${m.hoeheZuBreite ? `; die Höhe mindestens ${m.hoeheZuBreite} × die größere Breite` : ''}); angegeben sind ${B} × ${T} × ${H}`);
    // Einzug je Seite: Breite und Tiefe ändern sich nur um gerade Zahlen, deshalb bleibt die Parität (Mitte auf einem Block oder zwischen zwei Blöcken) und damit die Mittigkeit
    const ex = d.glieder.map((g) => Math.max(g.einzug.min, Math.round(g.einzug.anteil * B)));
    const ez = d.glieder.map((g) => Math.max(g.einzug.min, Math.round(g.einzug.anteil * T)));
    const b = ex.map((e) => B - 2 * e), t = ez.map((e) => T - 2 * e);
    if (b.some((x) => x < 1) || t.some((x) => x < 1)) throw new RezeptFehler(`„${name}“: bei ${B} × ${T} Blöcken würde ein Glied kein Maß mehr haben`);
    if (Math.max(...b) !== B || Math.max(...t) !== T) throw new RezeptFehler(`„${name}“: kein Glied füllt die Außenmaße ${B} × ${T}`);
    const h = hoehen(name, d, b, H, mm.eingang ? { [d.merkmale.eingang.glied]: d.merkmale.eingang.sockelMindesthoehe } : {});
    // Stufen schließen: wo sich der Einzug zwischen zwei Gliedern ändert, muss die Wand des tragenden (Verjüngung) oder des auskragenden Glieds (Auskragung) mindestens so dick sein wie der Unterschied
    // plus die Auflage (Rezeptdatum `auflage`, Standard 0): mit 1 liegt das obere Glied auf dem Ring des unteren auf, statt nur an dessen Innenkante zu hängen
    const wand = d.glieder.map((g) => g.wandstaerke);
    for (let i = 1; i < d.glieder.length; i++) {
      const dx = ex[i] - ex[i - 1], dz = ez[i] - ez[i - 1], diff = Math.max(Math.abs(dx), Math.abs(dz));
      const traeger = dx + dz > 0 ? i - 1 : i; // oben schmaler: das untere Glied trägt; oben breiter: das obere kragt aus
      wand[traeger] = Math.max(wand[traeger], diff + (d.auflage ?? 0));
    }
    const genutzt = new Set([...(mm.eingang ? [d.merkmale.eingang.glied] : []), ...(mm.fenster ? d.merkmale.fenster.formen[mm.fenster].glieder : [])]);
    let y = 0;
    const teile = d.glieder.map((g, i) => {
      const parameter = { ...passend(name, g, b[i], t[i], h[i], wand[i]), ...(genutzt.has(g.id) ? { wandzonen: 1 } : {}) }; // nur Glieder, die ein Merkmal trägt, bieten Wandzonen (die Blöcke bleiben gleich)
      const teil = { glied: g.id, ref: `${praefix}.${g.id}`, baustein: g.baustein, parameter, versatz: { x: 0, y, z: 0 }, ...(g.rollen ? { rollen: { ...g.rollen } } : {}) };
      y += h[i];
      return teil;
    });
    // Geschosse (D4): Decken und eine durchgehende Treppe, gegen die echte Geometrie geplant (keine Schätzung); die Glieder bekommen die internen Parameter erst danach
    let geschosse = null;
    if (mm.geschosse) {
      const fehler = (pfad, text) => { const f = new RezeptFehler(text); f.pfad = pfad; throw f; };
      const sockel = mm.eingang ? teile.find((q) => q.glied === d.merkmale.eingang.glied) : null;
      const eingang = mm.eingang ? { seite: mm.eingang, breite: ((mm.eingang === 'nord' || mm.eingang === 'sued' ? sockel.parameter.breite : sockel.parameter.tiefe) % 2 === 0 ? d.merkmale.eingang.fluegel.gerade : d.merkmale.eingang.fluegel.ungerade) } : null;
      geschosse = G.plane({ name, form: d.merkmale.geschosse.formen[mm.geschosse], wahl: mm.treppe ?? 'auto', teile, praefix, eingang, fehler });
      for (const q of teile) {
        const deck = geschosse.decken.get(q.glied);
        if (deck) q.parameter = { ...q.parameter, deckenAnzahl: deck.anzahl, deckenErste: deck.erste, deckenAbstand: geschosse.etage, deckenLoecher: deck.loecher };
        if (geschosse.traegerGlieder.has(q.glied)) q.parameter = { ...q.parameter, innenzone: 1 };
      }
    }
    const kinder = (mm.eingang || mm.fenster) ? baueKinder(name, d, mm, teile, praefix, geschosse) : [];
    if (geschosse) kinder.push(...geschosse.kinder);
    return {
      rezept: name, huelle: { breite: B, tiefe: T, hoehe: H }, teile, ...(kinder.length ? { kinder } : {}),
      ...(geschosse ? { geschosse: { form: geschosse.form, treppe: geschosse.art, etagen: geschosse.n, obersteEbene: geschosse.obersteEbene, begehbar: geschosse.begehbar, hinweise: geschosse.hinweise } } : {}),
    };
  }

  /** Prüft die gewählten Merkmale gegen die Rezeptdaten (unbekannte Werte nennen die möglichen) und gibt { eingang: seite|null, fenster: form|null } zurück. */
  function waehleMerkmale(name, d, merkmale) {
    const fehler = (pfad, text) => { const f = new RezeptFehler(text); f.pfad = pfad; throw f; };
    const m = merkmale === undefined ? {} : merkmale; // nur ein fehlendes Feld heißt „keine Merkmale“; null oder ein anderer Typ bekommt die Rückfrage
    if (!OBJEKT(m)) fehler('merkmale', `„${name}“: merkmale muss eine Zuordnung sein (eingang, fenster, geschosse, treppe)`);
    const erg = { eingang: null, fenster: null, geschosse: null, treppe: null };
    const gewaehlt = Object.keys(m).filter((k) => m[k] !== undefined);
    if (gewaehlt.length && d.merkmale === undefined) fehler('merkmale', `„${name}“ bietet keine Merkmale (Eingang, Fenster, Geschosse)`);
    for (const k of gewaehlt) if (!['eingang', 'fenster', 'geschosse', 'treppe'].includes(k)) fehler(`merkmale.${k}`, `„${name}“ kennt das Merkmal „${k}“ nicht (möglich: eingang, fenster, geschosse, treppe)`);
    if (m.eingang !== undefined) {
      if (!d.merkmale.eingang) fehler('merkmale.eingang', `„${name}“ bietet keinen Eingang`);
      if (!d.merkmale.eingang.seiten.includes(m.eingang)) fehler('merkmale.eingang', `„${name}“: der Eingang „${String(m.eingang)}“ ist keine mögliche Seite (möglich: ${d.merkmale.eingang.seiten.join(', ')})`);
      erg.eingang = m.eingang;
    }
    if (m.fenster !== undefined) {
      const formen = Object.keys(d.merkmale?.fenster?.formen ?? {});
      if (!formen.includes(m.fenster)) fehler('merkmale.fenster', `„${name}“: die Fensterform „${String(m.fenster)}“ gibt es nicht (möglich: ${formen.join(', ') || 'keine'})`);
      erg.fenster = m.fenster;
    }
    if (m.geschosse !== undefined) {
      const formen = Object.keys(d.merkmale?.geschosse?.formen ?? {});
      if (!formen.includes(m.geschosse)) fehler('merkmale.geschosse', `„${name}“: die Geschossform „${String(m.geschosse)}“ gibt es nicht (möglich: ${formen.join(', ') || 'keine'})`);
      erg.geschosse = m.geschosse;
    }
    if (m.treppe !== undefined) {
      if (m.geschosse === undefined) fehler('merkmale.treppe', `„${name}“: Die Treppenform gilt nur zusammen mit Geschossen. Entweder Geschosse wählen oder die Treppenform weglassen.`);
      const moeglich = ['auto', ...Object.keys(d.merkmale.geschosse.formen[m.geschosse].treppen.formen)];
      if (!moeglich.includes(m.treppe)) fehler('merkmale.treppe', `„${name}“: die Treppenform „${String(m.treppe)}“ gibt es nicht (möglich: ${moeglich.join(', ')})`);
      erg.treppe = m.treppe;
    }
    return erg;
  }

  /**
   * Eingang und Fenster als Kinder der Glieder (Einbau-Architektur): Träger, Wandzone, Anker Mitte, Versatz nach oben, Drehung nach außen.
   * Die Wanddicke (tiefe) wird an den echten Blöcken des Trägers gemessen: von der äußersten Zellschicht nach innen bis zur ersten freien Zelle, an allen Spalten und Zeilen der Öffnung.
   * Gerade Breite → zwei Spalten um die Mitte (die Mitte liegt zwischen zwei Blöcken), ungerade → eine; so bleibt jede Öffnung symmetrisch.
   */
  function baueKinder(name, d, mm, teile, praefix, geschosse = null) {
    const kinder = [];
    const nachGlied = new Map(teile.map((t) => [t.glied, t]));
    const messe = (glied, seite, spalten, y0, zeilen, wo) => {
      const t = nachGlied.get(glied);
      const paket = ebene2.baue(t.baustein, t.parameter);
      const z = paket.einbauzonen.find((q) => q.id === `wand-${seite}`);
      const belegt = new Set(paket.bloecke.map((q) => `${q.x},${q.y},${q.z}`));
      const quer = seite === 'nord' || seite === 'sued';
      const mitte = quer ? z.von.x + Math.floor((z.bis.x - z.von.x) / 2) : z.von.z + Math.floor((z.bis.z - z.von.z) / 2);
      const aussen = { nord: z.von.z, sued: z.bis.z, west: z.von.x, ost: z.bis.x }[seite];
      const schritt = { nord: 1, sued: -1, west: 1, ost: -1 }[seite];
      const schluessel = (a, tiefe, y) => (quer ? `${a},${y},${aussen + schritt * tiefe}` : `${aussen + schritt * tiefe},${y},${a}`);
      let tiefe = 0;
      for (let i = 0; i < spalten; i++) for (let j = 0; j < zeilen; j++) {
        const y = z.von.y + y0 + j;
        let k = 0;
        while (belegt.has(schluessel(mitte + i, k, y))) k++;
        if (k === 0) throw new RezeptFehler(`„${name}“: ${wo} trifft an der Seite ${seite} keinen Wandblock (Zeile ${y0 + j} des Glieds ${glied}); die Maße etwas ändern`);
        tiefe = Math.max(tiefe, k);
      }
      return tiefe;
    };
    const paritaetBreite = (glied, seite, p) => ((seite === 'nord' || seite === 'sued' ? nachGlied.get(glied).parameter.breite : nachGlied.get(glied).parameter.tiefe) % 2 === 0 ? p.gerade : p.ungerade);
    if (mm.eingang) {
      const e = d.merkmale.eingang, seite = mm.eingang;
      const fluegel = paritaetBreite(e.glied, seite, e.fluegel);
      const tiefe = messe(e.glied, seite, fluegel, 0, 2, 'der Eingang');
      kinder.push({ ref: `${praefix}.eingang`, name: 'Eingang', baustein: e.baustein, parameter: { fluegel, tiefe }, traeger: nachGlied.get(e.glied).ref, einbau: { zone: `wand-${seite}`, anker: 'mitte', versatz: { x: 0, y: 0, z: 0 }, drehung: WANDSEITE[seite] } });
    }
    if (mm.fenster) {
      const fo = d.merkmale.fenster.formen[mm.fenster], hoehe = fo.parameter.hoehe;
      const erste = nachGlied.get(fo.glieder[0]), letztes = nachGlied.get(fo.glieder.at(-1));
      const zaehler = new Map();
      let gesetzteReihen = 0;
      // Ohne Geschosse gilt der Rhythmus der Fensterform (ab dem ersten Schaftglied). Mit Geschossen richten sich die Fenster an den Decken aus: je Etage die Brüstung über dem Fußboden (Daten: geschosse.fenster.schwelleAbBoden).
      const etage = geschosse?.etage, schwelleBoden = geschosse ? d.merkmale.geschosse.formen[mm.geschosse].fenster.schwelleAbBoden : 0;
      for (let k = 0; k < 1000; k++) { // die Obergrenze ist nur ein Netz: die Schleife endet über die Höhe des letzten Glieds
        if (geschosse && k > geschosse.n) break; // nur auf wirklich geplanten Ebenen (Erdgeschoss bis oberste Ebene), nie auf Böden, die es nicht gibt
        const yk = geschosse ? k * etage + schwelleBoden : erste.versatz.y + fo.schwelle + k * fo.geschoss; // absolute Schicht des Fensterfußes
        if (yk + hoehe - 1 > letztes.versatz.y + letztes.parameter.hoehe - 1) break;
        // das Fenster muss ganz in einem Glied liegen, mit Randzeilen zu dessen Unter- und Oberkante (dort liegt das nächste Glied auf: tragender Übergang)
        const glied = fo.glieder.map((g) => nachGlied.get(g)).find((t) => yk >= t.versatz.y + fo.randUnten && yk + hoehe - 1 <= t.versatz.y + t.parameter.hoehe - 1 - fo.randOben);
        if (!glied) continue;
        // ohne Geschosse wechselt die Seitenfolge mit dem Geschossindex (wie in D3, unverändert); mit Geschossen nach den tatsächlich gesetzten Reihen (so bekommen alle vier Seiten Fenster)
        const folge = fo.seitenfolge[(geschosse ? gesetzteReihen : k) % fo.seitenfolge.length];
        gesetzteReihen++;
        for (const seite of folge) {
          const breite = paritaetBreite(glied.glied, seite, fo.breite);
          const y0 = yk - glied.versatz.y;
          const tiefe = messe(glied.glied, seite, breite, y0, hoehe, 'ein Fenster');
          const schluessel = `${glied.glied}-${seite}`;
          const n = (zaehler.get(schluessel) ?? 0) + 1; zaehler.set(schluessel, n);
          kinder.push({ ref: `${praefix}.fenster-${schluessel}-${n}`, name: 'Fenster', baustein: fo.baustein, parameter: { ...fo.parameter, breite, tiefe }, traeger: glied.ref, einbau: { zone: `wand-${seite}`, anker: 'mitte', versatz: { x: 0, y: y0, z: 0 }, drehung: WANDSEITE[seite] } });
        }
      }
    }
    return kinder;
  }

return { namen, rezept, wendeRezeptAn, RezeptFehler };
}

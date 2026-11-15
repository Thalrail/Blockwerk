// Ebene 3 – Bausteinrezepte (D2): ein Rezept setzt ein Bauwerk aus gestapelten Ebene-2-Formen („Gliedern“, von unten nach oben) zusammen.
// Die Rezepte sind Daten (data/regeln/rezepte.json, Regel rezepte.<name>); hier steht nur die feste, deterministische Auswertung. Gleiche Eingabe = gleiches Ergebnis.
// Die Spezifikation (Ebene 4) wählt nur den Namen und nennt die Außenmaße; die Glieder, ihre Maße und Lagen kennt allein dieses Rezept.

const PRAEFIX = 'rezepte.';
const ganz = (n) => Number.isSafeInteger(n);
const OBJEKT = (w) => w !== null && typeof w === 'object' && !Array.isArray(w);
const ID = /^[a-z0-9-]+$/;
const NACH = 3; // höchste Vergrößerung je Maß beim Anpassen der Hülle (Breite/Tiefe: 2 × NACH Blöcke, Höhe: NACH Schichten)

/** Fehler eines Rezepts: unbekannter Name, Maße zu klein oder nicht stimmig (kein stilles Raten, die Meldung geht als Rückfrage an Jonah). */
export class RezeptFehler extends Error {
  constructor(nachricht) { super(`Rezept: ${nachricht}`); this.name = 'RezeptFehler'; }
}

/**
 * @param {{regelwerk: object, ebene2: object}} quellen
 */
export function erzeugeRezepte({ regelwerk, ebene2 }) {
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
  }
  for (const n of namen()) pruefeDaten(n, regelwerk.regel(PRAEFIX + n).parameter);

  /** Die Daten des Rezepts; unbekannter Name → RezeptFehler mit den bekannten Namen. */
  function rezept(name) {
    if (typeof name !== 'string' || !regelwerk.hat(PRAEFIX + name)) throw new RezeptFehler(`„${String(name)}“ kennt Blockwerk nicht (bekannt: ${namen().join(', ')})`);
    return regelwerk.regel(PRAEFIX + name).parameter;
  }

  /** Höhen der Glieder (Summe = Gesamthöhe): feste zuerst, der Rest nach Gewicht (größter Bruchteil, bei Gleichstand das untere Glied). */
  function hoehen(name, d, b, H) {
    const h = new Array(d.glieder.length).fill(0);
    d.glieder.forEach((g, i) => {
      const q = g.hoehe;
      if (q.rest !== undefined) return;
      const roh = Math.round(q.anteil !== undefined ? q.anteil * H : q.zuBreite * b[i]);
      const oben = Math.min(q.max ?? Infinity, q.maxAnteil !== undefined ? Math.floor(q.maxAnteil * H) : Infinity);
      h[i] = Math.max(q.min ?? 1, Math.min(oben, roh)); // das Mindestmaß geht vor
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
  function wendeRezeptAn(name, groesse, praefix = name) {
    const d = rezept(name);
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
    const h = hoehen(name, d, b, H);
    // Stufen schließen: wo sich der Einzug zwischen zwei Gliedern ändert, muss die Wand des tragenden (Verjüngung) oder des auskragenden Glieds (Auskragung) mindestens so dick sein wie der Unterschied
    // plus die Auflage (Rezeptdatum `auflage`, Standard 0): mit 1 liegt das obere Glied auf dem Ring des unteren auf, statt nur an dessen Innenkante zu hängen
    const wand = d.glieder.map((g) => g.wandstaerke);
    for (let i = 1; i < d.glieder.length; i++) {
      const dx = ex[i] - ex[i - 1], dz = ez[i] - ez[i - 1], diff = Math.max(Math.abs(dx), Math.abs(dz));
      const traeger = dx + dz > 0 ? i - 1 : i; // oben schmaler: das untere Glied trägt; oben breiter: das obere kragt aus
      wand[traeger] = Math.max(wand[traeger], diff + (d.auflage ?? 0));
    }
    let y = 0;
    const teile = d.glieder.map((g, i) => {
      const parameter = passend(name, g, b[i], t[i], h[i], wand[i]);
      const teil = { glied: g.id, ref: `${praefix}.${g.id}`, baustein: g.baustein, parameter, versatz: { x: 0, y, z: 0 }, ...(g.rollen ? { rollen: { ...g.rollen } } : {}) };
      y += h[i];
      return teil;
    });
    return { rezept: name, huelle: { breite: B, tiefe: T, hoehe: H }, teile };
  }

  return { namen, rezept, wendeRezeptAn, RezeptFehler };
}

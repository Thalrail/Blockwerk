// Ebene 2 – Lager: Sortiereinheit (eine Gegenstandssorte). Regeln: data/regeln/lager.json (Wiki „Item sorting“, Hopper; die Pläne dort sind Bilder,
// die Anordnung wurde mit der Ebene-1-Simulation entworfen und mit Zufallsströmen geprüft, siehe test/ebene2/sortiereinheit.test.js; im Spiel `ungeprüft`).
// Aufbau (Rohr läuft nach Osten, y = 3; Koordinaten: x = Ost, z = Süd, y = oben; Nullpunkt = Spalte des Filtertrichters, y = 0 Boden der Lagerkiste):
//  - Rohr: 6 Trichter (x = −3…2, y = 3), Strom nur mit ≥ 9 Ticks Abstand (sonst rutscht bei Volllast ein Teil vorbei, wie im Wiki für Bedrock beschrieben).
//  - Filtertrichter F (0, 2, 0) unter dem Rohrtrichter über ihm: Slot 1 hält `halt` Stück der Sorte, die Slots 2–5 je 1 Füller (Gegenstand, der nie im Strom vorkommt):
//    so zieht F aus dem Rohr nur die Sorte. F zeigt gegen einen festen Block, schiebt also nichts fort.
//  - Ausgabetrichter O (0, 1, 0) schiebt in die Lagerkiste (0, 0, 0). O ist gesperrt, solange F nicht „übervoll“ ist: Komparator (liest F, Subtraktion der Konstanten 1)
//    → Repeater → Staub → Repeater → Block, daran die Fackel (0, 1, 1) neben O. Übervoll = Haltemenge + 1: dann geht die Fackel aus, O zieht den Überschuss ab.
//  - Haltemenge aus der Stapelgröße: Signal(k) = floor(1 + (k ÷ Stapel + Füllerbruchteil) ÷ 5 × 14) (wie `trichter.lesewert`); halt = größtes k mit Signal 1.
//    Nicht stapelbare Sorten (Stapel 1) gehen so nicht.
import { definiere, listeParam } from './baustein.js';

const QUELLE = 'https://minecraft.wiki/w/Tutorial:Item_sorting (Wortbeschreibung; die Anordnung ist Blockwerks eigener Entwurf, ungeprüft)';
const STEIN = 'minecraft:stone';

/**
 * @param {{regelwerk: import('../ebene1/regelwerk.js').Regelwerk, ebene0: ReturnType<typeof import('../ebene0/index.js').erzeugeEbene0>}} quellen
 */
export function erzeugeLager({ regelwerk, ebene0 }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  const fueller = P('lager.filter', 'fueller');
  const fuellerAnzahl = P('lager.filter', 'fuellerAnzahl');
  const fuellerMenge = P('lager.filter', 'fuellerMenge');
  const konstante = P('lager.filter', 'konstante');
  const basis = P('trichter.komparator', 'basis');
  const faktor = P('trichter.komparator', 'faktor');
  const slots = P('trichter.slots', 'trichterSlots');
  const bloecke = ebene0.register.bloecke;
  const richtungVon = ebene0.vermesser.richtungVon;
  const stapel = (id) => ebene0.register.stapel(id);

  const facing = (r) => bloecke.zustandsart('facing_direction').werte.find((v) => richtungVon('facing_direction', v) === r);
  const hopper = (x, y, z, r, inhalt) => ({ x, y, z, technik: true, id: 'minecraft:hopper', zustand: { facing_direction: facing(r), toggle_bit: false }, ...(inhalt ? { inhalt } : {}) });
  const komp = (x, y, z, eingang, subtrahieren) => ({ x, y, z, technik: true, id: 'minecraft:unpowered_comparator', zustand: { 'minecraft:cardinal_direction': eingang, output_lit_bit: false, output_subtract_bit: subtrahieren } });
  const rep = (x, y, z, eingang) => ({ x, y, z, technik: true, id: 'minecraft:unpowered_repeater', zustand: { 'minecraft:cardinal_direction': eingang, repeater_delay: 0 } });
  const staub = (x, y, z) => ({ x, y, z, technik: true, id: 'minecraft:redstone_wire', zustand: { redstone_signal: 0 } });
  const stein = (x, y, z) => ({ x, y, z, technik: true, id: STEIN });

  /** Signalstärke eines Trichters mit `k` Stück der Sorte und den Füllern (Formel wie trichter.lesewert). */
  const signal = (k, st) => Math.floor(basis + ((k / st + fuellerAnzahl * fuellerMenge / stapel(fueller[0])) / slots) * faktor);

  /** Haltemenge für die Stapelgröße: größtes k, bei dem F gerade noch das Signal `konstante` zeigt (darüber entsperrt O). Wirft bei nicht stapelbaren Sorten. */
  function haltFuer(sorte) {
    const st = stapel(sorte);
    let halt = 0;
    while (halt < st && signal(halt + 1, st) <= konstante) halt++;
    if (halt >= st) throw new Error(`${sorte}: F zeigt nie mehr als Signal ${konstante}`);
    if (halt < 1) throw new Error(`${sorte} (Stapel ${st}) lässt sich so nicht filtern: schon ein Stück übersteigt die Schwelle`);
    return halt;
  }

  const sortiereinheit = definiere({
    id: 'tech.sortiereinheit', titel: 'Sortiereinheit (Filtertrichter mit gesperrtem Ausgabetrichter, eine Sorte)', quelle: QUELLE,
    parameter: [listeParam('sorte', 'technik', { min: 1, max: 1, standard: ['minecraft:stone'], beschreibung: 'Die Gegenstandssorte dieser Einheit (stapelbar: Stapel 64 oder 16)' })],
    testszenario: { start: 'Rohr mit Gemisch (Abstand mindestens 9 Ticks), Welt im Sandkasten mit Trichtern und Redstone', erwartung: 'Jede Stück der Sorte landet in der Lagerkiste, nichts anderes; F behält Haltemenge und Füller' },
    baue: ({ sorte: [sorte] }) => {
      if (!ebene0.register.gegenstaende.includes(sorte)) throw new Error(`Unbekannter Gegenstand: ${sorte}`);
      const halt = haltFuer(sorte);
      const mit = fueller.filter((g) => g !== sorte && stapel(g) === 64 && ebene0.register.gegenstaende.includes(g)).slice(0, fuellerAnzahl);
      if (mit.length < fuellerAnzahl) throw new Error('Nicht genug Füller');
      const inhaltF = [{ slot: 0, gegenstand: sorte, anzahl: halt }, ...mit.map((g, i) => ({ slot: i + 1, gegenstand: g, anzahl: fuellerMenge }))];
      const b = [];
      for (let x = -3; x <= 2; x++) b.push(hopper(x, 3, 0, 'east'));
      b.push(hopper(0, 2, 0, 'east', inhaltF), stein(1, 2, 0));
      b.push(hopper(0, 1, 0, 'down'), { x: 0, y: 0, z: 0, technik: true, id: 'minecraft:chest', zustand: { 'minecraft:cardinal_direction': 'north' } });
      // Komparator liest F (Subtraktion), Konstante aus einem Fass mit einem Stück
      b.push(stein(-1, 1, 0), komp(-1, 2, 0, 'east', true));
      b.push(stein(-1, 1, 1), komp(-1, 2, 1, 'south', false));
      b.push({ x: -1, y: 2, z: 2, technik: true, id: 'minecraft:barrel', zustand: { facing_direction: facing('up'), open_bit: false }, inhalt: [{ slot: 0, gegenstand: STEIN, anzahl: konstante }] });
      // Verstärker, Staub, Treppe nach unten, Repeater, Block, Fackel
      b.push(stein(-2, 1, 0), rep(-2, 2, 0, 'east'));
      b.push(stein(-3, 1, 0), staub(-3, 2, 0), stein(-3, 1, 1), staub(-3, 2, 1), stein(-3, 1, 2), staub(-3, 2, 2));
      b.push(stein(-2, 0, 2), staub(-2, 1, 2));
      b.push(stein(-1, 0, 2), rep(-1, 1, 2, 'west'));
      b.push(stein(0, 1, 2));
      b.push({ x: 0, y: 1, z: 1, technik: true, id: 'minecraft:redstone_torch', zustand: { torch_facing_direction: 'south' } });
      return {
        bloecke: b,
        anschluesse: [
          { art: 'rohr', seite: 'west', x: -3, y: 3, z: 0 }, { art: 'rohr', seite: 'ost', x: 2, y: 3, z: 0 },
          { art: 'lager', x: 0, y: 0, z: 0 }, { art: 'eingang', mindestabstandTicks: P('lager.eingang', 'mindestabstand') },
        ],
      };
    },
  });

  return { sortiereinheit, haltFuer, signal, alle: [sortiereinheit] };
}

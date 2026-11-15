// Orchestrierung: dauerhafte Rundensicherung. Ein Zwischen-Snapshot (Commit ohne Referenz) liegt nur lose im Objektspeicher und geht bei `git gc --prune=now` oder nach etwa
// zwei Wochen verloren. Deshalb schreibt `runde-ende` zusätzlich eine Pack-Datei mit allen Objekten des Snapshots (Kette seit dem HEAD des Laufstarts) in den Laufordner
// unter `.claude/orchestrierung/laeufe/<lauf>/sicherung/`. Das legt KEINE Git-Referenz an (der Integritätswächter vergleicht alle Referenzen des Hauptrepositorys) und
// ändert weder Index, Zweig noch Arbeitsbaum. Wiederherstellung mit reinem Git, nach dem Lauf: `git unpack-objects < <pack>` und danach `git branch <name> <commit>`
// (oder `entpacke` unten). Gelöscht wird nie automatisch. Der Snapshot hat den Geheimnis-Scan schon bestanden, der Pack enthält nichts anderes.
import fs from 'node:fs';
import path from 'node:path';
import { git, gitStatus, sha256 } from './git.js';

/** Fehler der Rundensicherung: Pack nicht erzeugt, nicht prüfbar oder manipuliert. */
export class SicherungsFehler extends Error {
  constructor(nachricht) { super(`Sicherung: ${nachricht}`); this.name = 'SicherungsFehler'; }
}

/**
 * Packt den Snapshot `commit` samt allem, was nicht schon in `ohne` (HEAD beim Start des Laufs) steckt, und prüft den Pack.
 * @param {string} repo Hauptrepository
 * @param {{verzeichnis: string, nr: number, commit: string, ohne: string}} p
 * @returns {{pack: string, idx: string, sha256: string, bytes: number, commit: string, ohne: string}}
 */
export function sichereRunde(repo, { verzeichnis, nr, commit, ohne }) {
  if (!/^[0-9a-f]{40}$/.test(String(commit)) || !/^[0-9a-f]{40}$/.test(String(ohne))) throw new SicherungsFehler('Commit und Ausgangs-HEAD müssen vollständige SHA-1-Werte sein');
  fs.mkdirSync(verzeichnis, { recursive: true });
  const vorsatz = path.join(verzeichnis, `runde-${nr}`);
  let hash;
  try { hash = git(repo, ['pack-objects', '--revs', '--quiet', vorsatz], { input: `${commit}\n^${ohne}\n` }).trim(); } catch (f) { throw new SicherungsFehler(`Pack nicht erzeugt (${f.message})`); }
  if (!/^[0-9a-f]{40}$/.test(hash)) throw new SicherungsFehler(`unerwartete Ausgabe von git pack-objects: ${hash.slice(0, 80)}`);
  const pack = `${path.basename(vorsatz)}-${hash}.pack`, idx = `${path.basename(vorsatz)}-${hash}.idx`;
  const bytes = fs.readFileSync(path.join(verzeichnis, pack));
  const eintrag = { pack, idx, sha256: sha256(bytes), bytes: bytes.length, commit, ohne };
  pruefePack(repo, verzeichnis, eintrag);
  return eintrag;
}

/** Prüft einen gesicherten Pack: Datei da, Prüfsumme stimmt, `git verify-pack` ist zufrieden. Wirft SicherungsFehler. */
export function pruefePack(repo, verzeichnis, eintrag) {
  const packPfad = path.join(verzeichnis, String(eintrag?.pack ?? ''));
  const idxPfad = path.join(verzeichnis, String(eintrag?.idx ?? ''));
  if (!eintrag?.pack || !eintrag?.idx || !fs.existsSync(packPfad) || !fs.existsSync(idxPfad)) throw new SicherungsFehler('Pack-Datei oder Index fehlt');
  if (sha256(fs.readFileSync(packPfad)) !== eintrag.sha256) throw new SicherungsFehler(`Die Prüfsumme von ${eintrag.pack} stimmt nicht (Datei verändert)`);
  const v = gitStatus(repo, ['verify-pack', idxPfad]);
  if (v.status !== 0) throw new SicherungsFehler(`git verify-pack lehnt ${eintrag.pack} ab: ${v.stderr.toString().trim().slice(0, 200)}`);
  return true;
}

/** Stellt die Objekte eines gesicherten Packs im Repository wieder her (ohne Referenz; den Branch legt danach der Benutzer an). Nur außerhalb eines überwachten Laufs verwenden. */
export function entpacke(repo, verzeichnis, eintrag) {
  pruefePack(repo, verzeichnis, eintrag);
  git(repo, ['unpack-objects', '-q'], { input: fs.readFileSync(path.join(verzeichnis, eintrag.pack)) });
  return eintrag.commit;
}

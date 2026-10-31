// Orchestrierung: Unterschied zweier Snapshots (die Arbeit eines Agenten, ohne den uncommitteten Ausgangsstand).
import { git } from './git.js';

/** Geänderte Pfade zwischen zwei Commits: [{status: 'A'|'M'|'D'|'T', pfad}] (ohne Umbenennungserkennung). */
export function aenderungen(repo, von, nach) {
  const out = git(repo, ['diff', '--raw', '-z', '--no-renames', '--full-index', von, nach]).split('\0').filter(Boolean);
  const l = [];
  for (let i = 0; i < out.length; i += 2) l.push({ status: out[i].split(' ').pop()[0], pfad: out[i + 1] });
  return l;
}

/** Binärer Patch von `von` nach `nach` (zum Wiederherstellen eines verlorenen Worktrees). */
export const patch = (repo, von, nach) => git(repo, ['diff', '--binary', '--full-index', von, nach], { text: false });

/** Hinzugefügte Zeilen einer Datei (ohne Kopf), zum Suchen nach Importen und Versionsänderungen. */
export function hinzugefuegteZeilen(repo, von, nach, pfad) {
  return git(repo, ['diff', '-U0', '--no-color', von, nach, '--', pfad]).split('\n').filter((z) => z.startsWith('+') && !z.startsWith('+++')).map((z) => z.slice(1));
}

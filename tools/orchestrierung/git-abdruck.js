// Orchestrierung: Abdruck und Prüfung der Git-Konfiguration. Hooks, Konfiguration und Attribute können Programme starten (Hooks, fsmonitor, Filter, Credential-Helper, Proxy),
// sobald der Abschluss committet und pusht; ein Testprozess des Agenten läuft unter dem Benutzerkonto und könnte sie ändern. Hier wird das erkannt (Abdruck) und abgelehnt (Prüfung).
// Nur Node-Bordmittel und Git. Bereinigung und Erkennung, keine Isolation.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, sha256 } from './git.js';

const hash = (p) => { try { return sha256(fs.readFileSync(p)); } catch { return 'fehlt'; } };
const vor = (p) => p.replace(/\\/g, '/');

/** `.git`-Verzeichnis des Repositories und das gemeinsame Verzeichnis (bei einem Worktree das des Hauptrepositories). Ohne Aufruf von Git. */
export function gitVerzeichnisse(repo) {
  let dir = path.join(repo, '.git');
  try {
    if (fs.statSync(dir).isFile()) dir = path.resolve(repo, fs.readFileSync(dir, 'utf8').replace(/^gitdir:\s*/, '').trim());
  } catch { return { gitDir: dir, commonDir: dir }; }
  let common = dir;
  try { common = path.resolve(dir, fs.readFileSync(path.join(dir, 'commondir'), 'utf8').trim()); } catch { /* kein Worktree */ }
  return { gitDir: dir, commonDir: common };
}

function dateienUnter(dir, rel = '', out = []) {
  let eintraege = [];
  try { eintraege = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of eintraege.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) dateienUnter(path.join(dir, e.name), r, out); else out.push(r);
  }
  return out;
}

/** Aktive Hooks (alles in hooks/ außer den *.sample-Vorlagen). */
export function aktiveHooks(repo) {
  const { commonDir } = gitVerzeichnisse(repo);
  return dateienUnter(path.join(commonDir, 'hooks')).filter((p) => !p.endsWith('.sample'));
}

/** Konfigurationsdateien, die für Git in diesem Repository gelten könnten (auch noch nicht vorhandene: Neuanlage fällt dann auf). Quellen: Git selbst (Ursprung jedes Eintrags) und die üblichen Orte. */
export function konfigDateien(repo, umgebung = process.env) {
  const s = new Set();
  try {
    for (const z of git(repo, ['config', '--list', '--show-origin', '-z']).split('\0')) {
      const m = z.match(/^file:(.+)$/);
      if (m) s.add(path.normalize(m[1]));
    }
  } catch { /* ohne lesbare Konfiguration bleiben die üblichen Orte */ }
  const home = umgebung.HOME || umgebung.USERPROFILE || os.homedir();
  const xdg = umgebung.XDG_CONFIG_HOME || path.join(home, '.config');
  for (const p of [umgebung.GIT_CONFIG_GLOBAL, umgebung.GIT_CONFIG_SYSTEM, path.join(home, '.gitconfig'), path.join(xdg, 'git', 'config'), path.join(xdg, 'git', 'attributes'), path.join(xdg, 'git', 'ignore')]) if (p) s.add(path.normalize(p));
  return [...s].sort();
}

/**
 * Abdruck aller Stellen, über die Git Programme starten kann: `config`, `config.worktree`, `hooks/**`, `info/**` (auch `info/attributes`) im gemeinsamen Git-Verzeichnis,
 * die globale und die Systemkonfiguration samt Attributen. Mit `mitWorktrees` zusätzlich die Metadaten der angelegten Worktrees (`worktrees/*`: Konfiguration, gitdir, commondir, Hooks).
 * Liest nur Dateien (ein einziger Git-Aufruf: `config --list`, der keine Programme startet).
 */
export function gitAbdruck(repo, { mitWorktrees = false, umgebung = process.env } = {}) {
  const { commonDir } = gitVerzeichnisse(repo);
  const m = {};
  m['git/config'] = hash(path.join(commonDir, 'config'));
  m['git/config.worktree'] = hash(path.join(commonDir, 'config.worktree'));
  for (const sub of ['hooks', 'info']) for (const r of dateienUnter(path.join(commonDir, sub))) m[`git/${sub}/${r}`] = hash(path.join(commonDir, sub, r));
  for (const p of konfigDateien(repo, umgebung)) m[`konfig/${vor(p)}`] = hash(p);
  if (mitWorktrees) {
    const wd = path.join(commonDir, 'worktrees');
    let namen = [];
    try { namen = fs.readdirSync(wd); } catch { /* keine Worktrees */ }
    for (const n of namen.sort()) {
      for (const f of ['config.worktree', 'gitdir', 'commondir']) m[`worktrees/${n}/${f}`] = hash(path.join(wd, n, f));
      for (const r of dateienUnter(path.join(wd, n, 'hooks'))) m[`worktrees/${n}/hooks/${r}`] = hash(path.join(wd, n, 'hooks', r));
    }
  }
  return m;
}

/** Unterschiede zweier Abdrücke als Liste „abdruck:<Stelle>“ (leer = gleich). */
export const abdruckUnterschiede = (a, b, praefix = 'git') => [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].sort().filter((p) => a?.[p] !== b?.[p]).map((p) => `${praefix}:${p}`);

/** Credential-Helper, die Git mitliefert oder das Betriebssystem stellt (Git Credential Manager, wincred, osxkeychain, libsecret, store, cache). Alles andere – vor allem Shell-Aufrufe mit „!“ – wird abgelehnt. */
const HELPER_NAME = /^(?:manager|manager-core|wincred|osxkeychain|libsecret)$/i;
const HELPER_STORE_CACHE = /^(?:store|cache)(?: --[A-Za-z-]+(?:=\S+)?)*$/i;
const HELPER_PFAD = /^"?(?:[A-Za-z]:)?[\\/][^"!]*git-credential-(?:manager(?:-core)?|wincred|osxkeychain|libsecret)(?:\.exe)?"?$/i;
const helperErlaubt = (wert) => wert === '' || HELPER_NAME.test(wert) || HELPER_STORE_CACHE.test(wert) || HELPER_PFAD.test(wert);

/**
 * Prüft die wirksame Git-Konfiguration auf Einträge, die beim Commit, Push oder Fetch Programme starten oder das Ziel umleiten könnten und die der Abschluss nicht selbst überschreibt:
 * Filter (außer den Git-LFS-Filtern der Systemkonfiguration), Credential-Helper außer den bekannten, `url.*.insteadOf`/`pushInsteadOf`, `remote.*.pushurl|proxy|receivepack|uploadpack`, alle `http.*` außer `http.sslBackend`,
 * `core.hooksPath|fsmonitor|sshCommand|gitProxy|askPass|worktree`, `diff.external`, Submodul-Updatebefehle mit „!“ und freigegebene `ext`-Protokolle. Liefert Probleme (leer = in Ordnung).
 */
export function pruefeGitKonfiguration(repo) {
  const probleme = [];
  const roh = git(repo, ['config', '--list', '--show-scope', '--show-origin', '-z']).split('\0').filter(Boolean);
  for (let i = 0; i + 2 < roh.length; i += 3) {
    const scope = roh[i]; const origin = roh[i + 1]; const kv = roh[i + 2];
    if (kv === undefined) break;
    const nl = kv.indexOf('\n');
    const key = (nl < 0 ? kv : kv.slice(0, nl)); const wert = nl < 0 ? '' : kv.slice(nl + 1);
    if (scope === 'command') continue; // Einstellungen von der Befehlszeile oder aus GIT_CONFIG_COUNT sind die eigenen (gehärteter Modus), nicht die der Dateien
    const k = key.toLowerCase();
    const meldung = (was) => probleme.push(`${key} (${scope}, ${origin.replace(/^file:/, '')}): ${was}`);
    if (/^credential(\..+)?\.helper$/.test(k)) { if (!helperErlaubt(wert.trim())) meldung('unbekannter Credential-Helper'); continue; }
    if (k.startsWith('filter.')) {
      const lfs = scope === 'system' && /^filter\.lfs\.(clean|smudge|process)$/.test(k) && /^git-lfs /.test(wert);
      const lfsFlag = scope === 'system' && k === 'filter.lfs.required';
      if (!lfs && !lfsFlag) meldung('Filter (startet Programme beim Hinzufügen/Auschecken)');
      continue;
    }
    if (/^url\..+\.(insteadof|pushinsteadof)$/.test(k)) { meldung('schreibt Adressen um (Ziel des Pushs)'); continue; }
    if (/^remote\..+\.(pushurl|proxy|receivepack|uploadpack|vcs)$/.test(k)) { meldung('ändert Ziel oder Programme des Remotes'); continue; }
    if (k.startsWith('http.') && k !== 'http.sslbackend') { meldung('HTTP-Einstellung (Proxy, Zertifikate, Header) ist nicht erlaubt'); continue; }
    if (['core.hookspath', 'core.sshcommand', 'core.gitproxy', 'core.askpass', 'core.worktree'].includes(k) && wert.trim() !== '') { meldung('startet Programme oder verlegt das Arbeitsverzeichnis'); continue; }
    if (k === 'core.fsmonitor' && !['false', '0', 'no', 'off', ''].includes(wert.trim().toLowerCase())) { meldung('startet ein Programm bei jedem Git-Aufruf'); continue; }
    if (k === 'diff.external' && wert.trim() !== '') { meldung('startet ein externes Diff-Programm'); continue; }
    if (/^submodule\..+\.update$/.test(k) && wert.trim().startsWith('!')) { meldung('Submodul-Update mit Shell-Befehl'); continue; }
    if (/^protocol\.ext\.allow$/.test(k) && wert.trim() !== 'never') meldung('ext-Protokoll (startet beliebige Befehle) freigegeben');
  }
  return probleme;
}

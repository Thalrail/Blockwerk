// Orchestrierung: dünner Git-Zugriff und Zustandsvergleich. Nur Node-Bordmittel und Git, keine Abhängigkeiten.
// Alle Git-Aufrufe laufen mit festen Einstellungen (keine Zeilenenden-Umwandlung, kein Index-Neuschreiben beim Lesen).
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Feste Einstellungen: Snapshots müssen byte-genau sein, egal was core.autocrlf des Systems sagt. */
export const KONFIG = Object.freeze(['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false', '-c', 'core.quotepath=false']);

export const sha256 = (daten) => createHash('sha256').update(daten).digest('hex');
export const blobSha = (b) => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');

/** Führt Git aus und liefert die Ausgabe (Text oder Buffer); bei Fehler eine Exception mit der Git-Meldung. */
export function git(cwd, args, { env = {}, input, text = true } = {}) {
  try {
    const out = execFileSync('git', [...KONFIG, ...args], { cwd, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', ...env }, input, maxBuffer: 1 << 30, stdio: ['pipe', 'pipe', 'pipe'] });
    return text ? out.toString('utf8') : out;
  } catch (e) { throw new Error(`git ${args.join(' ')} → ${e.stderr?.toString().trim() || e.message}`); }
}

/** Wie `git`, wirft aber nie: {status, stdout, stderr}. */
export function gitStatus(cwd, args, { input } = {}) {
  const r = spawnSync('git', [...KONFIG, ...args], { cwd, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, input, maxBuffer: 1 << 30 });
  return { status: r.status, stdout: r.stdout ?? Buffer.alloc(0), stderr: r.stderr ?? Buffer.alloc(0) };
}

/** Inhalt einer Datei in einem Commit (Buffer) oder null, wenn es sie dort nicht gibt. */
export function blob(repo, commit, pfad) {
  const r = gitStatus(repo, ['cat-file', 'blob', `${commit}:${pfad}`]);
  return r.status === 0 ? r.stdout : null;
}

/** Hash über alle Dateien eines Verzeichnisses (ohne das Git-Verzeichnis und ohne die Präfixe aus `ausser`). */
export function baumHash(dir, { ausser = [] } = {}) {
  const dateien = new Map();
  const geh = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name === '.git' && rel === '') continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (ausser.some((p) => r === p || r.startsWith(`${p}/`))) continue;
      if (e.isDirectory()) geh(path.join(d, e.name), r);
      else if (e.isFile()) dateien.set(r, sha256(fs.readFileSync(path.join(d, e.name))));
    }
  };
  geh(dir, '');
  const h = createHash('sha256');
  for (const [p, s] of [...dateien].sort((a, b) => (a[0] < b[0] ? -1 : 1))) h.update(`${p}\0${s}\n`);
  return { hash: h.digest('hex'), dateien };
}

/** Abdruck von HEAD, Zweig, Stash, Refs, Index und Arbeitsbaum – zum Beweis „nichts verändert“. */
export function zustand(repo, { ausser = [] } = {}) {
  const gitDir = git(repo, ['rev-parse', '--absolute-git-dir']).trim();
  const zweig = gitStatus(repo, ['symbolic-ref', '-q', 'HEAD']);
  const baum = baumHash(repo, { ausser });
  return {
    head: git(repo, ['rev-parse', 'HEAD']).trim(),
    zweig: zweig.status === 0 ? zweig.stdout.toString().trim() : '(losgelöst)',
    stash: git(repo, ['for-each-ref', '--format=%(objectname)', 'refs/stash']).trim(),
    refs: sha256(git(repo, ['for-each-ref', '--format=%(refname) %(objectname)'])),
    index: sha256(fs.readFileSync(path.join(gitDir, 'index'))),
    baum: baum.hash,
    dateien: Object.fromEntries(baum.dateien),
  };
}

/** Unterschiede zweier Abdrücke als Liste (leer = identisch). `dateien` wird dateiweise verglichen. */
export function zustandsUnterschiede(a, b) {
  const l = [];
  for (const k of ['head', 'zweig', 'stash', 'refs', 'index']) if (a[k] !== b[k]) l.push(k);
  const alle = new Set([...Object.keys(a.dateien ?? {}), ...Object.keys(b.dateien ?? {})]);
  for (const p of [...alle].sort()) if (a.dateien?.[p] !== b.dateien?.[p]) l.push(`datei:${p}`);
  return l;
}

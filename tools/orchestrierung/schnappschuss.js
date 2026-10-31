// Orchestrierung: Snapshot des ganzen Arbeitsstands (auch uncommittet und unversioniert) als losgelöster Commit.
// Der Snapshot entsteht über einen temporären Index außerhalb des Repositories: HEAD, Zweig, echter Index, Stash und Arbeitsbaum bleiben unberührt.
// Es entstehen nur lose, unreferenzierte Objekte. Fest eingestellter Autor und Zeitstempel: gleicher Stand = gleicher Commit.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, blobSha, baumHash } from './git.js';

const FEST = {};
for (const k of ['AUTHOR', 'COMMITTER']) { FEST[`GIT_${k}_NAME`] = 'blockwerk-snapshot'; FEST[`GIT_${k}_EMAIL`] = 'snapshot@invalid'; FEST[`GIT_${k}_DATE`] = '2000-01-01T00:00:00Z'; }
export const SNAPSHOT_ENV = Object.freeze({ ...FEST });

export class GeheimnisFehler extends Error {
  constructor(datei, muster) { super(`Geheimnis-Verdacht in ${datei} (${muster}); es wird kein Snapshot angelegt`); this.name = 'GeheimnisFehler'; this.datei = datei; }
}

/** Muster für Zugangsdaten. Ein Treffer bricht ab (im Zweifel kein Snapshot). */
export const GEHEIM = Object.freeze([
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /ghp_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /\bsk-[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/, /xox[baprs]-[A-Za-z0-9-]{10,}/, /api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{16,}/i,
]);

/** Prüft Text (Buffer ohne Nullbytes) auf Zugangsdaten; wirft GeheimnisFehler. */
export function pruefeGeheimnisse(name, buf) {
  if (buf.includes(0)) return;
  const t = buf.toString('latin1');
  for (const m of GEHEIM) if (m.test(t)) throw new GeheimnisFehler(name, String(m));
}

/** Blockwerk-Standard: nicht versionierte Dateien nur aus diesen Bereichen (Standard: verboten), nie diese Namen. */
export const STANDARD = Object.freeze({
  erlaubt: [
    /^(src|test|docs|data|tools|web|dienst|\.github)\//,
    /^\.claude\/(agents|skills|hooks)\//, /^\.claude\/settings\.json$/,
    /^\.gitignore$/, /^[^/]+\.(md|json|html|webmanifest|toml|js|mjs|yml)$/,
  ],
  verboten: [
    /(^|\/)\.env/, /\.(pem|key|p12|pfx|db|sqlite|sqlite3)(-shm|-wal)?$/i, /(^|\/)(auth|credentials?)[^/]*\.json$/i,
    /(^|\/)(secrets?|tokens?)\.[a-z]+$/i, /(^|\/)\.claude\/(worktrees|orchestrierung|settings\.local\.json)/, /(^|\/)\.(codex|wrangler)/,
  ],
  maxDatei: 5 * 1024 * 1024,
});

/**
 * Legt einen Commit mit dem ganzen Arbeitsstand an. Elternteil ist HEAD (oder `eltern`).
 * @returns {{commit: string, tree: string, ausgeschlossen: Array<{pfad: string, grund: string}>, aufgenommen: number, geloescht: number}}
 */
export function schnappschuss(repo, { id = 'x', eltern = null, ...optionen } = {}) {
  const o = { ...STANDARD, ...optionen };
  const liste = git(repo, ['ls-files', '-z', '-c', '-o', '--exclude-standard']).split('\0').filter(Boolean);
  const getrackt = new Set(git(repo, ['ls-files', '-z', '-c']).split('\0').filter(Boolean));
  const aufnehmen = [], loeschen = [], ausgeschlossen = [];
  for (const p of liste) {
    const abs = path.join(repo, p);
    let st;
    try { st = fs.lstatSync(abs); } catch { if (getrackt.has(p)) loeschen.push(p); continue; }
    if (st.isDirectory()) continue;
    if (st.isSymbolicLink()) { ausgeschlossen.push({ pfad: p, grund: 'symlink' }); continue; }
    if (!getrackt.has(p)) {
      if (o.verboten.some((r) => r.test(p))) { ausgeschlossen.push({ pfad: p, grund: 'verboten' }); continue; }
      if (!o.erlaubt.some((r) => r.test(p))) { ausgeschlossen.push({ pfad: p, grund: 'nicht-erlaubt' }); continue; }
      if (st.size > o.maxDatei) { ausgeschlossen.push({ pfad: p, grund: 'zu-gross' }); continue; }
    }
    pruefeGeheimnisse(p, fs.readFileSync(abs));
    aufnehmen.push(p);
  }
  const idx = path.join(os.tmpdir(), `bw-idx-${randomBytes(6).toString('hex')}`);
  const env = { GIT_INDEX_FILE: idx, ...FEST };
  try {
    git(repo, ['read-tree', 'HEAD'], { env });
    if (aufnehmen.length) git(repo, ['update-index', '--add', '-z', '--stdin'], { env, input: `${aufnehmen.join('\0')}\0` });
    if (loeschen.length) git(repo, ['update-index', '--force-remove', '-z', '--stdin'], { env, input: `${loeschen.join('\0')}\0` });
    const tree = git(repo, ['write-tree'], { env }).trim();
    const commit = git(repo, ['commit-tree', tree, '-p', eltern ?? git(repo, ['rev-parse', 'HEAD']).trim(), '-m', `snapshot ${id}`], { env }).trim();
    return { commit, tree, ausgeschlossen, aufgenommen: aufnehmen.length, geloescht: loeschen.length };
  } finally { for (const f of [idx, `${idx}.lock`]) fs.rmSync(f, { force: true }); }
}

/** Bytegenauer Vergleich: jede Datei im Commit-Baum stimmt mit der Platte überein, und es gibt keine unerklärte Datei auf der Platte. */
export function vergleicheMitPlatte(repo, commit, { ausgeschlossen = [], ausser = [] } = {}) {
  const fehler = [];
  const baum = new Map();
  for (const e of git(repo, ['ls-tree', '-r', '-z', '--full-tree', commit]).split('\0').filter(Boolean)) {
    const [meta, p] = e.split('\t'); const [modus, art, sha] = meta.split(' ');
    if (art === 'blob') baum.set(p, { modus, sha });
  }
  const platte = baumHash(repo, { ausser }).dateien;
  for (const [p, { sha }] of baum) {
    const abs = path.join(repo, p);
    if (!fs.existsSync(abs)) { fehler.push(`${p}: im Snapshot, nicht auf der Platte`); continue; }
    if (blobSha(fs.readFileSync(abs)) !== sha) fehler.push(`${p}: Inhalt weicht ab`);
  }
  const erklaert = new Set(ausgeschlossen.map((x) => x.pfad));
  const ignoriert = new Set(git(repo, ['ls-files', '-z', '-o', '-i', '--exclude-standard']).split('\0').filter(Boolean));
  for (const p of platte.keys()) if (!baum.has(p) && !erklaert.has(p) && !ignoriert.has(p)) fehler.push(`${p}: auf der Platte, nicht im Snapshot und nicht erklärt`);
  return { fehler, dateien: baum.size };
}

/** Legt einen losgelösten Worktree genau auf dem Commit an (kein Zweig). */
export function seed(repo, commit, ziel) { git(repo, ['worktree', 'add', '--detach', ziel, commit]); return ziel; }

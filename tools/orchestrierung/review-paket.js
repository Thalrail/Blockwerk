// Orchestrierung: Review-Paket für den unabhängigen Codex-Review.
// Es entsteht ein eigenes kleines Git-Repository im isolierten Review-Verzeichnis (außerhalb von Blockwerk) mit zwei Commits „vorher“ (Stand S0 der
// geänderten Dateien und ihrer Kontextdateien) und „nachher“ (S1). Die Bridge bildet den Diff selbst (`base`/`head` im `cwd`): nichts wird von Hand abgetippt.
// Alle Blobs sind byte-identisch mit denen der Quelle; das wird geprüft. Codex liest nur dieses Paket, nie den Entwickler-Worktree.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, gitStatus, blob, sha256 } from './git.js';
import { aenderungen } from './delta.js';
import { GEHEIM, GeheimnisFehler, SNAPSHOT_ENV } from './schnappschuss.js';

const IMPORT = /(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g;

/** Standard-Verzeichnis für Review-Pakete: der isolierte Ordner, den Jonah für Codex eingerichtet hat. */
export const standardReviewVerzeichnis = () => process.env.BW_REVIEW_DIR || path.join(os.homedir(), '.codex-review-test');

/**
 * @param {string} quelle Repository, das die Commits kennt (Hauptrepository oder Worktree)
 * @param {string} s0 Ausgangs-Snapshot
 * @param {string} s1 Snapshot mit der Arbeit
 * @param {string} wurzel isolierter Review-Ordner (muss außerhalb von `quelle` liegen)
 */
export function reviewPaket(quelle, s0, s1, wurzel, { id = 'x', kontext = [], maxToken = 120000, hinweise = '' } = {}) {
  const geaendert = aenderungen(quelle, s0, s1);
  if (!geaendert.length) throw new Error('Kein Unterschied zwischen den Snapshots: es gibt nichts zu prüfen');
  const imS1 = new Set(git(quelle, ['ls-tree', '-r', '--name-only', '-z', s1]).split('\0').filter(Boolean));
  const kontextMenge = new Set();
  for (const { pfad, status } of geaendert) {
    if (status === 'D' || !/\.m?js$/.test(pfad)) continue;
    const text = (blob(quelle, s1, pfad) ?? Buffer.alloc(0)).toString('utf8');
    for (const m of text.matchAll(IMPORT)) {
      const rel = path.posix.normalize(path.posix.join(path.posix.dirname(pfad), m[1]));
      for (const c of [rel, `${rel}.js`, `${rel}.mjs`, `${rel}/index.js`]) if (imS1.has(c)) { kontextMenge.add(c); break; }
    }
  }
  for (const k of kontext) if (imS1.has(k)) kontextMenge.add(k);
  const alle = new Set([...geaendert.map((x) => x.pfad), ...kontextMenge]);
  const sauber = String(id).replace(/[^A-Za-z0-9_.-]/g, '_');
  const dir = path.join(wurzel, `lauf-${sauber}`);
  const rel = path.relative(path.resolve(quelle), path.resolve(dir));
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) throw new Error('Das Review-Paket muss außerhalb des Quell-Repositories liegen');
  if (fs.existsSync(dir)) throw new Error(`Paket ${dir} gibt es schon`);
  fs.mkdirSync(dir, { recursive: true });
  const g = (a) => git(dir, a, { env: SNAPSHOT_ENV });
  g(['init', '-q', '-b', 'main']);
  g(['config', 'core.autocrlf', 'false']);
  const schreibe = (commit) => {
    for (const p of alle) {
      const b = blob(quelle, commit, p), abs = path.join(dir, p);
      if (b === null) fs.rmSync(abs, { force: true }); else { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, b); }
    }
  };
  const hinweisText = `# Review-Hinweise\n\n${hinweise}\n\nGeänderte Dateien (Diff vorher → nachher):\n${geaendert.map((x) => `- ${x.status} ${x.pfad}`).join('\n')}\n\nUnveränderte Kontextdateien (nur lesen, nicht im Diff):\n${[...kontextMenge].filter((p) => !geaendert.some((x) => x.pfad === p)).map((p) => `- ${p}`).join('\n') || '- keine'}\n`;
  schreibe(s0);
  fs.writeFileSync(path.join(dir, 'REVIEW-HINWEISE.md'), hinweisText);
  g(['add', '-A']); g(['commit', '-q', '-m', 'vorher']);
  const vorher = g(['rev-parse', 'HEAD']).trim();
  schreibe(s1);
  g(['add', '-A']); g(['commit', '-q', '-m', 'nachher']);
  const nachher = g(['rev-parse', 'HEAD']).trim();
  // Beweis der Genauigkeit: dieselben Blobs wie in der Quelle
  const abweichungen = [];
  for (const { pfad, status } of geaendert) {
    const q0 = status === 'A' ? null : git(quelle, ['rev-parse', `${s0}:${pfad}`]).trim();
    const q1 = status === 'D' ? null : git(quelle, ['rev-parse', `${s1}:${pfad}`]).trim();
    const p0 = gitStatus(dir, ['rev-parse', '-q', '--verify', `${vorher}:${pfad}`]).stdout.toString().trim() || null;
    const p1 = gitStatus(dir, ['rev-parse', '-q', '--verify', `${nachher}:${pfad}`]).stdout.toString().trim() || null;
    if (q0 !== p0 || q1 !== p1) abweichungen.push(pfad);
  }
  const paketDiff = git(dir, ['diff', '--full-index', vorher, nachher], { text: false });
  const quellDiff = git(quelle, ['diff', '--full-index', s0, s1, '--', ...geaendert.map((x) => x.pfad)], { text: false });
  const inhalte = [...alle].map((p) => blob(quelle, s1, p) ?? Buffer.alloc(0));
  const zeichen = paketDiff.length + inhalte.reduce((s, b) => s + b.length, 0);
  const diffText = paketDiff.toString('utf8');
  for (const m of GEHEIM) if (m.test(diffText) || inhalte.some((b) => !b.includes(0) && m.test(b.toString('latin1')))) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new GeheimnisFehler('Review-Paket', String(m));
  }
  const token = Math.ceil(zeichen / 3.5);
  return {
    dir, base: vorher, head: nachher, geaendert, kontext: [...kontextMenge], abweichungen,
    diffIdentisch: Buffer.compare(paketDiff, quellDiff) === 0, diffSha256: sha256(paketDiff), tokenSchaetzung: token, zuGross: token > maxToken,
    aufruf: { tool: 'review_code', cwd: dir, base: vorher, head: nachher, tier: 'balanced', auto_diff: false },
  };
}

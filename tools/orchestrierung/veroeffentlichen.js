// Orchestrierung: Veröffentlichung eines vorbereiteten `claude/*`-Branches (Push, PR gegen main, Ready for review, Pflichtchecks). Jonah, 12.11.2026.
// Zwei Schritte: `vorpruefung` (ändert nichts am Repository und am Remote, zeigt den Stand und liefert einen Freigabe-Hash) und `veroeffentlichen` (nur mit diesem Hash).
// Die Freigabe selbst ist der Bestätigungsdialog von Claude Code für den Aufruf `veroeffentlichen` (Regel `ask` in .claude/settings.json); der Hash bindet den Stand
// (Repository, Origin-URL, Branch, HEAD, Baum, Basis, Diff, Tests, Review mit Befunden und Einstufungen, Titel, Einschränkungen), ersetzt aber keine Berechtigung; Remote-Branch und PR werden vor dem Push gegen die Vorprüfung gehalten. Es gibt hier absichtlich keinen Merge, kein Force, kein Löschen und kein `gh api`.
// Nachweise wie im Lauf: Tests (das Werkzeug startet die Suite selbst), unabhängiges Codex-Review (Einzelmodus) und eingestufte Befunde, gebunden an den Baum von HEAD;
// bei Branches aus einem autonomen Lauf zählen dessen Nachweise für denselben Baum. Sicherheitsdateien (.claude/, .github/, tools/orchestrierung/, .gitignore) werden abgelehnt.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { git, gitStatus, mitHaertung, sha256, zustand, zustandsUnterschiede } from './git.js';
import { gitAbdruck, abdruckUnterschiede, pruefeGitKonfiguration, aktiveHooks } from './git-abdruck.js';
import { pruefeGeheimnisse } from './schnappschuss.js';
import { reviewPaket, standardReviewVerzeichnis } from './review-paket.js';
import { pruefeReviewErgebnis } from './review-pruefung.js';
import {
  LaufFehler, AUSSCHLUSS, SUITEN, orchDir, lies, leseZeilen, leseJson, schreibeJson, jetzt, vor, bewerteNachweise, pruefeBefundListe, pruefeEinstufung, testUmgebung, liesTestZaehler,
} from './lauf.js';
import { GITHUB_REPO, ERLAUBTE_REMOTES, BASIS_ZWEIG, ZWEIG_PRAEFIX, TRAILER, geschuetzterPfad, abgelehnt, kurz, ghUmgebung } from './abschluss.js';

const BRANCH = /^claude\/[a-z0-9][a-z0-9-]{2,40}$/;
const HASH = /^[0-9a-f]{16}$/;
const GH_ERLAUBT = Object.freeze(['list', 'create', 'view', 'ready', 'checks']);
/** Der Job aus .github/workflows/test.yml (Workflow „Tests“, Job `test`): zählt immer als Pflichtcheck, auch wenn GitHub ihn nicht als solchen führt. */
export const TEST_CHECK = Object.freeze({ workflow: 'Tests', name: 'test' });

const verzeichnis = (w, branch) => path.join(orchDir(w), 'veroeffentlichung', branch.slice(ZWEIG_PRAEFIX.length));
const anhaengen = (datei, obj) => { fs.mkdirSync(path.dirname(datei), { recursive: true }); fs.appendFileSync(datei, `${JSON.stringify(obj)}\n`); };
const schlafe = (ms) => { if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };

function aktuellerBranch(w) {
  const b = gitStatus(w, ['symbolic-ref', '--short', '-q', 'HEAD']).stdout.toString().trim();
  if (b === BASIS_ZWEIG || !BRANCH.test(b)) throw new LaufFehler(`Veröffentlicht werden nur Branches „claude/<name>“ (a-z, 0-9, Bindestrich), nicht „${b || 'losgelöst'}“`);
  return b;
}

// ---------------------------------------------------------------- GitHub (feste Argumente, nur diese fünf Unterbefehle von `gh pr`)
function gh(w, umgebung, args) {
  if (args[0] !== 'pr' || !GH_ERLAUBT.includes(args[1])) throw new LaufFehler(`gh ${String(args[0])} ${String(args[1])} ist hier nicht vorgesehen`);
  const [exe, ...vorn] = umgebung.gh ?? ['gh'];
  return spawnSync(exe, [...vorn, ...args], { cwd: w, encoding: 'utf8', env: ghUmgebung(umgebung.ghEnv), maxBuffer: 16 << 20 });
}
const jsonVon = (text) => { try { return JSON.parse(String(text ?? '').trim() || 'null'); } catch { return null; } };

/** Offene PR zu diesem Branch: `{ pr }` (oder `pr: null`) oder `{ fehler }`. */
function findePr(w, umgebung, branch) {
  const r = gh(w, umgebung, ['pr', 'list', '--repo', GITHUB_REPO, '--head', branch, '--state', 'open', '--json', 'number,url,isDraft,headRefOid,baseRefName,isCrossRepository']);
  const liste = r.status === 0 ? jsonVon(r.stdout) : null;
  if (!Array.isArray(liste)) return { fehler: abgelehnt('gh-fehler', { meldung: kurz(r.stderr) || kurz(r.stdout) || `Exit ${r.status}`, hinweis: 'GitHub ist nicht abfragbar (Anmeldung und Netz prüfen: gh auth status)' }) };
  const eigene = liste.filter((p) => !p.isCrossRepository);
  if (eigene.length > 1) return { fehler: abgelehnt('mehrere-prs', { nummern: eigene.map((p) => p.number), hinweis: 'Mehrere offene PRs zum selben Branch: Jonah entscheidet' }) };
  return { pr: eigene[0] ?? null };
}
const prAnsicht = (w, umgebung, nummer, felder) => {
  const r = gh(w, umgebung, ['pr', 'view', String(nummer), '--repo', GITHUB_REPO, '--json', felder]);
  return { ok: r.status === 0, daten: r.status === 0 ? jsonVon(r.stdout) : null, meldung: kurz(r.stderr) || kurz(r.stdout) };
};

/**
 * Bewertet die Check-Liste (`gh pr checks --json`): Pflichtchecks (`--required`) plus der Job `test` aus test.yml.
 * @returns {{status: 'ok'|'wartet'|'fehler', grund?: string, checks: object[]}}
 */
export function bewerteChecks(alle, pflicht) { // übersprungen („skipping“) gilt nie als bestanden: lieber eine Blockade mit Namen als ein stilles „fertig“
  const gleich = (a, b) => a.name === b.name && (a.workflow ?? '') === (b.workflow ?? '');
  const test = alle.find((c) => c.workflow === TEST_CHECK.workflow && c.name === TEST_CHECK.name) ?? null;
  const muss = [...pflicht];
  if (test && !muss.some((c) => gleich(c, test))) muss.push(test);
  const schlecht = muss.filter((c) => c.bucket === 'fail' || c.bucket === 'cancel' || c.bucket === 'skipping');
  if (schlecht.length) return { status: 'fehler', grund: 'check-fehlgeschlagen', checks: schlecht };
  if (!test) return { status: 'wartet', grund: 'test-check-fehlt', checks: muss };
  const offen = muss.filter((c) => c.bucket !== 'pass');
  if (offen.length) return { status: 'wartet', grund: 'check-ausstehend', checks: offen };
  return { status: 'ok', checks: muss };
}

// ---------------------------------------------------------------- Stand des Repositories
function ermittleStand(w, umgebung) {
  let zweig;
  try { zweig = aktuellerBranch(w); } catch (f) { return { fehler: abgelehnt('branch', { hinweis: f.message }) }; }
  const lauf = lies(w);
  if (lauf?.status === 'aktiv') return { fehler: abgelehnt('lauf-aktiv', { lauf: lauf.id, hinweis: 'Zuerst den Lauf mit „ende“ beenden; ein laufender Lauf überwacht Git-Konfiguration und Hauptbaum und würde den Push als Manipulation melden' }) };
  const schmutzig = git(w, ['status', '--porcelain']).trim();
  if (schmutzig) return { fehler: abgelehnt('arbeitsbaum-unsauber', { dateien: schmutzig.split('\n').slice(0, 8), hinweis: 'Veröffentlicht wird nur ein vollständig committeter Stand' }) };
  const hooks = aktiveHooks(w);
  if (hooks.length) return { fehler: abgelehnt('git-hooks', { hooks }) };
  const konfig = pruefeGitKonfiguration(w);
  if (konfig.length) return { fehler: abgelehnt('git-konfiguration', { probleme: konfig }) };
  const erlaubt = (umgebung.erlaubteRemotes ?? ERLAUBTE_REMOTES).map((x) => x.toLowerCase());
  // alle URLs (Fetch und Push): ein Push geht an jede eingetragene URL, nicht nur an die erste
  const urlListe = (args) => git(w, args).split('\n').map((x) => x.trim()).filter(Boolean);
  const abrufUrls = urlListe(['remote', 'get-url', '--all', 'origin']);
  const pushUrls = urlListe(['remote', 'get-url', '--all', '--push', 'origin']);
  const fremd = [...abrufUrls, ...pushUrls].find((x) => !erlaubt.includes(x.toLowerCase()));
  if (fremd) return { fehler: abgelehnt('remote-nicht-erlaubt', { remote: fremd }) };
  // genau ein Ziel: `ls-remote origin` fragt den Abruf-Endpunkt, `git push origin` geht an jede Push-URL; nur bei Gleichheit gilt der geprüfte Stand auch für den Push
  if (abrufUrls.length !== 1 || pushUrls.length !== 1 || abrufUrls[0].toLowerCase() !== pushUrls[0].toLowerCase()) return { fehler: abgelehnt('remote-nicht-eindeutig', { abruf: abrufUrls, push: pushUrls, hinweis: 'origin braucht genau eine Abruf-URL und genau eine gleiche Push-URL (kein pushurl, keine zweite URL)' }) };

  const hole = gitStatus(w, ['fetch', '--no-tags', 'origin', `+refs/heads/${BASIS_ZWEIG}:refs/remotes/origin/${BASIS_ZWEIG}`]);
  if (hole.status !== 0) return { fehler: abgelehnt('fetch-fehlgeschlagen', { meldung: kurz(hole.stderr) }) };
  const ref = `refs/remotes/origin/${BASIS_ZWEIG}`;
  const basis = git(w, ['rev-parse', ref]).trim();
  const kopf = git(w, ['rev-parse', 'HEAD']).trim();
  const baum = git(w, ['rev-parse', 'HEAD^{tree}']).trim();
  const mergeBase = gitStatus(w, ['merge-base', ref, 'HEAD']).stdout.toString().trim();
  if (!mergeBase) return { fehler: abgelehnt('keine-gemeinsame-basis') };
  const voraus = Number(git(w, ['rev-list', '--count', `${ref}..HEAD`]).trim());
  const hinterher = Number(git(w, ['rev-list', '--count', `HEAD..${ref}`]).trim());
  if (!voraus) return { fehler: abgelehnt('nichts-zu-veroeffentlichen', { hinweis: `${zweig} enthält nichts, was nicht schon in origin/${BASIS_ZWEIG} liegt` }) };
  if (gitStatus(w, ['merge-tree', '--write-tree', '--no-messages', ref, 'HEAD']).status === 1) return { fehler: abgelehnt('merge-konflikt', { hinweis: `Der Branch lässt sich nicht konfliktfrei in ${BASIS_ZWEIG} mergen` }) };

  // Remote-Stand des Branches: nur neu oder schneller Vorlauf, nie Force
  const fern = gitStatus(w, ['ls-remote', '--heads', 'origin', `refs/heads/${zweig}`]);
  if (fern.status !== 0) return { fehler: abgelehnt('remote-nicht-erreichbar', { meldung: kurz(fern.stderr) }) };
  const remoteSpitze = fern.stdout.toString().trim().split(/\s+/)[0] || null;
  let push = 'neu';
  if (remoteSpitze) {
    if (remoteSpitze === kopf) push = 'aktuell';
    else {
      if (gitStatus(w, ['cat-file', '-e', `${remoteSpitze}^{commit}`]).status !== 0) gitStatus(w, ['fetch', '--no-tags', 'origin', `+refs/heads/${zweig}:refs/remotes/origin/${zweig}`]);
      if (gitStatus(w, ['merge-base', '--is-ancestor', remoteSpitze, 'HEAD']).status !== 0) return { fehler: abgelehnt('remote-weicht-ab', { remote: remoteSpitze.slice(0, 7), kopf: kopf.slice(0, 7), hinweis: 'Der Remote-Branch hat Commits, die HEAD nicht enthält; es wird nie ein Force-Push gemacht (Jonah entscheidet)' }) };
      push = 'vorlauf';
    }
  }

  const diff = git(w, ['diff', '--binary', `${ref}...HEAD`], { text: false });
  const dateien = git(w, ['diff', '--name-only', '-z', `${ref}...HEAD`]).split('\0').filter(Boolean).map(vor).sort();
  const gesperrt = dateien.filter(geschuetzterPfad);
  if (gesperrt.length) return { fehler: abgelehnt('sicherheitsdateien', { dateien: gesperrt, hinweis: 'Änderungen an .claude/, .github/, tools/orchestrierung/ und .gitignore veröffentlicht dieser Ablauf nie; dafür braucht es eine eigene, ausdrücklich beschlossene Freigabe (siehe docs/orchestrierung.md)' }) };
  // Geheimnisse in jedem Objekt, das mitgepusht wird (alle Blobs aus `main..HEAD`, auch wenn ein späterer Commit die Datei wieder entfernt, umbenennt oder ihren Typ ändert: die Historie geht ins Remote).
  // Fail-closed: ein Blob, der sich nicht lesen lässt, lehnt die Veröffentlichung ab.
  try {
    const objekte = git(w, ['rev-list', '--objects', `${ref}..HEAD`]).split('\n').filter(Boolean).map((z) => { const i = z.indexOf(' '); return i < 0 ? { sha: z, pfad: '' } : { sha: z.slice(0, i), pfad: z.slice(i + 1) }; });
    const arten = git(w, ['cat-file', '--batch-check=%(objecttype) %(objectname)'], { input: `${objekte.map((o) => o.sha).join('\n')}\n` }).split('\n').filter(Boolean);
    if (arten.length !== objekte.length) throw new Error('Objektliste und Typliste passen nicht zusammen');
    for (const [i, o] of objekte.entries()) {
      if (!arten[i].startsWith('blob ')) continue;
      try { pruefeGeheimnisse(o.pfad || o.sha, git(w, ['cat-file', 'blob', o.sha], { text: false })); } catch (f) { return { fehler: abgelehnt('geheimnis', { datei: o.pfad || o.sha, hinweis: String(f.message) }) }; }
    }
  } catch (f) { return { fehler: abgelehnt('geheimnis-pruefung', { hinweis: `Die zu pushenden Objekte ließen sich nicht vollständig prüfen: ${String(f.message).slice(0, 200)}` }) }; }
  const stat = git(w, ['diff', '--stat', `${ref}...HEAD`]).trim().split('\n');
  const commits = git(w, ['log', '--format=%h %s', `${ref}..HEAD`]).trim().split('\n').filter(Boolean);
  return { werte: { ursprung: [...new Set([...abrufUrls, ...pushUrls])].join(' '), zweig, kopf, baum, basis, mergeBase, voraus, hinterher, remoteSpitze, push, dateien, commits, stat, diffSha256: sha256(diff) } };
}

// ---------------------------------------------------------------- Nachweise (Tests, Review, Befunde)
/** Ablagen mit Nachweisen für den Branch: die eigene, dann beendete Läufe, die diesen Stand übernommen haben. */
function nachweisAblagen(w, zweig) {
  const l = [{ name: 'branch', dir: verzeichnis(w, zweig) }];
  const wurzel = path.join(orchDir(w), 'laeufe');
  if (fs.existsSync(wurzel)) {
    for (const id of fs.readdirSync(wurzel).sort().reverse()) {
      const d = path.join(wurzel, id);
      if (fs.existsSync(path.join(d, 'gesperrt.json'))) continue;
      let a; try { a = leseJson(path.join(d, 'lauf.json')); } catch { continue; }
      if (a?.status === 'beendet' && a.uebernommen) l.push({ name: `lauf ${id}`, dir: d });
    }
  }
  return l;
}
function bewerte(w, zweig, baum) {
  const alle = nachweisAblagen(w, zweig).map((q) => ({ ...q, ...bewerteNachweise(q.dir, baum) }));
  const gut = alle.find((x) => x.gruende.length === 0);
  return { ...(gut ?? alle[0]), hatTests: alle.some((x) => x.tests), quelle: (gut ?? alle[0]).name };
}

/** Startet die Suite `kurz` im Hauptbaum selbst (bereinigte Umgebung wie `tests-ausfuehren`) und protokolliert das echte Ergebnis für den Baum von HEAD. */
function testeSelbst(w, zweig, baum, timeoutMs = 1800000) {
  const z0 = zustand(w, AUSSCHLUSS); const g0 = gitAbdruck(w, { mitWorktrees: true });
  const privat = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-test-'));
  let r;
  try {
    fs.writeFileSync(path.join(privat, 'gitconfig'), '');
    r = spawnSync(process.execPath, SUITEN.kurz, { cwd: w, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 256 << 20, env: testUmgebung(process.env, privat) });
  } finally { try { fs.rmSync(privat, { recursive: true, force: true, maxRetries: 3 }); } catch { /* egal */ } }
  const verdacht = [...abdruckUnterschiede(g0, gitAbdruck(w, { mitWorktrees: true }), 'git'), ...zustandsUnterschiede(z0, zustand(w, AUSSCHLUSS))];
  if (verdacht.length) throw new LaufFehler(`MANIPULATIONSVERDACHT: Während der Tests änderten sich ${verdacht.length} Stelle(n) (${verdacht.slice(0, 5).join('; ')}). Es wird nichts protokolliert und nichts veröffentlicht; Jonah berichten`);
  const z = liesTestZaehler(r.stdout);
  if (!z) throw new LaufFehler(`Die Testausgabe war nicht lesbar oder nicht stimmig (Exit ${r.status}, ${r.error ? r.error.message : 'keine vollständige, rechnende Zusammenfassung'}); es wird nichts protokolliert`);
  const exit = r.status ?? 1;
  if (exit === 0 && (z.fail > 0 || z.cancelled > 0)) throw new LaufFehler('Die Testausgabe widerspricht dem Exit-Code; es wird nichts protokolliert');
  if (git(w, ['status', '--porcelain']).trim()) throw new LaufFehler('Die Tests haben den Arbeitsbaum verändert; das Ergebnis gilt nicht für den committeten Stand');
  anhaengen(path.join(verzeichnis(w, zweig), 'tests.jsonl'), { baum, suite: 'kurz', gruen: z.pass, fehlgeschlagen: z.fail + z.cancelled, uebersprungen: z.skipped, exit, quelle: 'werkzeug', zeit: jetzt() });
}

/** Review-Paket für den Branch (Merge-Basis bis HEAD) im isolierten Review-Ordner; Voraussetzung für `nachweisReview`. */
export function nachweisPaket(w, { kontext = [], hinweise = '', wurzel = null } = {}) {
  return mitHaertung(() => {
    const zweig = aktuellerBranch(w);
    const hole = gitStatus(w, ['fetch', '--no-tags', 'origin', `+refs/heads/${BASIS_ZWEIG}:refs/remotes/origin/${BASIS_ZWEIG}`]);
    if (hole.status !== 0) throw new LaufFehler(`fetch von ${BASIS_ZWEIG} fehlgeschlagen: ${kurz(hole.stderr)}`);
    const basis = gitStatus(w, ['merge-base', `refs/remotes/origin/${BASIS_ZWEIG}`, 'HEAD']).stdout.toString().trim();
    const kopf = git(w, ['rev-parse', 'HEAD']).trim(); const baum = git(w, ['rev-parse', 'HEAD^{tree}']).trim();
    const p = reviewPaket(w, basis, kopf, wurzel ?? standardReviewVerzeichnis(), { id: `veroeffentlichen-${zweig.slice(ZWEIG_PRAEFIX.length)}-${kopf.slice(0, 7)}`, kontext, hinweise: `${hinweise}\n\nBranch ${zweig} gegen ${BASIS_ZWEIG}` });
    anhaengen(path.join(verzeichnis(w, zweig), 'pakete.jsonl'), { baum, basis, dir: vor(p.dir), base: p.base, head: p.head, diffSha256: p.diffSha256, zeit: jetzt() });
    return { ...p, geaendert: p.geaendert.map((x) => `${x.status} ${x.pfad}`), reviewVerzeichnis: standardReviewVerzeichnis() };
  });
}

/** Meldet das Codex-Ergebnis für den Baum von HEAD (nur mit Review-Paket für genau diesen Stand); Prüfung wie `review-melden`. */
export function nachweisReview(w, kopf, befunde = []) {
  return mitHaertung(() => {
    const zweig = aktuellerBranch(w);
    const baum = git(w, ['rev-parse', 'HEAD^{tree}']).trim();
    const d = verzeichnis(w, zweig);
    if (!leseZeilen(path.join(d, 'pakete.jsonl')).some((x) => x.baum === baum)) throw new LaufFehler('Für den Stand von HEAD gibt es kein Review-Paket (zuerst: veroeffentlichen-paket). Ein Review zählt nur für genau den Stand des Pakets');
    pruefeBefundListe(befunde);
    const r = pruefeReviewErgebnis(kopf);
    anhaengen(path.join(d, 'reviews.jsonl'), {
      baum, gueltig: r.gueltig, gruende: r.gruende, verdict: kopf?.verdict ?? null, session_id: kopf?.session_id ?? null,
      befunde: befunde.map((b) => ({ id: b.id, schwere: b.schwere, kurz: String(b.kurz ?? '').slice(0, 200) })), zeit: jetzt(),
    });
    return { ...r, baum, befunde: befunde.length };
  });
}

/** Stuft einen Befund des Reviews für den Baum von HEAD ein (Regeln wie `befund-melden`). */
export function nachweisBefund(w, { id, einstufung, beleg = '' }) {
  return mitHaertung(() => {
    const zweig = aktuellerBranch(w);
    const baum = git(w, ['rev-parse', 'HEAD^{tree}']).trim();
    const d = verzeichnis(w, zweig);
    const rv = leseZeilen(path.join(d, 'reviews.jsonl')).filter((x) => x.baum === baum).at(-1);
    if (!rv) throw new LaufFehler('Für den Stand von HEAD gibt es noch kein gemeldetes Review (veroeffentlichen-review)');
    const b = (rv.befunde ?? []).find((x) => x.id === id);
    if (!b) throw new LaufFehler(`Befund „${String(id)}“ gehört nicht zum Review des Stands von HEAD`);
    pruefeEinstufung(b, einstufung, beleg);
    anhaengen(path.join(d, 'befunde.jsonl'), { baum, session_id: rv.session_id, id, einstufung, beleg: String(beleg).slice(0, 1000), zeit: jetzt() });
    return { id, einstufung, baum };
  });
}

// ---------------------------------------------------------------- Vorprüfung
function pruefeText(titel, einschraenkungen) {
  if (typeof titel !== 'string' || !titel.trim() || titel.length > 120 || /[\r\n]/.test(titel)) return abgelehnt('titel', { hinweis: 'eine Zeile, höchstens 120 Zeichen' });
  if (typeof einschraenkungen !== 'string' || einschraenkungen.trim().length < 10) return abgelehnt('einschraenkungen', { hinweis: 'Bekannte Einschränkungen angeben (oder ausdrücklich „Keine bekannten Einschränkungen“)' });
  return null;
}

/** Alles, was der Freigabe-Hash bindet. Reihenfolge der Felder ist fest. */
const kernVon = (s, n, titel, einschraenkungen) => ({
  repo: GITHUB_REPO, ursprung: s.ursprung, branch: s.zweig, kopf: s.kopf, baum: s.baum, basis: s.basis, mergeBase: s.mergeBase, diffSha256: s.diffSha256,
  tests: { quelle: n.quelle, suite: n.tests.suite, gruen: n.tests.gruen, fehlgeschlagen: n.tests.fehlgeschlagen },
  review: { session_id: n.review.session_id, verdict: n.review.verdict, befunde: n.befundStand },
  titel: titel.trim(), einschraenkungen: einschraenkungen.trim(),
});
const hashVon = (kern) => sha256(JSON.stringify(kern)).slice(0, 16);
const prKern = (pr) => (pr ? { nummer: pr.number, headRefOid: pr.headRefOid, isDraft: pr.isDraft, basis: pr.baseRefName } : null);

function gesamtStand(w, umgebung, { titel, einschraenkungen, testen }) {
  const t = pruefeText(titel, einschraenkungen); if (t) return { fehler: t };
  const st = ermittleStand(w, umgebung); if (st.fehler) return st;
  const s = st.werte;
  let n = bewerte(w, s.zweig, s.baum);
  if (!n.hatTests && testen) { testeSelbst(w, s.zweig, s.baum, umgebung.testTimeoutMs); n = bewerte(w, s.zweig, s.baum); }
  if (n.gruende.length) return { fehler: abgelehnt('freigabe', { gruende: n.gruende, hinweis: 'Tests grün und gültiges, vollständig eingestuftes Codex-Review für genau diesen Stand sind Pflicht (veroeffentlichen-paket, review_code, veroeffentlichen-review, veroeffentlichen-befund)' }) };
  const p = findePr(w, umgebung, s.zweig); if (p.fehler) return p;
  if (p.pr && p.pr.baseRefName !== BASIS_ZWEIG) return { fehler: abgelehnt('pr-basis', { nummer: p.pr.number, basis: p.pr.baseRefName, pr: p.pr.url, hinweis: `Die offene PR hat die Basis „${p.pr.baseRefName}“ statt „${BASIS_ZWEIG}“: Jonah entscheidet (PR anpassen oder schließen); es wird nichts gepusht` }) };
  const kern = kernVon(s, n, titel, einschraenkungen);
  return { s, n, kern, hash: hashVon(kern), pr: p.pr };
}

/** Zeigt den Stand und liefert den Freigabe-Hash; schreibt nur die Vorprüfungsdatei unter .claude/orchestrierung (nicht versioniert). */
export function vorpruefung(w, { titel, einschraenkungen = '' }, umgebung = {}) {
  return mitHaertung(() => {
    const g = gesamtStand(w, umgebung, { titel, einschraenkungen, testen: true });
    if (g.fehler) return g.fehler;
    const { s, n, kern, hash, pr } = g;
    schreibeJson(path.join(verzeichnis(w, s.zweig), 'zustand.json'), { hash, kern, remoteSpitze: s.remoteSpitze, pr: prKern(pr), fortschritt: {}, zeit: jetzt() });
    return {
      status: 'bereit', repository: GITHUB_REPO, branch: s.zweig, ziel: BASIS_ZWEIG, commit: s.kopf, basis: s.basis, voraus: s.voraus, hinterher: s.hinterher,
      commits: s.commits, diff: { dateien: s.dateien.length, uebersicht: s.stat, sha256: s.diffSha256 },
      remote: { branch: s.remoteSpitze ?? null, push: s.push }, pr: prKern(pr) ?? 'keine offene PR (wird erstellt)',
      tests: { quelle: n.quelle, suite: n.tests.suite, gruen: n.tests.gruen, fehlgeschlagen: n.tests.fehlgeschlagen },
      review: { verdict: n.review.verdict, session_id: n.review.session_id, befunde: (n.review.befunde ?? []).length },
      freigabeHash: hash,
      aufruf: `node tools/orchestrierung/cli.js veroeffentlichen --branch ${s.zweig} --bestaetigt ${hash}`,
      hinweis: 'Dieser Aufruf löst den Bestätigungsdialog von Claude Code aus; der Klick darauf ist die Freigabe. Ändert sich Branch, HEAD, Basis, Diff, Tests, Review, Titel, Einschränkungen, Origin-URL, der Remote-Branch oder die PR, ist eine neue Vorprüfung (und ein neuer Dialog) nötig',
    };
  });
}

// ---------------------------------------------------------------- Veröffentlichung
function prText(g) {
  const { s, n, kern } = g;
  const befunde = (n.review.befunde ?? []).map((b) => `  - ${b.id} (${b.schwere})`);
  return [
    '## Zusammenfassung', kern.titel, '',
    '## Änderungen', ...s.commits.slice(0, 30).map((c) => `- ${c}`), '', '```', ...s.stat, '```', '',
    '## Tests', `- \`${kern.tests.suite}\`: ${kern.tests.gruen} grün, ${kern.tests.fehlgeschlagen} fehlgeschlagen (Quelle: ${kern.tests.quelle}, Baum ${s.baum.slice(0, 10)})`, '',
    '## Unabhängiges Review (Codex)', `- Ergebnis: ${kern.review.verdict}, Session ${kern.review.session_id}, ${(n.review.befunde ?? []).length} Befunde (alle eingestuft)`, ...befunde, '',
    '## Bekannte Einschränkungen', kern.einschraenkungen, '',
    '## Ablauf', `Veröffentlicht mit \`cli.js veroeffentlichen\` (Freigabe-Hash ${g.hash}). Über den Merge entscheidet Jonah.`, '', TRAILER, '',
    '🤖 Generated with [Claude Code](https://claude.com/claude-code)', '',
  ].join('\n');
}

function blockiert(w, z, zweig, schritt, grund, extra = {}) {
  schreibeJson(path.join(verzeichnis(w, zweig), 'zustand.json'), z);
  return { status: 'blockiert', schritt, grund, pr: z.fortschritt.pr?.url ?? null, fortschritt: z.fortschritt, ...extra, hinweis: 'Stoppen und Jonah den konkreten Grund nennen; ein erneuter Aufruf mit demselben Hash setzt fort und verwendet eine schon erstellte PR' };
}

/**
 * Pusht den freigegebenen Branch, verwendet die offene PR oder erstellt sie, setzt sie auf „Ready for review“, prüft den PR-Head, wartet auf die Pflichtchecks
 * und den Job `test` aus test.yml. Nur mit dem Hash der Vorprüfung; jede Änderung an Branch, HEAD, Basis, Diff, Tests, Review, Titel, Einschränkungen oder Origin-URL sowie am Remote-Branch oder an der PR hält vor dem Push an.
 * @param {{branch: string, bestaetigt: string}} p
 * @param {{erlaubteRemotes?: string[], gh?: string[], ghEnv?: object, intervallMs?: number, timeoutMs?: number}} umgebung nur für Tests (die Kommandozeile reicht nichts davon durch)
 */
export function veroeffentlichen(w, { branch, bestaetigt }, umgebung = {}) { return mitHaertung(() => veroeffentlichenIntern(w, { branch, bestaetigt }, umgebung)); }

function veroeffentlichenIntern(w, { branch, bestaetigt }, umgebung) {
  if (typeof branch !== 'string' || !BRANCH.test(branch)) return abgelehnt('branch', { hinweis: '--branch claude/<name> angeben' });
  if (typeof bestaetigt !== 'string' || !HASH.test(bestaetigt)) return abgelehnt('freigabe-hash', { hinweis: '--bestaetigt <16 Hex-Zeichen> aus der Vorprüfung angeben' });
  let aktuell; try { aktuell = aktuellerBranch(w); } catch (f) { return abgelehnt('branch', { hinweis: f.message }); }
  if (aktuell !== branch) return abgelehnt('branch-weicht-ab', { erwartet: branch, ist: aktuell });
  const dat = path.join(verzeichnis(w, branch), 'zustand.json');
  let z; try { z = leseJson(dat); } catch { return abgelehnt('keine-vorpruefung', { hinweis: 'Zuerst: veroeffentlichen-vorpruefung' }); }
  if (z.hash !== bestaetigt) return abgelehnt('freigabe-passt-nicht', { hinweis: 'Der Hash gehört nicht zur letzten Vorprüfung dieses Branches; neue Vorprüfung nötig' });

  // Stand neu ermitteln (ohne die Tests zu wiederholen) und gegen die Freigabe halten
  const g = gesamtStand(w, umgebung, { titel: z.kern.titel, einschraenkungen: z.kern.einschraenkungen, testen: false });
  if (g.fehler) return g.fehler;
  if (g.hash !== z.hash) {
    const geaendert = Object.keys(z.kern).filter((k) => JSON.stringify(z.kern[k]) !== JSON.stringify(g.kern[k]));
    return abgelehnt('freigabe-veraltet', { geaendert, hinweis: 'Branch, HEAD, Basis, Diff, Tests oder Review haben sich seit der Vorprüfung geändert: neue Vorprüfung und neue Freigabe nötig. Es wurde nichts gepusht' });
  }
  const { s } = g;
  z.fortschritt ??= {};
  const f = z.fortschritt;

  // 1. Push (nur dieser Branch, ausdrücklicher Refspec, nie Force); vorher müssen Remote-Branch und PR noch so sein wie in der Vorprüfung
  if (!f.push) {
    if (JSON.stringify(prKern(g.pr)) !== JSON.stringify(z.pr)) return abgelehnt('pr-veraendert', { vorher: z.pr, jetzt: prKern(g.pr), hinweis: 'Die PR hat sich seit der Vorprüfung geändert: neue Vorprüfung nötig. Es wurde nichts gepusht' });
    if (s.remoteSpitze !== z.remoteSpitze) return abgelehnt('remote-veraendert', { vorher: z.remoteSpitze?.slice(0, 7) ?? null, jetzt: s.remoteSpitze?.slice(0, 7) ?? null, hinweis: 'Der Remote-Branch hat sich seit der Vorprüfung geändert: neue Vorprüfung nötig. Es wurde nichts gepusht' });
    if (s.push !== 'aktuell') {
      const p = gitStatus(w, ['push', '-u', 'origin', `refs/heads/${branch}:refs/heads/${branch}`]);
      if (p.status !== 0) return blockiert(w, z, branch, 'push', kurz(p.stderr) || kurz(p.stdout) || `Exit ${p.status}`);
    }
    const ls = gitStatus(w, ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]).stdout.toString();
    if (!ls.startsWith(s.kopf)) return blockiert(w, z, branch, 'push', 'Der Remote-Branch zeigt nicht auf den freigegebenen Commit');
    f.push = s.kopf; schreibeJson(dat, z);
  }

  // 2. PR: offene PR gegen main verwenden oder erstellen
  let pr = g.pr;
  if (!f.pr) {
    if (pr && pr.baseRefName !== BASIS_ZWEIG) return blockiert(w, z, branch, 'pr', `Die offene PR #${pr.number} hat die Basis „${pr.baseRefName}“ statt „${BASIS_ZWEIG}“`, { pr: pr.url });
    if (!pr) {
      const body = path.join(os.tmpdir(), `bw-veroeffentlichen-${s.kopf.slice(0, 10)}.md`);
      fs.writeFileSync(body, prText(g));
      const r = gh(w, umgebung, ['pr', 'create', '--repo', GITHUB_REPO, '--base', BASIS_ZWEIG, '--head', branch, '--title', z.kern.titel, '--body-file', body]);
      fs.rmSync(body, { force: true });
      if (r.status !== 0) return blockiert(w, z, branch, 'pr', kurz(r.stderr) || kurz(r.stdout) || `Exit ${r.status}`);
      const neu = findePr(w, umgebung, branch);
      pr = neu.pr ?? null;
      if (!pr) return blockiert(w, z, branch, 'pr', 'Die PR wurde erstellt, ist aber nicht abfragbar');
    }
    f.pr = { nummer: pr.number, url: pr.url }; schreibeJson(dat, z);
  }
  const nummer = f.pr.nummer;

  // 3. PR-Head muss der freigegebene Commit sein (GitHub braucht nach dem Push kurz)
  const warte = umgebung.intervallMs ?? 15000;
  let ansicht = null;
  for (let i = 0; i < 12; i++) {
    const v = prAnsicht(w, umgebung, nummer, 'number,url,isDraft,headRefOid,baseRefName,state');
    if (!v.ok || !v.daten) return blockiert(w, z, branch, 'pr-pruefung', v.meldung || 'gh pr view lieferte nichts');
    ansicht = v.daten;
    if (ansicht.headRefOid === s.kopf) break;
    schlafe(warte);
  }
  if (ansicht.headRefOid !== s.kopf) return blockiert(w, z, branch, 'pr-head', `Der Head der PR (${String(ansicht.headRefOid).slice(0, 7)}) ist nicht der freigegebene Commit (${s.kopf.slice(0, 7)})`);
  if (ansicht.baseRefName !== BASIS_ZWEIG || ansicht.state !== 'OPEN') return blockiert(w, z, branch, 'pr-pruefung', `PR #${nummer}: Basis „${ansicht.baseRefName}“, Status ${ansicht.state}`);

  // 4. Draft → Ready for review
  if (ansicht.isDraft) {
    const r = gh(w, umgebung, ['pr', 'ready', String(nummer), '--repo', GITHUB_REPO]);
    if (r.status !== 0) return blockiert(w, z, branch, 'ready', kurz(r.stderr) || kurz(r.stdout) || `Exit ${r.status}`);
    const nach = prAnsicht(w, umgebung, nummer, 'isDraft');
    if (!nach.ok || nach.daten?.isDraft !== false) return blockiert(w, z, branch, 'ready', 'Die PR ist nach „ready“ weiter ein Draft');
  }
  f.ready = true; schreibeJson(dat, z);

  // 5. Pflichtchecks und Job `test` aus test.yml
  const ende = Date.now() + (umgebung.timeoutMs ?? 25 * 60 * 1000);
  // `gh pr checks` endet mit Exit 8 (ausstehend) oder 1 (fehlgeschlagen) und liefert trotzdem JSON; nur „keine Checks gemeldet“ ist eine leere Liste, jeder andere Fehler eine Blockade
  const holeChecks = (zusatz) => {
    const r = gh(w, umgebung, ['pr', 'checks', String(nummer), '--repo', GITHUB_REPO, ...zusatz, '--json', 'name,state,bucket,workflow,link']);
    const liste = jsonVon(r.stdout);
    // „keine Checks“ zuerst und nur mit leerer oder fehlender Liste erkennen
    if (/no (required )?checks (reported|found)/i.test(`${r.stderr} ${r.stdout}`) && (!Array.isArray(liste) || !liste.length)) return { liste: [] };
    const vollstaendig = Array.isArray(liste) && liste.every((c) => c && typeof c.name === 'string' && typeof c.bucket === 'string');
    if (vollstaendig && (r.status === 0 || r.status === 8 || (r.status === 1 && liste.some((c) => ['fail', 'cancel'].includes(c.bucket))))) return { liste };
    // Exit 1 ohne fehlgeschlagenen Check, unvollständige Einträge oder jeder andere Exit: Abfragefehler, auch mit parsebarem JSON
    return { fehler: kurz(r.stderr) || kurz(r.stdout) || `Exit ${r.status}` };
  };
  let bew;
  for (;;) {
    const alle = holeChecks([]); const pflicht = holeChecks(['--required']);
    if (alle.fehler || pflicht.fehler) return blockiert(w, z, branch, 'checks', `Die Checks sind nicht abfragbar: ${alle.fehler ?? pflicht.fehler}`);
    bew = bewerteChecks(alle.liste, pflicht.liste);
    if (bew.status !== 'wartet' || Date.now() >= ende) break;
    schlafe(warte);
  }
  const zeilen = (l) => l.map((c) => ({ name: c.name, workflow: c.workflow, status: c.bucket, link: c.link }));
  if (bew.status === 'fehler') return blockiert(w, z, branch, 'checks', `Check fehlgeschlagen: ${bew.checks.map((c) => `${c.workflow ?? ''}/${c.name} (${c.bucket})`).join(', ')}`, { checks: zeilen(bew.checks) });
  if (bew.status === 'wartet') return blockiert(w, z, branch, 'checks', bew.grund === 'test-check-fehlt' ? 'Der Job „test“ aus test.yml wurde auf GitHub nicht gemeldet' : `Checks noch nicht abgeschlossen: ${bew.checks.map((c) => `${c.workflow ?? ''}/${c.name}`).join(', ')}`, { checks: zeilen(bew.checks) });
  f.checks = zeilen(bew.checks); schreibeJson(dat, z);

  // 6. GitHub-Regeln (Konflikte, fehlende Reviews, Branch-Schutz)
  let regel = null;
  for (let i = 0; i < 6; i++) {
    const v = prAnsicht(w, umgebung, nummer, 'mergeStateStatus,mergeable,reviewDecision,isDraft,url');
    if (!v.ok || !v.daten) return blockiert(w, z, branch, 'github-regel', v.meldung || 'gh pr view lieferte nichts');
    regel = v.daten;
    if (regel.mergeStateStatus && regel.mergeStateStatus !== 'UNKNOWN' && regel.mergeable && regel.mergeable !== 'UNKNOWN') break;
    schlafe(warte);
  }
  if (regel.isDraft || !['CLEAN', 'UNSTABLE', 'HAS_HOOKS', 'BEHIND'].includes(regel.mergeStateStatus) || regel.mergeable !== 'MERGEABLE') { // nur bekannte gute Werte; alles andere (auch fehlend oder UNKNOWN) ist eine Blockade
    return blockiert(w, z, branch, 'github-regel', `GitHub meldet mergeStateStatus ${regel.mergeStateStatus}, mergeable ${regel.mergeable}, reviewDecision ${regel.reviewDecision || 'keine'}`, { pr: regel.url ?? f.pr.url });
  }
  f.fertig = jetzt(); schreibeJson(dat, z);
  return { status: 'fertig', pr: regel.url ?? f.pr.url, nummer, commit: s.kopf, checks: f.checks, mergeStateStatus: regel.mergeStateStatus };
}

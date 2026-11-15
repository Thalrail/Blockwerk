// Orchestrierung: Wächtermeldung mit Referenznamen (Anforderung 5). Die Sperre bleibt unverändert streng: Sie hängt allein am Hash `refs` über alle Referenzen
// (Branches, Tags, Remote-Tracking …); die Liste `refsListe` ergänzt nur die Meldung und kann ihr nie widersprechen oder sie ersetzen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { git, zustand, zustandsUnterschiede, refsUnterschiede, sha256 } from '../../tools/orchestrierung/git.js';
import * as lauf from '../../tools/orchestrierung/lauf.js';
import fs from 'node:fs';
import { neuesRepo, neuerName, w } from './hilfe.js';

const commit = (repo, m) => git(repo, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-q', '-m', m]);

test('zustand: der Hash refs ist unverändert der Hash über die Ausgabe von for-each-ref, die Liste ist sortiert und stimmt damit überein', () => {
  const repo = neuesRepo();
  const z = zustand(repo);
  const roh = git(repo, ['for-each-ref', '--format=%(refname) %(objectname)']);
  assert.equal(z.refs, sha256(roh));
  assert.deepEqual(z.refsListe, roh.split('\n').filter(Boolean));
  assert.ok(z.refsListe.some((x) => x.startsWith('refs/heads/main ')));
});

test('Positiv: neue, verschobene und gelöschte Branches, Tags und Remote-Tracking-Referenzen werden mit Namen gemeldet; ohne Änderung nichts', () => {
  const repo = neuesRepo();
  const vorher = zustand(repo);
  assert.deepEqual(zustandsUnterschiede(vorher, zustand(repo)), []);
  git(repo, ['branch', 'neu-ast']);
  git(repo, ['tag', 'meine-marke']);
  git(repo, ['update-ref', 'refs/remotes/origin/fremd', 'HEAD']);
  const u1 = zustandsUnterschiede(vorher, zustand(repo));
  assert.ok(u1.includes('refs'));
  assert.deepEqual(u1.filter((x) => x.startsWith('refs:')), ['refs:+refs/heads/neu-ast', 'refs:+refs/remotes/origin/fremd', 'refs:+refs/tags/meine-marke']);
  // verschoben und gelöscht
  const mitNeu = zustand(repo);
  commit(repo, 'weiter');
  git(repo, ['branch', '-f', 'neu-ast', 'HEAD']);
  git(repo, ['tag', '-d', 'meine-marke']);
  const u2 = zustandsUnterschiede(mitNeu, zustand(repo)).filter((x) => x.startsWith('refs:'));
  assert.ok(u2.includes('refs:~refs/heads/neu-ast') && u2.includes('refs:-refs/tags/meine-marke') && u2.includes('refs:~refs/heads/main'), u2.join());
});

test('Negativ (Strenge unverändert): die Sperre hängt am Hash, nicht an der Liste: fehlende, leere oder erfundene Listen ändern nichts', () => {
  const repo = neuesRepo();
  const vorher = zustand(repo);
  git(repo, ['branch', 'x']);
  const nachher = zustand(repo);
  for (const [a, b] of [[{ ...vorher, refsListe: undefined }, nachher], [{ ...vorher, refsListe: [] }, { ...nachher, refsListe: [] }], [{ ...vorher, refsListe: nachher.refsListe }, nachher]]) {
    assert.ok(zustandsUnterschiede(a, b).includes('refs'), 'der Hash unterscheidet sich, also bleibt die Meldung refs bestehen');
  }
  // umgekehrt: gleiche Hashes, aber eine abweichende Liste: kein Unterschied (die Liste entscheidet nie)
  assert.deepEqual(zustandsUnterschiede(vorher, { ...vorher, refsListe: ['refs/heads/fremd 1'] }), []);
  // ältere Abdrücke ohne Liste: nur die bisherige Meldung
  assert.deepEqual(zustandsUnterschiede({ ...vorher, refsListe: undefined }, nachher).filter((x) => x.startsWith('refs:')), []);
});

test('refsUnterschiede: höchstens 8 Namen, danach eine Zählung, sortiert; Name mit Leerzeichen am Ende der Zeile bleibt heil', () => {
  const vorher = [];
  const nachher = Array.from({ length: 11 }, (_, i) => `refs/heads/b${String(i).padStart(2, '0')} ${'a'.repeat(40)}`);
  const l = refsUnterschiede(vorher, nachher);
  assert.equal(l.length, 9);
  assert.equal(l[0], 'refs:+refs/heads/b00');
  assert.equal(l[8], 'refs:… und 3 weitere');
  assert.deepEqual(refsUnterschiede(['refs/heads/a b 1'], ['refs/heads/a b 2']), ['refs:~refs/heads/a b']);
});

test('Im Lauf: eine neue Referenz im Hauptrepository sperrt die Übernahme und die Meldung nennt den Namen; haupt-kontrolle zeigt ihn ebenfalls', () => {
  // ein autonomer Lauf braucht einen sauberen Arbeitsbaum (nur er kontrolliert Hauptbaum und Referenzen vor der Übernahme)
  const repo = neuerName('sauber');
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']); git(repo, ['config', 'user.name', 't']); git(repo, ['config', 'user.email', 't@t']);
  w(repo, '.gitignore', ['.claude/worktrees/', '.claude/orchestrierung/', ''].join('\n')); w(repo, 'src/a.js', 'eins\n');
  git(repo, ['add', '-A']); git(repo, ['commit', '-q', '-m', 'basis']);
  lauf.starten(repo, { auftrag: 'Referenzen', dateien: ['src/**'], autonom: true });
  const wt = lauf.worktreeAnlegen(repo, 'agent-r1');
  w(wt, 'src/runde1.js', 'export const r = 1;\n');
  lauf.rundeEnde(repo, { worktree: wt });
  git(repo, ['branch', 'claude/zwischenstand-versehen']);
  const k = lauf.hauptKontrolle(repo);
  assert.equal(k.unveraendert, false);
  assert.ok(k.buchfuehrung.includes('refs') && k.buchfuehrung.includes('refs:+refs/heads/claude/zwischenstand-versehen'), k.buchfuehrung.join());
  const u = lauf.uebernehmen(repo, { freigabePruefen: false });
  assert.equal(u.status, 'abgelehnt');
  assert.equal(u.grund, 'integritaet');
  assert.ok(u.verstoss.includes('haupt:refs') && u.verstoss.includes('haupt:refs:+refs/heads/claude/zwischenstand-versehen'), u.verstoss.join());
  assert.match(u.hinweis, /gesperrt/);
  // der Lauf bleibt gesperrt: auch ein zweiter Versuch (und damit jede weitere Übernahme) wird abgelehnt
  assert.equal(lauf.uebernehmen(repo, { freigabePruefen: false }).grund, 'gesperrt');
  assert.ok(lauf.sperrGrund(repo, lauf.lies(repo)), 'die Sperre ist im Laufzustand vermerkt');
});

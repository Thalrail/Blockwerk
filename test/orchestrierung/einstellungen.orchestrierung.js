// Orchestrierung: Projekteinstellungen, Agenten, Skill und Ignore-Regeln sind vorhanden, verdrahtet und sicher.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lies = (p) => fs.readFileSync(path.join(wurzel, p), 'utf8');
const einst = () => JSON.parse(lies('.claude/settings.json'));
const frontmatter = (text) => { const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text); assert.ok(m, 'Frontmatter fehlt'); return Object.fromEntries(m[1].split(/\r?\n/).map((z) => { const i = z.indexOf(':'); return [z.slice(0, i).trim(), z.slice(i + 1).trim()]; })); };

test('settings.json: Hooks sind verdrahtet, zeigen auf vorhandene Skripte, und die Git-Sperren bleiben bestehen', () => {
  const e = einst();
  for (const [ereignis, skript] of [['WorktreeCreate', 'worktree-hook.js'], ['WorktreeRemove', 'worktree-hook.js'], ['PreToolUse', 'git-wache.js']]) {
    const befehle = (e.hooks?.[ereignis] ?? []).flatMap((x) => x.hooks).map((h) => h.command);
    assert.ok(befehle.some((c) => c.includes(skript)), `${ereignis} → ${skript}`);
    assert.ok(fs.existsSync(path.join(wurzel, '.claude', 'hooks', skript)));
  }
  assert.match(e.hooks.PreToolUse[0].matcher, /Bash/);
  assert.match(e.hooks.PreToolUse[0].matcher, /Write/);
  for (const sperre of ['Bash(git push *)', 'Bash(gh pr *)', 'Bash(git reset *)', 'Bash(git clean *)', 'Bash(git stash *)', 'Bash(git rebase *)']) assert.ok(e.permissions.deny.includes(sperre), sperre);
  assert.ok(e.permissions.ask.includes('Bash(git commit *)'), 'Commits fragen immer nach');
  assert.equal(e.worktree?.baseRef, 'head');
});

test('Agenten: Entwickler (Sonnet, Worktree), Dokumentationsprüfer (Haiku, nur lesend), Quellen- und Rechenprüfer (Sonnet) im Projekt', () => {
  const erwartet = {
    'blockwerk-entwickler': { model: 'sonnet', isolation: 'worktree', effort: 'medium' },
    'blockwerk-entwickler-leicht': { model: 'haiku', isolation: 'worktree', effort: 'low' },
    'blockwerk-entwickler-schwer': { model: 'opus', isolation: 'worktree' },
    'blockwerk-dokupruefer': { model: 'haiku' },
    'blockwerk-quellenpruefer': { model: 'sonnet' },
    'blockwerk-rechenpruefer': { model: 'haiku' },
  };
  for (const [name, soll] of Object.entries(erwartet)) {
    const f = frontmatter(lies(`.claude/agents/${name}.md`));
    assert.equal(f.name, name);
    for (const [k, v] of Object.entries(soll)) assert.equal(f[k], v, `${name}.${k}`);
  }
  assert.equal(frontmatter(lies('.claude/agents/blockwerk-dokupruefer.md')).tools, 'Read, Grep, Glob', 'Dokumentationsprüfer bleibt lesend');
  assert.ok(einst().permissions.ask.includes('Agent(blockwerk-entwickler-schwer)'), 'Opus-Entwickler nur nach Rückfrage');
  assert.doesNotMatch(frontmatter(lies('.claude/agents/blockwerk-quellenpruefer.md')).tools, /Edit|Write|Bash/, 'Quellenprüfer ohne Schreibrechte');
  assert.doesNotMatch(frontmatter(lies('.claude/agents/blockwerk-rechenpruefer.md')).tools, /Edit|Write/, 'Rechenprüfer ohne Schreibrechte');
  // der Entwickler darf nicht committen, pushen oder Einstellungen ändern
  const dev = lies('.claude/agents/blockwerk-entwickler.md');
  for (const w of ['git commit', 'git push', '.claude/', 'Zugangsdaten']) assert.ok(dev.includes(w), `Entwickler-Regel: ${w}`);
});

test('Skill /blockwerk-auftrag: Rollen, Tore, Schleifen und Codex-Einzelmodus stehen drin', () => {
  const skill = lies('.claude/skills/blockwerk-auftrag/SKILL.md');
  const f = frontmatter(skill);
  assert.equal(f.name, 'blockwerk-auftrag');
  assert.ok(f.description.length > 40);
  for (const stichwort of ['tools/orchestrierung/cli.js', 'blockwerk-entwickler', 'blockwerk-dokupruefer', 'blockwerk-quellenpruefer', 'blockwerk-rechenpruefer', 'review_code', 'review_mode', 'failover_occurred',
    'drei Korrekturschleifen', 'Freigabe', 'Commit', 'wiederherstellen', 'Zwischen-Snapshot', 'nie wieder', 'PushNotification']) assert.ok(skill.includes(stichwort), `Skill erwähnt ${stichwort}`);
});

test('.gitignore und Snapshot schließen Worktrees und Laufzustand aus', () => {
  const g = lies('.gitignore');
  assert.match(g, /^\.claude\/worktrees\/$/m);
  assert.match(g, /^\.claude\/orchestrierung\/$/m);
});

test('Keine Zugangsdaten in den Orchestrierungsdateien', () => {
  const dateien = [];
  const geh = (d) => { for (const e of fs.readdirSync(path.join(wurzel, d), { withFileTypes: true })) { const r = `${d}/${e.name}`; if (e.isDirectory()) geh(r); else dateien.push(r); } };
  for (const d of ['tools/orchestrierung', '.claude/hooks', '.claude/agents', '.claude/skills', 'test/orchestrierung']) if (fs.existsSync(path.join(wurzel, d))) geh(d);
  dateien.push('.claude/settings.json');
  assert.ok(dateien.length >= 15);
  for (const p of dateien) {
    const t = lies(p);
    for (const m of [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /ghp_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /\bsk-[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/]) {
      if (p.includes('test/orchestrierung')) continue; // Testdaten enthalten absichtlich Köder-Muster
      assert.doesNotMatch(t, m, p);
    }
  }
});

const UEBERNOMMEN = ['test-driven-development', 'debugging-and-error-recovery', 'code-review-and-quality', 'source-driven-development', 'doubt-driven-development', 'code-simplification', 'context-engineering'];
const ohneVorrang = (text) => text.replace(/<!-- blockwerk-vorrang -->[\s\S]*?<!-- \/blockwerk-vorrang -->/, '');

test('Fremde Skills: sieben Agent Skills und die Einfachheitsregeln sind projektlokal, mit Quelle, Stand und Lizenz', () => {
  for (const name of [...UEBERNOMMEN, 'einfachheit']) {
    const text = lies(`.claude/skills/${name}/SKILL.md`);
    const f = frontmatter(text);
    assert.equal(f.name, name);
    assert.equal(f.license, 'MIT', name);
    assert.ok(f.description.length > 60, name);
    assert.match(text, /<!-- blockwerk-vorrang -->[\s\S]*Blockwerk-Vorrang[\s\S]*<!-- \/blockwerk-vorrang -->/, `${name}: Vorrang-Block`);
    assert.match(text, /docs\/fremdlizenzen\/(agent-skills|ponytail)-MIT\.txt/, `${name}: Lizenzverweis`);
    assert.ok(fs.existsSync(path.join(wurzel, 'docs', 'fremdlizenzen', text.includes('ponytail-MIT') ? 'ponytail-MIT.txt' : 'agent-skills-MIT.txt')));
  }
  assert.match(lies('docs/fremdlizenzen/agent-skills-MIT.txt'), /MIT License[\s\S]*Addy Osmani/);
  assert.match(lies('docs/fremdlizenzen/ponytail-MIT.txt'), /MIT License[\s\S]*DietrichGebert/);
  const herkunft = lies('docs/fremdlizenzen/README.md');
  assert.match(herkunft, /eb07f19f52c2669f2364897aaa293e2aaddd7b1c/);
  assert.match(herkunft, /96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/);
});

test('Fremde Skills: keine Git-Schreibbefehle, Installationen, Netzzugriffe, MCP oder Fremd-Prüfer außerhalb des Vorrang-Blocks', () => {
  const verboten = [
    [/git\s+(bisect|commit|push|checkout|switch|branch|merge|rebase|reset|stash|add|tag|cherry-pick)\b/i, 'Git-Schreibbefehl'],
    [/\bnpx\s/i, 'npx'], [/\bnpm\s+(install|i|ci|audit|publish)\b/i, 'npm-Installation'], [/\b(pip|pipx|uv)\s+(install|tool)\b/i, 'Python-Installation'],
    [/\b(curl|wget)\b/i, 'Download'], [/https?:\/\//i, 'Netzadresse'], [/\bMCP\b/, 'MCP'], [/DevTools/i, 'DevTools'],
    [/codex\s+exec|which\s+(gemini|codex)|gemini\s+(-p|--|CLI)/i, 'Fremd-Prüfer per Kommandozeile'], [/~\/\.(claude|config)/, 'globale Konfiguration'],
    [/\.\.\/\.\.\/references|references\//, 'Verweis auf fehlende Dateien'], [/security-and-hardening|performance-optimization|browser-testing-with-devtools/, 'nicht übernommener Skill'],
  ];
  for (const name of [...UEBERNOMMEN, 'einfachheit']) {
    const text = ohneVorrang(lies(`.claude/skills/${name}/SKILL.md`));
    for (const [re, was] of verboten) {
      // erlaubt bleibt allein der Hinweis, dass etwas verboten ist ("is not allowed", "STOP", "no ... in Blockwerk")
      for (const zeile of text.split('\n').filter((z) => re.test(z))) assert.match(zeile, /not allowed|STOP|no cross-model|There is no|never install|Blockwerk has no|ist verboten|nie |kein/i, `${name}: ${was}: ${zeile.trim().slice(0, 100)}`);
    }
  }
});

test('Skills in Agenten: Entwickler, Dokumentationsprüfer und Quellenprüfer laden die passenden, doubt-driven nie in einen Agenten', () => {
  const liste = (n) => (frontmatter(lies(`.claude/agents/${n}.md`)).skills ?? '').replace(/[[\]]/g, '').split(',').map((x) => x.trim()).filter(Boolean);
  // Token-Effizienz: vorgeladen wird nur `einfachheit`, alles andere holt der Agent bei Bedarf über das Skill-Werkzeug
  for (const n of ['blockwerk-entwickler', 'blockwerk-entwickler-leicht', 'blockwerk-entwickler-schwer']) {
    assert.deepEqual(liste(n), ['einfachheit'], n);
    if (n !== 'blockwerk-entwickler-leicht') assert.match(frontmatter(lies(`.claude/agents/${n}.md`)).tools, /Skill/, `${n} darf Skills bei Bedarf laden`);
  }
  for (const n of ['blockwerk-dokupruefer', 'blockwerk-quellenpruefer', 'blockwerk-rechenpruefer']) assert.deepEqual(liste(n), [], n);
  for (const n of ['blockwerk-entwickler', 'blockwerk-entwickler-leicht', 'blockwerk-entwickler-schwer', 'blockwerk-dokupruefer', 'blockwerk-quellenpruefer', 'blockwerk-rechenpruefer']) {
    for (const s of liste(n)) assert.ok(fs.existsSync(path.join(wurzel, '.claude', 'skills', s, 'SKILL.md')), `${n} → ${s}`);
    assert.ok(!liste(n).includes('doubt-driven-development') && !liste(n).includes('context-engineering'), 'Koordinator-Skills nicht in Agenten');
  }
  // der Koordinator-Skill nennt die Zuordnung
  const skill = lies('.claude/skills/blockwerk-auftrag/SKILL.md');
  for (const s of [...UEBERNOMMEN, 'einfachheit']) assert.ok(skill.includes(`\`${s}\``), `/blockwerk-auftrag erwähnt ${s}`);
});

test('Graphify und OmniRoute bleiben aus, Ponytail ist kein Plugin: keine zusätzlichen Hooks, Server, Abhängigkeiten oder Dateien', () => {
  const e = einst();
  assert.deepEqual(Object.keys(e.hooks).sort(), ['PreToolUse', 'WorktreeCreate', 'WorktreeRemove'], 'nur die drei Orchestrierungs-Hooks');
  assert.equal(e.hooks.PreToolUse.length, 1);
  assert.equal(e.mcpServers, undefined);
  assert.equal(e.enabledPlugins, undefined);
  assert.equal(e.statusLine, undefined);
  assert.equal(e.env, undefined);
  const einstText = lies('.claude/settings.json');
  assert.doesNotMatch(einstText, /ponytail|graphify|omniroute|agent-skills/i);
  for (const nein of ['.mcp.json', '.claude/skills/graphify', '.claude/skills/ponytail', '.claude/hooks/ponytail.js', 'graphify-out', '.claude/plugins']) assert.ok(!fs.existsSync(path.join(wurzel, nein)), nein);
  const pkg = JSON.parse(lies('package.json'));
  assert.equal(pkg.dependencies, undefined); assert.equal(pkg.devDependencies, undefined);
  assert.ok(fs.existsSync(path.join(wurzel, '.claude', 'hooks', 'git-wache.js')) && fs.existsSync(path.join(wurzel, '.claude', 'hooks', 'worktree-hook.js')));
  // die Doku nennt den Grund
  const doku = lies('docs/orchestrierung-erweiterungen.md');
  assert.match(doku, /Graphify[\s\S]*bleibt deaktiviert|Graphify[\s\S]*nicht aktiv/);
  assert.match(doku, /OmniRoute[\s\S]*bleibt deaktiviert|OmniRoute[\s\S]*nicht integrieren/);
});


test('Modell-Routing (Jonah, 31.10.2026): Haiku nur mechanisch, Sonnet direkt bei Logik, Eskalation statt Haiku-Schleifen, Opus nur nach Freigabe', () => {
  const skill = lies('.claude/skills/blockwerk-auftrag/SKILL.md');
  for (const wort of ['rein mechanische', 'Heuristik', 'Regex', 'Zustandslogik', 'Korrektheitsgarantie', 'Direkt Sonnet', 'Eskalation', 'statt mehrere Haiku-Korrekturschleifen']) assert.ok(skill.includes(wort), `/blockwerk-auftrag nennt „${wort}“`);
  assert.match(skill, /Opus \(`blockwerk-entwickler-schwer`\) nie ohne ausdrückliche Freigabe von Jonah/);
  const leicht = lies('.claude/agents/blockwerk-entwickler-leicht.md');
  for (const wort of ['Entscheidungslogik', 'Heuristik', 'Regex', 'Zustandslogik', 'Korrektheitsgarantie', 'zu groß für leicht']) assert.ok(leicht.includes(wort), `Agent leicht nennt „${wort}“`);
  // Opus bleibt hinter der Rückfrage-Berechtigung
  assert.ok(einst().permissions.ask.includes('Agent(blockwerk-entwickler-schwer)'));
});

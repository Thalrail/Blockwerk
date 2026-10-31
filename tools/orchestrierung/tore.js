// Orchestrierung: Freigabegrenzen („Tore“). Prüft die Arbeit eines Agenten (S0 → S1) auf alles, was Jonah entscheiden muss oder nie automatisch geschehen darf.
// Stufen: „stopp“ = nie automatisch übernehmen; „frage“ = nur mit ausdrücklicher Zustimmung von Jonah; „info“ = Hinweis für den Bericht.
import { builtinModules } from 'node:module';
import { blob, git } from './git.js';
import { aenderungen, hinzugefuegteZeilen } from './delta.js';

const BUILTIN = new Set(builtinModules.flatMap((m) => [m, m.replace(/^node:/, '')]));
const IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
const ABHAENGIGKEITEN = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'bundledDependencies', 'bundleDependencies'];
const ENTWURFSREGELN = /^(plan|leser|tech|bau|form)\./;
const eolStil = (b) => { const t = b.toString('latin1'); const crlf = (t.match(/\r\n/g) ?? []).length, lf = (t.match(/(?<!\r)\n/g) ?? []).length; return crlf && !lf ? 'crlf' : lf && !crlf ? 'lf' : crlf || lf ? 'gemischt' : 'keine'; };
const json = (b) => { try { return b ? JSON.parse(b.toString('utf8')) : null; } catch { return null; } };

/** Einfache Globs (`*`, `**`, `?`) → RegExp. */
export function globZuRegex(g) {
  let r = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') { i++; if (g[i + 1] === '/') { i++; r += '(?:.*/)?'; } else r += '.*'; }
    else if (c === '*') r += '[^/]*';
    else if (c === '?') r += '[^/]';
    else r += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${r}$`);
}

/**
 * @param {string} repo Repository, das beide Commits kennt
 * @param {{dateien?: string[]|null, ausgeschlossen?: Array<{pfad: string, grund: string}>}} [optionen]
 *   `dateien`: Globs der Dateien, die der Auftrag ändern darf (alles andere ist „ausserhalb-auftrag“)
 *   `ausgeschlossen`: Dateien, die der Snapshot nicht übernommen hat (verboten, nicht erlaubt, zu groß, Symlink)
 * @returns {{findings: Array<{stufe: string, tor: string, pfad: string, grund: string}>}}
 */
export function pruefeTore(repo, s0, s1, { dateien = null, ausgeschlossen = [] } = {}) {
  const f = [];
  const add = (stufe, tor, pfad, grund) => f.push({ stufe, tor, pfad, grund });
  const globs = dateien ? dateien.map(globZuRegex) : null;
  const imS0 = git(repo, ['ls-tree', '-r', '--name-only', '-z', s0]).split('\0').filter(Boolean);
  for (const a of ausgeschlossen) add('frage', 'nicht-uebernommen', a.pfad, `Datei wurde nicht in den Snapshot übernommen (${a.grund}); sie ginge sonst still verloren`);
  for (const { status, pfad } of aenderungen(repo, s0, s1)) {
    const alt = blob(repo, s0, pfad), neu = blob(repo, s1, pfad);
    if (/^\.claude\//.test(pfad) || /^tools\/orchestrierung\//.test(pfad) || pfad === '.gitignore' || /^\.github\//.test(pfad)) {
      add('stopp', 'sicherheit', pfad, 'Orchestrierungs-, Sicherheits- und CI-Dateien ändert nur der Koordinator, nie ein Agent');
    }
    if (globs && !globs.some((r) => r.test(pfad))) add('frage', 'ausserhalb-auftrag', pfad, 'Datei gehört nicht zu den Dateien des Auftrags');
    if (/^(CLAUDE\.md|docs\/(ebenen|entscheidungen|konzept)\.md)$/.test(pfad)) add('frage', 'entscheidung', pfad, 'Architektur- und Entscheidungsdokumente ändert nur Jonah (oder der Koordinator nach seiner Zustimmung)');
    if (/^data\/(bloecke|wesen|drehregeln|server|gegenstaende)\.json$/.test(pfad) || /^data\/quellen\//.test(pfad)) add('frage', 'bedrock-daten', pfad, 'Änderung an Minecraft-Bedrock-Grunddaten');
    const neueBereiche = /^src\/([^/]+)\//.exec(pfad);
    if (status === 'A' && neueBereiche && !imS0.some((p) => p.startsWith(`src/${neueBereiche[1]}/`))) add('frage', 'architektur', pfad, `neuer Bereich src/${neueBereiche[1]}/`);

    // Zeilenenden
    if (neu && !neu.includes(0)) {
      if (alt && !alt.includes(0)) {
        const vor = eolStil(alt), nach = eolStil(neu);
        if (vor !== 'keine' && nach !== 'keine' && vor !== nach) add('stopp', 'zeilenenden', pfad, `Zeilenenden ${vor} → ${nach}`);
      } else if (eolStil(neu) === 'crlf') add('frage', 'zeilenenden', pfad, 'neue Datei mit CRLF (das Repository nutzt LF)');
    }

    // package.json und Abhängigkeiten
    if (pfad === 'package-lock.json' || /(^|\/)node_modules\//.test(pfad)) add('frage', 'abhaengigkeit', pfad, 'Lock-Datei oder node_modules');
    if (pfad === 'package.json') {
      const a = json(alt) ?? {}, n = json(neu) ?? {};
      for (const k of ABHAENGIGKEITEN) if (JSON.stringify(a[k]) !== JSON.stringify(n[k])) add('frage', 'abhaengigkeit', pfad, `Änderung an ${k}`);
      for (const k of ['engines', 'type', 'main', 'bin', 'exports', 'workspaces']) if (JSON.stringify(a[k]) !== JSON.stringify(n[k])) add('frage', 'architektur', pfad, `Änderung an ${k}`);
      for (const k of Object.keys(n.scripts ?? {})) if (JSON.stringify(a.scripts?.[k]) !== JSON.stringify(n.scripts[k])) add('info', 'skript', pfad, `Skript „${k}“ neu oder geändert`);
    }

    // Code: Importe, Ebenengrenzen, Datenformat
    if (/\.(m?js|cjs|html)$/.test(pfad) && neu) {
      const zeilen = hinzugefuegteZeilen(repo, s0, s1, pfad);
      const ebene = /^src\/ebene(\d)\//.exec(pfad)?.[1];
      for (const z of zeilen) {
        for (const m of z.matchAll(IMPORT)) {
          const spez = m[1];
          if (/^https?:\/\//.test(spez)) add('frage', 'abhaengigkeit', pfad, `Import von einer Netz-Adresse: ${spez}`);
          else if (!spez.startsWith('.') && !spez.startsWith('/') && !spez.startsWith('node:') && !BUILTIN.has(spez)) add('frage', 'abhaengigkeit', pfad, `externes Paket „${spez}“`);
          else if (ebene !== undefined) { const ziel = /ebene(\d)/.exec(spez)?.[1]; if (ziel !== undefined && Number(ziel) > Number(ebene)) add('stopp', 'ebenengrenze', pfad, `Ebene ${ebene} importiert aus der höheren Ebene ${ziel}: ${spez}`); }
        }
        if (/<script[^>]+src=["']https?:\/\//i.test(z)) add('frage', 'abhaengigkeit', pfad, 'Skript von einer Netz-Adresse');
        if (/^src\//.test(pfad) && /\b(const|let)\s+(VERSION|DATENSTAND)\b/.test(z)) add('frage', 'datenformat', pfad, `Versions- oder Datenstandskonstante geändert: ${z.trim().slice(0, 80)}`);
      }
    }

    // Regeldaten (Bedrock-Regeln und Entwurfsregeln)
    if (/^data\/regeln\/[^/]+\.json$/.test(pfad)) {
      const a = new Map((json(alt)?.regeln ?? []).map((r) => [r.id, r])), n = new Map((json(neu)?.regeln ?? []).map((r) => [r.id, r]));
      for (const [id, r] of a) {
        const x = n.get(id);
        const entwurf = ENTWURFSREGELN.test(id);
        if (!x) add('frage', entwurf ? 'entwurfsregel' : 'bedrock-regel', pfad, `Regel ${id} entfernt`);
        else if (JSON.stringify(r) !== JSON.stringify(x)) {
          if (x.status === 'geprüft' && r.status !== 'geprüft') add('stopp', 'geprueft-status', pfad, `Regel ${id} auf „geprüft“ gesetzt: das tut nur Jonah nach einem Spieltest`);
          else add(entwurf && (!globs || globs.some((g) => g.test(pfad))) ? 'info' : 'frage', entwurf ? 'entwurfsregel' : 'bedrock-regel', pfad, `Regel ${id} geändert`);
        }
      }
      for (const [id, x] of n) if (!a.has(id)) {
        if (x.status === 'geprüft') add('stopp', 'geprueft-status', pfad, `neue Regel ${id} mit Status „geprüft“: das tut nur Jonah nach einem Spieltest`);
        else if (!ENTWURFSREGELN.test(id) && (!x.quelle || (x.ungeprueft && !(typeof x.testanleitung === 'string' && x.testanleitung.length >= 20)))) add('frage', 'bedrock-regel', pfad, `neue Bedrock-Regel ${id} ohne Quelle oder Testanleitung`);
        else add('info', ENTWURFSREGELN.test(id) ? 'entwurfsregel' : 'bedrock-regel', pfad, `neue Regel ${id} (${x.status}${x.ungeprueft ? ', ungeprüft' : ''})`);
      }
    }
  }
  const rang = { stopp: 0, frage: 1, info: 2 };
  f.sort((a, b) => rang[a.stufe] - rang[b.stufe] || (a.pfad < b.pfad ? -1 : a.pfad > b.pfad ? 1 : 0));
  return { findings: f };
}

/** Ordnet die Funde: `stopp` blockiert immer; `frage` ist nur mit Zustimmung (Tor oder „tor:pfad“ in `erlaubt`) frei. */
export function bewerteTore(findings, erlaubt = []) {
  const stopp = findings.filter((x) => x.stufe === 'stopp');
  const offen = findings.filter((x) => x.stufe === 'frage' && !erlaubt.includes(x.tor) && !erlaubt.includes(`${x.tor}:${x.pfad}`));
  return { frei: stopp.length === 0 && offen.length === 0, stopp, offen };
}

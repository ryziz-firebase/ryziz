#!/usr/bin/env node
import { writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { task } from '../packages/flow/index.js';

if (process.argv[2] === 'install') {
  writeFileSync('.git/hooks/pre-commit', '#!/bin/sh\nnode scripts/pre-commit.js\n', { mode: 0o755 });
  process.exit(0);
}

task('Pre-commit Hook', {
  'Analysing': (c) => {
    c.staged = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  },
  'Linting': ({ staged, skip }) => {
    const targets = staged.filter((f) => /\.(js|jsx)$/.test(f));
    if (!targets.length) skip('No JS files');
    console.log(`Fixing ${targets.length} files`);
    execSync(`npx eslint --fix ${targets.map((f) => `'${f}'`).join(' ')}`);
    execSync(`git add ${targets.map((f) => `'${f}'`).join(' ')}`);
  },
  'Sorting': ({ staged }) => {
    const keys = [
      'name', 'version', 'private', 'description', 'license', 'author', // Identity
      'type', 'engines', 'packageManager', // Env
      'main', 'module', 'types', 'exports', 'bin', 'files', 'sideEffects', // Entries
      'scripts', // Runtime
      'peerDependencies', 'dependencies', 'optionalDependencies', // Deps
      'devDependencies', 'workspaces', 'eslintConfig', // Dev
      'repository', 'bugs', 'homepage', 'keywords', // Meta
    ];
    staged.filter((f) => f.endsWith('package.json')).forEach((f) => {
      const txt = readFileSync(f, 'utf8'), j = JSON.parse(txt);
      const sorted = keys.filter((k) => k in j).concat(Object.keys(j).filter((k) => !keys.includes(k))).reduce((a, k) => (a[k] = j[k], a), {});
      writeFileSync(f, JSON.stringify(sorted, null, 2) + '\n');
      execSync(`git add '${f}'`);
    });
  },
  'Indexing': (c) => {
    if (!c.staged.length) c.skip('No changes');
    c.pkgs = ['packages', 'templates']
      .flatMap((d) => readdirSync(d).map((s) => join(d, s))).filter((d) => statSync(d).isDirectory())
      .map((p) => ({ path: join(p, 'package.json'), pkg: JSON.parse(readFileSync(join(p, 'package.json'), 'utf8')) }));
    c.versions = c.pkgs.reduce((a, { pkg }) => (a[pkg.name] = pkg.version, a), {});
    c.dirty = new Set(c.pkgs.filter(({ path }) => c.staged.some((f) => f.startsWith(path.replace('/package.json', '')))).map((p) => p.pkg.name));
    if (!c.dirty.size) c.skip('No package changes');
  },
  'Bumping': (c) => {
    if (!c.dirty || !c.dirty.size) c.skip('Skipped');
    c.bumped = new Set();
    for (let loop = 0, stable = false; !stable;) {
      if (++loop > 100) throw Error('Circular dependency detected');
      stable = true;
      c.pkgs.forEach((p) => {
        ['dependencies', 'devDependencies', 'peerDependencies'].forEach((t) => {
          if (!p.pkg[t]) return;
          Object.keys(p.pkg[t]).forEach((d) => {
            if (c.versions[d] && p.pkg[t][d] !== `^${c.versions[d]}`) {
              p.pkg[t][d] = `^${c.versions[d]}`;
              c.dirty.add(p.pkg.name);
            }
          });
        });
        if (c.dirty.has(p.pkg.name) && !c.bumped.has(p.pkg.name)) {
          p.pkg.version = c.versions[p.pkg.name] = p.pkg.version.replace(/\d+$/, (v) => +v + 1);
          c.bumped.add(p.pkg.name);
          stable = false;
          console.log(`${p.pkg.name} -> ${p.pkg.version}`);
        }
      });
    }
  },
  'Syncing': ({ pkgs, bumped, skip }) => {
    if (!bumped || !bumped.size) skip('Up to date');
    pkgs.filter((p) => bumped.has(p.pkg.name)).forEach(({ path, pkg }) => {
      writeFileSync(path, JSON.stringify(pkg, null, 4) + '\n');
      execSync(`git add '${path}'`);
    });
  },
});

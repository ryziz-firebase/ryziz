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
    execSync(`npx eslint --fix ${targets.join(' ')}`, { stdio: 'inherit' });
    execSync(`git add ${targets.join(' ')}`);
  },
  'Bumping': (c) => {
    if (!c.staged.length) c.skip('No changes');
    c.pkgs = ['packages', 'templates'].flatMap((d) => readdirSync(d).map((s) => join(d, s))).filter((d) => statSync(d).isDirectory());
    c.bumped = c.pkgs.filter((p) => c.staged.some((f) => f.startsWith(p.replace(/\\/g, '/') + '/')))
      .reduce((acc, p) => {
        const path = join(p, 'package.json'), pkg = JSON.parse(readFileSync(path));
        pkg.version = pkg.version.replace(/\d+$/, (v) => +v + 1);
        writeFileSync(path, JSON.stringify(pkg, null, 4) + '\n');
        execSync(`git add ${path}`) || console.log(`${pkg.name} -> ${pkg.version}`);
        return (acc[pkg.name] = `^${pkg.version}`, acc);
      }, {});
    if (!Object.keys(c.bumped).length) c.skip('No package changes');
  },
  'Syncing': ({ pkgs, bumped, skip }) => {
    if (!Object.keys(bumped).length) skip('Up to date');
    pkgs.forEach((p) => {
      const path = join(p, 'package.json'), txt = readFileSync(path, 'utf8');
      const nTxt = Object.entries(bumped).reduce((acc, [n, v]) => acc.replace(new RegExp(`"${n}": ".*?"`, 'g'), `"${n}": "${v}"`), txt);
      if (txt !== nTxt) writeFileSync(path, nTxt) || execSync(`git add ${path}`);
    });
    try { execSync('git add package-lock.json'); } catch (e) { }
  },
});

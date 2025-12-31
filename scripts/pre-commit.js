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
    execSync(`npx eslint --fix ${targets.join(' ')}`);
    execSync(`git add ${targets.join(' ')}`);
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
      execSync(`git add ${f}`);
    });
  },
  'Bumping': ({ staged, skip }) => {
    if (!staged.length) skip('No changes');
    const pkgs = ['packages', 'templates'].flatMap((d) => readdirSync(d).map((s) => join(d, s))).filter((d) => statSync(d).isDirectory());
    const pkgMap = pkgs.reduce((a, p) => (a[JSON.parse(readFileSync(join(p, 'package.json'))).name] = p, a), {});
    const bump = (name) => {
      const p = join(pkgMap[name], 'package.json'), pkg = JSON.parse(readFileSync(p, 'utf8'));
      pkg.version = pkg.version.replace(/\d+$/, (v) => +v + 1);
      writeFileSync(p, JSON.stringify(pkg, null, 4) + '\n');
      execSync(`git add ${p}`) || console.log(`${pkg.name} -> ${pkg.version}`);
      Object.keys(pkgMap).forEach((N) => { // Check dependents
        const path = join(pkgMap[N], 'package.json'), txt = readFileSync(path, 'utf8');
        if (txt.includes(`"${name}":`)) {
          const nTxt = txt.replace(new RegExp(`"${name}": ".*?"`), `"${name}": "^${pkg.version}"`);
          if (txt !== nTxt) writeFileSync(path, nTxt) || execSync(`git add ${path}`) || bump(N);
        }
      });
    };
    pkgs.filter((p) => staged.some((f) => f.startsWith(p.replace(/\\/g, '/') + '/')))
      .map((p) => JSON.parse(readFileSync(join(p, 'package.json'))).name).forEach(bump);
  },
});

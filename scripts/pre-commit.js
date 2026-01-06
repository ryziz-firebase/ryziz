#!/usr/bin/env node
import { writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { f } from '../packages/task/index.js';

if (process.argv[2] === 'install') {
  writeFileSync('.git/hooks/pre-commit', '#!/bin/sh\nnode scripts/pre-commit.js\n', { mode: 0o755 });
  process.exit(0);
}

const staged = execSync('git diff --cached --name-only --diff-filter=AM', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const jsFiles = staged.filter((f) => /\.(js|jsx)$/.test(f));
const pkgFiles = staged.filter((f) => f.endsWith('package.json'));

f('Pre-committing',
  f('Linting', () => linting(jsFiles), { skip: !jsFiles.length && 'No JS files' }),
  f('Sorting', () => sorting(pkgFiles)),
  f('Versioning', () => versioning(staged)),
)();

function linting(files) {
  console.log(`Fixing ${files.length} files`);
  execSync(`npx eslint --fix ${files.map((f) => `'${f}'`).join(' ')}`);
  execSync(`git add ${files.map((f) => `'${f}'`).join(' ')}`);
}

function sorting(files) {
  const keys = [
    'name', 'version', 'private', 'description', 'license', 'author',
    'type', 'engines', 'packageManager',
    'main', 'module', 'types', 'exports', 'bin', 'files', 'sideEffects',
    'scripts',
    'peerDependencies', 'dependencies', 'optionalDependencies',
    'devDependencies', 'workspaces', 'eslintConfig',
    'repository', 'bugs', 'homepage', 'keywords',
  ];

  files.forEach((f) => {
    const txt = readFileSync(f, 'utf8');
    const j = JSON.parse(txt);
    const sorted = keys.filter((k) => k in j).concat(Object.keys(j).filter((k) => !keys.includes(k))).reduce((a, k) => (a[k] = j[k], a), {});
    writeFileSync(f, JSON.stringify(sorted, null, 2) + '\n');
    execSync(`git add '${f}'`);
  });
}

function versioning(stagedFiles) {
  if (!stagedFiles.length) return;

  const pkgs = ['packages', 'templates']
    .flatMap((d) => readdirSync(d).map((s) => join(d, s)))
    .filter((d) => statSync(d).isDirectory())
    .map((p) => ({
      path: join(p, 'package.json'),
      pkg: JSON.parse(readFileSync(join(p, 'package.json'), 'utf8')),
    }));

  const versions = pkgs.reduce((a, { pkg }) => (a[pkg.name] = pkg.version, a), {});
  const dirty = new Set(pkgs.filter(({ path }) => stagedFiles.some((f) => f.startsWith(path.replace('/package.json', '')))).map((p) => p.pkg.name));

  if (!dirty.size) return;

  const bumped = new Set();
  for (let loop = 0, stable = false; !stable;) {
    if (++loop > 100) throw Error('Circular dependency detected');
    stable = true;

    pkgs.forEach((p) => {
      ['dependencies', 'devDependencies', 'peerDependencies'].forEach((t) => {
        if (!p.pkg[t]) return;
        Object.keys(p.pkg[t]).forEach((d) => {
          if (versions[d] && p.pkg[t][d] !== `^${versions[d]}`) {
            p.pkg[t][d] = `^${versions[d]}`;
            dirty.add(p.pkg.name);
          }
        });
      });

      if (dirty.has(p.pkg.name) && !bumped.has(p.pkg.name)) {
        p.pkg.version = versions[p.pkg.name] = p.pkg.version.replace(/\d+$/, (v) => +v + 1);
        bumped.add(p.pkg.name);
        stable = false;
        console.log(`${p.pkg.name} -> ${p.pkg.version}`);
      }
    });
  }

  if (!bumped.size) return;

  pkgs.filter((p) => bumped.has(p.pkg.name)).forEach(({ path, pkg }) => {
    writeFileSync(path, JSON.stringify(pkg, null, 4) + '\n');
    execSync(`git add '${path}'`);
  });
}

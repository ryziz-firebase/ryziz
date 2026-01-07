#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { f } from '../packages/task/index.js';

const ctx = {
  changed: [],
  paths: [],
  packages: [],
  toPublish: [],
};

await f('Preparing',
  f('Diffing', () => ctx.changed = getChangedFiles()),
  f('Scanning', () => ctx.paths = scanWorkspaces(['packages', 'templates'])),
  f('Loading', () => ctx.packages = loadPackages(ctx.paths)),
  f('Filtering', () => ctx.toPublish = filterPublishable(ctx.packages, ctx.changed)),
)();

await f('Publishing',
  ...ctx.toPublish.map((p) => f(`${p.name}@${p.version}`, () => publishPackage(p.dir))),
  { skip: !ctx.toPublish.length && 'No changes', parallel: true },
)();

function getChangedFiles() {
  try {
    return execSync('git diff --name-only HEAD^ HEAD', { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
  } catch { return []; }
}

function scanWorkspaces(roots) {
  const paths = [];
  roots.forEach((root) => {
    if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) return;
    readdirSync(root).map((d) => join(root, d)).forEach((dir) => {
      if (statSync(dir).isDirectory()) paths.push(dir);
    });
  });
  return paths;
}

function loadPackages(paths) {
  const packages = [];
  paths.forEach((dir) => {
    const pkgPath = join(dir, 'package.json');
    try {
      const pkg = readJson(pkgPath);
      packages.push({ dir, name: pkg.name, version: pkg.version, pkgPath });
    } catch { /* skip invalid packages */ }
  });
  return packages;
}

function filterPublishable(packages, changed) {
  return packages.filter((p) =>
    changed.some((f) => f.includes(p.pkgPath.replace(/\\/g, '/'))),
  );
}

function publishPackage(dir) {
  execSync('npm publish --access public --silent', { cwd: dir, stdio: 'inherit' });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

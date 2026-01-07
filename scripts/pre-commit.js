#!/usr/bin/env node
import { writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { f } from '../packages/task/index.js';

if (process.argv[2] === 'install') installHook();

const ctx = {
  staged: [], jsFiles: [], pkgFiles: [],
  paths: [], workspaces: [], versions: {},
  dirty: new Set(),
  updates: [],
};

await f('Preparing',
  f('Scoping',
    f('Diffing', () => ctx.staged = getGitDiff()),
    f('Grouping', () => ({ js: ctx.jsFiles, pkg: ctx.pkgFiles } = groupFiles(ctx.staged))),
  ),
  f('Indexing',
    f('Scanning', () => ctx.paths = scanRoots(['packages', 'templates'])),
    f('Loading', () => ({ workspaces: ctx.workspaces, versions: ctx.versions } = loadWorkspaces(ctx.paths))),
  ),
  f('Mapping', () => ctx.dirty = findDirty(ctx.workspaces, ctx.staged)),
  f('Resolving', () => ctx.updates = resolveUpdates(ctx.workspaces, ctx.dirty, ctx.versions)),
)();

await f('Processing',
  f('Validating',
    f('Linting',
      ...ctx.jsFiles.map((file) => f(file, () => lintFile(file))),
      { skip: !ctx.jsFiles.length && 'No JS files staged', parallel: true },
    ),
    f('Sorting',
      ...ctx.pkgFiles.map((file) => f(file, () => sortPkg(file))),
      { skip: !ctx.pkgFiles.length && 'No package.json staged', parallel: true },
    ),
    { parallel: true },
  ),
  f('Syncing',
    ...ctx.updates.map((w) => f(`${w.name}@${w.pkg.version}`, () => writePkg(w.path, w.pkg))),
    { skip: !ctx.updates.length && 'No packages updated', parallel: true },
  ),
)();

function getGitDiff() {
  try {
    return execSync('git diff --cached --name-only --diff-filter=AM', { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
  } catch { return []; }
}

function groupFiles(files) {
  return {
    js: files.filter((f) => /\.(js|jsx)$/.test(f)),
    pkg: files.filter((f) => f.endsWith('package.json')),
  };
}

function scanRoots(roots) {
  const paths = [];
  roots.forEach((root) => {
    if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) return;
    readdirSync(root).map((d) => join(root, d)).forEach((dir) => {
      if (statSync(dir).isDirectory()) paths.push(dir);
    });
  });
  return paths;
}

function loadWorkspaces(paths) {
  const workspaces = [];
  const versions = {};
  paths.forEach((dir) => {
    const pkgPath = join(dir, 'package.json');
    const pkg = readJson(pkgPath);
    workspaces.push({ dir, name: pkg.name, pkg, path: pkgPath });
    versions[pkg.name] = pkg.version;
  });
  return { workspaces, versions };
}

function findDirty(workspaces, staged) {
  const dirty = new Set();
  workspaces.forEach((w) => {
    if (staged.some((f) => f.startsWith(w.dir))) dirty.add(w.name);
  });
  return dirty;
}

function resolveUpdates(workspaces, dirty, versions) {
  if (!dirty.size) return [];
  const bumped = new Set();
  let stable = false;
  let loops = 0;

  while (!stable) {
    if (++loops > 100) throw new Error('Circular dependency detected');
    stable = true;
    workspaces.forEach((w) => {
      const depsChanged = updateDeps(w.pkg, versions);
      const isDirty = dirty.has(w.name);
      if ((isDirty || depsChanged) && !bumped.has(w.name)) {
        w.pkg.version = versions[w.name] = bumpPatch(w.pkg.version);
        dirty.add(w.name);
        bumped.add(w.name);
        stable = false;
      }
    });
  }
  return workspaces.filter((w) => bumped.has(w.name));
}

function updateDeps(pkg, versions) {
  let changed = false;
  ['dependencies', 'devDependencies', 'peerDependencies'].forEach((t) => {
    if (!pkg[t]) return;
    Object.keys(pkg[t]).forEach((dep) => {
      const ver = versions[dep];
      if (ver && pkg[t][dep] !== `^${ver}`) {
        pkg[t][dep] = `^${ver}`;
        changed = true;
      }
    });
  });
  return changed;
}

function lintFile(file) {
  execSync(`npx eslint --fix '${file}'`, { stdio: 'inherit' });
  execSync(`git add '${file}'`);
}

function sortPkg(path) {
  const ORDER = ['name', 'version', 'private', 'description', 'license', 'author', 'main', 'scripts', 'dependencies', 'devDependencies'];
  const pkg = readJson(path);
  const sorted = {};
  ORDER.forEach((k) => k in pkg && (sorted[k] = pkg[k]));
  Object.keys(pkg).forEach((k) => !(k in sorted) && (sorted[k] = pkg[k]));
  writePkg(path, sorted);
}

function installHook() {
  writeFileSync('.git/hooks/pre-commit', '#!/bin/sh\nnode scripts/pre-commit.js\n', { mode: 0o755 });
  process.exit(0);
}

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

function writePkg(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  execSync(`git add '${path}'`);
}

function bumpPatch(v) { return v.replace(/\d+$/, (n) => +n + 1); }

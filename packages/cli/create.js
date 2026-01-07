#!/usr/bin/env node
import { existsSync as exists, cpSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { f } from '@ryziz/task';

const ctx = {
  root: null,
  name: null,
  dest: null,
  src: null,
};

await f('Preparing',
  f('Parsing',
    f('Args', () => ({ name: ctx.name, dest: ctx.dest } = parseArgs())),
    f('Root', () => ctx.root = resolveRoot()),
  ),
  f('Locating', () => ctx.src = findTemplate(ctx.root, ctx.name)),
)();

await f('Initializing',
  f('Cloning', () => clone(ctx.src, ctx.dest)),
  f('Configuring', () => configure(ctx.dest)),
  f('Installing', () => install(ctx.dest)),
  f('Completing', () => complete(ctx.dest)),
  { skip: getSkipReason(ctx) },
)();

function parseArgs() {
  const name = basename(process.argv[1]);
  const dest = process.argv[2] ? resolve(process.argv[2]) : null;
  return { name, dest };
}

function resolveRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../');
}

function findTemplate(root, name) {
  return [resolve(root, name), resolve(root, '../templates', name)]
    .find((p) => exists(join(p, 'package.json')));
}

function getSkipReason(ctx) {
  if (!ctx.src) return `Template ${ctx.name} not found`;
  if (!ctx.dest) return 'Project name/directory is missing';
  if (exists(ctx.dest)) return 'Directory exists';
  return false;
}

function clone(src, dest) {
  cpSync(src, dest, { recursive: true });
  if (exists(join(dest, 'gitignore'))) 
    renameSync(join(dest, 'gitignore'), join(dest, '.gitignore'));
  
}

function configure(dest) {
  const pkgPath = join(dest, 'package.json');
  const pkg = readJson(pkgPath);
  delete pkg.bin;
  pkg.name = basename(dest);
  if (pkg.dependencies?.['@ryziz/cli']) {
    (pkg.devDependencies ||= {})['@ryziz/cli'] = pkg.dependencies['@ryziz/cli'];
    delete pkg.dependencies['@ryziz/cli'];
  }
  writeJson(pkgPath, pkg);
}

function install(dest) {
  execSync('npm install', { cwd: dest });
}

function complete(dest) {
  console.log(dest);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

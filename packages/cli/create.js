#!/usr/bin/env node
import { existsSync as exists, cpSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { f } from '@ryziz/task';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../');
const name = basename(process.argv[1]);
const dest = process.argv[2] ? resolve(process.argv[2]) : null;
const src = [resolve(root, name), resolve(root, '../templates', name)]
  .find((p) => exists(join(p, 'package.json')));

f('Initializing',
  f('Verifying', verifying),
  f('Cloning', cloning),
  f('Configuring', configuring),
  f('Installing', installing),
  f('Completing', completing),
)();

function verifying() {
  if (!src) throw Error(`Template ${name} not found`);
  if (!dest) throw Error('Project name/directory is missing');
  if (exists(dest)) throw Error('Directory exists');
}

function cloning() {
  cpSync(src, dest, { recursive: true });
  if (exists(join(dest, 'gitignore'))) renameSync(join(dest, 'gitignore'), join(dest, '.gitignore'));
}

function configuring() {
  const pkgPath = join(dest, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath));
  delete pkg.bin;
  pkg.name = basename(dest);
  if (pkg.dependencies?.['@ryziz/cli']) {
    (pkg.devDependencies ||= {})['@ryziz/cli'] = pkg.dependencies['@ryziz/cli'];
    delete pkg.dependencies['@ryziz/cli'];
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

function installing() {
  execSync('npm install', { cwd: dest });
}

function completing() {
  console.log(dest);
}

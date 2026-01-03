#!/usr/bin/env node
import { existsSync as exists, cpSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { task } from '@ryziz/flow';

task('Initialize Project', {
  'Locating': (c) => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../'), name = basename(process.argv[1]);
    c.src = [resolve(root, name), resolve(root, '../templates', name)].find((p) => exists(join(p, 'package.json')));
    if (!c.src) throw Error(`Template ${name} not found`);
  },
  'Verifying': (c) => {
    if (!process.argv[2]) throw Error('Project name/directory is missing');
    if (exists(c.dest = resolve(process.argv[2]))) throw Error('Directory exists');
  },
  'Cloning': ({ src, dest }) => {
    cpSync(src, dest, { recursive: true });
    if (exists(join(dest, 'gitignore'))) renameSync(join(dest, 'gitignore'), join(dest, '.gitignore'));
  },
  'Configuring': ({ dest }) => {
    const p = join(dest, 'package.json'), pkg = JSON.parse(readFileSync(p));
    delete pkg.bin; pkg.name = basename(dest);
    if (pkg.dependencies?.['@ryziz/cli']) (pkg.devDependencies ||= {})['@ryziz/cli'] = pkg.dependencies['@ryziz/cli'], delete pkg.dependencies['@ryziz/cli'];
    writeFileSync(p, JSON.stringify(pkg, null, 2));
  },
  'Installing': ({ dest }) => execSync('npm install', { cwd: dest }),
  'Ready': ({ dest }) => console.log(dest),
});

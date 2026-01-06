#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { f } from '../packages/task/index.js';

const changed = execSync('git diff --name-only HEAD^ HEAD', { encoding: 'utf8' }).split('\n').filter(Boolean);
const all = ['packages', 'templates']
  .flatMap((d) => readdirSync(d).map((s) => join(d, s)))
  .filter((d) => statSync(d).isDirectory());
const toPublish = all.filter((p) => changed.some((f) => f.includes(join(p, 'package.json').replace(/\\/g, '/'))));

f('Publishing',
  ...toPublish.map((p) => {
    const { name, version } = JSON.parse(readFileSync(join(p, 'package.json')));
    return f(`${name}@${version}`, f.$('npm', ['publish', '--access', 'public', '--silent'], { cwd: p }));
  }),
  { parallel: true, skip: !toPublish.length && 'No changes' },
)();

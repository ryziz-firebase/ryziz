#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { task } from '../packages/flow/index.js';

task('Publish Packages', {
  'Detecting': (c) => {
    const changed = execSync('git diff --name-only HEAD^ HEAD', { encoding: 'utf8' }).split('\n');
    const all = ['packages', 'templates'].flatMap((d) => readdirSync(d).map((s) => join(d, s))).filter((d) => statSync(d).isDirectory());
    c.list = all.filter((p) => changed.some((f) => f.includes(join(p, 'package.json').replace(/\\/g, '/'))));
  },
  'Publishing': ({ list, skip }) => {
    if (!list.length) skip('No changes');
    list.forEach((p) => {
      const { name, version } = JSON.parse(readFileSync(join(p, 'package.json')));
      console.log(`${name}@${version}`);
      try { execSync('npm publish --access public', { cwd: p }); } catch (e) { }
    });
  },
});

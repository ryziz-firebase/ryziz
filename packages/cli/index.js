#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'node:module';
import runBuild from './src/build.js';

const pkg = createRequire(import.meta.url)('./package.json');

const program = new Command();
program.name('ryziz').version(pkg.version);

program.command('dev').action(() => runBuild(true));
program.command('build').action(() => runBuild(false));

program.parse();

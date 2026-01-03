#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync, readdirSync, mkdirSync, existsSync, cpSync, watch as fsWatch } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { task } from '@ryziz/flow';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

const program = new Command();
program.name('ryziz').version(pkg.version);

program.command('dev').action(() => runBuild(true));
program.command('build').action(() => runBuild(false));

program.parse();

function runBuild(watch) {
  task(watch ? 'Serving' : 'Bundling', {
    'Configuring': (c) => {
      c.root = process.cwd();
      c.out = 'dist';
      c.pub = join(c.root, 'public');
      c.pkg = require.resolve('@ryziz/router/package.json');
      if (!existsSync(c.out)) mkdirSync(c.out, { recursive: true });
    },
    'Scanning': (c) => {
      const src = resolve(c.root, 'src');
      if (existsSync(src)) {
        const files = readdirSync(src).filter((f) => f.startsWith('pages.') && f.endsWith('.jsx'));
        const maps = files.map((f, i) => ({
          n: `R${i}`,
          p: join(src, f).replace(/\\/g, '/'),
          r: ('/' + f.slice(6, -4)).replace(/^\/index$/, '/').replace(/\./g, '/').replace(/\$/g, ':'),
        }));
        c.imp = maps.map((m) => `import ${m.n} from '${m.p}';`).join('\n');
        c.rts = `[${maps.map((m) => `{path:'${m.r}',element:<${m.n}/>}`).join(',')}]`;
      } else {
        c.imp = ''; c.rts = '[]';
      }
    },
    'Building': async (c) => {
      const cp = () => existsSync(c.pub) && cpSync(c.pub, c.out, { recursive: true });

      await build({
        entryPoints: [join(dirname(c.pkg), 'entry.jsx')],
        bundle: true,
        outfile: join(c.out, 'assets/index.js'),
        plugins: [{
          name: 'vr',
          setup(b) {
            b.onResolve({ filter: /^virtual:routes$/ }, (a) => ({ path: a.path, namespace: 'vr' }));
            b.onLoad({ filter: /.*/, namespace: 'vr' }, () => ({
              contents: `import React from 'react';\n${c.imp}\nexport default ${c.rts};`,
              loader: 'jsx',
              resolveDir: c.root,
            }));
          },
        }],
        loader: { '.js': 'jsx', '.jsx': 'jsx' },
        jsx: 'automatic',
        watch: watch && {
          onRebuild(e) { !e && (console.log('Reloaded'), cp()); },
        },
      });

      cp();
      if (watch) {
        if (existsSync(c.pub)) fsWatch(c.pub, { recursive: true }, cp);
        await new Promise(() => { });
      }
    },
  });
}

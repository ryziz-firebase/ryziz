import { context } from 'esbuild';
import { existsSync, readdirSync, mkdirSync, cpSync, watch, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { task } from '@ryziz/flow';

export default (isDev) => task('Building', {
  'Preparing': (c) => {
    c.root = process.cwd(); c.dist = 'dist'; c.public = join(c.root, 'public');
    if (existsSync(c.dist)) rmSync(c.dist, { recursive: true, force: true });
    mkdirSync(c.dist, { recursive: true });
  },
  'Setup': async (c) => {
    const getRoutes = () => {
      const src = resolve(c.root, 'src'), files = existsSync(src) ? readdirSync(src).filter((f) => /^pages\..+\.jsx$/.test(f)) : [];
      const imports = files.map((file, index) => `import R${index} from './src/${file}';`).join('\n');
      const exports = files.map((file, index) => `{path:'${('/' + file.slice(6, -4)).replace(/^\/index$/, '/').replace(/\./g, '/').replace(/\$/g, ':')}',element:<R${index}/>}`).join(',');
      return { contents: `import React from 'react';\n${imports}\nexport default [${exports}];`, loader: 'jsx', resolveDir: c.root, watchDirs: [src] };
    };

    c.builder = await context({
      entryPoints: { index: join(dirname(createRequire(import.meta.url).resolve('@ryziz/router/package.json')), 'entry.jsx') },
      bundle: true, splitting: true, format: 'esm', outdir: join(c.dist, 'assets'), loader: { '.js': 'jsx' }, jsx: 'automatic', nodePaths: [join(c.root, 'node_modules')],
      plugins: [
        { name: 'log', setup: (b) => b.onEnd(() => { c.onBuilt?.(); }) },
        { name: 'vr', setup: (b) => { b.onResolve({ filter: /^virtual:routes$/ }, (a) => ({ path: a.path, namespace: 'vr' })); b.onLoad({ filter: /.*/, namespace: 'vr' }, getRoutes); } },
      ],
      alias: {
        'react': join(c.root, 'node_modules/react'),
        'react-dom': join(c.root, 'node_modules/react-dom'),
        'react-router': join(c.root, 'node_modules/react-router'),
      },
    });
  },
  'Building': async (c) => {
    await c.builder.rebuild();
    if (existsSync(c.public)) cpSync(c.public, c.dist, { recursive: true });
    if (!isDev) await c.builder.dispose();
  },
  'Watching': async (c) => {
    if (!isDev) c.skip();
    let isFirst = true; c.onBuilt = () => isFirst ? (isFirst = false) : console.log('Client build updated');
    if (existsSync(c.public)) watch(c.public, { recursive: true }, () => { console.log('Public assets updated'); cpSync(c.public, c.dist, { recursive: true }); });
    await c.builder.watch();
    await new Promise(() => { });
  },
});

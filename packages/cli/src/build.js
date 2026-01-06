import { context } from 'esbuild';
import { existsSync, readdirSync, mkdirSync, cpSync, watch, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { task } from '@ryziz/flow';

export default (isDev) => task('Building', {
  'Preparing': (c) => {
    c.root = process.cwd(); c.dist = 'dist'; c.public = join(c.root, 'public');
    if (existsSync(c.dist)) rmSync(c.dist, { recursive: true, force: true });
    mkdirSync(c.dist, { recursive: true });
    mkdirSync(join(c.dist, 'functions'), { recursive: true });
  },
  'Hosting': async (c) => {
    const getRoutes = () => {
      const src = resolve(c.root, 'src'), files = existsSync(src) ? readdirSync(src).filter((f) => /^pages\..+\.jsx$/.test(f)) : [];
      const imports = files.map((file, index) => `import R${index} from './src/${file}';`).join('\n');
      const exports = files.map((file, index) => `{path:'${('/' + file.slice(6, -4)).replace(/^\/index$/, '/').replace(/\./g, '/').replace(/\$/g, ':')}',element:<R${index}/>}`).join(',');
      return { contents: `import React from 'react';\n${imports}\nexport default [${exports}];`, loader: 'jsx', resolveDir: c.root, watchDirs: [src] };
    };

    c.hostingBuilder = await context({
      entryPoints: { index: join(dirname(createRequire(import.meta.url).resolve('@ryziz/router/package.json')), 'entry.jsx') },
      bundle: true, splitting: true, format: 'esm', outdir: join(c.dist, 'assets'), loader: { '.js': 'jsx' }, jsx: 'automatic', nodePaths: [join(c.root, 'node_modules')],
      plugins: [
        { name: 'log', setup: (b) => b.onEnd(() => { c.onHostingBuilt?.(); }) },
        { name: 'vr', setup: (b) => { b.onResolve({ filter: /^virtual:routes$/ }, (a) => ({ path: a.path, namespace: 'vr' })); b.onLoad({ filter: /.*/, namespace: 'vr' }, getRoutes); } },
      ],
      alias: {
        'react': join(c.root, 'node_modules/react'),
        'react-dom': join(c.root, 'node_modules/react-dom'),
        'react-router': join(c.root, 'node_modules/react-router'),
      },
    });

    await c.hostingBuilder.rebuild();
    if (existsSync(c.public)) cpSync(c.public, c.dist, { recursive: true });
    if (!isDev) await c.hostingBuilder.dispose();
  },
  'Functions': async (c) => {
    const getApiRoutes = () => {
      const src = resolve(c.root, 'src'), files = existsSync(src) ? readdirSync(src).filter((f) => /^api\..+\.js$/.test(f)) : [];
      const imports = files.map((file, index) => `import handler${index} from './src/${file}';`).join('\n');
      const routes = files.map((file, index) => {
        const path = ('/' + file.slice(4, -3)).replace(/^\/index$/, '/').replace(/\./g, '/').replace(/\$/g, ':');
        const functionName = file.slice(0, -3).replace(/\./g, '-').replace(/\$/g, '');
        return { path, functionName, entry: `{path:'${path}',handler:handler${index},functionName:'${functionName}'}` };
      });
      return { contents: `${imports}\nmodule.exports = [${routes.map((r) => r.entry).join(',')}];`, loader: 'js', resolveDir: c.root, watchDirs: [src], routes };
    };

    c.functionsBuilder = await context({
      entryPoints: { index: join(dirname(createRequire(import.meta.url).resolve('@ryziz/functions/package.json')), 'entry.js') },
      bundle: true, format: 'cjs', platform: 'node', outfile: join(c.dist, 'functions', 'index.js'), minify: !isDev,
      external: ['firebase-admin', 'firebase-functions', 'express'],
      plugins: [
        { name: 'log', setup: (b) => b.onEnd(() => { c.onFunctionsBuilt?.(); }) },
        { name: 'var', setup: (b) => { b.onResolve({ filter: /^virtual:api-routes$/ }, (a) => ({ path: a.path, namespace: 'var' })); b.onLoad({ filter: /.*/, namespace: 'var' }, getApiRoutes); } },
        { name: 'fb', setup: (b) => b.onEnd(() => { const cfg = JSON.parse(readFileSync(join(dirname(createRequire(import.meta.url).resolve('@ryziz/functions/package.json')), 'firebase.json'))); writeFileSync(join(c.dist, 'firebase.json'), JSON.stringify({ ...cfg, hosting: { ...cfg.hosting, rewrites: [...getApiRoutes().routes.map((r) => ({ source: r.path, function: r.functionName })), { source: '**', destination: '/index.html' }] } }, null, 2)); }) },
      ],
    });

    await c.functionsBuilder.rebuild();
    cpSync(createRequire(import.meta.url).resolve('@ryziz/functions/package.json'), join(c.dist, 'functions', 'package.json'));
    if (!isDev) await c.functionsBuilder.dispose();
  },
  'Watching': async (c) => {
    if (!isDev) c.skip();
    let isFirstHosting = true, isFirstFunctions = true;
    c.onHostingBuilt = () => isFirstHosting ? (isFirstHosting = false) : console.log('Hosting build updated');
    c.onFunctionsBuilt = () => isFirstFunctions ? (isFirstFunctions = false) : console.log('Functions build updated');
    if (existsSync(c.public)) watch(c.public, { recursive: true }, () => { console.log('Public assets updated'); cpSync(c.public, c.dist, { recursive: true }); });
    await c.hostingBuilder.watch();
    await c.functionsBuilder.watch();
    await new Promise(() => { });
  },
});

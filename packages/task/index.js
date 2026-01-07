import { spawn } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage(), log = console.log;
console.log = (...a) => (als.getStore() || log)(...a);

export function f(name, ...args) {
  const opts = typeof args.at(-1) === 'object' && !args.at(-1)?.__isTask ? args.pop() : {};
  const tasks = args;
  const isLeaf = tasks.length === 1 && typeof tasks[0] === 'function' && !tasks[0].__isTask;

  const taskFn = async (indent = '', ctx = {}) => {
    const printer = ctx.printer || ((msg) => process.stdout.write(msg));

    if (opts.enabled === false) return;
    const skip = opts.skip || ctx.forceSkip;
    if (skip) return printer(`${indent}${name}... SKIP: ${skip}\n`);

    isLeaf ? printer(`${indent}${name}... `) : printer(`${indent}> ${name}\n`);

    const t0 = performance.now();
    let broken = 0;

    // Use context logger
    const logger = (...a) => (broken || (printer('\n'), broken = 1), printer(`${indent}     ${a.join(' ')}\n`));

    try {
      const exec = isLeaf
        ? async () => tasks[0]()
        : opts.parallel
          ? async () => {
            const results = await Promise.allSettled(tasks.map((t) => {
              const buf = [];
              // Buffer output for parallel tasks. 
              // Note: We use a local buffer and flush it atomically to the parent printer.
              return t(indent + '  ', { printer: (s) => buf.push(s) }).finally(() => printer(buf.join('')));
            }));
            const err = results.find((r) => r.status === 'rejected');
            if (err) throw err.reason;
          }
          : async () => {
            let err;
            for (const t of tasks) 
              if (err) await t(indent + '  ', { ...ctx, printer, forceSkip: 'Cascade' });
              else try { await t(indent + '  ', { ...ctx, printer }); } catch (e) { err = e; }
            
            if (err) throw err;
          };

      const p = als.run(isLeaf ? logger : null, exec);

      opts.timeout
        ? await Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(`Timeout ${opts.timeout}ms`)), opts.timeout).unref())])
        : await p;

      if (isLeaf) printer(`${broken ? indent + '  -> ' : ''}OK (${(performance.now() - t0).toFixed(2)}ms)\n`);
    } catch (e) {
      if (!e?.logged) {
        if (!broken) printer('\n');
        const [line1, ...rest] = (e.stack || String(e)).split('\n');
        printer(`${indent}  -> ${line1.toUpperCase()} (${(performance.now() - t0).toFixed(2)}ms)\n`);
        if (rest.length) printer(`${indent}     ${rest.join('\n' + indent + '     ')}\n`);
        if (e && typeof e === 'object') e.logged = true;
      }
      throw e;
    }

  };

  taskFn.__isTask = true;
  return taskFn;
}

f.$ = (cmd, args, opts = {}) => async () => {
  const logFile = join(tmpdir(), `spawn-${Date.now()}.txt`);
  writeFileSync(logFile, '');
  console.log(`Streamed to ${logFile}`);

  await new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: opts.cwd });
    let resolved = false, buf = ''; // Optimize: Only buffer if checking waitFor
    const handler = (d) => {
      const s = d.toString();
      appendFileSync(logFile, s);
      if (opts.waitFor && !resolved) {
        buf += s;
        if (opts.waitFor.test(buf)) { resolved = true; buf = ''; resolve(); }
      }
    };
    proc.stdout.on('data', handler);
    proc.stderr.on('data', handler);
    proc.on('exit', (code) => {
      (code === 0 || resolved) ? resolve() : reject(new Error(`Exit ${code}`));
    });
  });
};

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const oldLog = console.log;

export function f(name, ...args) {
  const opts = typeof args.at(-1) === 'object' && !args.at(-1)?.__isTask ? args.pop() : {};
  const tasks = args;
  const isLeaf = tasks.length === 1 && typeof tasks[0] === 'function' && !tasks[0].__isTask;

  const taskFn = async (indent = '', ctx = {}) => {
    const printer = ctx.printer || ((msg) => process.stdout.write(msg));

    if (opts.enabled === false) return;
    if (opts.skip) return printer(`${indent}${name}... SKIP: ${opts.skip}\n`);

    isLeaf ? printer(`${indent}${name}... `) : printer(`${indent}> ${name}\n`);

    const t0 = performance.now();
    let broken = 0;

    // Monkey-patch console.log to handle indentation
    if (isLeaf) {
      console.log = (...a) => (broken || (printer('\n'), broken = 1), printer(`${indent}     ${a.join(' ')}\n`));
    }

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
          : async () => { for (const t of tasks) await t(indent + '  ', { ...ctx, printer }); };

      const p = exec();
      opts.timeout
        ? await Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(`Timeout ${opts.timeout}ms`)), opts.timeout))])
        : await p;

      if (isLeaf) printer(`${broken ? indent + '  -> ' : ''}OK (${(performance.now() - t0).toFixed(2)}ms)\n`);
    } catch (e) {
      if (!isLeaf) process.exit(1);

      if (!broken) printer('\n');
      const [line1, ...rest] = (e.stack || String(e)).split('\n');
      printer(`${indent}  -> ${line1.toUpperCase()} (${(performance.now() - t0).toFixed(2)}ms)\n`);
      if (rest.length) printer(`${indent}     ${rest.join('\n' + indent + '     ')}\n`);
      throw e;
    } finally {
      if (isLeaf) console.log = oldLog;
    }
  };

  taskFn.__isTask = true;
  return taskFn;
}

f.$ = (cmd, args, opts = {}) => async () => {
  const logFile = join(tmpdir(), `spawn-${Date.now()}.txt`);
  console.log(`Streamed to ${logFile}`);

  await new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: opts.cwd });
    let output = '';
    const handler = (d) => {
      output += d;
      if (opts.waitFor?.test(output)) resolve();
    };
    proc.stdout.on('data', handler);
    proc.stderr.on('data', handler);
    proc.on('exit', (code) => {
      writeFileSync(logFile, output);
      code === 0 ? resolve() : reject(new Error(`Exit ${code}`));
    });
  });
};

import { AsyncLocalStorage } from 'node:async_hooks';

export { f };

// -----------------------------------------------------------------------------
// --- INTERNALS & UTILITIES ---------------------------------------------------
// -----------------------------------------------------------------------------

const writeContext = new AsyncLocalStorage();
const originalWrite = process.stdout.write.bind(process.stdout);

process.stdout.write = function (str) {
  const buffer = writeContext.getStore();
  if (buffer) buffer.push(str);
  else originalWrite(str);
};

async function parallelSafe(items, worker) {
  await Promise.allSettled(items.map(async (item) => {
    const buffer = [];
    try {
      await writeContext.run(buffer, () => worker(item));
    } finally { buffer.forEach(process.stdout.write); }
  }));
}

const logContext = new AsyncLocalStorage();
const originalConsoleLog = console.log;

console.log = function (...args) {
  const store = logContext.getStore();
  if (store) {
    if (store.isFirstLog) store.isFirstLog = false;
    process.stdout.write(`\n${store.indent} ${args.join(' ')}`);
  } else 
    originalConsoleLog.apply(console, args);
  
};

function f(name, ...args) {
  const { parallel = false, skip = false, enabled = true } = typeof args.at(-1) === 'object' ? args.pop() : {};
  const tasks = args;
  return async function s(ctx = { _error: null, _aborted: false }, options = { indent: '' }) {
    if (!enabled) return ctx;
    const startTime = performance.now();
    const nextIndent = options.indent + '│  ';

    process.stdout.write(`\n${options.indent}${name}... `);

    if (ctx._error || skip) {
      process.stdout.write(`\n${options.indent}└──> Skip (${(performance.now() - startTime).toFixed(2)}ms)`);
      return ctx;
    }

    const { isFirstLog } = await logContext.run({ indent: nextIndent, isFirstLog: tasks.length === 1 }, async () => {
      const executeTask = async (task) => {
        let result;
        try {
          if (ctx._error && task.name !== 's') result = ctx;
          else result = await task(ctx, { ...options, indent: nextIndent });
        } catch (error) { result = { _error: error }; }
        ctx = { ...ctx, ...result, _error: result?._error || ctx._error, _aborted: result?._aborted || ctx._aborted };
      };

      if (parallel) await parallelSafe(tasks, executeTask);
      else for (let task of tasks) await executeTask(task);

      return logContext.getStore();
    });

    if (ctx._aborted) {
      process.stdout.write(`\n${options.indent}└──> Aborted (${(performance.now() - startTime).toFixed(2)}ms)`);
      return ctx;
    }

    if (ctx._error) {
      ctx._aborted = true;
      process.stdout.write(`\n${options.indent}└──> ${ctx._error.stack.split('\n')[0]} (${(performance.now() - startTime).toFixed(2)}ms)`);
      process.stdout.write(`\n${ctx._error.stack.split('\n').slice(1).map((line) => `${options.indent}     ${line}`).join('\n')}`);
      return ctx;
    }

    if (isFirstLog) 
      process.stdout.write(`Ok (${(performance.now() - startTime).toFixed(2)}ms)`);
    else 
      process.stdout.write(`\n${options.indent}└──> Ok (${(performance.now() - startTime).toFixed(2)}ms)`);
    
    return ctx;
  };
}

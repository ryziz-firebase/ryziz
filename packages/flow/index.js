export async function task(name, steps) {
  console.log(`> ${name}`);
  const ctx = { skip: (m) => { throw { s: m || ' ' }; } };
  let err = null;

  for (const [title, fn] of Object.entries(steps)) {
    process.stdout.write(`  ${title}... `);
    if (err) { console.log('SKIP (Cascade)'); continue; }

    const t0 = performance.now();
    let broken = 0, oldLog = console.log, res = { ok: 1 };
    console.log = (...a) => (broken || (process.stdout.write('\n'), broken = 1), oldLog(`     ${a.join(' ')}`));

    try { await fn(ctx); }
    catch (e) { res = e.s ? { skip: e.s } : { err: e }; }
    finally { console.log = oldLog; }

    const t = `(${(performance.now() - t0).toFixed(2)}ms)`;
    if (res.ok) console.log(`${broken ? '  -> ' : ''}OK ${t}`);
    else {
      if (!broken) process.stdout.write('\n');
      if (res.skip) console.log(`  -> SKIP${res.skip.trim() ? ': ' + res.skip : ''} ${t}`);
      else {
        const s = ((res.err.stderr?.toString() || res.err.stdout?.toString() || res.err.stack || res.err.message).trim() || (res.err.stack || res.err.message).toString().trim()).split('\n');
        s[0] = s[0].replace(/^(.*?)(:)/, (m) => m.toUpperCase()) + ` ${t}`;
        console.error(`  -> ${s.join('\n     ')}`);
        err = res.err;
      }
    }
  }
  if (err) process.exit(1);
}

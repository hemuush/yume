const { spawn } = require('node:child_process');
const os = require('node:os');

// Keep locale-sensitive assertions identical on Windows and CI without shell-specific assignments.
// Workers: half the cores (with every core busy, slow suites such as appStartup and PurchaseCheck time out), but no
// more than the free memory can hold: a worker takes about 1.5 GB, and on a small laptop more of them than that
// swap the whole machine to a halt. Pass your own --maxWorkers to override.
const args = process.argv.slice(2);
if (!args.some((a) => a.startsWith('--maxWorkers') || a === '-w' || a === '--runInBand' || a === '-i')) {
  const byCores = Math.max(1, Math.floor(os.cpus().length / 2));
  const byMemory = Math.max(1, Math.floor(os.freemem() / 1.5 / 1024 ** 3));
  args.push(`--maxWorkers=${Math.min(byCores, byMemory)}`);
}
const child = spawn(process.execPath, [require.resolve('jest/bin/jest'), ...args], {
  stdio: 'inherit',
  env: { ...process.env, LANG: 'en_IN.UTF-8', LC_ALL: 'en_IN.UTF-8', TZ: 'Asia/Kolkata' },
});
// Below normal priority (inherited by the workers): the editor and the desktop stay responsive while tests run.
try {
  os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  /* Not allowed here: run at normal priority. */
}
child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 1));

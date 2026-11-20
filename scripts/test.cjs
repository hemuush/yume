const { spawnSync } = require('node:child_process');

// Keep locale-sensitive assertions identical on Windows and CI without shell-specific assignments.
// Half the cores by default: with every core busy, slow suites (appStartup, PurchaseCheck) time out. Pass your own
// --maxWorkers to override.
const args = process.argv.slice(2);
if (!args.some((a) => a.startsWith('--maxWorkers') || a === '-w' || a === '--runInBand' || a === '-i')) {
  args.push('--maxWorkers=50%');
}
const result = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), ...args], {
  stdio: 'inherit',
  env: { ...process.env, LANG: 'en_IN.UTF-8', LC_ALL: 'en_IN.UTF-8', TZ: 'Asia/Kolkata' },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);

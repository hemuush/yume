const { spawnSync } = require('node:child_process');

// Keep locale-sensitive assertions identical on Windows and CI without shell-specific assignments.
const result = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, LANG: 'en_IN.UTF-8', LC_ALL: 'en_IN.UTF-8', TZ: 'Asia/Kolkata' },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);

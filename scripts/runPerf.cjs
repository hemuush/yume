require('node:fs').mkdirSync('.expo', { recursive: true });
const { spawnSync } = require('node:child_process');
const result = spawnSync(
  process.execPath,
  [
    'scripts/test.cjs',
    '--runInBand',
    '--roots',
    'src',
    '--runTestsByPath',
    'src/perf/loadPerf.test.ts',
    'src/perf/outputParity.test.ts',
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, PERF: '1', PARITY_OUT: process.env.PARITY_OUT ?? '.expo/perf-parity.json' },
  }
);
process.exit(result.status ?? 1);

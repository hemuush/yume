// CI gate over `npm audit`: fails on high or critical advisories, except the ones listed below.
const { spawnSync } = require('node:child_process');

// Each entry needs a reason. Remove it as soon as a patched release exists; the gate says so when the advisory disappears.
const ALLOWED = {
  'GHSA-86w9-cpqp-85rv':
    'node-forge <=1.4.0 (latest release). Reached only through @expo/cli build tooling, never bundled into the app, and no patched version exists yet.',
  'GHSA-vfj7-8cjw-p6xm':
    'braces <=3.0.3 (latest release). Reached through Jest and Metro micromatch glob matching in test/build tooling, never bundled into the app, and no patched version exists yet.',
};

function advisoriesOf(report) {
  const found = new Map();
  for (const vuln of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object' || !via.url) continue;
      const id = via.url.split('/').pop();
      found.set(id, { id, severity: via.severity, title: via.title, pkg: via.name });
    }
  }
  return [...found.values()];
}

function evaluateAudit(report, allowed = ALLOWED) {
  const advisories = advisoriesOf(report);
  const serious = advisories.filter((a) => a.severity === 'high' || a.severity === 'critical');
  return {
    blocking: serious.filter((a) => !(a.id in allowed)),
    allowedHit: serious.filter((a) => a.id in allowed),
    staleAllowances: Object.keys(allowed).filter((id) => !advisories.some((a) => a.id === id)),
  };
}

function main() {
  const run = spawnSync('npm audit --json', {
    encoding: 'utf8',
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  let report;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    console.error('npm audit did not return JSON:\n' + (run.stderr || run.stdout));
    process.exit(1);
  }
  if (report.error) {
    console.error('npm audit failed: ' + (report.error.summary ?? JSON.stringify(report.error)));
    process.exit(1);
  }
  const { blocking, allowedHit, staleAllowances } = evaluateAudit(report);
  for (const a of allowedHit) console.log(`allowed  ${a.id} (${a.pkg}): ${ALLOWED[a.id]}`);
  for (const id of staleAllowances)
    console.log(`note     ${id} no longer reported; remove it from ALLOWED in scripts/auditGate.js`);
  if (blocking.length > 0) {
    for (const a of blocking) console.error(`BLOCKING ${a.severity} ${a.id} (${a.pkg}): ${a.title}`);
    process.exit(1);
  }
  console.log('npm audit: no blocking high or critical advisories.');
}

if (require.main === module) main();

module.exports = { evaluateAudit, advisoriesOf, ALLOWED };

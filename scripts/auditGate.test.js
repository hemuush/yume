const { evaluateAudit } = require('./auditGate');

const adv = (id, severity, name = 'pkg') => ({
  source: 1,
  name,
  title: `t-${id}`,
  url: `https://github.com/advisories/${id}`,
  severity,
});
const report = (...vias) => ({ vulnerabilities: { a: { via: vias }, b: { via: ['a'] } } });

describe('evaluateAudit', () => {
  const allowed = { 'GHSA-aaaa': 'reason' };

  it('blocks a high advisory that is not allowed', () => {
    const r = evaluateAudit(report(adv('GHSA-zzzz', 'high')), allowed);
    expect(r.blocking.map((a) => a.id)).toEqual(['GHSA-zzzz']);
  });

  it('blocks critical too', () => {
    expect(evaluateAudit(report(adv('GHSA-zzzz', 'critical')), allowed).blocking).toHaveLength(1);
  });

  it('lets an allowed advisory through and reports it', () => {
    const r = evaluateAudit(report(adv('GHSA-aaaa', 'high')), allowed);
    expect(r.blocking).toHaveLength(0);
    expect(r.allowedHit).toHaveLength(1);
  });

  it('ignores moderate advisories', () => {
    expect(evaluateAudit(report(adv('GHSA-zzzz', 'moderate')), allowed).blocking).toHaveLength(0);
  });

  it('counts an advisory once however many packages it spreads to', () => {
    const r = evaluateAudit(report(adv('GHSA-zzzz', 'high'), adv('GHSA-zzzz', 'high')), allowed);
    expect(r.blocking).toHaveLength(1);
  });

  it('flags an allowance whose advisory is gone', () => {
    expect(evaluateAudit({ vulnerabilities: {} }, allowed).staleAllowances).toEqual(['GHSA-aaaa']);
  });

  it('treats a report with no vulnerabilities as clean', () => {
    expect(evaluateAudit({}, allowed).blocking).toEqual([]);
  });
});

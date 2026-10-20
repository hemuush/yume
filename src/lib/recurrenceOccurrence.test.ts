import { advanceOccurrence, runsBetween } from './recurrence';
it('keeps a postponed weekly run from shifting later dates', () => {
  const rule = {
    nextRunDate: '2026-10-22',
    scheduledDate: '2026-10-20',
    frequency: 'weekly' as const,
    intervalCount: 1,
    anchorDay: 20,
    endDate: null,
  };
  expect(advanceOccurrence(rule, rule.nextRunDate)).toBe('2026-10-27');
  expect(advanceOccurrence(rule, '2026-10-27')).toBe('2026-11-03');
  expect(runsBetween(rule, '2026-10-19', '2026-11-03')).toBe(3);
});
it('restores the yearly anchor after a one-off delayed leap-day bill', () => {
  const rule = {
    nextRunDate: '2024-03-02',
    scheduledDate: '2024-02-29',
    frequency: 'yearly' as const,
    intervalCount: 1,
    anchorDay: 29,
  };
  expect(advanceOccurrence(rule, rule.nextRunDate)).toBe('2025-02-28');
  expect(advanceOccurrence(rule, '2025-02-28')).toBe('2026-02-28');
});

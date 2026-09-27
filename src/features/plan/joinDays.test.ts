jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { joinDays } from './PlanSections';

describe('joinDays', () => {
  it('names days in one month once, and each month across two', () => {
    expect(joinDays([])).toBe('');
    expect(joinDays(['2026-10-05'])).toMatch(/^5 Oct$/);
    expect(joinDays(['2026-10-05', '2026-10-07'])).toMatch(/^5 & 7 Oct$/);
    expect(joinDays(['2026-10-01', '2026-10-05', '2026-10-07'])).toMatch(/^1, 5 & 7 Oct$/);
    expect(joinDays(['2026-09-30', '2026-10-05'])).toMatch(/^30 Sept? & 5 Oct$/);
  });
});

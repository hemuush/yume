import { emptyRecentCopy, viewAllTarget } from './recentActivity';

const ref = new Date(2026, 10, 12); // 12 Nov 2026

describe('emptyRecentCopy', () => {
  it('says there is nothing yet for the current month or year, and how to change that', () => {
    expect(emptyRecentCopy({ granularity: 'month', offset: 0 }, ref)).toEqual({
      title: 'Nothing logged this month yet',
      subtitle: 'Tap + to add an entry.',
    });
    expect(emptyRecentCopy({ granularity: 'year', offset: 0 }, ref).title).toBe(
      'Nothing logged this year yet'
    );
  });

  it('names a past period, with its year when it is not this year', () => {
    const october = emptyRecentCopy({ granularity: 'month', offset: -1 }, ref);
    expect(october.title).toMatch(/^Nothing logged in \w+$/);
    expect(october.title).not.toContain('2026');
    expect(october.subtitle).toBe('Step to another month to look elsewhere.');
    expect(emptyRecentCopy({ granularity: 'month', offset: -13 }, ref).title).toContain('2025');
    expect(emptyRecentCopy({ granularity: 'year', offset: -1 }, ref)).toEqual({
      title: 'Nothing logged in 2025',
      subtitle: 'Step to another year to look elsewhere.',
    });
  });
});

describe('viewAllTarget', () => {
  it('opens Activity on the browsed month when it is a past one', () => {
    expect(viewAllTarget({ granularity: 'month', offset: -1 }, ref)).toEqual({
      pathname: '/transactions',
      params: { month: '2026-10' },
    });
    expect(viewAllTarget({ granularity: 'month', offset: -11 }, ref).params).toEqual({ month: '2025-12' });
  });

  it('leaves Activity as it is for the current month and for a year, which Activity cannot show', () => {
    expect(viewAllTarget({ granularity: 'month', offset: 0 }, ref)).toEqual({ pathname: '/transactions' });
    expect(viewAllTarget({ granularity: 'year', offset: -1 }, ref)).toEqual({ pathname: '/transactions' });
  });
});

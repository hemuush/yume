import { flynnLine } from './flynnLine';

describe('flynnLine', () => {
  it('asks for more data when there is no comparison yet', () => {
    expect(flynnLine(0, null)).toEqual({
      text: expect.stringContaining('Log a few days'),
      pose: 'default',
    });
  });

  it('is sleepy and cautionary when the month ran a deficit', () => {
    expect(flynnLine(-12, 5).pose).toBe('sleepy');
  });

  it('stays upbeat on a mere spend increase — the alert card carries that', () => {
    expect(flynnLine(40, 30).pose).toBe('default');
  });

  it('celebrates a healthy savings rate and quotes it', () => {
    const line = flynnLine(72, -3);
    expect(line.pose).toBe('default');
    expect(line.text).toContain('72%');
  });

  it('gives a gentle nudge for a thin but positive month', () => {
    expect(flynnLine(8, 2)).toEqual({
      text: expect.stringContaining('Every bit counts'),
      pose: 'default',
    });
  });
});

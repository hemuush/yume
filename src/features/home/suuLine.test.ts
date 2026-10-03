import { suuLine } from './suuLine';
import {
  NO_DATA_LINES,
  OVERSPENT_LINES,
  SPEND_UP_TEMPLATES,
  GOOD_SAVINGS_TEMPLATES,
  THIN_SAVINGS_LINES,
  PRIVATE_HEALTHY_LINES,
  PRIVATE_THIN_LINES,
  fillSuuTemplate,
} from './suuLinePools';
import { formatPctChange } from '@/lib/format';
import { savingsRateLabel } from '@/lib/savingsRate';

// suuLine() picks at random from a pool per situation (see suuLinePools.ts), so tests check the right pool
// (and the dynamic figure in it), not one exact line.

describe('suuLine', () => {
  it('asks for more data when there is no comparison yet', () => {
    const line = suuLine(0, null);
    expect(NO_DATA_LINES).toContain(line.text);
    expect(line.pose).toBe('default');
  });

  it('is sleepy and cautionary when the month ran a deficit', () => {
    const line = suuLine(-12, 5);
    expect(OVERSPENT_LINES).toContain(line.text);
    expect(line.pose).toBe('sleepy');
  });

  it('names the spend increase itself now, even with a healthy savings rate', () => {
    // Previously a separate SpendingAlertCard carried this fact — folded in
    // here since that card duplicated the hero's own "N% vs last" figure.
    const line = suuLine(71, 163);
    expect(line.pose).toBe('default');
    const pct = formatPctChange(163);
    expect(SPEND_UP_TEMPLATES.map((t) => `${fillSuuTemplate(t, pct)}.`)).toContain(line.text);
  });

  it('names the category that grew, when one did', () => {
    const line = suuLine(40, 30, 'Food & Dining');
    const pct = formatPctChange(30);
    expect(SPEND_UP_TEMPLATES.map((t) => `${fillSuuTemplate(t, pct)} — mostly Food & Dining.`)).toContain(
      line.text
    );
  });

  it('omits the category clause when nothing grew enough to name', () => {
    const line = suuLine(40, 30, null);
    expect(line.text).not.toContain('mostly');
    expect(line.text.endsWith('.')).toBe(true);
  });

  it('celebrates a healthy savings rate only when spending did not also rise', () => {
    const line = suuLine(72, -3);
    expect(line.pose).toBe('default');
    const pct = savingsRateLabel(72);
    expect(GOOD_SAVINGS_TEMPLATES.map((t) => fillSuuTemplate(t, pct))).toContain(line.text);
  });

  it('gives a gentle nudge for a thin but positive month with no spend increase', () => {
    const line = suuLine(8, -2);
    expect(THIN_SAVINGS_LINES).toContain(line.text);
    expect(line.pose).toBe('default');
  });

  it('turns sleepy late at night even when the numbers are otherwise fine', () => {
    // Pose only — the wording still comes from the same GOOD_SAVINGS_TEMPLATES
    // pool a healthy month always uses, the clock never changes what Suu says.
    const late = suuLine(72, -3, null, 23);
    expect(late.pose).toBe('sleepy');
    const early = suuLine(72, -3, null, 3);
    expect(early.pose).toBe('sleepy');
    const pct = savingsRateLabel(72);
    expect(GOOD_SAVINGS_TEMPLATES.map((t) => fillSuuTemplate(t, pct))).toContain(late.text);
  });

  it('stays awake during the day and when no hour is given at all', () => {
    expect(suuLine(72, -3, null, 12).pose).toBe('default');
    expect(suuLine(72, -3, null, 5).pose).toBe('default');
    expect(suuLine(72, -3, null, 22).pose).toBe('default');
    expect(suuLine(72, -3).pose).toBe('default');
  });

  it('an actual overspending deficit still wins over the hour', () => {
    // Already sleepy for the real financial reason — the night check only
    // ever nudges a pose that would otherwise be 'default'.
    const line = suuLine(-12, 5, null, 2);
    expect(OVERSPENT_LINES).toContain(line.text);
    expect(line.pose).toBe('sleepy');
  });
  describe('with savings amounts hidden', () => {
    it('uses neutral lines that never name a saved or kept share', () => {
      for (let i = 0; i < 50; i++) {
        const healthy = suuLine(72, -3, null, 12, true);
        expect(PRIVATE_HEALTHY_LINES).toContain(healthy.text);
        const thin = suuLine(8, -2, null, 12, true);
        expect(PRIVATE_THIN_LINES).toContain(thin.text);
      }
      for (const text of [...PRIVATE_HEALTHY_LINES, ...PRIVATE_THIN_LINES]) {
        expect(text).not.toMatch(/sav|kept|keep|%|put aside|tuck|cushion/i);
      }
    });

    it('leaves the no-data, overspent and spend-up situations alone', () => {
      expect(NO_DATA_LINES).toContain(suuLine(0, null, null, 12, true).text);
      expect(OVERSPENT_LINES).toContain(suuLine(-12, 5, null, 12, true).text);
      expect(suuLine(40, 9, 'Food', 12, true).text).toContain('mostly Food');
    });
  });
});

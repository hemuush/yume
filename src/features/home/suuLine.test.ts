import { suuLine } from './suuLine';
import {
  NO_DATA_LINES,
  OVERSPENT_LINES,
  SPEND_UP_TEMPLATES,
  GOOD_SAVINGS_TEMPLATES,
  THIN_SAVINGS_LINES,
  fillSuuTemplate,
} from './suuLinePools';
import { formatPctChange } from '@/lib/format';
import { savingsRateLabel } from '@/lib/savingsRate';

// suuLine() now picks randomly from a ~20-line pool per situation (see
// suuLinePools.ts) instead of returning one fixed sentence — these tests
// check the right *pool* (and the right dynamic figure within it) is used,
// not one exact line, since the exact line is deliberately no longer fixed.

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
});

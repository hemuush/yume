import { addDaysToIsoDate, toLocalIsoDate } from './date';
import { dueDateLabel, isDueUrgent } from './dueDate';

const inDays = (n: number) => addDaysToIsoDate(toLocalIsoDate(new Date()), n);

describe('dueDateLabel', () => {
  it('says it the way a person would, never "1 days"', () => {
    expect(dueDateLabel(inDays(-3))).toBe('Overdue by 3 days');
    expect(dueDateLabel(inDays(-1))).toBe('Overdue by 1 day');
    expect(dueDateLabel(inDays(0))).toBe('Due today');
    expect(dueDateLabel(inDays(1))).toBe('Due tomorrow');
    expect(dueDateLabel(inDays(5))).toBe('Due in 5 days');
  });

  it('flags today and anything past as urgent', () => {
    expect(isDueUrgent(inDays(0))).toBe(true);
    expect(isDueUrgent(inDays(-2))).toBe(true);
    expect(isDueUrgent(inDays(1))).toBe(false);
  });
});

import { RecurringRule, RecurrenceFrequency } from '@/types';

export function frequencyNoun(freq: RecurrenceFrequency, count: number): string {
  const plural = count === 1 ? '' : 's';
  switch (freq) {
    case 'daily':
      return `day${plural}`;
    case 'weekly':
      return `week${plural}`;
    case 'monthly':
      return `month${plural}`;
    case 'yearly':
      return `year${plural}`;
  }
}

/** "Every month", "Every 2 weeks". */
export function cadenceLabel(frequency: RecurrenceFrequency, intervalCount: number): string {
  const every = intervalCount === 1 ? '' : `${intervalCount} `;
  return `Every ${every}${frequencyNoun(frequency, intervalCount)}`;
}

export function ruleCadenceLabel(rule: RecurringRule): string {
  return cadenceLabel(rule.frequency, rule.intervalCount);
}

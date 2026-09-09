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

export function ruleCadenceLabel(rule: RecurringRule): string {
  const every = rule.intervalCount === 1 ? '' : `${rule.intervalCount} `;
  return `Every ${every}${frequencyNoun(rule.frequency, rule.intervalCount)}`;
}

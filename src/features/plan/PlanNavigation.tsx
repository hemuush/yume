import { UnderlineTabs } from '@/components/UnderlineTabs';

export type PlanTab = 'overview' | 'upcoming' | 'money' | 'debt';
export const PLAN_TABS: { label: string; value: PlanTab }[] = [
  { label: 'Overview', value: 'overview' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Money plan', value: 'money' },
  { label: 'Debt', value: 'debt' },
];

/** Plan's four parts as plain text tabs; every destination stays reachable (the row scrolls under large text). */
export function PlanNavigation({ value, onChange }: { value: PlanTab; onChange: (value: PlanTab) => void }) {
  return <UnderlineTabs options={PLAN_TABS} value={value} onChange={onChange} />;
}

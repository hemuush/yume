import { SegmentedControl } from '@/components/SegmentedControl';

export type PlanTab = 'overview' | 'upcoming' | 'money' | 'debt';
export const PLAN_TABS: { label: string; value: PlanTab }[] = [
  { label: 'Overview', value: 'overview' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Money plan', value: 'money' },
  { label: 'Debt', value: 'debt' },
];

/** Keep every destination visible; enlarged labels get two rows of two pills. */
export function PlanNavigation({
  value,
  onChange,
  stacked,
}: {
  value: PlanTab;
  onChange: (value: PlanTab) => void;
  stacked: boolean;
}) {
  return <SegmentedControl options={PLAN_TABS} value={value} onChange={onChange} onBand stacked={stacked} />;
}

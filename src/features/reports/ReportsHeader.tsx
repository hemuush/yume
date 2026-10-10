import { SkyHeader } from '@/features/home/SkyHeader';
import type { ReportWindow } from '@/lib/period';
import { PeriodRow } from './PeriodRow';
/** A stable header in normal layout; period controls never collapse over report content. */
export function ReportsHeader({
  cursor,
  onChange,
}: {
  cursor: ReportWindow;
  onChange: (cursor: ReportWindow) => void;
}) {
  return (
    <SkyHeader title="Reports" wallpaper>
      <PeriodRow cursor={cursor} onChange={onChange} compact />
    </SkyHeader>
  );
}

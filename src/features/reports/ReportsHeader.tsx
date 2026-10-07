import { ReportWindow } from '@/lib/period';
import { SkyHeader } from '@/features/home/SkyHeader';
import { PeriodRow } from './PeriodRow';

/**
 * Reports' header: Home's sky band with the title and the period control in it, so the tabs read as one app.
 * Pinned, like the summary under it.
 */
export function ReportsHeader({
  cursor,
  onChange,
}: {
  cursor: ReportWindow;
  onChange: (c: ReportWindow) => void;
}) {
  return (
    <SkyHeader title="Reports">
      <PeriodRow cursor={cursor} onChange={onChange} />
    </SkyHeader>
  );
}

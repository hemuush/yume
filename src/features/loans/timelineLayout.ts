import { parseLocalIsoDate } from '@/lib/date';

export interface TimelineInput {
  id: string;
  name: string;
  /** The loan's last EMI, YYYY-MM-DD. */
  endDate: string;
}

export interface TimelineRow extends TimelineInput {
  /** 0–1: how far along the shared axis this loan ends (the latest end date is 1). */
  fraction: number;
}

export interface Timeline {
  rows: TimelineRow[];
  /** Years under the bar axis after "Now": the middle one (null when it would repeat a neighbour) and the last. */
  midYear: number | null;
  endYear: number;
}

const MIN_FRACTION = 0.04;

/** Loans laid out on one axis from today to the last one's end, so the bars compare like with like. */
export function buildTimeline(items: TimelineInput[], today: Date): Timeline | null {
  if (items.length === 0) return null;
  const start = today.getTime();
  const ends = items.map((i) => parseLocalIsoDate(i.endDate).getTime());
  const last = Math.max(...ends);
  const span = Math.max(last - start, 1);
  const rows = items
    .map((item, i) => ({
      ...item,
      fraction: Math.min(1, Math.max(MIN_FRACTION, (ends[i] - start) / span)),
    }))
    .sort((a, b) => a.fraction - b.fraction);
  const endYear = new Date(last).getFullYear();
  const midYear = new Date(start + span / 2).getFullYear();
  return {
    rows,
    midYear: midYear === today.getFullYear() || midYear === endYear ? null : midYear,
    endYear,
  };
}

/**
 * The slowest SQL statements of each loader, one loader at a time (run with PERF=1, PERF_ENTRIES=100000), each with its
 * query plan: a SCAN of the transactions table, or an index that does not narrow the rows, is what to look for.
 * Timed inside the call (better-sqlite3 is synchronous), so loaders running together cannot inflate one another.
 * Skipped in normal test runs.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockRaw = createRealDataTestDb();
type Hit = { sql: string; params: any[]; ms: number };
const hits: Hit[] = [];
let tag = '';
const tagged = new Map<string, Hit[]>();
const time = <T>(sql: string, params: any[] | undefined, fn: () => Promise<T>) => {
  const t = performance.now();
  const p = fn();
  const ms = performance.now() - t;
  const h = { sql: sql.replace(/\s+/g, ' ').trim(), params: params ?? [], ms };
  hits.push(h);
  if (!tagged.has(tag)) tagged.set(tag, []);
  tagged.get(tag)!.push(h);
  return p;
};
const mockTestDb = {
  ...mockRaw,
  getFirstAsync: <T>(sql: string, p?: any[]) => time(sql, p, () => mockRaw.getFirstAsync<T>(sql, p)),
  getAllAsync: <T>(sql: string, p?: any[]) => time(sql, p, () => mockRaw.getAllAsync<T>(sql, p)),
  runAsync: (sql: string, p?: any[]) =>
    mockRaw.runAsync(sql, p).finally(require('@/db/dataVersion').bumpDataVersion),
  execAsync: (sql: string) => mockRaw.execAsync(sql).finally(require('@/db/dataVersion').bumpDataVersion),
  withTransactionAsync: (fn: any) =>
    mockRaw.withTransactionAsync(fn).finally(require('@/db/dataVersion').bumpDataVersion),
  exclusiveAsync: <T>(fn: (db: typeof mockRaw) => Promise<T>) => fn(mockRaw),
};
jest.mock('@/db/client', () => ({ ...jest.requireActual('@/db/client'), getDb: async () => mockTestDb }));
jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-file-system', () => ({}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => true }));

import { seedLedger } from './seedLedger';
import { trackDataVersion } from '@/db/dataVersion';
import { clearReadCache } from '@/db/readCache';
import { resetSettingsCache, setDefaultCurrency } from '@/db/settings';
import { listAccounts } from '@/db/ledger';
import { listCardCycles } from '@/db/cardCycles';
import {
  getCarryInMinor,
  getMonthlyCashFlow,
  getCategoryMonthlyTotals,
  getMonthlyExpenseTrend,
  getRangeComparison,
  getNetWorthTrend,
} from '@/db/reports';
import { findMonthlyPatterns } from '@/db/subscriptions';
import { findRepeatGroups, findStartingBalances } from '@/db/tidyUp';
import { loadNeedsYou } from '@/features/home/needsYouData';
import { periodRange, previousPeriodRange, CURRENT_PERIOD } from '@/lib/period';

const run = process.env.PERF === '1' ? describe : describe.skip;
run('hot statements', () => {
  jest.setTimeout(600000);
  it('lists them', async () => {
    await seedLedger(mockRaw, Number(process.env.PERF_ENTRIES ?? 100000));
    trackDataVersion();
    const range = periodRange(CURRENT_PERIOD);
    const loaders: [string, () => Promise<unknown>][] = [
      ['loadNeedsYou', () => loadNeedsYou()],
      ['getMonthlyCashFlow', () => getMonthlyCashFlow(7, new Date(), false)],
      ['findMonthlyPatterns', () => findMonthlyPatterns()],
      ['listCardCycles', () => listCardCycles()],
      ['getCarryInMinor', () => getCarryInMinor(range.start, false)],
      ['findRepeatGroups', () => findRepeatGroups()],
      ['listAccounts', () => listAccounts()],
      ['getCategoryMonthlyTotals', () => getCategoryMonthlyTotals(7, new Date(), false)],
      ['findStartingBalances', () => findStartingBalances()],
      ['getRangeComparison', () => getRangeComparison(range, previousPeriodRange(CURRENT_PERIOD), 'month')],
      ['getNetWorthTrend', () => getNetWorthTrend(7, new Date())],
      ['getMonthlyExpenseTrend', () => getMonthlyExpenseTrend(7, new Date(), false)],
    ];
    for (const [name, load] of loaders) {
      clearReadCache();
      resetSettingsCache();
      await setDefaultCurrency('INR');
      tag = name;
      await load(); // warm
      clearReadCache();
      tagged.set(name, []);
      await load();
    }
    const lines: string[] = [];
    for (const [name, hs] of tagged) {
      const total = hs.reduce((a, h) => a + h.ms, 0);
      lines.push(`\n## ${name}: ${hs.length} statements, ${total.toFixed(1)} ms in SQL`);
      for (const h of [...hs].sort((a, b) => b.ms - a.ms).slice(0, 3)) {
        if (h.ms < 2) continue;
        lines.push(`  ${h.ms.toFixed(1).padStart(6)} ms  ${h.sql.slice(0, 200)}`);
        try {
          const plan = await mockRaw.getAllAsync<{ detail: string }>('EXPLAIN QUERY PLAN ' + h.sql, h.params);
          for (const row of plan) lines.push(`            ${row.detail}`);
        } catch (e) {
          lines.push('            (plan failed: ' + (e as Error).message + ')');
        }
      }
    }
    console.log(lines.join('\n'));
  });
});

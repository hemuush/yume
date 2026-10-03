/**
 * The Home A widgets: the month ring's drawing, the date tile, the icons,
 * Quick Add's most-used categories, and that each of the five widgets
 * builds from plain widget pieces (a React fragment, for one, would leave a
 * widget stuck blank on the home screen).
 */
import type React from 'react';
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, listMostUsedExpenseCategories } from '@/db/ledger';
import { heroSlices } from '@/features/home/heroSlices';
import { ringSvg } from './ringSvg';
import { iconGlyph } from './WidgetShell';
import { dateTileParts, accountWidgetHue } from './data';
import { ThisMonthWidget } from './ThisMonthWidget';
import { QuickAddWidget } from './QuickAddWidget';
import { SuuWidget } from './SuuWidget';
import { NextDueWidget } from './NextDueWidget';
import { AccountsWidget } from './AccountsWidget';

const COLORS = { spent: '#FFC9B3', saved: '#8FE8C8', free: '#8FCBFF', track: '#F3ECE0', face: '#FBF3DA' };
const arcs = (svg: string) => svg.match(/stroke-dasharray="[^"]+"/g) ?? [];

describe('ringSvg', () => {
  it('draws one slice per share, each starting where the last ended', () => {
    const svg = ringSvg(heroSlices(100000, 50000, 20000), COLORS, 92);
    expect(arcs(svg)).toHaveLength(3);
    expect(svg).toContain(`stroke="${COLORS.spent}"`);
    expect(svg).toContain(`stroke="${COLORS.saved}"`);
    expect(svg).toContain(`stroke="${COLORS.free}"`);
    expect(svg).toContain('stroke-dashoffset="0.00"');
  });

  it('draws only the track and face with no income', () => {
    expect(arcs(ringSvg(heroSlices(0, 5000, 0), COLORS, 92))).toHaveLength(0);
  });

  it('fills the whole ring with spending when overspent', () => {
    const svg = ringSvg(heroSlices(10000, 15000, 0), COLORS, 92);
    expect(arcs(svg)).toHaveLength(1);
    expect(svg).toContain(`stroke="${COLORS.spent}"`);
  });
});

describe('widget helpers', () => {
  it('splits a due date into the date tile', () => {
    expect(dateTileParts('2026-10-01')).toEqual({ day: '01', month: 'OCT' });
  });

  it('draws a known icon as one glyph and falls back for an unknown one', () => {
    expect([...iconGlyph('bank')]).toHaveLength(1);
    expect(iconGlyph('no-such-icon')).toBe(iconGlyph('circle-small'));
  });

  it('tints accounts by type, like the Home account cards', () => {
    expect(accountWidgetHue('bank', '#A6B4F2', '#F0B79A')).toBe('#A6B4F2');
    expect(accountWidgetHue('wallet', '#A6B4F2', '#F0B79A')).toBe('#F0B79A');
    expect(accountWidgetHue('credit_card', '#A6B4F2', '#F0B79A')).toBe('#E0AC3F');
  });
});

describe('listMostUsedExpenseCategories', () => {
  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    const acc = await createAccount({
      name: 'Everyday',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    const ids: Record<string, string> = {};
    for (const name of ['Cafe', 'Food', 'Grocery', 'Travel', 'Books']) {
      ids[name] = (await createCategory({ name, kind: 'expense' })).id;
    }
    await createCategory({ name: 'Salary', kind: 'income' });
    const log = async (cat: string, date: string, times: number) => {
      for (let i = 0; i < times; i++) {
        await mockTestDb.runAsync(
          `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note)
           VALUES (?, 'expense', ?, ?, 100, ?, '')`,
          [`${cat}-${date}-${i}`, acc.id, ids[cat], date]
        );
      }
    };
    await log('Travel', '2026-09-20', 3);
    await log('Cafe', '2026-09-21', 2);
    // Busy, but before the window.
    await log('Books', '2026-03-01', 9);
  });

  it('puts the most-used first, then fills up A to Z, expense only', async () => {
    const names = (await listMostUsedExpenseCategories(4, '2026-07-01')).map((c) => c.name);
    expect(names).toEqual(['Travel', 'Cafe', 'Books', 'Food']);
  });
});

/**
 * Expands a widget the way the widget library does: our own components are
 * called, and everything left must be one of the library's widget pieces —
 * never a fragment or a plain string.
 */
function expand(node: unknown): string[] {
  if (node == null || node === false) return [];
  if (Array.isArray(node)) return node.flatMap(expand);
  const el = node as React.ReactElement<{ children?: unknown }>;
  if (typeof el.type !== 'function') throw new Error(`Not a widget piece: ${String(el.type)}`);
  const fn = el.type as ((props: unknown) => unknown) & { __name__?: string };
  if (fn.__name__) return [fn.__name__, ...expand(el.props.children)];
  return expand(fn(el.props));
}

describe('the five widgets', () => {
  const pack = { primary: '#A6B4F2', secondary: '#F0B79A' };

  it('This Month builds with income, when overspent, and with none', () => {
    for (const [income, spent] of [
      [100000, 40000],
      [10000, 15000],
      [0, 5000],
    ]) {
      const tree = expand(
        ThisMonthWidget({
          monthLabel: 'September',
          daysLeft: 2,
          spentMinor: spent,
          savedMinor: 0,
          hideSavings: false,
          freeMinor: income - spent,
          slices: heroSlices(income, spent, 0),
          pace: { projectedMinor: 60000, byLabel: '30 Sept' },
          ...pack,
        })
      );
      expect(tree).toContain('SvgWidget');
    }
  });

  it('Quick Add builds with and without categories', () => {
    const cats = [{ id: 'c1', name: 'Cafe', icon: 'coffee', color: '#F0876A' }];
    expect(expand(QuickAddWidget({ primary: pack.primary, categories: cats }))).toContain('IconWidget');
    expect(expand(QuickAddWidget({ primary: pack.primary, categories: [] }))).toContain('TextWidget');
  });

  it('Suu, Next Due and Accounts build', () => {
    expect(
      expand(SuuWidget({ line: { text: 'Food is up 30%.', tone: 'warn' } as never, dot: '#F0B79A', ...pack }))
    ).toContain('ImageWidget');
    expect(expand(NextDueWidget({ data: null }))).toContain('TextWidget');
    expect(
      expand(
        NextDueWidget({
          data: {
            title: 'Home loan EMI',
            subtitle: 'In 3 days',
            amountMinor: 1250000,
            sign: '-',
            route: '/loans',
            dateIso: '2026-10-01',
            tint: pack.primary,
          },
        })
      )
    ).toContain('TextWidget');
    expect(
      expand(
        AccountsWidget({
          accounts: [
            {
              name: 'Everyday',
              typeLabel: 'Bank',
              icon: 'bank',
              hue: pack.primary,
              balanceText: '₹100',
              negative: false,
            },
          ],
          totalText: null,
        })
      )
    ).toContain('IconWidget');
  });
});

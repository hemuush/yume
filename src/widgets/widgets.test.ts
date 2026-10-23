/**
 * The widgets: month layout, date tile, icons, Quick Add's most-used categories, and that
 * each widget builds from plain widget pieces (a React fragment would leave it blank on the home screen).
 */
import type React from 'react';
import { FlexWidget, type FlexWidgetProps } from 'react-native-android-widget';
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, listMostUsedExpenseCategories } from '@/db/ledger';
import { heroSlices } from '@/features/home/heroSlices';
import { iconGlyph } from './WidgetShell';
import { dateTileParts, accountWidgetHue } from './data';
import { ThisMonthWidget } from './ThisMonthWidget';
import { QuickAddWidget } from './QuickAddWidget';
import { SuuWidget } from './SuuWidget';
import { NextDueWidget } from './NextDueWidget';
import { AccountsWidget } from './AccountsWidget';

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
 * Expands a widget like the widget library does: our components are called and everything left must be a
 * library widget piece, never a fragment or plain string.
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
          dueMinor: 0,
          slices: heroSlices(income, spent, 0),
          pace: { projectedMinor: 60000, byLabel: '30 Sept' },
          ...pack,
        })
      );
      expect(tree).toContain('LinearLayoutWidget');
    }
  });

  it('preserves positive proportional weights through Android integer conversion', () => {
    const widget = ThisMonthWidget({
      monthLabel: 'October',
      daysLeft: 9,
      spentMinor: 1,
      savedMinor: 200000,
      hideSavings: false,
      freeMinor: 699999,
      dueMinor: 100000,
      slices: heroSlices(1000000, 1, 200000, 100000),
      pace: null,
      ...pack,
    });
    const primitives: React.ReactElement<FlexWidgetProps>[] = [];
    function visit(node: unknown): void {
      if (node == null || node === false) return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      const el = node as React.ReactElement<FlexWidgetProps>;
      const fn = el.type as ((props: FlexWidgetProps) => unknown) & { __name__?: string };
      if (fn.__name__) {
        primitives.push(el);
        visit(el.props.children);
      } else visit(fn(el.props));
    }
    visit(widget);
    const segments = primitives.filter((el) => el.props.style?.height === 7 && el.props.style?.width === 0);
    expect(segments).toHaveLength(4);
    const nativeWeights = segments.map((el) => FlexWidget.convertProps(el.props).weight!);
    expect(nativeWeights.every((weight) => Number.isInteger(weight) && weight > 0)).toBe(true);
    // Mirrors BaseWidget.java's getInt: even a sub-basis-point share must keep a nonzero native weight.
    expect(nativeWeights.map(Math.trunc)).toEqual(nativeWeights);
    expect(nativeWeights[3] / nativeWeights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(0.7, 3);
    const shell = primitives[0].props.style!;
    expect(shell.backgroundGradient).toBeUndefined();
    expect(shell.borderWidth).toBe(1);
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

import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import type { RecurringRule } from '@/types';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/CategoryIcon', () => ({ CategoryIcon: () => null }));
jest.mock('@/components/ToggleSwitch', () => ({
  ToggleSwitch: (p: object) =>
    require('react').createElement(require('react-native').View, { ...p, testID: 'rule-switch' }),
}));
import { RuleRow } from './RuleRow';
const rule = {
  id: 'wifi',
  type: 'expense',
  active: true,
  amountMinor: 70700,
  accountId: 'bank',
  categoryId: 'bills',
  frequency: 'monthly',
  intervalCount: 1,
  nextRunDate: '2026-11-01',
  note: 'Wifi',
} as RecurringRule;
function render(over: Partial<Parameters<typeof RuleRow>[0]> = {}) {
  let tree!: ReactTestRenderer;
  const edit = jest.fn(),
    toggle = jest.fn();
  act(() => {
    tree = create(
      <RuleRow
        rule={rule}
        category={undefined}
        accountName={() => 'SBI'}
        index={0}
        onPress={edit}
        onTogglePause={toggle}
        {...over}
      />
    );
  });
  return { tree, edit, toggle };
}
// The line under the title glues each piece together with non-breaking spaces; people read them as spaces.
const plain = (text: string) => text.replace(/\u00A0/g, ' ');
it.each([true, false])('keeps the switch separate from editing for active=%s', (active) => {
  const { tree, edit, toggle } = render({ rule: { ...rule, active } });
  const control = tree.root.findByProps({ testID: 'rule-switch' });
  expect(control.props.value).toBe(active);
  expect(control.props.accessibilityLabel).toBe(`Wifi, ${active ? 'running' : 'paused'}`);
  act(() => control.props.onChange(!active));
  expect(toggle).toHaveBeenCalledTimes(1);
  expect(edit).not.toHaveBeenCalled();
  act(() =>
    tree.root.find((n) => n.props.accessibilityRole === 'button' && !!n.props.onPress).props.onPress()
  );
  expect(edit).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
it('blocks a busy switch and keeps masked amounts out of spoken labels', () => {
  const { tree, toggle } = render({ busy: true, masked: true });
  const control = tree.root.findByProps({ testID: 'rule-switch' });
  expect(control.props.disabled).toBe(true);
  act(() => control.props.onChange(false));
  expect(toggle).not.toHaveBeenCalled();
  const label = tree.root.find((n) => n.props.accessibilityRole === 'button' && !!n.props.onPress).props
    .accessibilityLabel;
  expect(label).toContain('••••');
  expect(label).not.toContain('707');
  act(() => tree.unmount());
});
it('uses the account currency and retains the readable schedule line', () => {
  const { tree } = render({ currency: 'USD' });
  const text = tree.root
    .findAllByType(Text)
    .map((n) => plain([n.props.children].flat().join('')))
    .join(' ');
  expect(text).toContain('$707');
  expect(text).toContain('Next');
  expect(text).toContain('From SBI');
  act(() => tree.unmount());
});

describe('a recurring transfer that touches an investment', () => {
  const sip = { ...rule, type: 'transfer', toAccountId: 'fund', categoryId: null, note: '' } as RecurringRule;
  const names = (id: string | null | undefined) => (id === 'fund' ? 'Nifty 50' : 'SBI');
  const shown = (investRole: 'invest' | 'withdraw' | null) => {
    const { tree } = render({ rule: sip, accountName: names, investRole });
    return tree.root.findAllByType(Text).map((t) => plain([].concat(t.props.children).join('')));
  };

  it('is listed as a SIP, naming the holding and where the money comes from', () => {
    const lines = shown('invest');
    expect(lines).toContain('SIP · Nifty 50');
    expect(lines.some((t) => t.includes('From SBI'))).toBe(true);
  });
  it('is a withdrawal when money leaves the investment', () => {
    expect(shown('withdraw')).toContain('Withdraw · SBI');
  });
  it('stays a plain transfer otherwise', () => {
    const lines = shown(null);
    expect(lines).toContain('SBI → Nifty 50');
    expect(lines.some((t) => t.endsWith('Transfer'))).toBe(true);
  });
});

describe('the next date on a rule', () => {
  const year = new Date().getFullYear();
  const line = (nextRunDate: string) => {
    const { tree } = render({ rule: { ...rule, nextRunDate } });
    const shown = tree.root.findAllByType(Text).map((t) => plain([t.props.children].flat(Infinity).join('')));
    act(() => tree.unmount());
    return shown.find((t) => t.includes('Next ')) ?? '';
  };

  it('names the year of a run that is not this year (a yearly bill), and leaves it off this year', () => {
    expect(line(`${year + 1}-03-03`)).toContain(String(year + 1));
    expect(line(`${year}-12-28`)).not.toContain(String(year));
  });
});

describe('the lines under the title of a rule', () => {
  const subLines = (
    over: Partial<RecurringRule> = {},
    props: Partial<Parameters<typeof RuleRow>[0]> = {}
  ) => {
    const { tree } = render({ rule: { ...rule, ...over }, ...props });
    const lines = tree.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));
    act(() => tree.unmount());
    const when = lines.findIndex((t) => t.includes('Next'));
    return { when: lines[when] ?? '', where: lines[when + 1] ?? '' };
  };

  it('are two: when it runs, then where it comes from, so a separator never ends the first', () => {
    const { when, where } = subLines(
      { nextRunDate: '2026-12-01', note: 'Diya' },
      { accountName: () => 'Google Play' }
    );
    expect(plain(when)).toMatch(/^Every month · Next \w+, 1 Dec$/);
    expect(plain(where)).toBe('— · From Google Play');
  });

  it('wrap between their pieces, never inside one, so a date or an account is not split across lines', () => {
    const { when, where } = subLines(
      { nextRunDate: '2026-12-01', note: 'Diya' },
      { accountName: () => 'Google Play' }
    );
    for (const line of [when, where]) {
      for (const piece of line.split(' · ')) expect(piece).not.toMatch(/ /);
    }
    expect(when.split(' · ').some((p) => p.startsWith('Next\u00A0'))).toBe(true);
    expect(where.split(' · ').pop()).toBe('From\u00A0Google\u00A0Play');
  });
});

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
    .map((n) => [n.props.children].flat().join(''))
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
    return tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
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

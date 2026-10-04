/** Updating a floating loan's rate: validation, and the exact arguments handed to the database. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(120000); // cold module loading is slow while the whole suite runs in parallel

const mockApplyRateChange = jest.fn(async (..._a: unknown[]) => undefined as unknown);

jest.mock('@/db/loans', () => ({ applyRateChange: (...a: unknown[]) => mockApplyRateChange(...a) }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
}));
jest.mock('@/components/AmountField', () => ({
  AmountField: (p: { label: string }) =>
    require('react').createElement(require('react-native').View, { testID: 'rate', ...p }),
}));
jest.mock('@/components/DateField', () => ({
  DateField: (p: { label: string }) =>
    require('react').createElement(require('react-native').View, { testID: 'date', ...p }),
}));
jest.mock('@/components/SegmentedControl', () => ({
  SegmentedControl: (p: { value: string }) =>
    require('react').createElement(require('react-native').View, { testID: 'mode', ...p }),
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { RateChangeModal } from './RateChangeModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { calculateEmi } from '@/lib/loan';
import { formatMoney } from '@/lib/money';
import { toLocalIsoDate } from '@/lib/date';
import type { Loan } from '@/types';

const loan = {
  id: 'l1',
  direction: 'borrowed',
  rateType: 'floating',
  interestRateAnnualBp: 950,
  outstandingPrincipalMinor: 1_200_000,
  emiAmountMinor: 120_000,
} as Loan;

const mounted: ReactTestRenderer[] = [];
const byId = (t: ReactTestRenderer, id: string) => t.root.findByProps({ testID: id });
const texts = (t: ReactTestRenderer) =>
  t.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));

async function render(remainingMonths = 10) {
  const onDone = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <RateChangeModal loan={loan} remainingMonths={remainingMonths} onClose={jest.fn()} onDone={onDone} />
    );
  });
  mounted.push(tree);
  return { tree, onDone };
}
const press = async (t: ReactTestRenderer) =>
  act(async () => {
    await t.root.findByType(PrimaryButton).props.onPress();
  });

afterEach(() => {
  act(() => mounted.splice(0).forEach((t) => t.unmount()));
  mockApplyRateChange.mockClear();
  mockApplyRateChange.mockImplementation(async () => undefined);
});

describe('rate change', () => {
  it('starts from the current rate and today, keeping the EMI', async () => {
    const { tree } = await render();
    expect(byId(tree, 'rate').props.value).toBe('9.5');
    expect(byId(tree, 'date').props.value).toBe(toLocalIsoDate(new Date()));
    expect(byId(tree, 'mode').props.value).toBe('keepEmi');
    expect(texts(tree)).toContain('Current rate: 9.50%');
  });

  it('sends the new rate in basis points with the chosen date and mode', async () => {
    const { tree, onDone } = await render();
    await act(async () => byId(tree, 'rate').props.onChangeText('9.75'));
    await act(async () => byId(tree, 'date').props.onChange('2026-08-01'));
    await act(async () => byId(tree, 'mode').props.onChange('keepTenure'));
    await press(tree);
    expect(mockApplyRateChange).toHaveBeenCalledWith('l1', {
      newAnnualRateBp: 975,
      effectiveDate: '2026-08-01',
      mode: 'keepTenure',
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it.each(['abc', '-2'])('rejects an invalid rate (%s) without touching the database', async (typed) => {
    const { tree, onDone } = await render();
    await act(async () => byId(tree, 'rate').props.onChangeText(typed));
    await press(tree);
    expect(mockApplyRateChange).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Enter a valid interest rate');
  });

  it('rejects a rate above 100% a year without touching the database', async () => {
    const { tree, onDone } = await render();
    await act(async () => byId(tree, 'rate').props.onChangeText('101'));
    await press(tree);
    expect(mockApplyRateChange).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Interest rate can be at most 100% a year');
  });

  it('previews the recalculated EMI when the tenure is kept', async () => {
    const { tree } = await render(10);
    await act(async () => byId(tree, 'rate').props.onChangeText('12'));
    await act(async () => byId(tree, 'mode').props.onChange('keepTenure'));
    const expected = formatMoney(calculateEmi(1_200_000, 1200, 10));
    expect(texts(tree).some((t) => t.includes(`new EMI would be ${expected}`))).toBe(true);
  });

  it('shows the failure and stays open when the database rejects', async () => {
    mockApplyRateChange.mockRejectedValueOnce(new Error('Loan is closed'));
    const { tree, onDone } = await render();
    await act(async () => byId(tree, 'rate').props.onChangeText('8'));
    await press(tree);
    expect(onDone).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Loan is closed');
    // The button is usable again for a retry.
    expect(tree.root.findByType(PrimaryButton).props.disabled).toBe(false);
  });
});

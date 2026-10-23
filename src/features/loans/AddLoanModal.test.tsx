/** Adding a loan: a finished loan leaves a clean form (including the direction), and "I lent" has no fee. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(120000); // cold module loading is slow while the whole suite runs in parallel

const mockCreateLoan = jest.fn(async (..._a: unknown[]) => 'l1');

jest.mock('@/db/loans', () => ({ createLoan: (...a: unknown[]) => mockCreateLoan(...a) }));
jest.mock('@/db/ledger', () => ({
  listAccounts: async () => [{ id: 'a1', name: 'Main', type: 'bank', currency: 'INR' }],
  listCategories: async () => [
    { id: 'inc', name: 'Loan Repayment', kind: 'income' },
    { id: 'exp', name: 'Loan EMI', kind: 'expense' },
    { id: 'fee', name: 'Fees & Charges', kind: 'expense' },
  ],
}));
jest.mock('@/db/people', () => ({ listPeople: async () => [] }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
}));
jest.mock('@/components/DraftCard', () => ({
  DraftCard: (p: { title: string; figure?: string; meta: string }) =>
    require('react').createElement(require('react-native').View, {
      testID: 'card',
      title: p.title,
      emi: p.figure,
      meta: p.meta,
    }),
}));
jest.mock('@/components/AmountField', () => ({
  AmountField: (p: { label: string; onChangeText: (v: string) => void }) =>
    require('react').createElement(require('react-native').View, { testID: p.label, ...p }),
}));
jest.mock('@/components/FormInput', () => ({
  FormInput: (p: { label: string; onChangeText: (v: string) => void }) =>
    require('react').createElement(require('react-native').View, { testID: p.label, ...p }),
}));
jest.mock('@/components/DateField', () => ({ DateField: () => null }));
jest.mock('@/components/ToggleSwitch', () => ({ ToggleSwitch: () => null }));
jest.mock('@/components/SheetTabs', () => ({ SheetTabs: () => null }));
jest.mock('./AddLoanParts', () => ({
  OptionCards: (p: { options: { value: string }[]; value: string; onChange: (v: string) => void }) =>
    require('react').createElement(require('react-native').View, {
      testID: `options-${p.options[0].value}`,
      ...p,
    }),
  CountStepper: (p: { onChange: (n: number) => void }) =>
    require('react').createElement(require('react-native').View, { testID: 'stepper', ...p }),
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { AddLoanModal } from './AddLoanModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { DateField } from '@/components/DateField';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';

const mounted: ReactTestRenderer[] = [];
const byId = (t: ReactTestRenderer, id: string) => t.root.findByProps({ testID: id });
const hasId = (t: ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }).length > 0;
const footerButton = (t: ReactTestRenderer, title: string) =>
  t.root.findAllByType(PrimaryButton).find((b) => b.props.title === title)!;

async function render(onCreated = jest.fn()) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AddLoanModal visible onClose={jest.fn()} onCreated={onCreated} />);
  });
  mounted.push(tree);
  return { tree, onCreated };
}

async function fillStepOne(tree: ReactTestRenderer) {
  await act(async () => byId(tree, 'options-borrowed').props.onChange('lent'));
  await act(async () => byId(tree, 'Borrower (person)').props.onChangeText('Sam'));
  await act(async () => byId(tree, 'Principal amount').props.onChangeText('12000'));
  await act(async () => byId(tree, 'Annual interest rate (%)').props.onChangeText('0'));
  const custom = tree.root.findAll((n) => n.props.label === 'Custom' && n.props.onPress)[0];
  await act(async () => custom.props.onPress());
  await act(async () => byId(tree, 'Tenure (months)').props.onChangeText('12'));
}

afterEach(() => {
  act(() => mounted.splice(0).forEach((t) => t.unmount()));
  mockCreateLoan.mockClear();
});

describe('add loan', () => {
  it('works the monthly EMI out on the card once the amount, rate and tenure are in', async () => {
    const { tree } = await render();
    expect(byId(tree, 'card').props.emi).toBeUndefined();
    expect(byId(tree, 'card').props.meta).toContain('EMI shows once');
    await fillStepOne(tree);
    await act(async () => byId(tree, 'Annual interest rate (%)').props.onChangeText('12'));
    expect(byId(tree, 'card').props.emi).toMatch(/1,0[0-9]{2}/);
    expect(byId(tree, 'card').props.meta).toContain('interest over the term');
  });

  it('ignores hidden asset fields after switching from borrowing to lending', async () => {
    const { tree } = await render();
    act(() => tree.root.findByType(ToggleSwitch).props.onChange(true));
    act(() => byId(tree, 'Current estimated value (optional)').props.onChangeText('invalid'));
    await fillStepOne(tree);
    await act(async () => footerButton(tree, 'Next').props.onPress());
    await act(async () => footerButton(tree, 'Create loan').props.onPress());
    expect(mockCreateLoan).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'lent', assetLabel: null, assetValueMinor: null })
    );
  });

  it('refreshes untouched default dates on reopen while retaining a manually selected date', async () => {
    jest.useFakeTimers();
    const original = new Date();
    const tomorrow = addDaysToIsoDate(toLocalIsoDate(original), 1);
    const onCreated = jest.fn();
    const onClose = jest.fn();
    const { tree } = await render();
    try {
      await fillStepOne(tree);
      await act(async () =>
        tree.update(<AddLoanModal visible={false} onClose={onClose} onCreated={onCreated} />)
      );
      jest.setSystemTime(new Date(`${tomorrow}T12:00:00`));
      await act(async () => tree.update(<AddLoanModal visible onClose={onClose} onCreated={onCreated} />));
      await act(async () => footerButton(tree, 'Next').props.onPress());
      const start = () =>
        tree.root.findAllByType(DateField).find((f) => f.props.label === 'Disbursement date')!;
      expect(start().props.value).toBe(tomorrow);
      act(() => start().props.onChange('2026-01-15'));
      await act(async () =>
        tree.update(<AddLoanModal visible={false} onClose={onClose} onCreated={onCreated} />)
      );
      await act(async () => tree.update(<AddLoanModal visible onClose={onClose} onCreated={onCreated} />));
      await act(async () => footerButton(tree, 'Next').props.onPress());
      expect(start().props.value).toBe('2026-01-15');
    } finally {
      jest.useRealTimers();
    }
  });
  it('hides the processing fee for a loan you lent and never sends one', async () => {
    const { tree } = await render();
    await fillStepOne(tree);
    await act(async () => footerButton(tree, 'Next').props.onPress());
    expect(hasId(tree, 'Processing / documentation fees deducted (optional)')).toBe(false);
    await act(async () => {
      await footerButton(tree, 'Create loan').props.onPress();
    });
    const input = mockCreateLoan.mock.calls[0][0] as {
      direction: string;
      disbursement: { feeAmountMinor?: number };
    };
    expect(input.direction).toBe('lent');
    expect(input.disbursement.feeAmountMinor).toBeUndefined();
  });

  it('starts the next loan as "I borrowed" with a clean first step after one is created', async () => {
    const { tree, onCreated } = await render();
    await fillStepOne(tree);
    expect(byId(tree, 'card').props.title).toBe('Sam');
    await act(async () => footerButton(tree, 'Next').props.onPress());
    await act(async () => {
      await footerButton(tree, 'Create loan').props.onPress();
    });
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(byId(tree, 'options-borrowed').props.value).toBe('borrowed');
    expect(byId(tree, 'card').props.title).toBe('New loan');
    expect(byId(tree, 'Lender (bank/person)').props.value).toBe('');
  });

  it('refuses more EMIs already paid than the loan has', async () => {
    const { tree } = await render();
    await fillStepOne(tree);
    await act(async () => footerButton(tree, 'Next').props.onPress());
    await act(async () => byId(tree, 'options-new').props.onChange('existing'));
    await act(async () => byId(tree, 'stepper').props.onChange(99)); // more than the 12-month tenure
    await act(async () => {
      await footerButton(tree, 'Create loan').props.onPress();
    });
    expect(mockCreateLoan).not.toHaveBeenCalled();
    const shown = tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
    expect(shown).toContain("The loan only has 12 EMIs, so 99 can't be paid already");
  });
});

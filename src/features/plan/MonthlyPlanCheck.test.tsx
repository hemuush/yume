import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { MonthlyPlanCheck } from './MonthlyPlanCheck';
import { getMonthlyPlanIncome, setMonthlyPlanIncome } from '@/db/monthlyPlan';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AmountField } from '@/components/AmountField';
import { formatMoney } from '@/lib/money';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({
    children,
    footer,
    visible,
  }: {
    children: React.ReactNode;
    footer: React.ReactNode;
    visible: boolean;
  }) =>
    visible ? (
      <>
        {children}
        {footer}
      </>
    ) : null,
}));
jest.mock('@/db/monthlyPlan', () => ({ getMonthlyPlanIncome: jest.fn(), setMonthlyPlanIncome: jest.fn() }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
const input = {
  categories: [],
  accounts: [],
  rules: [],
  budgets: [],
  goals: [],
  loans: [],
  today: '2026-10-20',
};
let tree: ReactTestRenderer;
const text = () =>
  tree.root
    .findAllByType(Text)
    .map((n) => n.props.children)
    .flat(Infinity)
    .join('');
const button = (title: string) =>
  tree.root.findAllByType(PrimaryButton).find((n) => n.props.title === title)!;
afterEach(() => {
  act(() => tree?.unmount());
  jest.resetAllMocks();
});
it.each(['-50', 'invalid', '999999999999999999'])(
  'rejects invalid income %s without silently saving zero',
  async (value) => {
    (getMonthlyPlanIncome as jest.Mock).mockResolvedValue(null);
    (setMonthlyPlanIncome as jest.Mock).mockImplementation(async (_currency: string, amount: number) => {
      if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Enter a valid monthly income.');
    });
    await act(async () => {
      tree = create(<MonthlyPlanCheck input={input} currency="INR" hidden={false} />);
    });
    act(() => button('Income').props.onPress());
    act(() => tree.root.findByType(AmountField).props.onChangeText(value));
    await act(async () => button('Save estimate').props.onPress());
    expect((setMonthlyPlanIncome as jest.Mock).mock.calls[0][1]).not.toBe(0);
    expect(text()).toContain('Enter a valid monthly income.');
    expect(button('Save estimate')).toBeDefined();
  }
);
it('allows an explicit zero income estimate', async () => {
  (getMonthlyPlanIncome as jest.Mock).mockResolvedValue(null);
  (setMonthlyPlanIncome as jest.Mock).mockResolvedValue(undefined);
  await act(async () => {
    tree = create(<MonthlyPlanCheck input={input} currency="INR" hidden={false} />);
  });
  act(() => button('Income').props.onPress());
  act(() => tree.root.findByType(AmountField).props.onChangeText('0'));
  await act(async () => button('Save estimate').props.onPress());
  expect(setMonthlyPlanIncome).toHaveBeenCalledWith('INR', 0);
});
it('reloads the estimate after restore even when currency stays unchanged', async () => {
  (getMonthlyPlanIncome as jest.Mock).mockResolvedValueOnce(10000).mockResolvedValueOnce(20000);
  await act(async () => {
    tree = create(<MonthlyPlanCheck input={input} currency="INR" hidden={false} refreshToken={{}} />);
  });
  expect(text()).toContain(formatMoney(10000, 'INR'));
  await act(async () =>
    tree.update(<MonthlyPlanCheck input={input} currency="INR" hidden={false} refreshToken={{}} />)
  );
  expect(getMonthlyPlanIncome).toHaveBeenCalledTimes(2);
  expect(text()).toContain(formatMoney(20000, 'INR'));
});

it('does not let a completed old save overwrite a restored estimate', async () => {
  let resolve!: () => void;
  (getMonthlyPlanIncome as jest.Mock).mockResolvedValueOnce(10000).mockResolvedValueOnce(20000);
  (setMonthlyPlanIncome as jest.Mock).mockReturnValue(
    new Promise<void>((r) => {
      resolve = r;
    })
  );
  await act(async () => {
    tree = create(<MonthlyPlanCheck input={input} currency="INR" hidden={false} refreshToken={{}} />);
  });
  act(() => button('Income').props.onPress());
  act(() => tree.root.findByType(AmountField).props.onChangeText('150'));
  let pending!: Promise<void>;
  act(() => {
    pending = button('Save estimate').props.onPress();
  });
  await act(async () =>
    tree.update(<MonthlyPlanCheck input={input} currency="INR" hidden={false} refreshToken={{}} />)
  );
  await act(async () => {
    resolve();
    await pending;
  });
  expect(text()).toContain(formatMoney(20000, 'INR'));
  expect(text()).not.toContain(formatMoney(15000, 'INR'));
});

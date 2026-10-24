/**
 * Creating an account whose "worth today" valuation fails must not leave a duplicate behind: the account
 * exists after the first Save, so a retry only retries the valuation. Made-up accounts throughout.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(120000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer, onClose }: { children: unknown; footer?: unknown; onClose: () => void }) =>
    require('react').createElement(
      require('react-native').View,
      { testID: 'sheet', onClose },
      children,
      footer
    ),
}));
jest.mock('@/components/DraftCard', () => ({ DraftCard: () => null }));
jest.mock('@/components/FormInput', () => ({ FormInput: () => null }));
jest.mock('@/components/Chip', () => ({ Chip: () => null }));
jest.mock('@/components/PrimaryButton', () => ({ PrimaryButton: () => null }));
jest.mock('@/components/ToggleSwitch', () => ({ ToggleSwitch: () => null }));
jest.mock('@/components/AmountField', () => ({ AmountField: () => null }));
jest.mock('./CardCycleFields', () => ({
  ...jest.requireActual('./CardCycleFields'),
  CardCycleFields: () => null,
}));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));

const mockCreateAccount = jest.fn();
const mockAddValuation = jest.fn();
const mockGetDefaultCurrency = jest.fn();
const mockListAccounts = jest.fn();
jest.mock('@/db/ledger', () => ({
  createAccount: (...a: unknown[]) => mockCreateAccount(...a),
  listAccounts: () => mockListAccounts(),
}));
jest.mock('@/db/valuations', () => ({ addValuation: (...a: unknown[]) => mockAddValuation(...a) }));
jest.mock('@/db/settings', () => ({
  SUPPORTED_CURRENCIES: [
    { code: 'INR', label: 'Indian Rupee' },
    { code: 'USD', label: 'US Dollar' },
  ],
  getDefaultCurrency: () => mockGetDefaultCurrency(),
  getCachedCurrency: () => 'INR',
}));

import { AddAccountModal } from './AddAccountModal';

// The form widgets are mocked to null; their props are still readable from the element tree.
const byProps = (tree: ReactTestRenderer, match: Record<string, unknown>) =>
  tree.root.find(
    (n) => typeof n.type === 'function' && Object.entries(match).every(([k, v]) => n.props[k] === v)
  );

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

async function render(onCreated = jest.fn(), onClose = jest.fn()) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AddAccountModal visible onClose={onClose} onCreated={onCreated} />);
  });
  return { tree, onCreated, onClose };
}

/** A tracked savings account with a "worth today" figure, ready to Save. */
async function fillTrackedSavings(tree: ReactTestRenderer) {
  await act(async () => byProps(tree, { label: 'Name' }).props.onChangeText('Gold pot'));
  await act(async () => byProps(tree, { label: 'Investment' }).props.onPress());
  await act(async () => byProps(tree, { label: 'Worth today (optional)' }).props.onChangeText('12000'));
}

const save = (tree: ReactTestRenderer) =>
  act(async () => {
    await tree.root
      .find((n) => typeof n.type === 'function' && typeof n.props.title === 'string' && n.props.onPress)
      .props.onPress();
  });

beforeEach(() => {
  mockListAccounts.mockReset().mockResolvedValue([]);
  mockCreateAccount.mockReset().mockResolvedValue({ id: 'acc-1' });
  mockAddValuation.mockReset().mockResolvedValue(undefined);
  mockGetDefaultCurrency.mockReset().mockResolvedValue('INR');
});

it('keeps the chosen currency when a slow default-currency read finishes', async () => {
  let resolve!: (currency: string) => void;
  mockGetDefaultCurrency.mockReturnValueOnce(new Promise<string>((r) => (resolve = r)));
  const { tree } = await render();
  act(() => byProps(tree, { label: 'Name' }).props.onChangeText('Travel account'));
  act(() => byProps(tree, { label: 'USD' }).props.onPress());
  await act(async () => resolve('INR'));
  await save(tree);
  expect(mockCreateAccount).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD' }));
  act(() => tree.unmount());
});

it('ignores a default-currency read from a previous opening', async () => {
  let resolve!: (currency: string) => void;
  mockGetDefaultCurrency.mockReturnValueOnce(new Promise<string>((r) => (resolve = r)));
  const { tree, onCreated, onClose } = await render();
  await act(async () =>
    tree.update(<AddAccountModal visible={false} onClose={onClose} onCreated={onCreated} />)
  );
  await act(async () => tree.update(<AddAccountModal visible onClose={onClose} onCreated={onCreated} />));
  await act(async () => resolve('USD'));
  act(() => byProps(tree, { label: 'Name' }).props.onChangeText('Local account'));
  await save(tree);
  expect(mockCreateAccount).toHaveBeenCalledWith(expect.objectContaining({ currency: 'INR' }));
  act(() => tree.unmount());
});

describe('AddAccountModal retry after a failed valuation', () => {
  it('does not create a second account when Save is pressed again', async () => {
    mockAddValuation.mockRejectedValueOnce(new Error('disk full'));
    const { tree, onCreated } = await render();
    await fillTrackedSavings(tree);

    await save(tree);
    expect(mockCreateAccount).toHaveBeenCalledTimes(1);
    expect(texts(tree)).toContain('disk full');
    expect(onCreated).not.toHaveBeenCalled();

    await save(tree);
    expect(mockCreateAccount).toHaveBeenCalledTimes(1);
    expect(mockAddValuation).toHaveBeenCalledTimes(2);
    expect(mockAddValuation).toHaveBeenLastCalledWith(
      'acc-1',
      expect.objectContaining({ valueMinor: 1_200_000 })
    );
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(texts(tree)).not.toContain('disk full');
  });

  it('refreshes the list and starts clean when closed after a half-finished save', async () => {
    mockAddValuation.mockRejectedValue(new Error('disk full'));
    const { tree, onCreated, onClose } = await render();
    await fillTrackedSavings(tree);
    await save(tree);

    await act(async () => tree.root.findByProps({ testID: 'sheet' }).props.onClose());
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(texts(tree)).not.toContain('disk full');
  });
});

describe('Investment account type', () => {
  const bank = {
    id: 'bank-1',
    name: 'HDFC',
    type: 'bank',
    currency: 'INR',
    archived: false,
    investment: undefined,
  };
  const card = { id: 'card-1', name: 'Card', type: 'credit_card', currency: 'INR', archived: false };
  const usd = { id: 'usd-1', name: 'Wise', type: 'bank', currency: 'USD', archived: false };
  const fund = {
    id: 'f-1',
    name: 'Old fund',
    type: 'savings',
    currency: 'INR',
    archived: false,
    investment: {},
  };

  it('replaces the track-its-value switch: Investment is a type and there is no switch', async () => {
    const { tree } = await render();
    expect(byProps(tree, { label: 'Investment' })).toBeDefined();
    expect(
      tree.root.findAll((n) => typeof n.type === 'function' && n.props.title === 'Track its value')
    ).toHaveLength(0);
  });

  it('shows kind and money-comes-from only for an investment, offering plain accounts in its currency', async () => {
    mockListAccounts.mockResolvedValue([bank, card, usd, fund]);
    const { tree } = await render();
    expect(texts(tree)).not.toContain('Usually funded from (optional)');
    await act(async () => byProps(tree, { label: 'Investment' }).props.onPress());
    expect(texts(tree)).toContain('Usually funded from (optional)');
    expect(byProps(tree, { label: 'Mutual fund' })).toBeDefined();
    expect(byProps(tree, { label: 'HDFC' })).toBeDefined();
    for (const name of ['Card', 'Wise', 'Old fund']) {
      expect(tree.root.findAll((n) => typeof n.type === 'function' && n.props.label === name)).toHaveLength(
        0
      );
    }
  });

  it('saves an investment as a tracked savings account with its kind and funding account', async () => {
    mockListAccounts.mockResolvedValue([bank]);
    const { tree } = await render();
    await act(async () => byProps(tree, { label: 'Name' }).props.onChangeText('Nifty 50'));
    await act(async () => byProps(tree, { label: 'Investment' }).props.onPress());
    await act(async () => byProps(tree, { label: 'Mutual fund' }).props.onPress());
    await act(async () => byProps(tree, { label: 'HDFC' }).props.onPress());
    await save(tree);
    expect(mockCreateAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'savings',
        tracked: true,
        investmentKind: 'mutual_fund',
        fundingAccountId: 'bank-1',
      })
    );
  });

  it('drops a chosen funding account when the type changes away from Investment', async () => {
    mockListAccounts.mockResolvedValue([bank]);
    const { tree } = await render();
    await act(async () => byProps(tree, { label: 'Name' }).props.onChangeText('Pot'));
    await act(async () => byProps(tree, { label: 'Investment' }).props.onPress());
    await act(async () => byProps(tree, { label: 'HDFC' }).props.onPress());
    await act(async () => byProps(tree, { label: 'Savings' }).props.onPress());
    await save(tree);
    expect(mockCreateAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'savings',
        tracked: false,
        fundingAccountId: null,
        investmentKind: null,
      })
    );
  });
});

describe('Credit card minimum due', () => {
  const fillCard = async (tree: ReactTestRenderer) => {
    await act(async () => byProps(tree, { label: 'Name' }).props.onChangeText('Regalia'));
    await act(async () => byProps(tree, { label: 'Credit card' }).props.onPress());
  };

  it('saves the minimum due share and floor with the card', async () => {
    const { tree } = await render();
    await fillCard(tree);
    await act(async () => byProps(tree, { label: 'Minimum due (%)' }).props.onChangeText('5'));
    await act(async () => byProps(tree, { label: 'At least' }).props.onChangeText('200'));
    await save(tree);
    expect(mockCreateAccount).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'credit_card', minDueBp: 500, minDueFloorMinor: 20_000 })
    );
    act(() => tree.unmount());
  });

  it('saves no minimum when both are left empty', async () => {
    const { tree } = await render();
    await fillCard(tree);
    await save(tree);
    expect(mockCreateAccount).toHaveBeenCalledWith(
      expect.objectContaining({ minDueBp: null, minDueFloorMinor: null })
    );
    act(() => tree.unmount());
  });

  it('refuses a share over 100%', async () => {
    const { tree } = await render();
    await fillCard(tree);
    await act(async () => byProps(tree, { label: 'Minimum due (%)' }).props.onChangeText('150'));
    await save(tree);
    expect(mockCreateAccount).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('is not offered for any other type', async () => {
    const { tree } = await render();
    expect(
      tree.root.findAll((n) => typeof n.type === 'function' && n.props.label === 'Minimum due (%)')
    ).toHaveLength(0);
    act(() => tree.unmount());
  });
});

describe('Deposit and provident fund details', () => {
  const pickKind = async (tree: ReactTestRenderer, kind: string) => {
    await act(async () => byProps(tree, { label: 'Name' }).props.onChangeText('Bank FD'));
    await act(async () => byProps(tree, { label: 'Investment' }).props.onPress());
    await act(async () => byProps(tree, { label: kind }).props.onPress());
  };
  const has = (tree: ReactTestRenderer, label: string) =>
    tree.root.findAll((n) => n.props.label === label).length > 0;

  it('saves a fixed deposit with its yearly rate and maturity date', async () => {
    const { tree } = await render();
    await pickKind(tree, 'Fixed deposit');
    await act(async () => byProps(tree, { label: 'Interest rate (% a year)' }).props.onChangeText('7.1'));
    await act(async () => byProps(tree, { label: 'Set a maturity date' }).props.onPress());
    await save(tree);
    expect(mockCreateAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        investmentKind: 'fixed_deposit',
        rateBp: 710,
        maturityDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })
    );
    act(() => tree.unmount());
  });

  it('offers a rate but no maturity date for PPF / EPF', async () => {
    const { tree } = await render();
    await pickKind(tree, 'PPF / EPF');
    expect(has(tree, 'Interest rate (% a year)')).toBe(true);
    expect(has(tree, 'Set a maturity date')).toBe(false);
    act(() => tree.unmount());
  });

  it('offers neither for a mutual fund and saves no rate', async () => {
    const { tree } = await render();
    await pickKind(tree, 'Mutual fund');
    expect(has(tree, 'Interest rate (% a year)')).toBe(false);
    await save(tree);
    expect(mockCreateAccount).toHaveBeenCalledWith(
      expect.objectContaining({ rateBp: null, maturityDate: null })
    );
    act(() => tree.unmount());
  });

  it('refuses a rate over 100%', async () => {
    const { tree } = await render();
    await pickKind(tree, 'Fixed deposit');
    await act(async () => byProps(tree, { label: 'Interest rate (% a year)' }).props.onChangeText('710'));
    await save(tree);
    expect(mockCreateAccount).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });
});

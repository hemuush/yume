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
jest.mock('./CardCycleFields', () => ({ CardCycleFields: () => null }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));

const mockCreateAccount = jest.fn();
const mockAddValuation = jest.fn();
const mockGetDefaultCurrency = jest.fn();
jest.mock('@/db/ledger', () => ({ createAccount: (...a: unknown[]) => mockCreateAccount(...a) }));
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
  await act(async () => byProps(tree, { label: 'Savings' }).props.onPress());
  await act(async () =>
    tree.root.find((n) => typeof n.type === 'function' && 'onChange' in n.props).props.onChange(true)
  );
  await act(async () => byProps(tree, { label: 'Worth today (optional)' }).props.onChangeText('12000'));
}

const save = (tree: ReactTestRenderer) =>
  act(async () => {
    await tree.root
      .find((n) => typeof n.type === 'function' && typeof n.props.title === 'string' && n.props.onPress)
      .props.onPress();
  });

beforeEach(() => {
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

/**
 * The usage check on the account sheet: while it runs we say so, when it fails we offer Archive (never Delete,
 * since we can't tell whether there is history), and a loaded sheet shows the amounts in whole units. Made-up accounts.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(120000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
  SheetLink: ({ label }: { label: string }) =>
    require('react').createElement(require('react-native').Text, null, `link:${label}`),
}));
jest.mock('@/components/DraftCard', () => ({ DraftCard: () => null }));
jest.mock('@/components/FormInput', () => ({ FormInput: () => null }));
jest.mock('@/components/Chip', () => ({ Chip: () => null }));
jest.mock('@/components/PrimaryButton', () => ({ PrimaryButton: () => null }));
jest.mock('@/components/ToggleSwitch', () => ({ ToggleSwitch: () => null }));
jest.mock('@/components/AmountField', () => ({
  AmountField: ({ label, value }: { label: string; value: string }) =>
    require('react').createElement(require('react-native').Text, null, `field:${label}=${value}`),
}));
jest.mock('./CardCycleFields', () => ({ CardCycleFields: () => null }));
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: jest.fn() }) }));
jest.mock('@/components/AppDialog', () => ({ showAlert: jest.fn() }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: false }) }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), warn: jest.fn(), confirm: jest.fn() } }));

const mockCount = jest.fn();
const mockUpdate = jest.fn();
const mockListAccounts = jest.fn(async () => []);
jest.mock('@/db/ledger', () => ({
  updateAccount: (...a: unknown[]) => mockUpdate(...a),
  listAccounts: () => mockListAccounts(),
  archiveAccount: jest.fn(),
  unarchiveAccount: jest.fn(),
  deleteAccount: jest.fn(),
  restoreAccount: jest.fn(),
  getAccountTransactionCount: (...a: unknown[]) => mockCount(...a),
}));

import { AccountDetailModal } from './AccountDetailModal';
import type { Account } from '@/types';

const account = (over: Partial<Account> = {}): Account =>
  ({
    id: 'acc-1',
    name: 'Rainy day',
    type: 'bank',
    currency: 'INR',
    openingBalanceMinor: 1_250_000,
    currentBalanceMinor: 1_250_000,
    creditLimitMinor: null,
    statementDay: null,
    dueDay: null,
    archived: false,
    investment: null,
    ...over,
  }) as Account;

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

async function render(acc = account()) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AccountDetailModal account={acc} onClose={jest.fn()} onChanged={jest.fn()} />);
  });
  return tree;
}

beforeEach(() => mockCount.mockReset());

describe('AccountDetailModal usage check', () => {
  it('says it is checking while the count is pending', async () => {
    mockCount.mockReturnValue(new Promise(() => {}));
    const tree = await render();
    expect(texts(tree)).toContain('Checking usage…');
  });

  it('offers Archive, not Delete, and stops saying "Checking usage…" when the check fails', async () => {
    mockCount.mockRejectedValue(new Error('db locked'));
    const t = texts(await render());
    expect(t).not.toContain('Checking usage…');
    expect(t.some((s) => s.startsWith("Couldn't check whether this account has entries"))).toBe(true);
    expect(t).toContain('link:Archive account');
    expect(t).not.toContain('link:Delete account');
  });

  it('offers Delete for an unused account and Archive for one with entries', async () => {
    mockCount.mockResolvedValue(0);
    expect(texts(await render())).toContain('link:Delete account');
    mockCount.mockResolvedValue(3);
    expect(texts(await render())).toContain('link:Archive account · 3 entries');
  });

  it('fills the opening balance in whole units', async () => {
    mockCount.mockResolvedValue(0);
    expect(texts(await render())).toContain('field:Opening balance=12500');
  });
});

describe('AccountDetailModal investments', () => {
  const tracked = (over = {}) =>
    account({
      type: 'savings',
      investment: {
        investedMinor: 100,
        takenOutMinor: 0,
        gainMinor: 0,
        valuedAt: null,
        lastValueMinor: null,
        kind: 'gold',
        fundingAccountId: null,
        ...over,
      },
    });
  const press = async (tree: ReactTestRenderer, label: string) =>
    act(async () =>
      tree.root.find((n) => typeof n.type === 'function' && n.props.label === label).props.onPress()
    );
  const saveButton = (tree: ReactTestRenderer) =>
    tree.root.find((n) => typeof n.type === 'function' && n.props.title === 'Save changes');

  beforeEach(() => {
    mockCount.mockResolvedValue(0);
    mockUpdate.mockReset().mockResolvedValue({});
    jest.requireMock('@/components/AppDialog').showAlert.mockReset();
  });

  it('opens a tracked savings account as an Investment with its kind selected', async () => {
    const tree = await render(tracked());
    const chips = tree.root.findAll((n) => typeof n.type === 'function' && n.props.label === 'Investment');
    expect(chips[0].props.active).toBe(true);
    expect(tree.root.find((n) => typeof n.type === 'function' && n.props.label === 'Gold').props.active).toBe(
      true
    );
  });

  it('turns an ordinary savings account into an investment by picking the type', async () => {
    const tree = await render(account({ type: 'savings' }));
    await press(tree, 'Investment');
    await act(async () => saveButton(tree).props.onPress());
    expect(mockUpdate).toHaveBeenCalledWith(
      'acc-1',
      expect.objectContaining({ type: 'savings', tracked: true })
    );
  });

  it('asks before an investment goes back to Savings, and does nothing if cancelled', async () => {
    const { showAlert } = jest.requireMock('@/components/AppDialog');
    showAlert.mockImplementation(
      (_t: string, _m: string, buttons: { text: string; onPress?: () => void }[]) =>
        buttons.find((b) => b.text === 'Cancel')!.onPress!()
    );
    const tree = await render(tracked());
    await press(tree, 'Savings');
    await act(async () => saveButton(tree).props.onPress());
    expect(showAlert).toHaveBeenCalledWith('Stop tracking its value?', expect.any(String), expect.any(Array));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('stops tracking and clears the investment fields once confirmed', async () => {
    const { showAlert } = jest.requireMock('@/components/AppDialog');
    showAlert.mockImplementation(
      (_t: string, _m: string, buttons: { text: string; onPress?: () => void }[]) =>
        buttons.find((b) => b.text === 'Stop tracking')!.onPress!()
    );
    const tree = await render(tracked());
    await press(tree, 'Savings');
    await act(async () => saveButton(tree).props.onPress());
    expect(mockUpdate).toHaveBeenCalledWith(
      'acc-1',
      expect.objectContaining({ tracked: false, investmentKind: null, fundingAccountId: null })
    );
  });
});

/** Choosing which account a loan's EMIs come out of. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(120000);

const mockUpdate = jest.fn(async (..._a: unknown[]) => undefined as unknown);
jest.mock('@/db/loans', () => ({ updateLoanAccount: (...a: unknown[]) => mockUpdate(...a) }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
}));

import { AccountModal } from './AccountModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import type { Account } from '@/types';

const acc = (id: string, name: string, type: string) =>
  ({ id, name, type, currency: 'INR', archived: false }) as Account;
const accounts = [
  acc('b1', 'Test Bank', 'bank'),
  acc('c1', 'Test Cash', 'cash'),
  acc('s1', 'Test Savings', 'savings'),
];

const mounted: ReactTestRenderer[] = [];
const texts = (t: ReactTestRenderer) =>
  t.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const chipFor = (t: ReactTestRenderer, label: string) =>
  t.root.findAllByType(Chip).find((c) => c.props.label === label)!;

async function render(currentAccountId: string | null) {
  const onDone = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <AccountModal
        accounts={accounts}
        currentAccountId={currentAccountId}
        loanId="l1"
        onClose={jest.fn()}
        onDone={onDone}
      />
    );
  });
  mounted.push(tree);
  return { tree, onDone };
}
const save = (t: ReactTestRenderer) =>
  act(async () => {
    await t.root.findByType(PrimaryButton).props.onPress();
  });

afterEach(() => {
  act(() => mounted.splice(0).forEach((t) => t.unmount()));
  mockUpdate.mockReset();
  mockUpdate.mockImplementation(async () => undefined);
});

describe('AccountModal', () => {
  it('lists only accounts a payment can come out of, with the current one picked', async () => {
    const { tree } = await render('b1');
    const labels = tree.root.findAllByType(Chip).map((c) => c.props.label);
    expect(labels).toEqual(['Test Bank', 'Test Cash']);
    expect(chipFor(tree, 'Test Bank').props.active).toBe(true);
    expect(chipFor(tree, 'Test Cash').props.active).toBe(false);
  });

  it('saves the newly picked account for this loan and reports it', async () => {
    const { tree, onDone } = await render('b1');
    await act(async () => chipFor(tree, 'Test Cash').props.onPress());
    await save(tree);
    expect(mockUpdate).toHaveBeenCalledWith('l1', 'c1');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cannot save until an account is picked', async () => {
    const { tree } = await render(null);
    expect(tree.root.findByType(PrimaryButton).props.disabled).toBe(true);
    await save(tree);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('shows a failure and does not report success', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('disk full'));
    const { tree, onDone } = await render('b1');
    await save(tree);
    expect(texts(tree)).toContain('disk full');
    expect(onDone).not.toHaveBeenCalled();
  });
});

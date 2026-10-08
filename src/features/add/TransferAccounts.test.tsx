/** A transfer's From and To cards: each opens a sheet of accounts (To never offers From), and Swap trades the two. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ dot: '#F0876A', accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: false, toggleHideAmounts: jest.fn() }),
}));

import { TransferAccounts } from './AddSections';
import type { Account } from '@/types';

const acc = (id: string): Account =>
  ({ id, name: id, type: 'bank', currency: 'INR', currentBalanceMinor: 0 }) as Account;
const accounts = [acc('SBI'), acc('HDFC')];

function render(fromId: string | null, toId: string | null) {
  const onPickFrom = jest.fn();
  const onPickTo = jest.fn();
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <TransferAccounts
        fromOptions={accounts}
        accounts={accounts}
        fromId={fromId}
        toId={toId}
        onPickFrom={onPickFrom}
        onPickTo={onPickTo}
      />
    );
  });
  return { r, onPickFrom, onPickTo };
}
const swap = (r: ReactTestRenderer) =>
  r.root.findAll((n) => n.props.accessibilityLabel === 'Swap From and To' && n.props.onPress);

describe('transfer accounts', () => {
  it('swaps From and To in one tap', () => {
    const { r, onPickFrom, onPickTo } = render('SBI', 'HDFC');
    act(() => swap(r)[0].props.onPress());
    expect(onPickFrom).toHaveBeenCalledWith('HDFC');
    expect(onPickTo).toHaveBeenCalledWith('SBI');
  });

  it('offers no swap until both are picked', () => {
    expect(swap(render('SBI', null).r)).toHaveLength(0);
  });
});

describe('transfer account cards', () => {
  const press = (r: ReactTestRenderer, label: string) =>
    act(() => r.root.find((n) => n.props.accessibilityLabel === label && n.props.onPress).props.onPress());

  it('opens the To sheet without the From account, and picks from it', () => {
    const { r, onPickTo } = render('SBI', null);
    press(r, 'To, pick an account. Change');
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'SBI' && n.props.onPress)).toHaveLength(0);
    press(r, 'HDFC');
    expect(onPickTo).toHaveBeenCalledWith('HDFC');
  });

  it('changes From from its own sheet', () => {
    const { r, onPickFrom } = render('SBI', 'HDFC');
    press(r, 'From, SBI. Change');
    press(r, 'HDFC');
    expect(onPickFrom).toHaveBeenCalledWith('HDFC');
  });
});

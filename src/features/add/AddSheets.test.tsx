/** The sheets Add opens over itself: the account picker's title, choices and tap, and that each sheet gets its own state. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.setTimeout(120000);

function mockStub(testID: string) {
  return (p: object) => require('react').createElement(require('react-native').View, { testID, ...p });
}
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, visible }: { children: unknown; visible: boolean }) =>
    visible ? require('react').createElement(require('react').Fragment, null, children) : null,
}));
jest.mock('@/components/CalendarSheet', () => ({ CalendarSheet: mockStub('calendar') }));
jest.mock('@/features/profile/AddAccountModal', () => ({ AddAccountModal: mockStub('add-account') }));
jest.mock('@/features/people/AddPersonModal', () => ({ AddPersonModal: mockStub('add-person') }));
jest.mock('@/features/home/RepeatEntrySheet', () => ({ RepeatEntrySheet: mockStub('repeat') }));
jest.mock('./AddFields', () => ({ AccountTile: mockStub('tile') }));

import { AddSheets } from './AddSheets';
import type { Account } from '@/types';

const acc = (id: string, name: string) => ({ id, name, type: 'bank', currency: 'INR' }) as Account;
const mounted: ReactTestRenderer[] = [];
const byId = (t: ReactTestRenderer, id: string) => t.root.findByProps({ testID: id });
const tiles = (t: ReactTestRenderer) => [
  ...new Set(t.root.findAllByProps({ testID: 'tile' }).map((n) => n.props.account.id as string)),
];

function render(open = true) {
  const fns = {
    onPick: jest.fn(),
    closeAccount: jest.fn(),
    addAccountClose: jest.fn(),
    addAccountCreated: jest.fn(async () => undefined),
    personClose: jest.fn(),
    personCreated: jest.fn(),
    calendarClose: jest.fn(),
    calendarPick: jest.fn(),
    repeatClose: jest.fn(),
    repeatLogged: jest.fn(),
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <AddSheets
        accountSheet={{
          open,
          title: 'Pay from',
          accounts: [acc('a1', 'Test Bank'), acc('a2', 'Test Cash')],
          activeId: 'a2',
          onClose: fns.closeAccount,
          onPick: fns.onPick,
        }}
        addAccount={{ visible: false, onClose: fns.addAccountClose, onCreated: fns.addAccountCreated }}
        addPerson={{ visible: true, onClose: fns.personClose, onCreated: fns.personCreated }}
        calendar={{
          visible: true,
          value: '2026-06-15',
          onClose: fns.calendarClose,
          onPick: fns.calendarPick,
        }}
        repeat={{ visible: false, onClose: fns.repeatClose, onLogged: fns.repeatLogged }}
      />
    );
  });
  mounted.push(tree);
  return { tree, ...fns };
}

afterEach(() => act(() => mounted.splice(0).forEach((t) => t.unmount())));

describe('AddSheets', () => {
  it('lists the accounts it is given, with the active one marked', () => {
    const { tree } = render();
    expect(tiles(tree)).toEqual(['a1', 'a2']);
    const active = tree.root
      .findAllByProps({ testID: 'tile' })
      .filter((n) => n.props.active)
      .map((n) => n.props.account.id);
    expect(new Set(active)).toEqual(new Set(['a2']));
  });

  it('hands back the account that was tapped', () => {
    const { tree, onPick } = render();
    const first = tree.root.findAllByProps({ testID: 'tile' })[0];
    act(() => first.props.onPress());
    expect(onPick).toHaveBeenCalledWith('a1');
  });

  it('shows no account choices while the account sheet is closed', () => {
    expect(tiles(render(false).tree)).toEqual([]);
  });

  it('gives each of the other sheets its own visibility and handlers', () => {
    const r = render();
    expect(byId(r.tree, 'add-account').props.visible).toBe(false);
    expect(byId(r.tree, 'add-person').props.visible).toBe(true);
    expect(byId(r.tree, 'calendar').props.value).toBe('2026-06-15');
    expect(byId(r.tree, 'calendar').props.quickPicks).toBe(true);
    expect(byId(r.tree, 'repeat').props.visible).toBe(false);
    expect(byId(r.tree, 'repeat').props.fromAdd).toBe(true);
    act(() => byId(r.tree, 'calendar').props.onPick('2026-06-10'));
    act(() => byId(r.tree, 'repeat').props.onLogged());
    act(() => byId(r.tree, 'add-person').props.onCreated());
    expect(r.calendarPick).toHaveBeenCalledWith('2026-06-10');
    expect(r.repeatLogged).toHaveBeenCalledTimes(1);
    expect(r.personCreated).toHaveBeenCalledTimes(1);
  });
});

/** The new-goal sheet: validation, the exact goal handed to the database, and the form resetting on open. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(120000);

const mockCreateGoal = jest.fn(async (..._a: unknown[]) => undefined as unknown);
jest.mock('@/db/savingsGoals', () => ({ createSavingsGoal: (...a: unknown[]) => mockCreateGoal(...a) }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
}));
function mockStub(testID: string) {
  return (p: object) => require('react').createElement(require('react-native').View, { testID, ...p });
}
jest.mock('@/components/FormInput', () => ({
  FormInput: (p: { label: string }) =>
    require('react').createElement(require('react-native').View, { testID: `input:${p.label}`, ...p }),
}));
jest.mock('@/components/AmountField', () => ({ AmountField: mockStub('target') }));
jest.mock('@/components/DateField', () => ({ DateField: mockStub('date') }));
jest.mock('@/components/ToggleSwitch', () => ({ ToggleSwitch: mockStub('toggle') }));
jest.mock('./GoalAccountField', () => ({ GoalAccountField: mockStub('account') }));
jest.mock('./GoalSheetCard', () => ({ GoalSheetCard: mockStub('card') }));

import { AddGoalModal } from './AddGoalModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { addMonthsToIsoDate, toLocalIsoDate } from '@/lib/date';
import type { Account } from '@/types';

const savings = { id: 's1', name: 'Test Savings', type: 'savings', currency: 'INR' } as Account;
const bank = { id: 'b1', name: 'Test Bank', type: 'bank', currency: 'INR' } as Account;

const mounted: ReactTestRenderer[] = [];
const byId = (t: ReactTestRenderer, id: string) => t.root.findByProps({ testID: id });
const texts = (t: ReactTestRenderer) =>
  t.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const element = (visible: boolean, onCreated = jest.fn()) => (
  <AddGoalModal visible={visible} accounts={[savings, bank]} onClose={jest.fn()} onCreated={onCreated} />
);

async function render() {
  const onCreated = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element(true, onCreated));
  });
  mounted.push(tree);
  return { tree, onCreated };
}
const submit = (t: ReactTestRenderer) =>
  act(async () => {
    await t.root.findByType(PrimaryButton).props.onPress();
  });
const fill = async (t: ReactTestRenderer, name: string, target: string) => {
  await act(async () => byId(t, 'input:Goal name').props.onChangeText(name));
  await act(async () => byId(t, 'target').props.onChangeText(target));
};

afterEach(() => {
  act(() => mounted.splice(0).forEach((t) => t.unmount()));
  mockCreateGoal.mockReset();
  mockCreateGoal.mockImplementation(async () => undefined);
});

describe('AddGoalModal', () => {
  it('needs a name, then a valid target, before it saves anything', async () => {
    const { tree } = await render();
    await submit(tree);
    expect(texts(tree)).toContain('Enter a name');
    await fill(tree, 'Test goal', '0');
    await submit(tree);
    expect(texts(tree)).toContain('Enter a valid target amount');
    expect(mockCreateGoal).not.toHaveBeenCalled();
  });

  it('saves a trimmed name and a whole-unit target with no date, no account and no note', async () => {
    const { tree, onCreated } = await render();
    await fill(tree, '  Test goal  ', '40000.6');
    await submit(tree);
    expect(mockCreateGoal).toHaveBeenCalledWith({
      name: 'Test goal',
      targetAmountMinor: 4000100,
      targetDate: null,
      linkedAccountId: null,
      tracksAccount: false,
      noteToSelf: '',
    });
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('offers a target date a year out, from today, once the date switch is on', async () => {
    const { tree } = await render();
    expect(() => byId(tree, 'date')).toThrow();
    await act(async () => byId(tree, 'toggle').props.onChange(true));
    const today = toLocalIsoDate(new Date());
    expect(byId(tree, 'date').props.value).toBe(addMonthsToIsoDate(today, 12));
    expect(byId(tree, 'date').props.minDate).toBe(today);

    await act(async () => byId(tree, 'date').props.onChange('2030-05-01'));
    await fill(tree, 'Test goal', '1000');
    await submit(tree);
    expect(mockCreateGoal).toHaveBeenCalledWith(expect.objectContaining({ targetDate: '2030-05-01' }));
  });

  it('follows a savings account by default, and starts by hand for any other', async () => {
    const { tree } = await render();
    await act(async () => byId(tree, 'account').props.onChangeAccount('s1'));
    expect(byId(tree, 'account').props.tracks).toBe(true);
    await act(async () => byId(tree, 'account').props.onChangeAccount('b1'));
    expect(byId(tree, 'account').props.tracks).toBe(false);

    await act(async () => byId(tree, 'account').props.onChangeAccount('s1'));
    await fill(tree, 'Test goal', '1000');
    await submit(tree);
    expect(mockCreateGoal).toHaveBeenCalledWith(
      expect.objectContaining({ linkedAccountId: 's1', tracksAccount: true })
    );
  });

  it('shows a database failure and stays open for another try', async () => {
    mockCreateGoal.mockRejectedValueOnce(new Error('disk full'));
    const { tree, onCreated } = await render();
    await fill(tree, 'Test goal', '1000');
    await submit(tree);
    expect(texts(tree)).toContain('disk full');
    expect(onCreated).not.toHaveBeenCalled();
    expect(tree.root.findByType(PrimaryButton).props.disabled).toBe(false);
  });

  it('starts blank every time it opens', async () => {
    const { tree } = await render();
    await fill(tree, 'Test goal', '1000');
    await act(async () => byId(tree, 'toggle').props.onChange(true));
    act(() => tree.update(element(false)));
    act(() => tree.update(element(true)));
    expect(byId(tree, 'input:Goal name').props.value).toBe('');
    expect(byId(tree, 'target').props.value).toBe('');
    expect(byId(tree, 'toggle').props.value).toBe(false);
  });
});

/** The bar above Add's pad: which chips show for each entry type, what they say, and the note field. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

jest.setTimeout(120000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { AddDetailRow } from './AddDetailRow';
import type { EntryType } from './addEntry';

const mounted: ReactTestRenderer[] = [];
const handlers = () => ({
  onNoteChange: jest.fn(),
  onNoteEditing: jest.fn(),
  onPickAccount: jest.fn(),
  onPickDate: jest.fn(),
  onToggleRefund: jest.fn(),
  onSplit: jest.fn(),
});
function render(over: Partial<React.ComponentProps<typeof AddDetailRow>> = {}) {
  const h = handlers();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <AddDetailRow
        type={'expense' as EntryType}
        accountName="Test Bank"
        date="2026-06-15"
        today="2026-06-15"
        yesterday="2026-06-14"
        note=""
        noteEditing={false}
        isLinked={false}
        refund={false}
        splitCount={null}
        hasList={false}
        {...h}
        {...over}
      />
    );
  });
  mounted.push(tree);
  return { tree, ...h };
}
const chip = (t: ReactTestRenderer, label: string) =>
  t.root
    .findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')
    .at(-1)!;
const labels = (t: ReactTestRenderer) => [
  ...new Set(
    t.root
      .findAll((n) => typeof n.props.accessibilityLabel === 'string' && typeof n.props.onPress === 'function')
      .map((n) => n.props.accessibilityLabel as string)
  ),
];
const texts = (t: ReactTestRenderer) =>
  t.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));

afterEach(() => act(() => mounted.splice(0).forEach((t) => t.unmount())));

describe('AddDetailRow', () => {
  it('offers account, date, note, Money back and Split for a purchase', () => {
    const { tree } = render();
    expect(labels(tree)).toEqual([
      'Account, Test Bank. Change',
      expect.stringMatching(/^Date, /),
      'Add a note',
      'Money back (a refund)',
      'Split this payment',
    ]);
  });

  it('says Today, Yesterday, or the date', () => {
    expect(texts(render().tree)).toContain('Today');
    expect(texts(render({ date: '2026-06-14' }).tree)).toContain('Yesterday');
    expect(texts(render({ date: '2026-05-01' }).tree)).not.toContain('Today');
  });

  it('drops Money back and Split for income, transfers and friend entries, and the account for the last two', () => {
    expect(labels(render({ type: 'income' }).tree)).toEqual([
      'Account, Test Bank. Change',
      expect.stringMatching(/^Date, /),
      'Add a note',
    ]);
    expect(labels(render({ type: 'transfer' }).tree)).toEqual([
      expect.stringMatching(/^Date, /),
      'Add a note',
    ]);
    expect(labels(render({ type: 'friend' }).tree)).toEqual([expect.stringMatching(/^Date, /), 'Add a note']);
  });

  it('drops Money back and Split for an entry tied to a loan or person', () => {
    expect(labels(render({ isLinked: true }).tree)).not.toContain('Split this payment');
    expect(labels(render({ isLinked: true }).tree)).not.toContain('Money back (a refund)');
  });

  it('leaves the account chip out until there is an account', () => {
    expect(labels(render({ accountName: undefined }).tree)).not.toContain('Account, undefined. Change');
    expect(texts(render({ accountName: undefined }).tree)).not.toContain('undefined');
  });

  it('reports a tap on each chip', () => {
    const r = render();
    act(() => chip(r.tree, 'Account, Test Bank. Change').props.onPress());
    act(() => chip(r.tree, 'Add a note').props.onPress());
    act(() => chip(r.tree, 'Money back (a refund)').props.onPress());
    act(() => chip(r.tree, 'Split this payment').props.onPress());
    expect(r.onPickAccount).toHaveBeenCalledTimes(1);
    expect(r.onNoteEditing).toHaveBeenCalledWith(true);
    expect(r.onToggleRefund).toHaveBeenCalledTimes(1);
    expect(r.onSplit).toHaveBeenCalledTimes(1);
    const date = r.tree.root.findAll(
      (n) => /^Date, /.test(n.props.accessibilityLabel ?? '') && typeof n.props.onPress === 'function'
    )[0];
    act(() => date.props.onPress());
    expect(r.onPickDate).toHaveBeenCalledTimes(1);
  });

  it('shows the note, and offers to edit it', () => {
    const r = render({ note: ' Lunch ' });
    expect(texts(r.tree)).toContain('Lunch');
    expect(chip(r.tree, 'Note,  Lunch . Edit')).toBeDefined();
  });

  it('shows how many parts a split has, and blocks Money back while it is split', () => {
    const { tree } = render({ splitCount: 3 });
    expect(texts(tree)).toContain('Split · 3');
    expect(chip(tree, 'Split into 3 parts. Edit').props.accessibilityState.checked).toBe(true);
    expect(chip(tree, 'Money back (a refund)').props.disabled).toBe(true);
  });

  it('blocks Split while Money back is on, or while a list is being built', () => {
    expect(chip(render({ refund: true }).tree, 'Split this payment').props.disabled).toBe(true);
    expect(chip(render({ hasList: true }).tree, 'Split this payment').props.disabled).toBe(true);
    expect(chip(render().tree, 'Split this payment').props.disabled).toBe(false);
  });

  it('swaps the bar for the note field while the note is being typed', () => {
    const r = render({ noteEditing: true, note: 'Lunch' });
    const input = r.tree.root.findByType(TextInput);
    expect(input.props.value).toBe('Lunch');
    expect(labels(r.tree)).toEqual([]);
    act(() => input.props.onChangeText('Lunch out'));
    expect(r.onNoteChange).toHaveBeenCalledWith('Lunch out');
    act(() => input.props.onSubmitEditing());
    act(() => input.props.onBlur());
    expect(r.onNoteEditing).toHaveBeenCalledTimes(2);
    expect(r.onNoteEditing).toHaveBeenCalledWith(false);
  });
});

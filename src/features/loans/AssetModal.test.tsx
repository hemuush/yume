/** The asset a loan financed: an optional estimated value, validated only when given, and a way to stop tracking. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(120000);

const mockUpdateAsset = jest.fn(async (..._a: unknown[]) => undefined as unknown);
jest.mock('@/db/loans', () => ({ updateLoanAsset: (...a: unknown[]) => mockUpdateAsset(...a) }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
  SheetLink: (p: object) => require('react').createElement(require('react-native').Pressable, p),
}));
jest.mock('@/components/FormInput', () => ({
  FormInput: (p: { label: string }) =>
    require('react').createElement(require('react-native').View, { testID: 'label', ...p }),
}));
jest.mock('@/components/AmountField', () => ({
  AmountField: (p: { label: string }) =>
    require('react').createElement(require('react-native').View, { testID: 'value', ...p }),
}));

import { AssetModal } from './AssetModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SheetLink } from '@/components/ModalSheet';
import type { Loan } from '@/types';

const makeLoan = (over: Partial<Loan> = {}) =>
  ({
    id: 'l1',
    outstandingPrincipalMinor: 1_200_000,
    assetLabel: null,
    assetValueMinor: null,
    ...over,
  }) as Loan;

const mounted: ReactTestRenderer[] = [];
const byId = (t: ReactTestRenderer, id: string) => t.root.findByProps({ testID: id });
const texts = (t: ReactTestRenderer) =>
  t.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));

async function render(loan: Loan) {
  const onDone = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AssetModal loan={loan} onClose={jest.fn()} onDone={onDone} />);
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
  mockUpdateAsset.mockReset();
  mockUpdateAsset.mockImplementation(async () => undefined);
});

describe('AssetModal', () => {
  it('opens on the asset already recorded, its value shown in whole units', async () => {
    const { tree } = await render(makeLoan({ assetLabel: 'Test home', assetValueMinor: 350_000_000 }));
    expect(byId(tree, 'label').props.value).toBe('Test home');
    expect(byId(tree, 'value').props.value).toBe('3500000');
  });

  it('saves with no value yet, and names it "Asset" when the label is blank', async () => {
    const { tree, onDone } = await render(makeLoan());
    await save(tree);
    expect(mockUpdateAsset).toHaveBeenCalledWith('l1', { assetLabel: 'Asset', assetValueMinor: null });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('sends the trimmed label and the value in minor units', async () => {
    const { tree } = await render(makeLoan());
    await act(async () => byId(tree, 'label').props.onChangeText('  Test car  '));
    await act(async () => byId(tree, 'value').props.onChangeText('800000'));
    await save(tree);
    expect(mockUpdateAsset).toHaveBeenCalledWith('l1', {
      assetLabel: 'Test car',
      assetValueMinor: 80_000_000,
    });
  });

  it.each(['abc', '0', '-5'])('rejects a value that is given but not valid (%s)', async (typed) => {
    const { tree, onDone } = await render(makeLoan());
    await act(async () => byId(tree, 'value').props.onChangeText(typed));
    await save(tree);
    expect(mockUpdateAsset).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Enter a valid current value, or leave it blank for now');
  });

  it('offers to stop tracking only when a value is set, and clears both fields when used', async () => {
    const without = await render(makeLoan());
    expect(without.tree.root.findAllByType(SheetLink)).toHaveLength(0);

    const { tree, onDone } = await render(
      makeLoan({ assetLabel: 'Test home', assetValueMinor: 350_000_000 })
    );
    await act(async () => {
      await tree.root.findByType(SheetLink).props.onPress();
    });
    expect(mockUpdateAsset).toHaveBeenCalledWith('l1', { assetLabel: null, assetValueMinor: null });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows a failure and does not report success', async () => {
    mockUpdateAsset.mockRejectedValueOnce(new Error('disk full'));
    const { tree, onDone } = await render(makeLoan());
    await save(tree);
    expect(texts(tree)).toContain('disk full');
    expect(onDone).not.toHaveBeenCalled();
  });
});

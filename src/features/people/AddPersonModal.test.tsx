/** The new-person sheet: a name is required, it is trimmed, and a failure is shown without closing. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(120000);

const mockCreatePerson = jest.fn(async (..._a: unknown[]) => undefined as unknown);
jest.mock('@/db/people', () => ({ createPerson: (...a: unknown[]) => mockCreatePerson(...a) }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
}));
jest.mock('@/components/FormInput', () => ({
  FormInput: (p: { label: string }) =>
    require('react').createElement(require('react-native').View, { testID: 'name', ...p }),
}));

import { AddPersonModal } from './AddPersonModal';
import { PrimaryButton } from '@/components/PrimaryButton';

const mounted: ReactTestRenderer[] = [];
const texts = (t: ReactTestRenderer) =>
  t.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const nameField = (t: ReactTestRenderer) => t.root.findByProps({ testID: 'name' });

async function render() {
  const onCreated = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AddPersonModal visible onClose={jest.fn()} onCreated={onCreated} />);
  });
  mounted.push(tree);
  return { tree, onCreated };
}
const submit = (t: ReactTestRenderer) =>
  act(async () => {
    await t.root.findByType(PrimaryButton).props.onPress();
  });

afterEach(() => {
  act(() => mounted.splice(0).forEach((t) => t.unmount()));
  mockCreatePerson.mockReset();
  mockCreatePerson.mockImplementation(async () => undefined);
});

describe('AddPersonModal', () => {
  it('asks for a name and saves nothing while it is blank', async () => {
    const { tree, onCreated } = await render();
    await submit(tree);
    expect(texts(tree)).toContain('Enter a name');
    await act(async () => nameField(tree).props.onChangeText('   '));
    await submit(tree);
    expect(mockCreatePerson).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('saves the trimmed name, clears the field and reports it', async () => {
    const { tree, onCreated } = await render();
    await act(async () => nameField(tree).props.onChangeText('  Test Person  '));
    await submit(tree);
    expect(mockCreatePerson).toHaveBeenCalledWith({ name: 'Test Person' });
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(nameField(tree).props.value).toBe('');
  });

  it('shows a failure, keeps what was typed, and does not report success', async () => {
    mockCreatePerson.mockRejectedValueOnce(new Error('disk full'));
    const { tree, onCreated } = await render();
    await act(async () => nameField(tree).props.onChangeText('Test Person'));
    await submit(tree);
    expect(texts(tree)).toContain('disk full');
    expect(onCreated).not.toHaveBeenCalled();
    expect(nameField(tree).props.value).toBe('Test Person');
    expect(tree.root.findByType(PrimaryButton).props.disabled).toBe(false);
  });
});

/**
 * The restore preview: the backup next to the phone, and whether any newer
 * entries would be lost — before anything is replaced.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <>
      {children}
      {footer}
    </>
  ),
}));

import { RestorePreviewSheet, RestorePreview } from './RestorePreviewSheet';

const preview = (lostCount: number): RestorePreview => ({
  exportedAt: '2026-09-25T18:28:02Z',
  backup: { entries: 280, lastEntryDate: '2026-09-25', accounts: 4, loans: 3 },
  current: { entries: 281, lastEntryDate: '2026-09-26', accounts: 4, loans: 3 },
  lostCount,
});

async function render(p: RestorePreview, onRestore = jest.fn()) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <RestorePreviewSheet preview={p} busy={false} onCancel={jest.fn()} onRestore={onRestore} />
    );
  });
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

beforeAll(async () => {
  await render(preview(0));
}, 180000);

it('shows the backup next to the phone, and what would be lost', async () => {
  const shown = texts(await render(preview(1)));
  expect(shown.some((t) => t.startsWith('280 entries, the latest on'))).toBe(true);
  expect(shown.some((t) => t.startsWith('281 entries, the latest on'))).toBe(true);
  expect(shown.some((t) => t.startsWith('1 entry you added after that backup would be lost.'))).toBe(true);
});

it('says so when nothing would be lost, and restores on Restore', async () => {
  const onRestore = jest.fn();
  const tree = await render(preview(0), onRestore);
  expect(texts(tree).some((t) => t.startsWith('Nothing you added since would be lost.'))).toBe(true);
  act(() =>
    tree.root.find((n) => n.props.title === 'Restore this backup' && n.props.onPress).props.onPress()
  );
  expect(onRestore).toHaveBeenCalled();
});

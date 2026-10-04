/**
 * The restore preview: the backup next to the phone, and whether any newer
 * entries would be lost — before anything is replaced.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
const mockSheetProps: { onClose?: () => void; title?: string } = {};
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: (props: {
    children: React.ReactNode;
    footer?: React.ReactNode;
    onClose: () => void;
    title?: string;
  }) => {
    mockSheetProps.onClose = props.onClose;
    mockSheetProps.title = props.title;
    return (
      <>
        {props.children}
        {props.footer}
      </>
    );
  },
}));

import { RestorePreviewSheet, RestorePreview } from './RestorePreviewSheet';

const preview = (lostCount: number): RestorePreview => ({
  exportedAt: '2026-09-25T18:28:02Z',
  backup: { entries: 280, lastEntryDate: '2026-09-25', accounts: 4, loans: 3 },
  current: { entries: 281, lastEntryDate: '2026-09-26', accounts: 4, loans: 3 },
  lostCount,
});

async function render(p: RestorePreview, onRestore = jest.fn(), busy = false, onCancel = jest.fn()) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RestorePreviewSheet preview={p} busy={busy} onCancel={onCancel} onRestore={onRestore} />);
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

it('ignores a close request while the restore is running', async () => {
  const onCancel = jest.fn();
  await render(preview(0), jest.fn(), true, onCancel);
  mockSheetProps.onClose?.();
  expect(onCancel).not.toHaveBeenCalled();
});

it('closes normally when nothing is running', async () => {
  const onCancel = jest.fn();
  await render(preview(0), jest.fn(), false, onCancel);
  mockSheetProps.onClose?.();
  expect(onCancel).toHaveBeenCalledTimes(1);
});

it('does not print "Invalid Date" for a backup with an unreadable export time', async () => {
  const tree = await render({ ...preview(0), exportedAt: 'not a date' });
  expect(texts(tree).join(' | ')).not.toMatch(/Invalid/i);
  expect(mockSheetProps.title ?? '').not.toMatch(/Invalid/i);
});

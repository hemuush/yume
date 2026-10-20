import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
jest.mock('@/db/entryDraft', () => ({
  readEntryDraft: jest.fn(async () => null),
  writeEntryDraft: jest.fn(async () => {}),
}));
import { readEntryDraft, writeEntryDraft } from '@/db/entryDraft';
import { emitSettingsRestored } from '@/lib/dataEvents';
import { useEntryDraftRecovery } from './useEntryDraftRecovery';
import type { EntryDraft } from './entryDraft';
const draft: EntryDraft = {
  type: 'expense',
  expr: '270',
  accountId: 'bank',
  toAccountId: null,
  categoryId: 'food',
  note: '',
  paymentMode: 'cash',
  date: '2026-10-20',
  personId: null,
  friendSign: 1,
  friendAccountId: null,
  refund: false,
  rows: [],
  splitParts: null,
};
let tree: ReactTestRenderer;
let current: ReturnType<typeof useEntryDraftRecovery>;
let state: (s: string) => void;
let spy: jest.SpyInstance;
let update: (value: EntryDraft) => void;
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
    state = cb as (s: string) => void;
    return { remove: jest.fn() };
  });
});
afterEach(() => {
  act(() => tree?.unmount());
  spy.mockRestore();
  jest.useRealTimers();
});
async function setup(value = draft) {
  function Probe({ value }: { value: EntryDraft }) {
    current = useEntryDraftRecovery(value, true, value.expr !== '');
    return null;
  }
  await act(async () => {
    tree = create(<Probe value={value} />);
  });
  update = (value) => tree.update(<Probe value={value} />);
}
it('debounces saves and flushes the current entry when backgrounded', async () => {
  await setup();
  expect(writeEntryDraft).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(650);
  });
  expect(writeEntryDraft).toHaveBeenLastCalledWith(draft);
  await act(async () => {
    state('background');
  });
  expect(writeEntryDraft).toHaveBeenLastCalledWith(draft);
});
it('never resurrects a draft on background or unmount after successful Save/Discard', async () => {
  await setup();
  await act(async () => {
    await current.clear();
    jest.advanceTimersByTime(1000);
    state('background');
  });
  act(() => tree.unmount());
  expect(writeEntryDraft).toHaveBeenLastCalledWith(null);
});
it('offers recovery without overwriting it with the empty new form', async () => {
  jest.mocked(readEntryDraft).mockResolvedValueOnce(draft);
  await setup({ ...draft, expr: '' });
  expect(current.candidate).toEqual(draft);
  await act(async () => {
    jest.advanceTimersByTime(1000);
    state('background');
  });
  expect(writeEntryDraft).not.toHaveBeenCalled();
});
it('does not save a stale draft after the ledger is restored', async () => {
  await setup();
  act(() => emitSettingsRestored());
  await act(async () => {
    jest.advanceTimersByTime(1000);
    state('background');
  });
  expect(writeEntryDraft).not.toHaveBeenCalled();
});

it('can explicitly keep the current form even before initial recovery finishes', async () => {
  jest.mocked(readEntryDraft).mockImplementationOnce(() => new Promise(() => {}));
  await setup();
  await act(async () => {
    await current.keep();
  });
  expect(writeEntryDraft).toHaveBeenLastCalledWith(draft);
});

it('persists an emptied form when backgrounded before the debounce finishes', async () => {
  await setup();
  await act(async () => {
    jest.advanceTimersByTime(650);
  });
  await act(async () => {
    update({ ...draft, expr: '' });
  });
  await act(async () => {
    state('background');
  });
  expect(writeEntryDraft).toHaveBeenLastCalledWith(null);
});
it('does not replace a pending recovered draft when a new form backgrounds', async () => {
  jest.mocked(readEntryDraft).mockResolvedValueOnce({ ...draft, expr: '100' });
  await setup();
  await act(async () => {
    state('background');
  });
  expect(writeEntryDraft).not.toHaveBeenCalled();
  expect(current.candidate?.expr).toBe('100');
});

it('resumes autosaving after a discard fails and the user keeps editing', async () => {
  await setup();
  jest.mocked(writeEntryDraft).mockRejectedValueOnce(new Error('storage unavailable'));
  await act(async () => {
    await expect(current.discardCurrent()).rejects.toThrow('storage unavailable');
  });
  await act(async () => {
    update({ ...draft, expr: '300' });
    jest.advanceTimersByTime(650);
  });
  await act(async () => {
    jest.advanceTimersByTime(650);
  });
  expect(writeEntryDraft).toHaveBeenLastCalledWith(expect.objectContaining({ expr: '300' }));
});
it('suspends draft persistence during a save and recovers only the remaining form after failure', async () => {
  await setup();
  await act(async () => {
    await current.prepareSave();
    state('background');
    jest.advanceTimersByTime(1000);
  });
  expect(writeEntryDraft).toHaveBeenLastCalledWith(null);
  await act(async () => {
    update({ ...draft, expr: '90' });
    current.resumeAfterFailedSave();
  });
  await act(async () => {
    jest.advanceTimersByTime(650);
  });
  expect(writeEntryDraft).toHaveBeenLastCalledWith(expect.objectContaining({ expr: '90' }));
});
it('does not overwrite an unread recovery copy when its initial read fails', async () => {
  jest.mocked(readEntryDraft).mockRejectedValueOnce(new Error('read failed'));
  await setup();
  await act(async () => {
    jest.advanceTimersByTime(1000);
    state('background');
  });
  expect(writeEntryDraft).not.toHaveBeenCalled();
});

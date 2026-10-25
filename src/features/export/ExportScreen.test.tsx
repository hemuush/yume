/**
 * Reports & exports: pick a month, a year or everything, then make a PDF or an Excel file. Only periods with
 * entries are offered, app lock is asked first, and a failure is said out loud.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockFocusCallbacks = new Set<() => void>();
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useFocusEffect: (cb: () => (() => void) | void) =>
    require('react').useEffect(() => {
      const cleanup = cb();
      if (!cleanup) mockFocusCallbacks.add(cb);
      return () => {
        mockFocusCallbacks.delete(cb);
        cleanup?.();
      };
    }, [cb]),
}));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#A6B4F2', secondary: '#F0B79A', dot: '#F0B79A', onAccent: '#12130F' }),
}));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
const mockLock = { lockEnabled: false };
jest.mock('@/lib/AppLockContext', () => ({ useAppLock: () => mockLock }));
const mockAuth = jest.fn(async () => true);
jest.mock('@/lib/appLock', () => ({ authenticate: () => mockAuth() }));
jest.mock('@/components/AppDialog', () => ({ showAlert: jest.fn() }));
jest.mock('@/db/settings', () => ({ getDefaultCurrency: async () => 'INR' }));
const mockMonths = jest.fn();
jest.mock('@/db/exportSummary', () => ({ listEntryMonths: () => mockMonths() }));
const mockPdf = jest.fn();
jest.mock('@/lib/exportPdf', () => ({ generateReportPdf: (...a: unknown[]) => mockPdf(...a) }));
const mockXlsx = jest.fn();
jest.mock('@/lib/exportExcel', () => ({ generateExportWorkbookBytes: (...a: unknown[]) => mockXlsx(...a) }));
const mockShare = jest.fn();
jest.mock('@/lib/shareTempFile', () => ({ shareTempFile: (...a: unknown[]) => mockShare(...a) }));

import ExportScreen from '../../../app/export';

const MONTHS = [
  { month: '2026-09', count: 312, spentMinor: 4826000 },
  { month: '2026-07', count: 40, spentMinor: 100000 },
  { month: '2025-12', count: 9, spentMinor: 5000 },
];

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ExportScreen />);
  });
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
const pressLabel = async (tree: ReactTestRenderer, label: string) => {
  const node = tree.root.find(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function'
  );
  await act(async () => {
    await node.props.onPress();
  });
};
const segmented = (tree: ReactTestRenderer, first: string) =>
  tree.root.find((n) => n.props.options?.[0]?.value === first && typeof n.props.onChange === 'function');
const createButton = (tree: ReactTestRenderer) =>
  tree.root.find((n) => /^Create /.test(n.props.title ?? '') && typeof n.props.onPress === 'function');

beforeEach(() => {
  mockFocusCallbacks.clear();
  mockMonths.mockResolvedValue(MONTHS);
  mockPdf.mockResolvedValue({ bytes: new Uint8Array([1]), pageCount: 3 });
  mockXlsx.mockResolvedValue(new Uint8Array([2]));
  mockShare.mockResolvedValue(undefined);
  mockLock.lockEnabled = false;
  mockAuth.mockResolvedValue(true);
});

describe('Reports & exports', () => {
  const refresh = async () => {
    await act(async () => {
      for (const focus of mockFocusCallbacks) focus();
    });
  };

  it('shows a refresh failure beside the loaded period and retries', async () => {
    const tree = await render();
    mockMonths.mockRejectedValueOnce(new Error('Database busy'));
    await refresh();
    expect(texts(tree)).toContain('Database busy');
    expect(texts(tree)).toContain('September 2026');
    await act(async () => {
      tree.root.find((n) => n.props.title === 'Retry' && n.props.onPress).props.onPress();
    });
    expect(texts(tree)).not.toContain('Database busy');
  });

  it('chooses an available month when the old month disappears', async () => {
    const tree = await render();
    mockMonths.mockResolvedValue([{ month: '2025-12', count: 2, spentMinor: 5000 }]);
    await refresh();
    expect(texts(tree)).toContain('December 2025');
    expect(createButton(tree).props.disabled).toBe(false);
  });

  it('retains a month that still has entries when newer data arrives', async () => {
    const tree = await render();
    mockMonths.mockResolvedValue([{ month: '2026-10', count: 1, spentMinor: 1000 }, ...MONTHS]);
    await refresh();
    expect(texts(tree)).toContain('September 2026');
  });

  it('retains the year kind when the old year disappears', async () => {
    const tree = await render();
    act(() => segmented(tree, 'month').props.onChange('year'));
    mockMonths.mockResolvedValue([{ month: '2025-12', count: 2, spentMinor: 5000 }]);
    await refresh();
    expect(texts(tree)).toContain('2025');
    expect(segmented(tree, 'month').props.value).toBe('year');
  });

  it('opens on the latest month with entries and says what is in it', async () => {
    const tree = await render();
    expect(texts(tree)).toContain('September 2026');
    expect(texts(tree).some((t) => t.startsWith('312 entries'))).toBe(true);
  });

  it('steps only to months that have entries', async () => {
    const tree = await render();
    await pressLabel(tree, 'Earlier');
    expect(texts(tree)).toContain('July 2026');
    await pressLabel(tree, 'Earlier');
    expect(texts(tree)).toContain('December 2025');
    expect(tree.root.find((n) => n.props.accessibilityLabel === 'Earlier').props.disabled).toBe(true);
  });

  it('makes a PDF for the chosen month in the theme colours and shares it by period', async () => {
    const tree = await render();
    await act(async () => {
      await createButton(tree).props.onPress();
    });
    expect(mockPdf).toHaveBeenCalledWith(
      { kind: 'month', year: 2026, month: 9 },
      { primary: '#A6B4F2', secondary: '#F0B79A', dot: '#F0B79A' }
    );
    expect(mockShare).toHaveBeenCalledWith('yume-2026-09-report.pdf', expect.any(Uint8Array), {
      mimeType: 'application/pdf',
      dialogTitle: 'Yume report · September 2026',
    });
  });

  it('makes an Excel file for a whole year', async () => {
    const tree = await render();
    act(() => segmented(tree, 'month').props.onChange('year'));
    act(() => segmented(tree, 'pdf').props.onChange('excel'));
    await act(async () => {
      await createButton(tree).props.onPress();
    });
    expect(mockXlsx).toHaveBeenCalledWith({ kind: 'year', year: 2026 });
    expect(mockShare.mock.calls[0][0]).toBe('yume-2026.xlsx');
  });

  it('asks for the phone unlock first with app lock on, and stops if it is refused', async () => {
    mockLock.lockEnabled = true;
    mockAuth.mockResolvedValue(false);
    const tree = await render();
    await act(async () => {
      await createButton(tree).props.onPress();
    });
    expect(mockAuth).toHaveBeenCalled();
    expect(mockPdf).not.toHaveBeenCalled();
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('says so when the export fails', async () => {
    mockPdf.mockRejectedValue(new Error('too many entries'));
    const tree = await render();
    await act(async () => {
      await createButton(tree).props.onPress();
    });
    const { showAlert } = jest.requireMock('@/components/AppDialog');
    expect(showAlert).toHaveBeenCalledWith("Couldn't create the export", 'too many entries');
  });

  it('has nothing to export on an empty ledger', async () => {
    mockMonths.mockResolvedValue([]);
    const tree = await render();
    expect(texts(tree)).toContain('There are no entries to export yet.');
    expect(createButton(tree).props.disabled).toBe(true);
  });
});

import { act } from 'react-test-renderer';
import { renderHook } from '@/test-support/renderHook';
import type { Loan } from '@/types';

const mockLoans: Loan[] = [];
let mockProgress: { loanId: string; paidCount: number }[] = [];
// The next read of the loans waits here: an older load that finishes after a newer one.
const mockHold: { next: boolean; release: (() => void) | null } = { next: false, release: null };
jest.mock('@/db/loans', () => ({
  listLoans: async () => {
    const snapshot = JSON.parse(JSON.stringify(mockLoans));
    if (mockHold.next) {
      mockHold.next = false;
      await new Promise<void>((resolve) => {
        mockHold.release = resolve;
      });
    }
    return snapshot;
  },
  getLoanProgress: async () => JSON.parse(JSON.stringify(mockProgress)),
}));
jest.mock('@/hooks/useScreenLoad', () => ({
  useScreenLoad: (load: () => Promise<void>) => {
    const React = require('react');
    const [loaded, setLoaded] = React.useState(false);
    React.useEffect(() => {
      void load().then(() => setLoaded(true));
    }, [load]);
    return { loaded, hasData: loaded, loadError: null, reload: load };
  },
}));

import { useLoansData } from './useLoansData';

const loan = (id: string, outstanding: number) =>
  ({ id, counterparty: id, outstandingPrincipalMinor: outstanding }) as Loan;

beforeEach(() => {
  mockLoans.splice(0, mockLoans.length, loan('a', 500), loan('b', 700));
  mockProgress = [
    { loanId: 'a', paidCount: 1 },
    { loanId: 'b', paidCount: 2 },
  ];
  mockHold.next = false;
  mockHold.release = null;
});

const settle = () => act(async () => {});

describe('useLoansData', () => {
  it('reads the loans and each one’s progress', async () => {
    const { result } = renderHook(useLoansData);
    await settle();
    expect(result.current.loans.map((l) => l.id)).toEqual(['a', 'b']);
    expect(result.current.progress.b).toMatchObject({ paidCount: 2 });
    expect(result.current.loaded).toBe(true);
    expect(result.current.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('draws nothing again when a reload finds the same loans', async () => {
    const renders = jest.fn();
    const { result } = renderHook(useLoansData, { onRender: renders });
    await settle();
    const before = { ...result.current };
    const drawn = renders.mock.calls.length;
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.loans).toBe(before.loans);
    expect(result.current.progress).toBe(before.progress);
    expect(renders.mock.calls.length).toBe(drawn);
  });

  it('keeps each loan that did not change, so only the one that did is drawn again', async () => {
    const { result } = renderHook(useLoansData);
    await settle();
    const before = { ...result.current };
    mockLoans[1] = loan('b', 650);
    mockProgress[1] = { loanId: 'b', paidCount: 3 };
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.loans[0]).toBe(before.loans[0]);
    expect(result.current.loans[1]).not.toBe(before.loans[1]);
    expect(result.current.progress.a).toBe(before.progress.a);
    expect(result.current.progress.b).not.toBe(before.progress.b);
  });

  it('never lets an older load land over a newer one', async () => {
    const { result } = renderHook(useLoansData);
    await settle();
    // A load starts and is slow; before it finishes, another starts and finishes with newer loans.
    mockHold.next = true;
    let older!: Promise<void>;
    act(() => {
      older = result.current.reload();
    });
    mockLoans[1] = loan('b', 650);
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.loans[1].outstandingPrincipalMinor).toBe(650);
    await act(async () => {
      mockHold.release!();
      await older;
    });
    // The older read had taken the old balance; it finishes last and is thrown away.
    expect(result.current.loans[1].outstandingPrincipalMinor).toBe(650);
  });
});

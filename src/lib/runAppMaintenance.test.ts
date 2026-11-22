jest.mock('@/db/afterCommit', () => ({ rebuildNotificationsAfterCommit: jest.fn(async () => {}) }));
import { rebuildNotificationsAfterCommit } from '@/db/afterCommit';
jest.mock('@/db/recurring', () => ({ runDueRecurringRules: jest.fn() }));
jest.mock('./localBackup', () => ({ runLocalBackupIfDue: jest.fn(async () => {}) }));
jest.mock('./dataEvents', () => ({ emitTransactionsChanged: jest.fn() }));
import { runDueRecurringRules } from '@/db/recurring';
import { runLocalBackupIfDue } from './localBackup';
import { emitTransactionsChanged } from './dataEvents';
import { runAppMaintenance } from './runAppMaintenance';
import { recordRebuild } from './rebuildState';

it('waits for recurring transactions before backing up, sharing overlapping calls', async () => {
  let finish!: (count: number) => void;
  (runDueRecurringRules as jest.Mock).mockReturnValue(
    new Promise<number>((resolve) => {
      finish = resolve;
    })
  );
  const first = runAppMaintenance();
  const second = runAppMaintenance();
  expect(first).toBe(second);
  expect(runLocalBackupIfDue).not.toHaveBeenCalled();
  finish(2);
  await first;
  expect(emitTransactionsChanged).toHaveBeenCalledTimes(1);
  expect(runLocalBackupIfDue).toHaveBeenCalledTimes(1);
});

it('still attempts backup if recurring catch-up fails', async () => {
  const warning = jest.spyOn(console, 'error').mockImplementation(() => {});
  (runDueRecurringRules as jest.Mock).mockRejectedValue(new Error('failed rule'));
  await runAppMaintenance();
  expect(runLocalBackupIfDue).toHaveBeenCalledTimes(1);
  expect(emitTransactionsChanged).not.toHaveBeenCalled();
  warning.mockRestore();
});

it('renews reminders even when no recurring entry is due', async () => {
  jest.mocked(runDueRecurringRules).mockResolvedValue(0);
  await runAppMaintenance();
  expect(rebuildNotificationsAfterCommit).toHaveBeenCalledTimes(1);
  expect(jest.mocked(rebuildNotificationsAfterCommit).mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(runLocalBackupIfDue).mock.invocationCallOrder[0]
  );
});

describe('a rebuild that is still good', () => {
  it('is kept when nothing new was posted', async () => {
    recordRebuild(true);
    jest.mocked(runDueRecurringRules).mockResolvedValue(0);
    await runAppMaintenance();
    expect(rebuildNotificationsAfterCommit).not.toHaveBeenCalled();
  });

  it('is redone when the catch-up posted entries, which change what is due and whether today has one', async () => {
    recordRebuild(true);
    jest.mocked(runDueRecurringRules).mockResolvedValue(2);
    await runAppMaintenance();
    expect(rebuildNotificationsAfterCommit).toHaveBeenCalledTimes(1);
  });
});

jest.mock('@/db/recurring', () => ({ runDueRecurringRules: jest.fn() }));
jest.mock('./localBackup', () => ({ runLocalBackupIfDue: jest.fn(async () => {}) }));
jest.mock('./dataEvents', () => ({ emitTransactionsChanged: jest.fn() }));
import { runDueRecurringRules } from '@/db/recurring';
import { runLocalBackupIfDue } from './localBackup';
import { emitTransactionsChanged } from './dataEvents';
import { runAppMaintenance } from './runAppMaintenance';

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

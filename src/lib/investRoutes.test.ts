import { investHref, withdrawHref } from './investRoutes';

const holding = (fundingAccountId: string | null) => ({
  id: 'fund',
  investment: { fundingAccountId } as never,
});

it('opens Add as a transfer into the holding from its funding account', () => {
  expect(investHref(holding('bank'))).toBe('/add-transaction?type=transfer&accountId=bank&toAccountId=fund');
});
it('opens Add as a transfer back out to the funding account', () => {
  expect(withdrawHref(holding('bank'))).toBe(
    '/add-transaction?type=transfer&accountId=fund&toAccountId=bank'
  );
});
it('leaves the other account for Add to offer when none is set', () => {
  expect(investHref(holding(null))).toBe('/add-transaction?type=transfer&toAccountId=fund');
  expect(withdrawHref(holding(null))).toBe('/add-transaction?type=transfer&accountId=fund');
});

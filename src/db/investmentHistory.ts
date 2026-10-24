import { getDb } from './client';

/** Money moving into (+) or out of (−) a tracked account by transfer, on a date: what was put in or taken out. */
export interface InvestmentFlow {
  accountId: string;
  date: string;
  amountMinor: number;
}

/** A value update of a tracked account. */
export interface InvestmentValuation {
  accountId: string;
  date: string;
  valueMinor: number;
}

/** Everything the portfolio's chart and yearly rate need, for every tracked account, oldest first. */
export async function listInvestmentHistory(): Promise<{
  flows: InvestmentFlow[];
  valuations: InvestmentValuation[];
}> {
  const db = await getDb();
  const flows = await db.getAllAsync<{ account_id: string; date: string; amount: number }>(
    `SELECT t.to_account_id AS account_id, t.date AS date, t.amount_minor AS amount
       FROM transactions t JOIN accounts a ON a.id = t.to_account_id
      WHERE t.type = 'transfer' AND a.tracked = 1
     UNION ALL
     SELECT t.account_id AS account_id, t.date AS date, -t.amount_minor AS amount
       FROM transactions t JOIN accounts a ON a.id = t.account_id
      WHERE t.type = 'transfer' AND a.tracked = 1
     ORDER BY date ASC`
  );
  const valuations = await db.getAllAsync<{ account_id: string; date: string; value_minor: number }>(
    `SELECT v.account_id AS account_id, v.date AS date, v.value_minor AS value_minor
       FROM account_valuations v JOIN accounts a ON a.id = v.account_id
      WHERE a.tracked = 1 ORDER BY v.date ASC`
  );
  return {
    flows: flows.map((f) => ({ accountId: f.account_id, date: f.date, amountMinor: f.amount })),
    valuations: valuations.map((v) => ({ accountId: v.account_id, date: v.date, valueMinor: v.value_minor })),
  };
}

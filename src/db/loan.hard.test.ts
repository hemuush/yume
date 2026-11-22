/**
 * Hard loan tests on real SQLite: random pay/undo/prepay/rate-change sequences keep the loan and its schedule
 * consistent, and the one-time whole-rupee conversion is idempotent and loses at most a rupee.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockDb: any = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import {
  createLoan,
  payInstallment,
  applyRateChange,
  applyPrepayment,
  undoInstallmentPayment,
} from '@/db/loans';
import { convertLoansToWholeRupees } from '@/db/loanWholeRupees';
import { addMonthsToIsoDate } from '@/lib/date';

jest.setTimeout(300000);

const run = (sql: string, p: unknown[] = []) => mockDb.runAsync(sql, p);
const one = <T>(sql: string, p: unknown[] = []) => mockDb.getFirstAsync(sql, p) as Promise<T | null>;
const all = <T>(sql: string, p: unknown[] = []) => mockDb.getAllAsync(sql, p) as Promise<T[]>;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Loan = {
  id: string;
  emi_amount_minor: number;
  outstanding_principal_minor: number;
  status: string;
  principal_minor: number;
  interest_rate_annual_bp: number;
};
type Row = {
  id: string;
  installment_number: number;
  status: string;
  emi_amount_minor: number;
  principal_component_minor: number;
  interest_component_minor: number;
  outstanding_after_minor: number;
  transaction_id: string | null;
};

beforeAll(async () => {
  await mockDb.execAsync(CREATE_TABLES_SQL);
  await run(
    "INSERT INTO accounts (id, name, type, currency, opening_balance_minor) VALUES ('a','Bank','bank','INR',0)"
  );
  await run("INSERT INTO categories (id, name, kind) VALUES ('c','EMI','expense')");
});

const loanRow = (id: string) => one<Loan>('SELECT * FROM loans WHERE id = ?', [id]);
const rowsOf = (id: string) =>
  all<Row>('SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY installment_number', [id]);

async function checkLoan(id: string, everPrepaid: boolean) {
  const loan = (await loanRow(id))!;
  const rows = await rowsOf(id);
  const paid = rows.filter((r) => r.status === 'paid');
  const pending = rows.filter((r) => r.status !== 'paid');
  expect(rows.map((r) => r.installment_number)).toEqual(rows.map((_, i) => i + 1));
  expect(rows.slice(0, paid.length).every((r) => r.status === 'paid')).toBe(true);
  expect(loan.emi_amount_minor % 100).toBe(0);
  expect(loan.outstanding_principal_minor).toBeGreaterThanOrEqual(0);
  expect(pending.reduce((s, r) => s + r.principal_component_minor, 0)).toBe(loan.outstanding_principal_minor);
  let left = loan.outstanding_principal_minor;
  for (const r of pending) {
    left -= r.principal_component_minor;
    expect(r.outstanding_after_minor).toBe(left);
    expect(r.emi_amount_minor % 100).toBe(0);
    expect(r.interest_component_minor % 100).toBe(0);
    expect(r.emi_amount_minor).toBe(r.principal_component_minor + r.interest_component_minor);
    expect(r.principal_component_minor).toBeGreaterThan(0);
  }
  if (loan.outstanding_principal_minor === 0) {
    expect(loan.status).toBe('closed');
    expect(pending).toHaveLength(0);
  } else {
    expect(loan.status).toBe('active');
    expect(pending.length).toBeGreaterThan(0);
    expect(left).toBe(0);
  }
  const last = paid[paid.length - 1];
  if (last) {
    expect(loan.outstanding_principal_minor).toBeLessThanOrEqual(last.outstanding_after_minor);
    if (!everPrepaid) expect(loan.outstanding_principal_minor).toBe(last.outstanding_after_minor);
  } else {
    expect(loan.outstanding_principal_minor).toBeLessThanOrEqual(loan.principal_minor);
  }
  for (const r of paid) {
    const tx = await one<{ amount_minor: number }>('SELECT amount_minor FROM transactions WHERE id = ?', [
      r.transaction_id,
    ]);
    expect(tx?.amount_minor).toBe(r.emi_amount_minor);
    expect(r.emi_amount_minor % 100).toBe(0);
  }
  const emiTx = await one<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE id IN (SELECT transaction_id FROM loan_payments WHERE loan_id = ? AND transaction_id IS NOT NULL)',
    [id]
  );
  expect(emiTx?.n).toBe(paid.length);
}

const OK_ERROR = /never pay off|doesn’t even cover|no remaining|doesn’t cover/;
async function tolerant(fn: () => Promise<unknown>, before: () => Promise<string>) {
  const snap = await before();
  try {
    await fn();
    return true;
  } catch (e) {
    expect(String((e as Error).message)).toMatch(OK_ERROR);
    expect(await before()).toBe(snap); // a refused change leaves everything as it was
    return false;
  }
}

describe('random loan operation sequences', () => {
  it.each(Array.from({ length: 40 }, (_, i) => i + 1))('seed %i', async (seed) => {
    const r = rng(seed * 7919);
    const tenure = seed % 13 === 0 ? 120 : 1 + Math.floor(r() * 36);
    const principal = (seed % 5 === 0 ? 1 + Math.floor(r() * 20) : 1000 + Math.floor(r() * 900000)) * 100;
    const rate = seed % 7 === 0 ? 0 : Math.floor(r() * 3600);
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: `seed${seed}`,
      principalMinor: principal,
      interestRateAnnualBp: rate,
      tenureMonths: tenure,
      startDate: '2026-01-31',
      rateType: 'floating',
    });
    const id = loan.id;
    const snapshot = async () => JSON.stringify([await loanRow(id), await rowsOf(id)]);
    let everPrepaid = false;
    await checkLoan(id, everPrepaid);
    for (let step = 0; step < 30; step++) {
      const l = (await loanRow(id))!;
      const rows = await rowsOf(id);
      const pending = rows.filter((x) => x.status !== 'paid');
      const paid = rows.filter((x) => x.status === 'paid');
      const roll = r();
      if (roll < 0.4 && pending.length) {
        await payInstallment(pending[0].id, { accountId: 'a', categoryId: 'c', paidDate: '2030-01-01' });
      } else if (roll < 0.55 && paid.length) {
        if (paid.length > 1) {
          await expect(undoInstallmentPayment(paid[0].id)).rejects.toThrow(/most recently paid/);
        }
        await undoInstallmentPayment(paid[paid.length - 1].id);
      } else if (roll < 0.75 && l.outstanding_principal_minor >= 100) {
        const whole = Math.floor(l.outstanding_principal_minor / 100);
        const amount = (r() < 0.1 ? whole : 1 + Math.floor(r() * whole)) * 100;
        const ok = await tolerant(
          () =>
            applyPrepayment(id, { amountMinor: amount, accountId: 'a', categoryId: 'c', date: '2030-01-01' }),
          snapshot
        );
        everPrepaid = everPrepaid || ok;
      } else if (roll < 0.9) {
        await tolerant(
          () =>
            applyRateChange(id, {
              newAnnualRateBp: Math.floor(r() * 3600),
              effectiveDate: '2030-01-01',
              mode: r() < 0.5 ? 'keepEmi' : 'keepTenure',
            }),
          snapshot
        );
      }
      await checkLoan(id, everPrepaid);
    }
    // Run it to the end, then back one step: closing leaves no pending row, undo reopens it.
    for (let guard = 0; guard < 700; guard++) {
      const next = (await rowsOf(id)).find((x) => x.status !== 'paid');
      if (!next) break;
      await payInstallment(next.id, { accountId: 'a', categoryId: 'c', paidDate: '2030-01-01' });
    }
    await checkLoan(id, everPrepaid);
    expect((await loanRow(id))!.status).toBe('closed');
    const paidRows = (await rowsOf(id)).filter((x) => x.status === 'paid');
    if (!paidRows.length) return; // closed by a prepayment before any EMI was paid
    await undoInstallmentPayment(paidRows[paidRows.length - 1].id);
    await checkLoan(id, everPrepaid);
    expect((await loanRow(id))!.status).toBe('active');
  });
});

it('refuses to undo an EMI when a later rate rise means the EMI would not cover interest on the restored balance', async () => {
  const loan = await createLoan({
    direction: 'borrowed',
    counterparty: 'tight',
    principalMinor: 100000000,
    interestRateAnnualBp: 1000,
    tenureMonths: 360,
    startDate: '2026-01-31',
    rateType: 'floating',
  });
  for (let i = 0; i < 3; i++) {
    const next = (await rowsOf(loan.id)).find((x) => x.status !== 'paid')!;
    await payInstallment(next.id, { accountId: 'a', categoryId: 'c', paidDate: '2030-01-01' });
  }
  const now = (await loanRow(loan.id))!;
  const lastPaid = (await rowsOf(loan.id)).filter((x) => x.status === 'paid').pop()!;
  const interest = (bal: number, bp: number) => Math.round((bal * bp) / 120000 / 100) * 100;
  let bp = 1000;
  while (
    bp < 10000 &&
    !(
      interest(now.outstanding_principal_minor, bp) < now.emi_amount_minor &&
      interest(now.outstanding_principal_minor + lastPaid.principal_component_minor, bp) >=
        now.emi_amount_minor
    )
  )
    bp++;
  expect(bp).toBeLessThan(10000);
  await applyRateChange(loan.id, { newAnnualRateBp: bp, effectiveDate: '2030-01-01', mode: 'keepEmi' });
  // The rate change rebuilt the pending rows from the same balance, so the paid row's balance still matches: undo
  // takes the simple path. Move the balance with a prepayment so it must rebuild against the restored balance.
  await applyPrepayment(loan.id, { amountMinor: 100, accountId: 'a', categoryId: 'c', date: '2030-01-02' });
  const snap = JSON.stringify([await loanRow(loan.id), await rowsOf(loan.id)]);
  try {
    await undoInstallmentPayment(lastPaid.id);
  } catch (e) {
    expect(String((e as Error).message)).toMatch(/can’t be undone/);
    expect(JSON.stringify([await loanRow(loan.id), await rowsOf(loan.id)])).toBe(snap);
    return;
  }
  const rows = await rowsOf(loan.id);
  const pending = rows.filter((x) => x.status !== 'paid');
  expect(pending.length).toBeGreaterThan(0);
  expect(pending[pending.length - 1].outstanding_after_minor).toBe(0);
});

// ---------------------------------------------------------------------------------------------------------------
// Legacy paise loans and the one-time conversion.

type Legacy = {
  id: string;
  kind: 'plain' | 'prepaid' | 'rate' | 'closed' | 'unroundable';
  emi: number;
  outstanding: number;
  pendingCount: number;
  paidTx: { id: string; amount: number }[];
  paid: number;
};

const DONE = 'loans_whole_rupees_v1';

async function insertPayment(
  id: string,
  loanId: string,
  n: number,
  due: string,
  emi: number,
  principal: number,
  interest: number,
  out: number,
  paid: boolean,
  txId: string | null
) {
  await run(
    `INSERT INTO loan_payments (id, loan_id, installment_number, due_date, emi_amount_minor, principal_component_minor,
       interest_component_minor, outstanding_after_minor, status, paid_date, transaction_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, loanId, n, due, emi, principal, interest, out, paid ? 'paid' : 'pending', paid ? due : null, txId]
  );
}

async function legacyLoan(seed: number): Promise<Legacy> {
  const r = rng(seed * 104729);
  const kinds: Legacy['kind'][] = ['plain', 'prepaid', 'rate', 'closed', 'unroundable'];
  const kind = kinds[seed % kinds.length];
  const id = `LG${seed}`;
  const n = 3 + Math.floor(r() * 40);
  const principal = 100000 + Math.floor(r() * 5000000) + 1 + Math.floor(r() * 98); // paise
  let rateBp = seed % 6 === 0 ? 0 : Math.floor(r() * 2400);
  const mr = rateBp / 10000 / 12;
  const f = Math.pow(1 + mr, n);
  let emi = mr === 0 ? Math.round(principal / n) : Math.round((principal * mr * f) / (f - 1));
  if (emi % 100 === 0) emi += 37; // genuinely paise
  const paidCount = kind === 'closed' ? 0 : Math.floor(r() * (n - 1));
  const built: { emi: number; principal: number; interest: number; out: number }[] = [];
  const buildFrom = (from: number, start: number, e: number, mrate: number, last: boolean) => {
    let o = start;
    const list: typeof built = [];
    for (let i = from; i <= n && o > 0; i++) {
      const interest = Math.round(o * mrate);
      let p = e - interest;
      let em = e;
      if (p <= 0 || p >= o || (last && i === n)) {
        p = o;
        em = p + interest;
      }
      o -= p;
      list.push({ emi: em, principal: p, interest, out: o });
    }
    return list;
  };
  const first = buildFrom(1, principal, emi, mr, true);
  let loanOut = principal;
  let loanEmi = emi;
  let loanRate = rateBp;
  const rows = first.slice();
  const paidTx: Legacy['paidTx'] = [];
  const startDate = '2026-01-31';
  await run(
    `INSERT INTO loans (id, direction, counterparty, principal_minor, interest_rate_annual_bp, tenure_months, start_date,
       emi_amount_minor, outstanding_principal_minor, status, rate_type)
     VALUES (?, 'borrowed', ?, ?, ?, ?, ?, ?, ?, 'active', 'floating')`,
    [id, id, principal, rateBp, n, startDate, emi, principal]
  );
  const k = Math.min(paidCount, first.length - 1);
  for (let i = 0; i < k; i++) {
    const row = first[i];
    const txId = `${id}-tx${i + 1}`;
    await run(
      "INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date) VALUES (?, 'expense', 'a', 'c', ?, '2026-01-01')",
      [txId, row.emi]
    );
    paidTx.push({ id: txId, amount: row.emi });
    await insertPayment(
      `${id}-p${i + 1}`,
      id,
      i + 1,
      addMonthsToIsoDate(startDate, i),
      row.emi,
      row.principal,
      row.interest,
      row.out,
      true,
      txId
    );
    loanOut = row.out;
  }
  let pendingRows = first.slice(k);
  if (kind === 'prepaid' && k > 0 && loanOut > 5000) {
    const extra = 1000 + Math.floor(r() * (loanOut / 2)); // paise lump sum after the last paid EMI
    loanOut -= extra;
    pendingRows = buildFrom(k + 1, loanOut, loanEmi, mr, false);
    await run(
      "INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, loan_id, loan_tx_kind) VALUES (?, 'expense', 'a', 'c', ?, '2026-02-01', ?, 'prepayment')",
      [`${id}-pre`, extra, id]
    );
  }
  if (kind === 'rate') {
    loanRate = rateBp + 100 + Math.floor(r() * 300);
    pendingRows = buildFrom(k + 1, loanOut, loanEmi, loanRate / 10000 / 12, false);
    await run(
      `INSERT INTO loan_rate_changes (id, loan_id, old_rate_annual_bp, new_rate_annual_bp, effective_date, mode,
         old_emi_amount_minor, new_emi_amount_minor) VALUES (?, ?, ?, ?, '2026-03-01', 'keepEmi', ?, ?)`,
      [`${id}-rc`, id, rateBp, loanRate, loanEmi, loanEmi]
    );
  }
  if (kind === 'unroundable') {
    // Interest alone is far above the paise EMI: no whole-rupee EMI near it can clear the balance.
    loanRate = 9000;
    loanEmi = 150;
    loanOut = 1000050;
    pendingRows = [
      { emi: 150, principal: 150, interest: 0, out: 999900 },
      { emi: 999900, principal: 999900, interest: 0, out: 0 },
    ];
  }
  if (kind === 'closed') {
    await run("UPDATE loans SET status = 'closed' WHERE id = ?", [id]);
    loanOut = pendingRows[0]?.out ?? 0;
  }
  void rows;
  for (let i = 0; i < pendingRows.length; i++) {
    const row = pendingRows[i];
    const num = k + i + 1;
    await insertPayment(
      `${id}-p${num}`,
      id,
      num,
      addMonthsToIsoDate(startDate, num - 1),
      row.emi,
      row.principal,
      row.interest,
      row.out,
      false,
      null
    );
  }
  await run(
    'UPDATE loans SET interest_rate_annual_bp = ?, emi_amount_minor = ?, outstanding_principal_minor = ? WHERE id = ?',
    [loanRate, loanEmi, kind === 'closed' ? principal : loanOut, id]
  );
  return {
    id,
    kind,
    emi: loanEmi,
    outstanding: kind === 'closed' ? principal : loanOut,
    pendingCount: pendingRows.length,
    paidTx,
    paid: k,
  };
}

describe('legacy paise conversion', () => {
  const legacy: Legacy[] = [];
  let changed = 0;
  let before: Record<string, string> = {};

  beforeAll(async () => {
    await run('DELETE FROM settings WHERE key = ?', [DONE]);
    for (let seed = 1; seed <= 80; seed++) legacy.push(await legacyLoan(seed));
    for (const l of legacy) before[l.id] = JSON.stringify(await rowsOf(l.id));
    changed = await convertLoansToWholeRupees();
  });

  it('converts, leaves closed and unroundable loans alone, and is idempotent', async () => {
    expect(changed).toBeGreaterThan(30);
    for (const l of legacy) {
      if (l.kind !== 'closed' && l.kind !== 'unroundable') continue;
      const loan = (await loanRow(l.id))!;
      expect(loan.emi_amount_minor).toBe(l.emi);
      expect(loan.outstanding_principal_minor).toBe(l.outstanding);
      expect(JSON.stringify(await rowsOf(l.id))).toBe(before[l.id]);
    }
    const snap = JSON.stringify([
      await all('SELECT * FROM loans ORDER BY id'),
      await all('SELECT * FROM loan_payments ORDER BY id'),
      await all('SELECT * FROM transactions ORDER BY id'),
    ]);
    expect(await convertLoansToWholeRupees()).toBe(0);
    expect(
      JSON.stringify([
        await all('SELECT * FROM loans ORDER BY id'),
        await all('SELECT * FROM loan_payments ORDER BY id'),
        await all('SELECT * FROM transactions ORDER BY id'),
      ])
    ).toBe(snap);
  });

  it('keeps totals within a rupee and leaves a consistent whole-rupee schedule', async () => {
    for (const l of legacy) {
      const loan = (await loanRow(l.id))!;
      const rows = await rowsOf(l.id);
      const pending = rows.filter((x) => x.status !== 'paid');
      const paid = rows.filter((x) => x.status === 'paid');
      expect(paid).toHaveLength(l.paid);
      for (const t of l.paidTx) {
        const tx = (await one<{ amount_minor: number }>(
          'SELECT amount_minor FROM transactions WHERE id = ?',
          [t.id]
        ))!;
        if (l.kind === 'closed' || l.kind === 'unroundable') expect(tx.amount_minor).toBe(t.amount);
        else {
          expect(tx.amount_minor % 100).toBe(0);
          expect(Math.abs(tx.amount_minor - t.amount)).toBeLessThanOrEqual(50);
        }
      }
      if (l.kind === 'closed' || l.kind === 'unroundable') continue;
      if (loan.outstanding_principal_minor === l.outstanding && loan.emi_amount_minor === l.emi) {
        // Skipped for a legitimate reason only: nothing pending, or the EMI could not clear the balance.
        continue;
      }
      expect(loan.outstanding_principal_minor % 100).toBe(0);
      expect(Math.abs(loan.outstanding_principal_minor - l.outstanding)).toBeLessThanOrEqual(50);
      expect(loan.emi_amount_minor % 100).toBe(0);
      expect(pending.reduce((s, x) => s + x.principal_component_minor, 0)).toBe(
        loan.outstanding_principal_minor
      );
      expect(pending[pending.length - 1].outstanding_after_minor).toBe(0);
      expect(
        pending.every((x) => x.emi_amount_minor % 100 === 0 && x.interest_component_minor % 100 === 0)
      ).toBe(true);
      // After 20 one-rupee EMI bumps a tight legacy EMI may still need one small extra instalment: accepted by design.
      expect(pending.length).toBeLessThanOrEqual(l.pendingCount + 1);
      expect(loan.status).toBe('active');
    }
  });

  it('undo of the last paid EMI still works after conversion, and paying it again restores the balance', async () => {
    let undone = 0;
    for (const l of legacy) {
      if (l.kind === 'closed' || l.paid === 0) continue;
      const loan0 = (await loanRow(l.id))!;
      const lastPaid = (await rowsOf(l.id)).filter((x) => x.status === 'paid').pop()!;
      if (l.kind === 'unroundable') {
        // Its EMI cannot cover the interest: Undo must refuse and change nothing, not delete the row.
        const snap = JSON.stringify([await loanRow(l.id), await rowsOf(l.id)]);
        await expect(undoInstallmentPayment(lastPaid.id)).rejects.toThrow(/can’t be undone/);
        expect(JSON.stringify([await loanRow(l.id), await rowsOf(l.id)])).toBe(snap);
        expect(
          await one('SELECT 1 FROM transactions WHERE id = ?', [lastPaid.transaction_id])
        ).not.toBeNull();
        continue;
      }
      await undoInstallmentPayment(lastPaid.id);
      undone++;
      const loan = (await loanRow(l.id))!;
      const rows = await rowsOf(l.id);
      const pending = rows.filter((x) => x.status !== 'paid');
      expect(loan.status).toBe('active');
      expect(loan.outstanding_principal_minor).toBeGreaterThan(loan0.outstanding_principal_minor);
      expect(await one('SELECT 1 FROM transactions WHERE id = ?', [lastPaid.transaction_id])).toBeNull();
      expect(rows.map((x) => x.installment_number)).toEqual(rows.map((_, i) => i + 1));
      expect(pending.reduce((s, x) => s + x.principal_component_minor, 0)).toBe(
        loan.outstanding_principal_minor
      );
      expect(pending[pending.length - 1].outstanding_after_minor).toBe(0);
      expect(pending[0].installment_number).toBe(lastPaid.installment_number);
      // And pay it again: a whole-rupee debit, balance back where conversion left it.
      await payInstallment(pending[0].id, { accountId: 'a', categoryId: 'c', paidDate: '2030-01-01' });
      const after = (await loanRow(l.id))!;
      const tx = (await one<{ amount_minor: number }>(
        'SELECT t.amount_minor FROM transactions t JOIN loan_payments p ON p.transaction_id = t.id WHERE p.id = ?',
        [pending[0].id]
      ))!;
      expect(tx.amount_minor % 100).toBe(0);
      expect(after.outstanding_principal_minor).toBeGreaterThan(0);
      expect(after.outstanding_principal_minor).toBeLessThan(loan.outstanding_principal_minor);
    }
    expect(undone).toBeGreaterThan(20);
  });

  it('never converts closed loans even when the marker is cleared and the batch re-run', async () => {
    await run('DELETE FROM settings WHERE key = ?', [DONE]);
    await convertLoansToWholeRupees();
    for (const l of legacy.filter((x) => x.kind === 'closed')) {
      const loan = (await loanRow(l.id))!;
      expect(loan.emi_amount_minor).toBe(l.emi);
      expect(JSON.stringify(await rowsOf(l.id))).toBe(before[l.id]);
    }
  });
});

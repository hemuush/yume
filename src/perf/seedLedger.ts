/**
 * A heavy, realistic test ledger (default 20,000 entries over 3 years, loans, budgets, goals, rules, people,
 * valuations), the same on every run: for the load benchmark and the output-parity check. Not shipped code.
 */
import type { AsyncDb } from '@/test-support/realDataTestDb';
import { CREATE_TABLES_SQL } from '@/db/schema';
import { runMigrations } from '@/db/client';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { setDefaultCurrency } from '@/db/settings';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';

/** A deterministic pseudo-random sequence, so every run seeds the same ledger. */
function rng(seed: number) {
  // mulberry32: well-spread values (a plain LCG's correlated low bits made thousands of fake "repeats").
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedLedger(mockRaw: AsyncDb, entries = 20000) {
  await mockRaw.execAsync(CREATE_TABLES_SQL);
  // The real start-up path, so the indexes migrations add are there too.
  await mockRaw.withTransactionAsync((tx) => runMigrations(tx as never));
  await setDefaultCurrency('INR');
  const rand = rng(42);
  await mockRaw.withTransactionAsync(async (db) => {
    const accounts = ['bank1', 'bank2', 'cash', 'wallet', 'card', 'sav1', 'sav2'];
    const types = ['bank', 'bank', 'cash', 'wallet', 'credit_card', 'savings', 'savings'];
    for (let i = 0; i < accounts.length; i++) {
      await db.runAsync(
        `INSERT INTO accounts (id, name, type, currency, opening_balance_minor, statement_day, due_day, tracked)
         VALUES (?, ?, ?, 'INR', ?, ?, ?, ?)`,
        [
          accounts[i],
          accounts[i],
          types[i],
          5000000,
          types[i] === 'credit_card' ? 12 : null,
          types[i] === 'credit_card' ? 2 : null,
          i === 6 ? 1 : 0,
        ]
      );
    }
    const expenseCats: string[] = [];
    const incomeCats: string[] = [];
    for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
      const id = `c${i}`;
      await db.runAsync(
        `INSERT INTO categories (id, name, kind, icon, color, sort_order, is_sensitive, is_system)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, c.name, c.kind, c.icon, c.color, c.sortOrder, c.sensitive ? 1 : 0, c.system ? 1 : 0]
      );
      (c.kind === 'expense' ? expenseCats : incomeCats).push(id);
      // A few subcategories under each expense parent.
      if (c.kind === 'expense' && i % 3 === 0) {
        for (let k = 0; k < 3; k++) {
          const sub = `${id}s${k}`;
          await db.runAsync(
            `INSERT INTO categories (id, name, kind, parent_id, icon, color) VALUES (?, ?, 'expense', ?, 'tag', '#8FCBFF')`,
            [sub, `${c.name} ${k}`, id]
          );
          expenseCats.push(sub);
        }
      }
    }
    const spendable = ['bank1', 'bank2', 'cash', 'wallet', 'card'];
    const today = toLocalIsoDate(new Date());
    const days = 3 * 365;
    for (let n = 0; n < entries; n++) {
      const date = addDaysToIsoDate(today, -Math.floor(rand() * days));
      const r = rand();
      const acct = spendable[Math.floor(rand() * spendable.length)];
      if (r < 0.82) {
        await db.runAsync(
          `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note)
           VALUES (?, 'expense', ?, ?, ?, ?, ?)`,
          [
            `t${n}`,
            acct,
            expenseCats[Math.floor(rand() * expenseCats.length)],
            100 * (1 + Math.floor(rand() * 4000)),
            date,
            rand() < 0.3 ? 'lunch with team' : '',
          ]
        );
      } else if (r < 0.9) {
        await db.runAsync(
          `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date) VALUES (?, 'income', ?, ?, ?, ?)`,
          [
            `t${n}`,
            acct,
            incomeCats[Math.floor(rand() * incomeCats.length)],
            100 * (1000 + Math.floor(rand() * 90000)),
            date,
          ]
        );
      } else if (r < 0.92) {
        await db.runAsync(
          `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, is_refund) VALUES (?, 'income', ?, ?, ?, ?, 1)`,
          [
            `t${n}`,
            acct,
            expenseCats[Math.floor(rand() * expenseCats.length)],
            100 * (1 + Math.floor(rand() * 500)),
            date,
          ]
        );
      } else {
        await db.runAsync(
          `INSERT INTO transactions (id, type, account_id, to_account_id, amount_minor, date) VALUES (?, 'transfer', ?, ?, ?, ?)`,
          [`t${n}`, acct, rand() < 0.5 ? 'sav1' : 'sav2', 100 * (100 + Math.floor(rand() * 20000)), date]
        );
      }
    }
    // Loans with long schedules, half paid.
    for (let l = 0; l < 3; l++) {
      await db.runAsync(
        `INSERT INTO loans (id, direction, counterparty, principal_minor, interest_rate_annual_bp, tenure_months,
           start_date, emi_amount_minor, outstanding_principal_minor) VALUES (?, 'borrowed', ?, 500000000, 850, 240, '2020-01-05', 4339000, 300000000)`,
        [`l${l}`, `Bank ${l}`]
      );
      for (let i = 1; i <= 240; i++) {
        await db.runAsync(
          `INSERT INTO loan_payments (id, loan_id, installment_number, due_date, emi_amount_minor, principal_component_minor,
             interest_component_minor, outstanding_after_minor, status) VALUES (?, ?, ?, ?, 4339000, 800000, 3539000, ?, ?)`,
          [
            `l${l}p${i}`,
            `l${l}`,
            i,
            addDaysToIsoDate('2020-01-05', i * 30),
            500000000 - i * 800000,
            i <= 80 ? 'paid' : 'pending',
          ]
        );
      }
    }
    const month = today.slice(0, 7);
    for (let b = 0; b < 15; b++) {
      await db.runAsync(
        `INSERT INTO budgets (id, category_id, period_month, limit_amount_minor, rollover) VALUES (?, ?, ?, 2000000, ?)`,
        [`b${b}`, expenseCats[b], month, b % 2]
      );
      const prev = addDaysToIsoDate(`${month}-01`, -1).slice(0, 7);
      await db.runAsync(
        `INSERT INTO budgets (id, category_id, period_month, limit_amount_minor, rollover) VALUES (?, ?, ?, 2000000, 0)`,
        [`bp${b}`, expenseCats[b], prev]
      );
    }
    for (let g = 0; g < 5; g++) {
      await db.runAsync(
        `INSERT INTO savings_goals (id, name, target_amount_minor, current_amount_minor, linked_account_id, track_account)
         VALUES (?, ?, 10000000, 200000, ?, ?)`,
        [`g${g}`, `Goal ${g}`, g < 2 ? 'sav1' : null, g < 2 ? 1 : 0]
      );
    }
    for (let k = 0; k < 10; k++) {
      await db.runAsync(
        `INSERT INTO recurring_rules (id, type, account_id, category_id, amount_minor, frequency, next_run_date)
         VALUES (?, 'expense', 'bank1', ?, 50000, ?, ?)`,
        [`r${k}`, expenseCats[k], k % 3 === 0 ? 'weekly' : 'monthly', addDaysToIsoDate(today, k + 1)]
      );
    }
    for (let p = 0; p < 8; p++) {
      await db.runAsync(`INSERT INTO people (id, name) VALUES (?, ?)`, [`p${p}`, `Friend ${p}`]);
      for (let e = 0; e < 20; e++) {
        await db.runAsync(
          `INSERT INTO person_ledger_entries (id, person_id, amount_minor, date) VALUES (?, ?, ?, ?)`,
          [`p${p}e${e}`, `p${p}`, (e % 2 ? -1 : 1) * 50000, addDaysToIsoDate(today, -e * 10)]
        );
      }
    }
    for (let v = 0; v < 24; v++) {
      await db.runAsync(
        `INSERT INTO account_valuations (id, account_id, date, value_minor) VALUES (?, 'sav2', ?, ?)`,
        [`v${v}`, addDaysToIsoDate(today, -v * 30), 9000000 + v * 10000]
      );
    }
  });
}

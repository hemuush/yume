/**
 * Wording pools behind `suuLine()`: one short line per situation (kept as arrays so a variant can be added back). `{pct}`
 * tokens are filled by `fillSuuTemplate` so a wording tweak needn't redo number placement in each variant.
 */

export function fillSuuTemplate(template: string, pct: string): string {
  return template.replace('{pct}', pct);
}

/** No comparison period yet — a fresh install, or the very first days of use. */
export const NO_DATA_LINES: readonly string[] = ["Log a few days and I'll spot trends."];

/** This period ran a deficit (spent more than came in). */
export const OVERSPENT_LINES: readonly string[] = ['Spending passed income this month.'];

/** Spend rose vs last period — the priority message when it applies, even over a healthy savings rate. */
export const SPEND_UP_TEMPLATES: readonly string[] = ['Spending up {pct}'];

/** Savings rate is healthy (≥20%) and spending did not also rise. */
export const GOOD_SAVINGS_TEMPLATES: readonly string[] = ['{pct} of income unspent.'];

/** Income covers spending with less than 20% unspent, including a zero margin. */
export const THIN_SAVINGS_LINES: readonly string[] = ['Spending is within income.'];

/**
 * Stand-ins for the two savings-rate pools while savings amounts are hidden: "{pct} kept" plus the free
 * figure would reveal what went to savings, so these never mention saving.
 */
export const PRIVATE_HEALTHY_LINES: readonly string[] = ['Spending is below income.'];

export const PRIVATE_THIN_LINES: readonly string[] = ['Spending is within income.'];

/**
 * The wording pools behind `suuLine()` — roughly 20 variants per situation
 * so Suu doesn't say the exact same sentence every single time the Home
 * hero re-renders (every focus of the tab). One is picked at random on each
 * call via `pickRandom` — genuinely "each time", since this runs fresh on
 * every Home focus, not on a schedule like the push notifications in
 * `notificationCopy.ts` (see that file's own note on why those rotate on a
 * looser cadence).
 *
 * Templates that need a live number use a `{pct}` token, filled by
 * `fillSuuTemplate` — kept as a plain token substitution rather than baking
 * the figure into all ~20 variants of a given situation, so a wording tweak
 * later doesn't mean re-writing the number-placement logic 20 times over.
 */

export function fillSuuTemplate(template: string, pct: string): string {
  return template.replace('{pct}', pct);
}

/** No comparison period yet — a fresh install, or the very first days of use. */
export const NO_DATA_LINES: readonly string[] = [
  "Log a few days of spending and I'll start spotting trends.",
  "Add a few transactions and I'll have something useful to say.",
  "Once there's a week or two logged, I'll start noticing patterns.",
  'Not enough history yet — log a few days and check back.',
  'I need a little more to go on before I say anything useful.',
  "Give me a few days of entries and I'll start reading the tea leaves.",
  'Still getting to know your spending — a few more days will help.',
  'Log today, then tomorrow — patterns need a bit of data first.',
  "A few more entries and I'll be able to tell you something real.",
  "Nothing to compare against yet — keep logging and I'll catch up.",
  "I'm quiet for now — there's not quite enough history to read.",
  "Once a week of spending is in, I'll have real trends to share.",
  'Keep at it — a proper picture needs a few more days of data.',
  "Too early to say anything meaningful yet — I'm watching closely though.",
  "I'm still learning your habits — a few more days will tell me more.",
  "No comparison yet, but I'm paying attention from day one.",
  "A little more data and I'll start pointing things out.",
  "Just getting started — log a few days and I'll chime in.",
  'Not much to work with yet — a few more entries will change that.',
  "I'll have something to say once there's a few days behind us.",
];

/** This period ran a deficit (spent more than came in). */
export const OVERSPENT_LINES: readonly string[] = [
  'Spending edged past what came in — worth a peek.',
  'This month ran a little short. Might be worth checking where.',
  'More went out than came in this time — nothing panic-worthy, just a look.',
  'The month tipped slightly negative. Take a look when you can.',
  'Outgoings nudged past income this time — worth a glance, not a worry.',
  'A dip into the red this month. Worth understanding why, though.',
  "This one ran a touch short — let's see what moved.",
  'Spending crossed income by a little. Worth a glance when you get a chance.',
  'This month came in under. A quick look might explain it.',
  'A small shortfall this time. Nothing dramatic, just worth noting.',
  "Income didn't quite keep pace this month — worth a look.",
  'This month leaned negative. A peek at where might help.',
  'A little overspent this time. Happens — worth a look though.',
  'The scale tipped the wrong way this month. Take a glance when free.',
  "This month's outgoings won by a little. Worth checking what pushed it.",
  'A gentle dip below zero this time. Worth a look, not a worry.',
  'Spending pulled slightly ahead of income. Worth understanding why.',
  "This month's numbers lean a bit thin. A look might help spot why.",
  'A short month, money-wise. Worth a peek before the next one starts.',
  'Came in a little light this month. Take a look when it suits you.',
];

/** Spend rose vs last period — the priority message when it applies, even over a healthy savings rate. */
export const SPEND_UP_TEMPLATES: readonly string[] = [
  "Spending's up {pct} on last month",
  'You spent {pct} more than last month',
  "This month's outgoings climbed {pct} over last month's",
  'Spending grew {pct} compared to last month',
  'You went {pct} over last month on spending',
  "Outgoings are {pct} higher than last month's",
  'This month ran {pct} hotter than last month',
  'Spending picked up {pct} versus last month',
  "You're {pct} above last month's spending pace",
  'This month outspent last month by {pct}',
  "Expenses climbed {pct} from last month's total",
  'Spending stepped up {pct} on the month before',
  'This month came in {pct} heavier than last month',
  "You've spent {pct} more than the same time last month",
  'Outgoings rose {pct} against last month',
  'Spending is running {pct} ahead of last month',
  'This month is {pct} pricier than last month so far',
  'A {pct} jump in spending versus last month',
  "Last month's pace was beaten by {pct} this time",
  'This month outpaced last month by {pct} in spending',
];

/** Savings rate is healthy (≥20%) and spending did not also rise. */
export const GOOD_SAVINGS_TEMPLATES: readonly string[] = [
  'You kept {pct} of your income this month — lovely pace.',
  '{pct} of what came in stayed put this month. Lovely pace.',
  'A {pct} savings rate this month — that adds up fast.',
  'You held onto {pct} of your income this month. Nicely done.',
  "{pct} kept this month — that's a rate worth keeping up.",
  'This month you saved {pct} of your income. Solid work.',
  'A tidy {pct} kept aside this month — steady progress.',
  "You're keeping {pct} of what comes in this month. Great habit.",
  '{pct} saved this month — every bit like that compounds.',
  'This month held a {pct} savings rate. That pace pays off.',
  'You tucked away {pct} of your income this month. Well kept.',
  "{pct} of this month's income is still yours — good pace.",
  'A strong month: {pct} saved and spending steady.',
  'You kept {pct} back this month — a rate worth being proud of.',
  'This month landed a {pct} savings rate. Keep that up.',
  '{pct} saved this month, quietly. That is how it adds up.',
  'You held a {pct} savings pace this month — lovely rhythm.',
  'This month you set aside {pct} of your income. Nicely paced.',
  '{pct} kept this month — a genuinely healthy rate.',
  'A calm {pct} savings rate this month. Good, steady work.',
];

/** A thin but positive month — some savings, spending flat or down. */
export const THIN_SAVINGS_LINES: readonly string[] = [
  'A little put aside this month. Every bit counts.',
  'Not much saved this month, but something is. That still counts.',
  'A modest amount kept back this month — small steps add up.',
  'This month saved a little. Small, but real progress.',
  "It's a thin margin this month, but a positive one.",
  'A quiet, small saving this month — still moving the right way.',
  'This month kept a little aside. Slow and steady still works.',
  'Not a big month for saving, but a real one.',
  'A small cushion built this month. It adds up over time.',
  'This month is light on savings, but still in the black.',
  'A little extra tucked away this month. Worth noticing.',
  'This month saved modestly — still a step in the right direction.',
  'A thin but positive month. That still beats the alternative.',
  'Small savings this month, but savings all the same.',
  'This month kept just a bit back — every bit matters.',
  'Not much room this month, but something got saved.',
  'A gentle, small saving this month. Steady wins this race.',
  'This month put a little by. Small wins still count.',
  'A modest month for saving — still worth a nod.',
  'A little was saved this month, and that is never nothing.',
];

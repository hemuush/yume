/**
 * Cap on a list row's FadeIn entrance stagger delay (`Math.min(i * step, MAX_LIST_STAGGER_MS)`)
 * — shared by every plain list of cards/rows in the app (Home's sections, Transactions'
 * day groups, People, Recurring rules, Reports' heatmap) so a long list still finishes
 * settling in well under a second, and so retuning the app-wide stagger feel is a one-line
 * change instead of hunting down a copy of this constant in each screen.
 */
export const MAX_LIST_STAGGER_MS = 320;

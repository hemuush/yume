import { toMinor } from '@/lib/money';
import type { SplitPart } from '@/db/splits';
import { MAX_SPLIT_PARTS, MIN_SPLIT_PARTS } from '@/lib/splitLimits';
import { evaluateAmount, exprFromMinor } from '@/lib/padMath';

/**
 * The split page's working copy. The first part is "the rest": never typed, it's what the payment leaves
 * after the other parts, so a split always adds up. Pure, so pre-save checks are tested without a screen.
 */
export interface DraftPart {
  /** Stable while the page is open, so typing in one part never jumps to another. */
  key: string;
  categoryId: string | null;
  /** What was typed on the pad ("500", "120+45"). Unused for the first part, which holds the rest. */
  amountText: string;
}

let nextKey = 0;
export const newPartKey = () => `part-${++nextKey}`;

/** A typed amount (a number or a sum) in minor units; 0 for empty or unreadable text. */
export function partMinor(text: string): number {
  const n = evaluateAmount(text);
  return n !== null && Number.isFinite(n) && n > 0 ? toMinor(n) : 0;
}

/** What the first part holds: the payment less every other part (negative when they add up to more). */
export function restMinor(totalMinor: number, parts: DraftPart[]): number {
  return totalMinor - parts.slice(1).reduce((sum, p) => sum + partMinor(p.amountText), 0);
}

/** Each part's amount in minor units, the first part's being the rest. */
export function partAmounts(totalMinor: number, parts: DraftPart[]): number[] {
  return parts.map((p, i) => (i === 0 ? restMinor(totalMinor, parts) : partMinor(p.amountText)));
}

/** A new split: the category already picked on Add, holding the whole payment. */
export function seedParts(categoryId: string | null): DraftPart[] {
  return [{ key: newPartKey(), categoryId, amountText: '' }];
}

/** A saved split's parts, biggest first, as a draft: the biggest becomes the rest. */
export function draftFromSaved(
  // A part whose category was since deleted has none; it stays in the draft, flagged for the person to pick.
  parts: { categoryId: string | null; amountMinor: number }[]
): DraftPart[] {
  return parts.map((p, i) => ({
    key: newPartKey(),
    categoryId: p.categoryId,
    amountText: i === 0 ? '' : exprFromMinor(p.amountMinor),
  }));
}

/** Why a split can't be saved yet, as something the page can put into words; null when it can. */
export type SplitProblem =
  | { kind: 'noAmount' }
  | { kind: 'needSecond' }
  | { kind: 'noCategory'; key: string }
  | { kind: 'noPartAmount'; key: string }
  /** The other parts leave nothing for the first one; `overMinor` is how much they'd need to come down by (0: exactly nothing left). */
  | { kind: 'over'; overMinor: number };

export function splitProblem(totalMinor: number, parts: DraftPart[]): SplitProblem | null {
  if (totalMinor <= 0) return { kind: 'noAmount' };
  if (parts.length < MIN_SPLIT_PARTS) return { kind: 'needSecond' };
  const noCategory = parts.find((p) => !p.categoryId);
  if (noCategory) return { kind: 'noCategory', key: noCategory.key };
  const noAmount = parts.slice(1).find((p) => partMinor(p.amountText) <= 0);
  if (noAmount) return { kind: 'noPartAmount', key: noAmount.key };
  const rest = restMinor(totalMinor, parts);
  if (rest <= 0) return { kind: 'over', overMinor: -rest };
  return null;
}

/** The parts as saveSplit takes them. Only call once splitProblem is null. */
export function toSplitParts(totalMinor: number, parts: DraftPart[]): SplitPart[] {
  const amounts = partAmounts(totalMinor, parts);
  return parts.map((p, i) => ({ categoryId: p.categoryId!, amountMinor: amounts[i] }));
}

export const canAddPart = (parts: DraftPart[]) => parts.length < MAX_SPLIT_PARTS;
/** Every part but the first (the rest) can be taken out. */
export const canRemovePart = (parts: DraftPart[], key: string) => parts.findIndex((p) => p.key === key) > 0;

/**
 * A problem worded for a button or line of text: what to do next, never just that something's wrong.
 * `nameOf` names a part by key (its category, or "this part" before it has one).
 */
export function splitProblemText(
  problem: SplitProblem,
  parts: DraftPart[],
  nameOf: (key: string) => string,
  money: (minor: number) => string
): string {
  switch (problem.kind) {
    case 'noAmount':
      return 'Enter the amount first';
    case 'needSecond':
      return 'Add a 2nd category';
    case 'noCategory':
      return 'Pick a category for every part';
    case 'noPartAmount':
      return `Enter the amount for ${nameOf(problem.key)}`;
    case 'over':
      return problem.overMinor > 0
        ? `${money(problem.overMinor)} over the payment`
        : `Leave some for ${nameOf(parts[0].key)}`;
  }
}

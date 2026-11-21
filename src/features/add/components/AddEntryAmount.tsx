import { Keyboard } from 'react-native';
import { exprFromMinor } from '@/lib/padMath';
import { AmountCard } from '@/features/add/AddSections';
import type { AddEntryModel } from '@/features/add/types/addEntryModel';
import type { ReactElement } from 'react';

/** What this section of the Add page reads from the model; it is drawn again only when one of them changes. */
export const AMOUNT_KEYS = [
  'type',
  'refund',
  'currency',
  'expr',
  'sum',
  'shownAmount',
  'padVisible',
  'isLinked',
  'setSearchFocused',
  'setNoteEditing',
  'setPadOpen',
  'setError',
  'invalidAmount',
  'roundingNote',
  'frequentAmounts',
  'usual',
  'amountMinor',
  'setExpr',
] as const satisfies readonly (keyof AddEntryModel)[];

type Props = { model: Pick<AddEntryModel, (typeof AMOUNT_KEYS)[number]> };
export function AddEntryAmount({ model }: Props): ReactElement {
  const {
    type,
    refund,
    currency,
    expr,
    sum,
    shownAmount,
    padVisible,
    isLinked,
    setSearchFocused,
    setNoteEditing,
    setPadOpen,
    setError,
    invalidAmount,
    roundingNote,
    frequentAmounts,
    usual,
    amountMinor,
    setExpr,
  } = model;

  return (
    <AmountCard
      type={type}
      refund={refund}
      amount={{
        currency,
        expr,
        isSum: sum,
        shownAmount,
        // A sum that does not come out positive is a calculation to check; an amount that rounds to nothing says so.
        issue: invalidAmount
          ? (roundingNote ?? 'Enter a positive amount. Check the calculation.')
          : roundingNote,
        minor: amountMinor,
      }}
      pad={{
        visible: padVisible,
        linked: isLinked,
        onOpen: () => {
          Keyboard.dismiss();
          setSearchFocused(false);
          setNoteEditing(false);
          setPadOpen(true);
        },
        onToggle: () => {
          Keyboard.dismiss();
          setSearchFocused(false);
          setNoteEditing(false);
          setPadOpen(!padVisible);
          setError(null);
        },
      }}
      // "Your usual" below already offers amounts (with the category and account), so the plain amounts show only without it.
      suggestions={{
        amounts: usual.length > 0 && !isLinked ? [] : frequentAmounts,
        onPick: (minor) => setExpr(exprFromMinor(minor)),
      }}
    />
  );
}

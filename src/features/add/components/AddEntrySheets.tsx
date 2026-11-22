import { router } from 'expo-router';
import { AddSheets } from '@/features/add/AddSheets';
import type { AddEntryModel } from '@/features/add/types/addEntryModel';
import type { ReactElement } from 'react';

/** What this section of the Add page reads from the model; it is drawn again only when one of them changes. */
export const SHEETS_KEYS = [
  'accountSheetOpen',
  'type',
  'pickableAccounts',
  'effectiveAccountId',
  'setAccountSheetOpen',
  'pickAccount',
  'addAccountVisible',
  'setAddAccountVisible',
  'setError',
  'load',
  'addPersonVisible',
  'setAddPersonVisible',
  'onPersonAdded',
  'addCategoryVisible',
  'setAddCategoryVisible',
  'categories',
  'setCategoryId',
  'calendarOpen',
  'date',
  'setCalendarOpen',
  'setDate',
  'repeatSheetVisible',
  'setRepeatSheetVisible',
  'leave',
] as const satisfies readonly (keyof AddEntryModel)[];

type Props = { model: Pick<AddEntryModel, (typeof SHEETS_KEYS)[number]> };
export function AddEntrySheets({ model }: Props): ReactElement {
  const {
    accountSheetOpen,
    type,
    pickableAccounts,
    effectiveAccountId,
    setAccountSheetOpen,
    pickAccount,
    addAccountVisible,
    setAddAccountVisible,
    setError,
    load,
    addPersonVisible,
    setAddPersonVisible,
    onPersonAdded,
    addCategoryVisible,
    setAddCategoryVisible,
    categories,
    setCategoryId,
    calendarOpen,
    date,
    setCalendarOpen,
    setDate,
    repeatSheetVisible,
    setRepeatSheetVisible,
    leave,
  } = model;

  return (
    <AddSheets
      accountSheet={{
        open: accountSheetOpen,
        title: type === 'income' ? 'Received in' : 'Pay from',
        accounts: pickableAccounts,
        activeId: effectiveAccountId,
        onClose: () => setAccountSheetOpen(false),
        onPick: (id) => {
          pickAccount(id);
          setAccountSheetOpen(false);
        },
      }}
      addAccount={{
        visible: addAccountVisible,
        onClose: () => setAddAccountVisible(false),
        onCreated: async () => {
          setAddAccountVisible(false);
          setError(null);
          await load();
        },
      }}
      addPerson={{
        visible: addPersonVisible,
        onClose: () => setAddPersonVisible(false),
        onCreated: () => void onPersonAdded(),
      }}
      addCategory={{
        visible: addCategoryVisible,
        kind: type === 'income' ? 'income' : 'expense',
        categories,
        onClose: () => setAddCategoryVisible(false),
        // The new category is picked for this entry, so nothing typed so far is lost or redone.
        onSaved: async (created) => {
          setAddCategoryVisible(false);
          await load();
          if (created && created.kind === (type === 'income' ? 'income' : 'expense'))
            setCategoryId(created.id);
        },
      }}
      calendar={{
        visible: calendarOpen,
        value: date,
        onClose: () => setCalendarOpen(false),
        onPick: setDate,
      }}
      repeat={{
        visible: repeatSheetVisible,
        onClose: () => setRepeatSheetVisible(false),
        onLogged: () => leave(() => router.back()),
      }}
    />
  );
}

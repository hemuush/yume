import { router } from 'expo-router';
import { AddSheets } from '@/features/add/AddSheets';
import type { AddEntryModel } from '@/features/add/types/addEntryModel';
import type { ReactElement } from 'react';

type Props = {
  model: Pick<
    AddEntryModel,
    | 'accountSheetOpen'
    | 'type'
    | 'pickableAccounts'
    | 'effectiveAccountId'
    | 'setAccountSheetOpen'
    | 'pickAccount'
    | 'addAccountVisible'
    | 'setAddAccountVisible'
    | 'setError'
    | 'load'
    | 'addPersonVisible'
    | 'setAddPersonVisible'
    | 'onPersonAdded'
    | 'calendarOpen'
    | 'date'
    | 'setCalendarOpen'
    | 'setDate'
    | 'repeatSheetVisible'
    | 'setRepeatSheetVisible'
    | 'leave'
  >;
};
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

import { Account } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { CalendarSheet } from '@/components/CalendarSheet';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { AddPersonModal } from '@/features/people/AddPersonModal';
import { RepeatEntrySheet } from '@/features/home/RepeatEntrySheet';
import { AccountPickList } from './AddSections';

/** The sheets Add opens over itself: pick an account, add an account or person, pick a date, repeat an entry. */
export function AddSheets({
  accountSheet,
  addAccount,
  addPerson,
  calendar,
  repeat,
}: {
  accountSheet: {
    open: boolean;
    title: string;
    accounts: Account[];
    activeId: string | null;
    onClose: () => void;
    onPick: (id: string) => void;
  };
  addAccount: { visible: boolean; onClose: () => void; onCreated: () => Promise<void> };
  addPerson: { visible: boolean; onClose: () => void; onCreated: () => void };
  calendar: { visible: boolean; value: string; onClose: () => void; onPick: (date: string) => void };
  repeat: { visible: boolean; onClose: () => void; onLogged: () => void };
}) {
  return (
    <>
      <ModalSheet
        visible={accountSheet.open}
        onClose={accountSheet.onClose}
        title={accountSheet.title}
        scrollable={false}
      >
        <AccountPickList
          accounts={accountSheet.accounts}
          activeId={accountSheet.activeId}
          onPick={accountSheet.onPick}
        />
      </ModalSheet>

      <AddAccountModal {...addAccount} />

      <AddPersonModal {...addPerson} />

      <CalendarSheet
        visible={calendar.visible}
        value={calendar.value}
        quickPicks
        onClose={calendar.onClose}
        onPick={calendar.onPick}
      />

      <RepeatEntrySheet
        visible={repeat.visible}
        onClose={repeat.onClose}
        fromAdd
        onLogged={repeat.onLogged}
      />
    </>
  );
}

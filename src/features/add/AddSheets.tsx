import { Account, Category, CategoryKind } from '@/types';
import { AddCategoryModal } from '@/features/categories/AddCategoryModal';
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
  addCategory,
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
  addCategory: {
    visible: boolean;
    kind: CategoryKind;
    categories: Category[];
    onClose: () => void;
    onSaved: (created?: Category) => void | Promise<void>;
  };
  calendar: { visible: boolean; value: string; onClose: () => void; onPick: (date: string) => void };
  repeat: { visible: boolean; onClose: () => void; onLogged: () => void };
}) {
  return (
    <>
      <ModalSheet
        ledgerStyle
        size="compact"
        visible={accountSheet.open}
        onClose={accountSheet.onClose}
        title={accountSheet.title}
      >
        <AccountPickList
          accounts={accountSheet.accounts}
          activeId={accountSheet.activeId}
          onPick={accountSheet.onPick}
        />
      </ModalSheet>

      <AddAccountModal {...addAccount} />

      <AddPersonModal {...addPerson} ledgerStyle />

      <AddCategoryModal
        visible={addCategory.visible}
        category={null}
        allCategories={addCategory.categories}
        initialKind={addCategory.kind}
        onClose={addCategory.onClose}
        onSaved={(created) => void addCategory.onSaved(created)}
      />

      <CalendarSheet
        ledgerStyle
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

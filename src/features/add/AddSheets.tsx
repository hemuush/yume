import { View } from 'react-native';
import { Account } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { CalendarSheet } from '@/components/CalendarSheet';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { AddPersonModal } from '@/features/people/AddPersonModal';
import { RepeatEntrySheet } from '@/features/home/RepeatEntrySheet';
import { AccountTile } from './AddFields';
import { styles } from './add.styles';

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
        <View style={styles.accountRow}>
          {accountSheet.accounts.map((acc) => (
            <AccountTile
              key={acc.id}
              account={acc}
              active={accountSheet.activeId === acc.id}
              onPress={() => accountSheet.onPick(acc.id)}
            />
          ))}
        </View>
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

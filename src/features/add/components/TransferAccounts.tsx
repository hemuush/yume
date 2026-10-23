import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ModalSheet } from '@/components/ModalSheet';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { Account } from '@/types';
import { styles } from '@/features/add/add.styles';
import { withPressed } from '@/lib/pressed';
import { AccountPickList } from '@/features/add/components/AccountPickList';
import { TransferCard } from '@/features/add/components/TransferCard';

/**
 * A transfer's From and To as two account cards (name, kind, balance); tapping one opens a sheet of the
 * accounts to pick from, and Swap between them trades the two. To never offers the From account.
 */
export function TransferAccounts({
  fromOptions,
  accounts,
  fromId,
  toId,
  onPickFrom,
  onPickTo,
}: {
  /** Accounts money can leave: every one, for a transfer. */
  fromOptions: Account[];
  accounts: Account[];
  fromId: string | null;
  toId: string | null;
  onPickFrom: (id: string) => void;
  onPickTo: (id: string) => void;
}) {
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  const canSwap = !!fromId && !!toId && fromOptions.some((a) => a.id === toId);
  const options = picking === 'from' ? fromOptions : accounts.filter((a) => a.id !== fromId);
  return (
    <View style={styles.transfer}>
      <TransferCard label="From" account={from} onPress={() => setPicking('from')} />
      <TransferCard label="To" account={to} onPress={() => setPicking('to')} />
      {canSwap && (
        <Pressable
          onPress={() => {
            haptics.tap();
            onPickFrom(toId!);
            onPickTo(fromId!);
          }}
          hitSlop={8}
          style={withPressed(styles.swapBtn)}
          accessibilityRole="button"
          accessibilityLabel="Swap From and To"
        >
          <Feather name="repeat" size={15} color={theme.colors.white} />
        </Pressable>
      )}
      <ModalSheet
        size="compact"
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title={picking === 'from' ? 'Move from' : 'Move to'}
      >
        <AccountPickList
          accounts={options}
          activeId={picking === 'from' ? fromId : toId}
          onPick={(id) => {
            if (picking === 'from') onPickFrom(id);
            else onPickTo(id);
            setPicking(null);
          }}
        />
      </ModalSheet>
    </View>
  );
}

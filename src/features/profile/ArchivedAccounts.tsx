import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import ReanimatedAnimated from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { PANEL_ENTER, ROW_EXIT } from '@/lib/animation';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import type { Account } from '@/types';
import { AccountTiles } from './AccountTiles';
import { styles } from './profile.styles';

/**
 * The archived accounts: one row that opens their tiles in place. Whether it is open is this part's own state, so opening
 * it draws these rows, not the whole You page.
 */
export const ArchivedAccounts = memo(function ArchivedAccounts({
  accounts,
  onOpen,
}: {
  accounts: Account[];
  /** An account was tapped: open its details. */
  onOpen: (account: Account) => void;
}) {
  const { accent } = useAccent();
  const [open, setOpen] = useState(false);
  if (accounts.length === 0) return null;
  return (
    <View style={styles.archivedWrap}>
      <Pressable
        style={withPressedTint(accent, styles.archivedRow)}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Archived accounts, ${accounts.length}. ${open ? 'Hide' : 'Show'}`}
      >
        <MaterialCommunityIcons name="archive-outline" size={15} color={theme.colors.textMuted} />
        <Text style={styles.archivedLabel}>Archived accounts</Text>
        <Text style={styles.archivedSub}>
          {accounts.length} account{accounts.length === 1 ? '' : 's'} · {open ? 'tap to hide' : 'tap to show'}
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textMuted} />
      </Pressable>
      {open && (
        <ReanimatedAnimated.View entering={PANEL_ENTER} exiting={ROW_EXIT}>
          <AccountTiles accounts={accounts} archived onPress={onOpen} />
        </ReanimatedAnimated.View>
      )}
    </View>
  );
});

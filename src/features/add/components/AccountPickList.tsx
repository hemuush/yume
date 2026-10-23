import { selectedFill } from '@/theme/interactionColors';
import { Pressable, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { McIconName } from '@/components/iconName';
import { Amount } from '@/components/Amount';
import { accountBadgeColor, accountIcon } from '@/lib/account';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { Account } from '@/types';
import { styles } from '@/features/add/add.styles';
import { withPressed } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';

/** Accounts as rows with their kind and balance, the picked one outlined: Add's account sheets. */
export function AccountPickList({
  accounts,
  activeId,
  onPick,
}: {
  accounts: Account[];
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  const { accent } = useAccent();
  return (
    <View style={styles.pickList}>
      {accounts.map((a) => {
        const on = a.id === activeId;
        return (
          <Pressable
            key={a.id}
            onPress={() => {
              haptics.tap();
              onPick(a.id);
            }}
            style={withPressed([
              styles.pickRow,
              on && { backgroundColor: selectedFill(accent), borderColor: selectedFill(accent) },
            ])}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={a.name}
          >
            <View style={[styles.transferIcon, { backgroundColor: accountBadgeColor(a.type, accent) }]}>
              <MaterialCommunityIcons
                name={accountIcon(a.type) as McIconName}
                size={18}
                color={theme.colors.ink}
              />
            </View>
            <View style={styles.transferMid}>
              <Text style={styles.transferName} numberOfLines={1}>
                {a.name}
              </Text>
              <Text style={styles.pickSub} numberOfLines={1}>
                {a.type.replace('_', ' ')} ·{' '}
                <Amount
                  minor={a.currentBalanceMinor}
                  currency={a.currency}
                  sensitive={a.type === 'savings'}
                  style={styles.pickSub}
                />
              </Text>
            </View>
            {on && <Feather name="check" size={18} color={theme.colors.ink} />}
          </Pressable>
        );
      })}
    </View>
  );
}

import { Pressable, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { McIconName } from '@/components/iconName';
import { Amount } from '@/components/Amount';
import { accountBadgeColor, accountIcon } from '@/lib/account';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { Account } from '@/types';
import { styles } from '@/features/add/add.styles';
import { withPressed } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';

export function TransferCard({
  label,
  account,
  onPress,
}: {
  label: string;
  account?: Account;
  onPress: () => void;
}) {
  const { accent } = useAccent();
  return (
    <Pressable
      onPress={onPress}
      style={withPressed(styles.transferCard)}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${account ? account.name : 'pick an account'}. Change`}
    >
      <View
        style={[
          styles.transferIcon,
          { backgroundColor: account ? accountBadgeColor(account.type, accent) : theme.colors.surfaceAlt },
        ]}
      >
        <MaterialCommunityIcons
          name={(account ? accountIcon(account.type) : 'bank-outline') as McIconName}
          size={18}
          color={theme.colors.ink}
        />
      </View>
      <View style={styles.transferMid}>
        <Text style={styles.transferLabel}>{label}</Text>
        <Text style={styles.transferName} numberOfLines={1}>
          {account ? account.name : 'Pick an account'}
        </Text>
        {account && (
          <Amount
            minor={account.currentBalanceMinor}
            currency={account.currency}
            sensitive={account.type === 'savings'}
            style={styles.transferBal}
            numberOfLines={1}
          />
        )}
      </View>
      <Feather name="chevron-down" size={16} color={theme.colors.textMuted} />
    </Pressable>
  );
}

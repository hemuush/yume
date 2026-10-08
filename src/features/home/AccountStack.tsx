import { View, StyleSheet, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { Account } from '@/types';
import { accountHue, accountIcon } from '@/lib/account';
import { GainPill } from '@/features/investments/GainPill';
import { shade } from '@/lib/color';
import { withPressed } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { STACK, stackHeight, stackOrder } from './stackLayout';

interface Props {
  accounts: Account[];
  onOpen: (account: Account) => void;
}

/**
 * Home's "Your accounts": an overlapping card per account, savings at the back, cash in front (stackOrder).
 * Each card's name and balance show in its peeking strip, the front one in full. Tapping opens the summary.
 */
export function AccountStack({ accounts, onOpen }: Props) {
  const ordered = stackOrder(accounts);
  return (
    <View testID="account-stack" style={[styles.stack, { height: stackHeight(ordered.length) }]}>
      {ordered.map((account, i) => (
        <StackCard key={account.id} account={account} top={i * STACK.peek} onOpen={() => onOpen(account)} />
      ))}
    </View>
  );
}

function StackCard({ account, top, onOpen }: { account: Account; top: number; onOpen: () => void }) {
  const { accent } = useAccent();
  const hue = accountHue(account.type, accent);
  const typeLabel = account.investment ? 'savings · tracked' : account.type.replace('_', ' ');
  return (
    <View
      testID={`account-card-${account.id}`}
      style={[styles.card, { top, borderColor: shade(hue, 88), backgroundColor: shade(hue, 96) }]}
    >
      <Pressable
        onPress={onOpen}
        style={withPressed(styles.face)}
        accessibilityRole="button"
        accessibilityLabel={`${account.name}, ${typeLabel}. Open summary`}
      >
        <View style={styles.row}>
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons
              name={accountIcon(account.type) as McIconName}
              size={18}
              color={shade(hue, 38, 10)}
            />
          </View>
          <View style={styles.nameBlock}>
            <Text style={styles.name} numberOfLines={1}>
              {account.name}
            </Text>
            <Text style={styles.type} numberOfLines={1}>
              {typeLabel}
            </Text>
          </View>
          <View style={styles.figures}>
            <Amount
              minor={account.currentBalanceMinor}
              currency={account.currency}
              sensitive={account.type === 'savings'}
              style={styles.balance}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
            {account.investment && <GainPill account={account} />}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { marginHorizontal: 20 },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: STACK.cardHeight,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0px -2px 8px rgba(18,19,15,0.05)',
  },
  face: { flex: 1 },
  row: {
    height: STACK.peek,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 2,
    paddingHorizontal: 18,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  nameBlock: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: theme.font.roundedBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  type: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
  figures: { flexShrink: 0, maxWidth: '50%', alignItems: 'flex-end', gap: 1 },
  balance: {
    fontFamily: theme.font.monoBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
});

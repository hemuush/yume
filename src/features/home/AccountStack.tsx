import { View, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    <View testID={`account-card-${account.id}`} style={[styles.card, { top, borderColor: shade(hue, 82) }]}>
      <LinearGradient
        colors={[shade(hue, 94), shade(hue, 88)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.circleBig} />
      <View style={styles.circleSmall} />
      <Pressable
        onPress={onOpen}
        style={withPressed(styles.face)}
        accessibilityRole="button"
        accessibilityLabel={`${account.name}, ${typeLabel}. Open summary`}
      >
        <View style={styles.row}>
          <MaterialCommunityIcons
            name={accountIcon(account.type) as McIconName}
            size={22}
            color={shade(hue, 38, 10)}
          />
          <Text style={styles.name} numberOfLines={1}>
            {account.name}
          </Text>
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
        <Text style={styles.type}>{typeLabel}</Text>
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
    borderRadius: theme.radius.xl2,
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0px -2px 9px rgba(18,19,15,0.08)',
  },
  face: { flex: 1 },
  circleBig: {
    position: 'absolute',
    right: -28,
    bottom: -52,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  circleSmall: {
    position: 'absolute',
    right: 30,
    bottom: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  row: {
    height: STACK.peek,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 2,
    paddingHorizontal: 20,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.font.roundedBold,
    fontSize: 15.5,
    color: theme.colors.textPrimary,
  },
  figures: { flexShrink: 0, maxWidth: '55%', alignItems: 'flex-end', gap: 1 },
  balance: {
    fontFamily: theme.font.monoBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  type: {
    position: 'absolute',
    left: 52,
    bottom: 11,
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
});

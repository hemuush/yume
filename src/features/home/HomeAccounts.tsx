import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { Glass, GLASS } from '@/components/Glass';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { accountHue, accountIcon } from '@/lib/account';
import { shade } from '@/lib/color';
import { withPressed } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { GainPill } from '@/features/investments/GainPill';
import type { Account } from '@/types';

/** "bank", "credit card", "savings · tracked": what kind of account, as the old account cards said it. */
export function accountTypeLabel(a: Account): string {
  return a.investment ? 'savings · tracked' : a.type.replace('_', ' ');
}

/**
 * Home's Accounts card: money in hand (bank, cash and wallets in the default currency), then a chip per
 * account with its type and balance, and the gain on a tracked investment. The heading opens the full list;
 * each chip opens that account, so a screen reader reaches every chip on its own. With no accounts yet it
 * offers to add one.
 */
export function HomeAccounts({
  accounts,
  currency,
  onOpenAccounts,
  onOpenAccount,
  onAddAccount,
}: {
  accounts: Account[];
  /** The default currency: the in-hand total counts only accounts in it. */
  currency: string;
  onOpenAccounts: () => void;
  onOpenAccount: (account: Account) => void;
  onAddAccount: () => void;
}) {
  const { accent } = useAccent();
  if (accounts.length === 0) {
    return (
      <Pressable
        onPress={onAddAccount}
        style={withPressed(styles.wrap)}
        accessibilityRole="button"
        accessibilityLabel="Add an account"
      >
        <Glass radius={22} style={styles.tile}>
          <View style={styles.head}>
            <Text style={styles.title}>Accounts</Text>
            <Feather name="plus" size={17} color={theme.colors.textSecondary} />
          </View>
          <Text style={styles.big}>Add one</Text>
          <Text style={styles.sub}>A bank account, cash, or a UPI wallet</Text>
        </Glass>
      </Pressable>
    );
  }
  const inHand = accounts.filter(
    (a) => (a.type === 'bank' || a.type === 'cash' || a.type === 'wallet') && a.currency === currency
  );
  const inHandMinor = inHand.reduce((s, a) => s + a.currentBalanceMinor, 0);
  return (
    <View style={styles.wrap}>
      <Glass radius={22} style={styles.tile}>
        <Pressable
          onPress={onOpenAccounts}
          hitSlop={8}
          style={withPressed(styles.head)}
          accessibilityRole="button"
          accessibilityLabel={`Accounts, ${accounts.length}. See all`}
        >
          <Text style={styles.title}>Accounts</Text>
          <Feather name="arrow-up-right" size={17} color={theme.colors.textSecondary} />
        </Pressable>
        {inHand.length > 0 && (
          <>
            <Amount minor={inHandMinor} currency={currency} style={styles.big} numberOfLines={1} />
            <Text style={styles.sub} numberOfLines={1}>
              Bank, cash & wallets only
            </Text>
          </>
        )}
        <View style={styles.chips}>
          {accounts.map((a) => {
            const hue = accountHue(a.type, accent);
            return (
              <Pressable
                key={a.id}
                onPress={() => onOpenAccount(a)}
                style={withPressed(styles.chip)}
                accessibilityRole="button"
                accessibilityLabel={`${a.name}, ${accountTypeLabel(a)}. Open summary`}
              >
                <View style={[styles.chipIcon, { backgroundColor: shade(hue, 88) }]}>
                  <MaterialCommunityIcons
                    name={accountIcon(a.type) as McIconName}
                    size={14}
                    color={shade(hue, 30, 10)}
                  />
                </View>
                <View style={styles.chipText}>
                  <View style={styles.chipNameRow}>
                    <Text style={styles.chipName} numberOfLines={1}>
                      {a.name}
                    </Text>
                    {a.investment && <GainPill account={a} />}
                  </View>
                  <Text style={styles.chipSub} numberOfLines={1}>
                    {accountTypeLabel(a)} ·{' '}
                    <Amount
                      minor={a.currentBalanceMinor}
                      currency={a.currency}
                      sensitive={a.type === 'savings'}
                      style={styles.chipAmount}
                    />
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16 },
  tile: { padding: 14, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  big: {
    fontFamily: theme.font.body,
    fontSize: theme.typeSize.title,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: theme.colors.textPrimary,
  },
  sub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingLeft: 5,
    paddingRight: 12,
    paddingVertical: 5,
    borderRadius: 22,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
    maxWidth: '100%',
  },
  chipIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  chipText: { flexShrink: 1, minWidth: 0 },
  chipNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipName: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  chipSub: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textMuted,
    textTransform: 'capitalize',
  },
  chipAmount: { fontFamily: theme.font.monoBold, fontSize: 11.5, color: theme.colors.textSecondary },
});

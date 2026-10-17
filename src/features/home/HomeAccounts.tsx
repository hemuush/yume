import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { Glass, GLASS } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { accountHue, accountIcon } from '@/lib/account';
import { shade } from '@/lib/color';
import { withPressed } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { homeInk } from './homeInk';
import { GainPill } from '@/features/investments/GainPill';
import type { Account } from '@/types';

/** "bank", "credit card", "savings · tracked": what kind of account, as the old account cards said it. */
export function accountTypeLabel(a: Account): string {
  return a.investment ? 'savings · tracked' : a.type.replace('_', ' ');
}

/** Everyday balance and wrapping account pills; savings remain individually masked. */
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
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  if (accounts.length === 0) {
    return (
      <Pressable
        onPress={onAddAccount}
        style={withPressed(styles.wrap)}
        accessibilityRole="button"
        accessibilityLabel="Add an account"
      >
        <Glass radius={22} style={[styles.tile, cardSurface.neutral]}>
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
  // With savings and everyday accounts side by side, each gets its own heading and the savings a subtotal.
  const savings = accounts.filter((a) => a.type === 'savings');
  const everyday = accounts.filter((a) => a.type !== 'savings');
  const grouped = savings.length > 0 && everyday.length > 0;
  // A sum across currencies would mean nothing: the subtotal is only for savings all in the default currency.
  const savingsMinor = savings.every((a) => a.currency === currency)
    ? savings.reduce((sum, a) => sum + a.currentBalanceMinor, 0)
    : null;

  // Everyday accounts are two-column tiles (name, kind, balance); savings are full-width rows (name, balance).
  const tile = (a: Account) => {
    const hue = accountHue(a.type, accent);
    return (
      <Pressable
        key={a.id}
        onPress={() => onOpenAccount(a)}
        style={withPressed([styles.tileBtn, stacked ? styles.full : styles.half])}
        accessibilityRole="button"
        accessibilityLabel={`${a.name}, ${accountTypeLabel(a)}. Open summary`}
      >
        <View style={[styles.chipIcon, { backgroundColor: shade(hue, 88) }]}>
          <MaterialCommunityIcons
            name={accountIcon(a.type) as McIconName}
            size={18}
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
            {accountTypeLabel(a)}
          </Text>
          <Amount minor={a.currentBalanceMinor} currency={a.currency} style={styles.chipAmount} />
        </View>
      </Pressable>
    );
  };
  const row = (a: Account) => {
    const hue = accountHue(a.type, accent);
    return (
      <Pressable
        key={a.id}
        onPress={() => onOpenAccount(a)}
        style={withPressed(styles.rowBtn)}
        accessibilityRole="button"
        accessibilityLabel={`${a.name}, ${accountTypeLabel(a)}. Open summary`}
      >
        <View style={[styles.chipIcon, { backgroundColor: shade(hue, 88) }]}>
          <MaterialCommunityIcons
            name={accountIcon(a.type) as McIconName}
            size={18}
            color={shade(hue, 30, 10)}
          />
        </View>
        <View style={[styles.chipNameRow, styles.rowName]}>
          <Text style={styles.chipName} numberOfLines={1}>
            {a.name}
          </Text>
          {a.investment && <GainPill account={a} />}
        </View>
        <Amount minor={a.currentBalanceMinor} currency={a.currency} sensitive style={styles.chipAmount} />
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      <Glass radius={22} style={[styles.tile, cardSurface.neutral]}>
        <View style={styles.head}>
          <View style={[styles.headIcon, { backgroundColor: shade(accent, 88) }]}>
            <MaterialCommunityIcons name="wallet-outline" size={18} color={homeInk(accent)} />
          </View>
          <Text style={styles.title}>Accounts</Text>
          <Pressable
            onPress={onOpenAccounts}
            hitSlop={8}
            style={withPressed(styles.headingAction)}
            accessibilityRole="button"
            accessibilityLabel={`Accounts, ${accounts.length}. See all`}
          >
            <Text style={styles.headingActionText}>View all</Text>
            <Feather name="arrow-up-right" size={15} color={theme.colors.link} />
          </Pressable>
        </View>
        {inHand.length > 0 && (
          <View style={[styles.inHand, { backgroundColor: shade(accent, 92) }]}>
            <Text style={styles.inHandLabel}>In hand now</Text>
            <Amount
              minor={inHandMinor}
              currency={currency}
              style={styles.big}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
            <Text style={styles.sub}>
              Bank, cash & wallets only{accounts.some((a) => a.currency !== currency) ? ` · ${currency}` : ''}
            </Text>
          </View>
        )}
        {everyday.length > 0 && (
          <>
            {grouped && (
              <Text style={styles.groupHead} accessibilityRole="header">
                Everyday
              </Text>
            )}
            <View style={styles.chips}>{everyday.map(tile)}</View>
          </>
        )}
        {savings.length > 0 && (
          <>
            {grouped && (
              <View style={styles.groupHeadRow}>
                <Text style={styles.groupHeadText} accessibilityRole="header">
                  Savings
                </Text>
                {savingsMinor != null && (
                  <Amount minor={savingsMinor} currency={currency} sensitive style={styles.groupHeadText} />
                )}
              </View>
            )}
            <View style={styles.rows}>{savings.map(row)}</View>
          </>
        )}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16 },
  tile: { padding: 14, gap: 4 },
  head: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  headIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headingAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: GLASS.fillStrong,
  },
  inHand: { borderRadius: 18, padding: 12, gap: 2 },
  headingActionText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.link },
  title: { flex: 1, fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
  big: {
    fontFamily: theme.font.body,
    fontSize: theme.typeSize.title,
    fontVariant: ['tabular-nums'],
    lineHeight: 26,
    letterSpacing: -0.5,
    color: theme.colors.textPrimary,
  },
  sub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  full: { flexBasis: '100%' },
  // Two even columns when the accounts are grouped.
  half: { width: '48.5%' },
  rows: { gap: 6, marginTop: 6 },
  rowName: { flex: 1, minWidth: 0 },
  inHandLabel: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textMuted },
  groupHead: {
    marginTop: 14,
    marginHorizontal: 2,
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  groupHeadRow: {
    marginTop: 14,
    marginHorizontal: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  groupHeadText: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textMuted,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    padding: 8,
    borderRadius: 18,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
    maxWidth: '100%',
  },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 18,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
  },
  chipIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chipText: { flexShrink: 1, minWidth: 0 },
  chipNameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chipName: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  chipSub: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'capitalize',
  },
  chipAmount: {
    fontFamily: theme.font.bodyBold,
    fontVariant: ['tabular-nums'],
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
});

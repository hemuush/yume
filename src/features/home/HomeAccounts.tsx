import { memo } from 'react';
import { View, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { accountHue, accountIcon, accountTypeLabel } from '@/lib/account';
import { shade } from '@/lib/color';
import { withPressed, withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { Section } from '@/components/Section';
import { screenStyles as h } from '@/components/screenStyles';
import type { Account } from '@/types';

/** Accounts shown in the row; the rest are one tap away under "View all". */
const PREVIEW_ACCOUNTS = 8;
const TILE_WIDTH = 148;
const IN_HAND_TYPES = new Set<Account['type']>(['bank', 'cash', 'wallet']);
const TILE_GAP = 10;

/**
 * A row of account tiles you swipe sideways (everyday accounts first, then savings), each with its own currency
 * and savings privacy, ending in an "Add account" tile.
 */
export function HomeAccounts({
  accounts,
  currency,
  onOpenAccounts,
  onOpenAccount,
  onAddAccount,
}: {
  accounts: Account[];
  /** The default currency: the heading's in-hand total counts only everyday accounts held in it. */
  currency?: string;
  onOpenAccounts: () => void;
  onOpenAccount: (account: Account) => void;
  onAddAccount: () => void;
}) {
  const { accent } = useAccent();
  const { fontScale } = useWindowDimensions();
  if (accounts.length === 0) {
    return (
      <Pressable
        onPress={onAddAccount}
        style={withPressed(styles.wrap)}
        accessibilityRole="button"
        accessibilityLabel="Add an account"
      >
        <View style={styles.fresh}>
          <View style={styles.freshHead}>
            <Text style={styles.freshTitle}>Your accounts</Text>
            <Feather name="plus" size={17} color={theme.colors.textSecondary} />
          </View>
          <Text style={styles.freshBig}>A fresh start</Text>
          <Text style={styles.freshSub}>Add a bank account, cash or wallet to get started.</Text>
        </View>
      </Pressable>
    );
  }
  // Only accounts holding money (or owing it) get a tile; an empty one is still one tap away under "View all".
  const held = accounts.filter((a) => a.currentBalanceMinor !== 0);
  const savings = held.filter((a) => a.type === 'savings');
  const everyday = held.filter((a) => a.type !== 'savings');
  const preview = [...everyday, ...savings].slice(0, PREVIEW_ACCOUNTS);
  // Money you can reach today: bank, cash and wallet balances in the default currency. Savings, investments
  // and cards stay out, so the line never reveals a hidden savings figure.
  const inHand = accounts.filter(
    (a) => IN_HAND_TYPES.has(a.type) && !a.investment && a.currency === currency && a.currentBalanceMinor > 0
  );
  const inHandLine =
    currency && inHand.length > 0
      ? `${formatMoney(
          inHand.reduce((sum, a) => sum + a.currentBalanceMinor, 0),
          currency
        )} in hand across ${inHand.length} ${inHand.length === 1 ? 'account' : 'accounts'}`
      : undefined;
  // Bigger text needs a wider tile for a balance to stay on one line.
  const width = Math.round(TILE_WIDTH * Math.min(1.3, Math.max(1, fontScale)));
  return (
    <Section
      compact
      title="Your accounts"
      subtitle={inHandLine}
      onSeeAll={onOpenAccounts}
      actionLabel="View all"
    >
      <ScrollView
        horizontal
        nestedScrollEnabled
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        snapToInterval={width + TILE_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.row}
      >
        {preview.map((a) => (
          <AccountTile key={a.id} account={a} width={width} accent={accent} onOpen={onOpenAccount} />
        ))}
        <Pressable
          onPress={onAddAccount}
          accessibilityRole="button"
          accessibilityLabel="Add an account"
          style={withPressed([styles.tile, styles.addTile, { width: Math.round(width * 0.8) }])}
        >
          <Feather name="plus" size={22} color={theme.colors.textSecondary} />
          <Text style={styles.addText}>Add account</Text>
        </Pressable>
      </ScrollView>
    </Section>
  );
}

/** One tile, memoised so scrolling the row re-renders none of them. */
const AccountTile = memo(function AccountTile({
  account: a,
  width,
  accent,
  onOpen,
}: {
  account: Account;
  width: number;
  accent: string;
  onOpen: (account: Account) => void;
}) {
  const hue = accountHue(a.type, accent);
  return (
    <Pressable
      onPress={() => onOpen(a)}
      accessibilityRole="button"
      accessibilityLabel={`${a.name}, ${accountTypeLabel(a)}. Open summary`}
      style={withPressedTint(accent, [styles.tile, { width }])}
    >
      <View style={styles.tileHead}>
        <View style={[styles.icon, { backgroundColor: shade(hue, 88) }]}>
          <MaterialCommunityIcons
            name={accountIcon(a.type, !!a.investment) as McIconName}
            size={17}
            color={shade(hue, 30, 10)}
          />
        </View>
        <Text style={styles.kind} numberOfLines={1}>
          {accountTypeLabel(a)}
        </Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {a.name}
      </Text>
      <Amount
        minor={a.currentBalanceMinor}
        currency={a.currency}
        sensitive={a.type === 'savings'}
        style={[styles.balance, a.currentBalanceMinor < 0 && styles.balanceOwed]}
        numberOfLines={1}
        adjustsFontSizeToFit
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 4, gap: TILE_GAP },
  tile: { ...h.card, marginHorizontal: 0, minHeight: 112, padding: 12 },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  icon: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: {
    marginTop: 10,
    fontFamily: theme.font.bodyMedium,
    fontSize: theme.typeSize.row,
    color: theme.colors.textPrimary,
  },
  kind: {
    flexShrink: 1,
    fontFamily: theme.font.body,
    fontSize: 11,
    textAlign: 'right',
    color: theme.colors.textMuted,
  },
  balance: {
    marginTop: 2,
    fontFamily: theme.font.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  balanceOwed: { color: theme.colors.expenseText },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderSoft,
  },
  addText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  wrap: { marginHorizontal: 16 },
  fresh: { ...h.card, marginHorizontal: 0, padding: 16, gap: 4 },
  freshHead: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  freshTitle: { flex: 1, fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
  freshBig: {
    fontFamily: theme.font.body,
    fontSize: theme.typeSize.title,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: theme.colors.textPrimary,
  },
  freshSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
});

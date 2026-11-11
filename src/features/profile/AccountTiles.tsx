import { memo } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { CategoryIcon } from '@/components/CategoryIcon';
import { GainPill } from '@/features/investments/GainPill';
import { theme } from '@/constants/theme';
import { cardUsage } from '@/lib/cardUsage';
import { accountBadgeColor, accountIcon } from '@/lib/account';
import { investmentLabel } from '@/lib/investment';
import { formatMaskableMoney } from '@/lib/money';
import { withPressedTint } from '@/lib/pressed';
import { roundedMinor } from '@/lib/round';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
import { screenStyles as h, SCREEN } from '@/components/screenStyles';
import type { Account } from '@/types';

const ACCOUNT_TYPE_LABEL: Record<Account['type'], string> = {
  bank: 'Bank',
  cash: 'Cash',
  wallet: 'Wallet',
  savings: 'Savings',
  credit_card: 'Credit card',
};

const GAP = 8;

/**
 * The accounts as tiles, two to a row (one with large text or on a narrow screen): the type's icon and name of
 * the type, the account's name and its balance. Accounts that hold something come first; the ones at zero
 * follow in quieter ink, so a long list never buries the ones that matter.
 */
export function AccountTiles({
  accounts,
  archived = false,
  onPress,
}: {
  accounts: Account[];
  /** Archived accounts: all quiet, and named so. */
  archived?: boolean;
  onPress: (account: Account) => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 360 || fontScale > 1.2 ? 1 : 2;
  const rows: Account[][] = [];
  for (let i = 0; i < accounts.length; i += columns) rows.push(accounts.slice(i, i + columns));
  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((account) => (
            <AccountTile key={account.id} account={account} archived={archived} onPress={onPress} />
          ))}
          {Array.from({ length: columns - row.length }, (_, k) => (
            <View key={`gap${k}`} style={styles.slot} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Holding something first, empty ones after; each keeps its place among its own kind. */
export function tileOrder(accounts: Account[]): Account[] {
  const held = accounts.filter((a) => roundedMinor(a.currentBalanceMinor) !== 0);
  const empty = accounts.filter((a) => roundedMinor(a.currentBalanceMinor) === 0);
  return [...held, ...empty];
}

const AccountTile = memo(function AccountTile({
  account,
  archived,
  onPress,
}: {
  account: Account;
  archived: boolean;
  onPress: (account: Account) => void;
}) {
  const { accent } = useAccent();
  const { hideAmounts } = usePrivacy();
  const minor = roundedMinor(account.currentBalanceMinor);
  const quiet = archived || minor === 0;
  const kind = account.investment ? investmentLabel(account.investment) : ACCOUNT_TYPE_LABEL[account.type];
  const usage = cardUsage(account);
  const balance = formatMaskableMoney(minor, {
    currency: account.currency,
    masked: hideAmounts && account.type === 'savings',
  });
  return (
    <Pressable
      onPress={() => onPress(account)}
      accessibilityRole="button"
      accessibilityLabel={`${account.name}, ${kind}${archived ? ', archived' : ''}, ${balance}`}
      accessibilityHint="Edit account"
      style={withPressedTint(accent, styles.tile)}
    >
      <View style={styles.head}>
        <CategoryIcon
          name={accountIcon(account.type, !!account.investment)}
          color={quiet ? theme.colors.textMuted : accountBadgeColor(account.type, accent)}
          square={28}
          size={14}
          round
        />
        <Text style={styles.kind} numberOfLines={1}>
          {kind}
          {archived ? ' · archived' : ''}
        </Text>
      </View>
      <Text style={[styles.name, quiet && styles.quiet]} numberOfLines={2}>
        {account.name}
      </Text>
      <View style={styles.foot}>
        <Amount
          minor={minor}
          currency={account.currency}
          sensitive={account.type === 'savings'}
          style={[
            styles.amount,
            quiet && styles.quiet,
            !quiet && account.currentBalanceMinor < 0 && h.expense,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        {account.investment && !archived && <GainPill account={account} moneyOnly />}
      </View>
      {usage && !archived && <Text style={styles.usage}>{Math.round(usage.pct)}% of limit used</Text>}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  grid: { marginHorizontal: SCREEN.gutter, gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  slot: { flex: 1, minWidth: 0 },
  tile: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    gap: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  kind: { flexShrink: 1, fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  name: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
    color: theme.colors.textPrimary,
  },
  foot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  amount: {
    flexShrink: 1,
    fontFamily: theme.font.bodyBold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  quiet: { color: theme.colors.textMuted },
  usage: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
});

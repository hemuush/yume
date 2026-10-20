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
import { Section } from '@/components/Section';
import { GainPill } from '@/features/investments/GainPill';
import type { Account } from '@/types';

/** Everyday accounts drawn as tiles; the rest are under View all. */
const EVERYDAY_SHOWN = 4;

/** "bank", "credit card", "savings · tracked": what kind of account, as the old account cards said it. */
function accountTypeLabel(a: Account): string {
  return a.investment ? 'savings · tracked' : a.type.replace('_', ' ');
}

/** Everyday balance and wrapping account pills; savings remain individually masked. */
export function HomeAccounts({
  accounts,
  currency,
  onOpenAccounts,
  onOpenAccount,
  onAddAccount,
  compact = false,
}: {
  accounts: Account[];
  /** The default currency: the in-hand total counts only accounts in it. */
  currency: string;
  onOpenAccounts: () => void;
  onOpenAccount: (account: Account) => void;
  onAddAccount: () => void;
  compact?: boolean;
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
          <Text style={styles.big}>{compact ? 'A fresh start' : 'Add one'}</Text>
          <Text style={styles.sub}>
            {compact
              ? 'Add a bank account, cash or wallet to get started.'
              : 'A bank account, cash, or a UPI wallet'}
          </Text>
        </Glass>
      </Pressable>
    );
  }
  const inHand = accounts.filter(
    (a) => (a.type === 'bank' || a.type === 'cash' || a.type === 'wallet') && a.currency === currency
  );
  const inHandMinor = inHand.reduce((s, a) => s + a.currentBalanceMinor, 0);
  const savings = accounts.filter((a) => a.type === 'savings');
  const everyday = accounts.filter((a) => a.type !== 'savings');
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
            <Text style={styles.chipName}>{a.name}</Text>
            {a.investment && <GainPill account={a} />}
          </View>
          <Amount
            minor={a.currentBalanceMinor}
            currency={a.currency}
            sensitive={a.type === 'savings'}
            style={styles.chipAmount}
          />
        </View>
      </Pressable>
    );
  };
  // Several savings accounts are one summary row (the count and the total, masked like each balance) that opens
  // the full list; a single one is shown as itself.
  const savingsSummary = (
    <Pressable
      onPress={onOpenAccounts}
      style={withPressed(styles.rowBtn)}
      accessibilityRole="button"
      accessibilityLabel={`Savings, ${savings.length} accounts. See all`}
    >
      <View style={[styles.chipIcon, { backgroundColor: shade(accountHue('savings', accent), 88) }]}>
        <MaterialCommunityIcons
          name={accountIcon('savings') as McIconName}
          size={18}
          color={shade(accountHue('savings', accent), 30, 10)}
        />
      </View>
      <View style={styles.rowName}>
        <Text style={styles.chipName}>Savings</Text>
        <Text style={styles.chipSub}>{`${savings.length} accounts`}</Text>
      </View>
      {savingsMinor != null && (
        <Amount minor={savingsMinor} currency={currency} sensitive style={styles.chipAmount} />
      )}
      <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
    </Pressable>
  );
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
          <Text style={styles.chipName}>{a.name}</Text>
          {a.investment && <GainPill account={a} />}
        </View>
        <Amount minor={a.currentBalanceMinor} currency={a.currency} sensitive style={styles.chipAmount} />
      </Pressable>
    );
  };

  if (compact) {
    const spending = everyday.filter((a) => a.type === 'bank' || a.type === 'cash' || a.type === 'wallet');
    const preview = (spending.length ? spending : everyday.length ? everyday : savings).slice(0, 2);
    return (
      <Section
        compact
        title="Accounts"
        onSeeAll={onOpenAccounts}
        actionLabel={compact ? 'View all' : undefined}
      >
        <View style={styles.wrap}>
          <View style={[styles.accountGrid, stacked && { flexDirection: 'column' }]}>
            {preview.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => onOpenAccount(a)}
                accessibilityRole="button"
                accessibilityLabel={`${a.name}, ${accountTypeLabel(a)}. Open summary`}
                style={withPressed(styles.accountCard)}
              >
                <View style={styles.accountCardHead}>
                  <View style={[styles.chipIcon, { backgroundColor: shade(accountHue(a.type, accent), 88) }]}>
                    <MaterialCommunityIcons
                      name={accountIcon(a.type) as McIconName}
                      size={18}
                      color={shade(accountHue(a.type, accent), 30, 10)}
                    />
                  </View>
                  <View style={styles.chipText}>
                    <Text style={styles.chipName}>{a.name}</Text>
                    <Text style={styles.chipSub}>{accountTypeLabel(a)}</Text>
                  </View>
                </View>
                <Amount
                  minor={a.currentBalanceMinor}
                  currency={a.currency}
                  sensitive={a.type === 'savings'}
                  style={styles.listAmount}
                />
              </Pressable>
            ))}
          </View>
        </View>
      </Section>
    );
  }

  return (
    <Section title="Accounts" onSeeAll={onOpenAccounts} actionLabel={compact ? 'View all' : undefined}>
      <View style={styles.wrap}>
        <Glass radius={24} style={[styles.tile, cardSurface.neutral]}>
          {everyday.length > 0 && (
            <>
              <View style={styles.groupHeadRow}>
                <Text style={styles.groupHeadText} accessibilityRole="header">
                  {`Everyday · ${everyday.length} ${everyday.length === 1 ? 'account' : 'accounts'}`}
                </Text>
                {inHand.length > 0 && (
                  <Amount minor={inHandMinor} currency={currency} style={styles.groupHeadAmount} />
                )}
              </View>
              <View style={styles.chips}>
                {everyday.slice(0, EVERYDAY_SHOWN).map(tile)}
                {everyday.length < EVERYDAY_SHOWN && (
                  <Pressable
                    onPress={onAddAccount}
                    style={withPressed([styles.tileBtn, styles.addTile, stacked ? styles.full : styles.half])}
                    accessibilityRole="button"
                    accessibilityLabel="Add an account"
                  >
                    <Feather name="plus" size={18} color={theme.colors.textSecondary} />
                    <Text style={styles.chipName}>Account</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
          {savings.length > 0 && (
            <View style={styles.rows}>{savings.length === 1 ? row(savings[0]) : savingsSummary}</View>
          )}
        </Glass>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  accountGrid: { flexDirection: 'row', gap: 10 },
  accountCard: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    gap: 12,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    minHeight: 106,
  },
  accountCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listAmount: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 17,
    lineHeight: 23,
    color: theme.colors.textPrimary,
  },
  wrap: { marginHorizontal: 16 },
  tile: { padding: 14, gap: 4 },
  head: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
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
  groupHeadRow: {
    marginTop: 4,
    marginHorizontal: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  groupHeadAmount: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  groupHeadText: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textMuted,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  addTile: { justifyContent: 'center', borderStyle: 'dashed', backgroundColor: 'transparent' },
  tileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 72,
    padding: 10,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
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
  chipText: { flex: 1, minWidth: 0 },
  chipNameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chipName: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
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

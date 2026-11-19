import { memo } from 'react';
import { View, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { accountTypeLabel, accountIcon, accountHue } from '@/lib/account';
import { withPressed, withPressedTint } from '@/lib/pressed';
import { haptics } from '@/lib/haptics';
import { useAccent } from '@/theme/AccentContext';
import { Section } from '@/components/Section';
import type { Account } from '@/types';
import { themedStyles } from '@/theme/themedStyles';

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
        onPress={() => {
          haptics.tap();
          onAddAccount();
        }}
        style={withPressed(styles.wrap)}
        accessibilityRole="button"
        accessibilityLabel="Add an account"
      >
        <View style={styles.fresh}>
          <View style={styles.freshHead}>
            <View style={styles.freshHeadLeft}>
              <View style={styles.freshIconChip}>
                <Feather name="credit-card" size={14} color={accent} />
              </View>
              <Text style={styles.freshTitle}>Your accounts</Text>
            </View>
            <View style={styles.freshAddPill}>
              <Feather name="plus" size={14} color={theme.colors.textSecondary} />
            </View>
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
        style={styles.strip}
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
          onPress={() => {
            haptics.tap();
            onAddAccount();
          }}
          accessibilityRole="button"
          accessibilityLabel="Add an account"
          style={withPressed([styles.tile, styles.addTile, { width: Math.round(width * 0.72) }])}
        >
          <View style={styles.addIconCircle}>
            <Feather name="plus" size={15} color={theme.colors.textPrimary} />
          </View>
          <Text style={styles.addText}>Add</Text>
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
  const icon = accountIcon(a.type, !!a.investment);
  const hue = accountHue(a.type, accent);
  const isOwed = a.currentBalanceMinor < 0;

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onOpen(a);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${a.name}, ${accountTypeLabel(a)}. Open summary`}
      style={withPressedTint(accent, [styles.tile, { width }])}
    >
      <View style={styles.tileHead}>
        <View style={styles.iconChip}>
          <CategoryGlyph name={icon} size={13} color={hue} />
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {a.name}
        </Text>
      </View>
      <Amount
        minor={a.currentBalanceMinor}
        currency={a.currency}
        sensitive={a.type === 'savings'}
        style={[styles.balance, isOwed && styles.balanceOwed]}
        numberOfLines={1}
        adjustsFontSizeToFit
      />
    </Pressable>
  );
});

const styles = themedStyles(() =>
  StyleSheet.create({
    // A horizontally-scrolling strip of modern cards with gentle gaps between them.
    strip: { overflow: 'visible' },
    row: { paddingHorizontal: 16, gap: 10 },
    tile: {
      minHeight: 68,
      paddingVertical: 8,
      paddingHorizontal: 12,
      justifyContent: 'center',
      gap: 4,
      backgroundColor: theme.colors.home.surface,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
    },
    tileHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    iconChip: {
      width: 22,
      height: 22,
      borderRadius: 7,
      backgroundColor: theme.colors.home.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      flex: 1,
      minWidth: 0,
      fontFamily: theme.font.bodyMedium,
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.1,
      color: theme.colors.textSecondary,
    },
    balance: {
      fontFamily: theme.font.bodyBold,
      fontSize: 17,
      lineHeight: 22,
      letterSpacing: -0.3,
      fontVariant: ['tabular-nums'],
      color: theme.colors.textPrimary,
    },
    balanceOwed: { color: theme.colors.expenseText },
    addTile: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: theme.colors.home.control,
      borderStyle: 'dashed',
      borderColor: theme.colors.home.edge,
    },
    addIconCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
    },
    addText: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    wrap: { marginHorizontal: 16 },
    fresh: {
      backgroundColor: theme.colors.home.surface,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      padding: 16,
      gap: 6,
      shadowColor: theme.colors.ink,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
    },
    freshHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    freshHeadLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    freshIconChip: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    freshTitle: {
      fontFamily: theme.font.bodyBold,
      fontSize: 15,
      color: theme.colors.textPrimary,
    },
    freshAddPill: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    freshBig: {
      fontFamily: theme.font.roundedBold,
      fontSize: 19,
      lineHeight: 24,
      letterSpacing: -0.3,
      color: theme.colors.textPrimary,
    },
    freshSub: {
      fontFamily: theme.font.body,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textMuted,
    },
  })
);

import { View, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { accountHue, accountIcon, accountTypeLabel } from '@/lib/account';
import { shade } from '@/lib/color';
import { withPressed } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { Section } from '@/components/Section';
import type { Account } from '@/types';

/** Accounts shown in the row; the rest are one tap away under "View all". */
const PREVIEW_ACCOUNTS = 8;
const TILE_WIDTH = 148;
const TILE_GAP = 10;

/**
 * A row of account tiles you swipe sideways (everyday accounts first, then savings), each with its own currency
 * and savings privacy, ending in an "Add account" tile.
 */
export function HomeAccounts({
  accounts,
  onOpenAccounts,
  onOpenAccount,
  onAddAccount,
}: {
  accounts: Account[];
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
            <Text style={styles.freshTitle}>Accounts</Text>
            <Feather name="plus" size={17} color={theme.colors.textSecondary} />
          </View>
          <Text style={styles.freshBig}>A fresh start</Text>
          <Text style={styles.freshSub}>Add a bank account, cash or wallet to get started.</Text>
        </View>
      </Pressable>
    );
  }
  const savings = accounts.filter((a) => a.type === 'savings');
  const everyday = accounts.filter((a) => a.type !== 'savings');
  const preview = [...everyday, ...savings].slice(0, PREVIEW_ACCOUNTS);
  // Bigger text needs a wider tile for a balance to stay on one line.
  const width = Math.round(TILE_WIDTH * Math.min(1.3, Math.max(1, fontScale)));
  return (
    <Section compact title="Accounts" onSeeAll={onOpenAccounts} actionLabel="View all">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={width + TILE_GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.row}
      >
        {preview.map((a) => {
          const hue = accountHue(a.type, accent);
          return (
            <Pressable
              key={a.id}
              onPress={() => onOpenAccount(a)}
              accessibilityRole="button"
              accessibilityLabel={`${a.name}, ${accountTypeLabel(a)}. Open summary`}
              style={withPressed([styles.tile, { width }])}
            >
              <View style={[styles.icon, { backgroundColor: shade(hue, 88) }]}>
                <MaterialCommunityIcons
                  name={accountIcon(a.type) as McIconName}
                  size={18}
                  color={shade(hue, 30, 10)}
                />
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {a.name}
              </Text>
              <Text style={styles.kind} numberOfLines={1}>
                {accountTypeLabel(a)}
              </Text>
              <Amount
                minor={a.currentBalanceMinor}
                currency={a.currency}
                sensitive={a.type === 'savings'}
                style={styles.balance}
                numberOfLines={1}
                adjustsFontSizeToFit
              />
            </Pressable>
          );
        })}
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

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 4, gap: TILE_GAP },
  tile: {
    minHeight: 112,
    borderRadius: 24,
    padding: 14,
    backgroundColor: theme.colors.surface,
    boxShadow: '0px 1px 2px rgba(18,19,15,0.04), 0px 10px 24px -14px rgba(18,19,15,0.16)',
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 10, fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  kind: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  balance: {
    marginTop: 2,
    fontFamily: theme.font.bodyBold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    boxShadow: 'none',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderSoft,
  },
  addText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  wrap: { marginHorizontal: 16 },
  fresh: { padding: 18, gap: 4, borderRadius: 28, backgroundColor: theme.colors.surface },
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

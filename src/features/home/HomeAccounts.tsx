import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { accountHue, accountIcon } from '@/lib/account';
import { shade } from '@/lib/color';
import { withPressed } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { Section } from '@/components/Section';
import type { Account } from '@/types';

/** "bank", "credit card", "savings · tracked": what kind of account, as the old account cards said it. */
function accountTypeLabel(a: Account): string {
  return a.investment ? 'savings · tracked' : a.type.replace('_', ' ');
}

/** Up to six accounts in the Home grid, with per-account currency and savings privacy. */
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
  const { width, fontScale } = useWindowDimensions();
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
          <Text style={styles.big}>A fresh start</Text>
          <Text style={styles.sub}>Add a bank account, cash or wallet to get started.</Text>
        </Glass>
      </Pressable>
    );
  }
  const savings = accounts.filter((a) => a.type === 'savings');
  const everyday = accounts.filter((a) => a.type !== 'savings');
  const preview = [...everyday, ...savings].slice(0, 6);
  const rows: Account[][] = [];
  const columns = fontScale > 1.2 ? 1 : width < 360 ? 2 : 3;
  for (let i = 0; i < preview.length; i += columns) rows.push(preview.slice(i, i + columns));
  return (
    <Section compact title="Accounts" onSeeAll={onOpenAccounts} actionLabel="View all">
      <View style={styles.wrap}>
        <Glass radius={24} style={[styles.groupedAccounts, cardSurface.neutral]}>
          {rows.map((accounts, index) => (
            <View
              key={index}
              style={[
                styles.accountGrid,
                index > 0 && styles.accountGridDivider,
                columns === 1 && { flexDirection: 'column' },
              ]}
            >
              {accounts.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => onOpenAccount(a)}
                  accessibilityRole="button"
                  accessibilityLabel={`${a.name}, ${accountTypeLabel(a)}. Open summary`}
                  style={withPressed([styles.accountCard, columns === 1 && styles.accountCardWide])}
                >
                  <View style={[styles.accountHead, columns === 1 && { flex: 1 }]}>
                    <View
                      style={[
                        styles.chipIcon,
                        styles.compactIcon,
                        { backgroundColor: shade(accountHue(a.type, accent), 88) },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={accountIcon(a.type) as McIconName}
                        size={16}
                        color={shade(accountHue(a.type, accent), 30, 10)}
                      />
                    </View>
                    <Text style={styles.accountName} numberOfLines={2}>
                      {a.name}
                    </Text>
                  </View>
                  <View style={[styles.accountCopy, columns === 1 && styles.accountCopyWide]}>
                    <Amount
                      minor={a.currentBalanceMinor}
                      currency={a.currency}
                      sensitive={a.type === 'savings'}
                      style={styles.listAmount}
                    />
                  </View>
                </Pressable>
              ))}
              {Array.from({ length: columns - accounts.length }, (_, i) => (
                <View key={`empty-${i}`} style={{ flex: 1 }} />
              ))}
            </View>
          ))}
        </Glass>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  groupedAccounts: { paddingHorizontal: 14, paddingVertical: 8, gap: 4 },
  accountGrid: { flexDirection: 'row', gap: 10 },
  accountCard: { flex: 1, minWidth: 0, alignItems: 'flex-start', paddingVertical: 6, gap: 5, minHeight: 68 },
  accountHead: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, alignSelf: 'stretch' },
  compactIcon: { width: 26, height: 26, borderRadius: 9 },
  accountGridDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
    paddingTop: 6,
  },
  accountCardWide: { flexDirection: 'row', minHeight: 64, gap: 10 },
  accountCopy: { alignSelf: 'stretch', alignItems: 'flex-start', gap: 3 },
  accountCopyWide: { flexShrink: 1, alignItems: 'flex-start', alignSelf: 'auto' },
  accountName: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'left',
    color: theme.colors.textPrimary,
  },
  listAmount: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
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
  chipIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});

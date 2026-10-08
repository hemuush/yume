import { View, Pressable, StyleSheet, Animated } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { Glass, GLASS } from '@/components/Glass';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { accountHue, accountIcon } from '@/lib/account';
import { shade } from '@/lib/color';
import { usePressScale } from '@/lib/usePressScale';
import { withPressed } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import type { BudgetProgress } from '@/db/budgets';
import type { Account } from '@/types';
import type { Upcoming, UpcomingItem } from './HomeGlance';

type Tone = 'ok' | 'warn' | 'bad' | 'plain';

/** A small status tag: green all right, amber soon or close, red late or over. */
function Tag({ tone, children }: { tone: Tone; children: string }) {
  return (
    <View style={[styles.tag, styles[`tag_${tone}`]]}>
      <Text style={[styles.tagText, styles[`tagText_${tone}`]]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

function Tile({
  title,
  onPress,
  label,
  wide = false,
  children,
}: {
  title: string;
  onPress: () => void;
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={wide ? styles.wide : styles.half}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={animatedStyle}>
        <Glass radius={22} style={styles.tile}>
          <View style={styles.tileHead}>
            <Text style={styles.tileTitle}>{title}</Text>
            <Feather name="arrow-up-right" size={17} color={theme.colors.textSecondary} />
          </View>
          {children}
        </Glass>
      </Animated.View>
    </Pressable>
  );
}

/** The one thing to show in Coming up: the first thing due (pinned first), else the next one after the week. */
function nextDue(upcoming: Upcoming): UpcomingItem | null {
  return upcoming.items[0] ?? upcoming.next;
}

/**
 * The Accounts tile: its heading is the button to the full list, and each account chip opens that account,
 * so a screen reader can reach every chip (a chip inside a pressable tile would be folded into the tile).
 */
function AccountsTile({
  accounts,
  currency,
  onOpenAccounts,
  onOpenAccount,
}: {
  accounts: Account[];
  currency: string;
  onOpenAccounts: () => void;
  onOpenAccount: (account: Account) => void;
}) {
  const { accent } = useAccent();
  // Money in hand, in the default currency only, so two currencies are never added together.
  const inHand = accounts.filter(
    (a) => (a.type === 'bank' || a.type === 'cash' || a.type === 'wallet') && a.currency === currency
  );
  const inHandMinor = inHand.reduce((s, a) => s + a.currentBalanceMinor, 0);
  return (
    <View style={styles.wide}>
      <Glass radius={22} style={styles.tile}>
        <Pressable
          onPress={onOpenAccounts}
          hitSlop={8}
          style={withPressed(styles.tileHead)}
          accessibilityRole="button"
          accessibilityLabel={`Accounts, ${accounts.length}. See all`}
        >
          <Text style={styles.tileTitle}>Accounts</Text>
          <Feather name="arrow-up-right" size={17} color={theme.colors.textSecondary} />
        </Pressable>
        {inHand.length > 0 && (
          <>
            <Amount minor={inHandMinor} currency={currency} style={styles.big} numberOfLines={1} />
            <Text style={styles.sub} numberOfLines={1}>
              In bank, cash and wallets
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
                accessibilityLabel={`${a.name}. Open summary`}
              >
                <View style={[styles.chipIcon, { backgroundColor: shade(hue, 88) }]}>
                  <MaterialCommunityIcons
                    name={accountIcon(a.type) as McIconName}
                    size={13}
                    color={shade(hue, 30, 10)}
                  />
                </View>
                <Text style={styles.chipName} numberOfLines={1}>
                  {a.name}
                </Text>
                <Amount
                  minor={a.currentBalanceMinor}
                  currency={a.currency}
                  sensitive={a.type === 'savings'}
                  style={styles.chipAmount}
                  numberOfLines={1}
                />
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

/**
 * Home's bento: Coming up and Budgets side by side, Accounts across the bottom. Each tile shows one figure
 * and a small tag, and opens its full screen; an account chip opens that account's summary.
 */
export function HomeBento({
  upcoming,
  budgets,
  accounts,
  currency,
  onOpenUpcoming,
  onOpenBudgets,
  onOpenAccounts,
  onOpenAccount,
  onAddAccount,
}: {
  upcoming: Upcoming;
  budgets: BudgetProgress[];
  accounts: Account[];
  /** The default currency: the in-hand total counts only accounts in it. */
  currency: string;
  onOpenUpcoming: () => void;
  onOpenBudgets: () => void;
  onOpenAccounts: () => void;
  onOpenAccount: (account: Account) => void;
  onAddAccount: () => void;
}) {
  const due = nextDue(upcoming);
  const dueTone: Tone = !due ? 'ok' : due.urgent ? 'bad' : due.pinned ? 'warn' : 'plain';

  const over = budgets.filter((b) => b.overBudget).length;
  const close = budgets.filter((b) => !b.overBudget && b.percentUsed >= 80).length;
  const onTrack = budgets.length - over;

  return (
    <View style={styles.grid}>
      <Tile
        title="Coming up"
        onPress={onOpenUpcoming}
        label={
          due
            ? `Coming up: ${due.title}, ${formatMoney(due.amountMinor)}, ${due.subtitle}`
            : 'Coming up: nothing due'
        }
      >
        <Text style={styles.big} numberOfLines={1} adjustsFontSizeToFit>
          {due ? formatMoney(due.amountMinor) : 'All clear'}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {due ? due.title : 'Nothing due this week'}
        </Text>
        <Tag tone={dueTone}>{due ? due.subtitle : 'Quiet week'}</Tag>
      </Tile>

      <Tile
        title="Budgets"
        onPress={onOpenBudgets}
        label={
          budgets.length > 0 ? `Budgets: ${onTrack} of ${budgets.length} on track` : 'Budgets: set one up'
        }
      >
        <Text style={styles.big} numberOfLines={1}>
          {budgets.length > 0 ? `${onTrack} of ${budgets.length}` : 'None yet'}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {budgets.length > 0 ? 'on track' : 'Set a monthly limit'}
        </Text>
        {budgets.length > 0 && (
          <Tag tone={over > 0 ? 'bad' : close > 0 ? 'warn' : 'ok'}>
            {over > 0 ? `${over} over` : close > 0 ? `${close} close` : 'All good'}
          </Tag>
        )}
      </Tile>

      {accounts.length > 0 ? (
        <AccountsTile
          accounts={accounts}
          currency={currency}
          onOpenAccounts={onOpenAccounts}
          onOpenAccount={onOpenAccount}
        />
      ) : (
        <Tile title="Accounts" wide onPress={onAddAccount} label="Add an account">
          <Text style={styles.big}>Add one</Text>
          <Text style={styles.sub}>A bank account, cash, or a UPI wallet</Text>
        </Tile>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 20 },
  half: { flexBasis: '47%', flexGrow: 1, minWidth: 0 },
  wide: { flexBasis: '100%' },
  tile: { padding: 14, gap: 4, minHeight: 132 },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  tileTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  big: {
    fontFamily: theme.font.body,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.5,
    color: theme.colors.textPrimary,
  },
  sub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textMuted },
  tag: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    minHeight: 22,
    justifyContent: 'center',
    borderRadius: 11,
    maxWidth: '100%',
  },
  tag_ok: { backgroundColor: theme.colors.incomeTint },
  tag_warn: { backgroundColor: theme.colors.dueTint },
  tag_bad: { backgroundColor: theme.colors.expenseTint },
  tag_plain: { backgroundColor: GLASS.fillStrong },
  tagText: { fontFamily: theme.font.bodyBold, fontSize: 11 },
  tagText_ok: { color: theme.colors.incomeText },
  tagText_warn: { color: theme.colors.dueInk },
  tagText_bad: { color: theme.colors.expenseText },
  tagText_plain: { color: theme.colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 16,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
    maxWidth: '100%',
  },
  chipIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chipName: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  chipAmount: { fontFamily: theme.font.monoBold, fontSize: 12, color: theme.colors.textSecondary },
});

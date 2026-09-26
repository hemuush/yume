import { useCallback, useState } from 'react';
import { View, Text, Pressable, Animated, ScrollView, Alert, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { listAccounts, countTransactions, listCategories } from '@/db/ledger';
import { listLoans } from '@/db/loans';
import { computeTrackedBalance } from '@/db/reports';
import { listPeople } from '@/db/people';
import { getDefaultCurrency } from '@/db/settings';
import {
  listBudgetsForMonth,
  deleteBudget,
  restoreBudget,
  periodMonthOf,
  BudgetProgress,
} from '@/db/budgets';
import { listSavingsGoals } from '@/db/savingsGoals';
import { listRecurringRules, setRecurringRuleActive } from '@/db/recurring';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { haptics } from '@/lib/haptics';
import { Account, Category, SavingsGoal, RecurringRule } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { FlatIconBadge } from '@/components/FlatIconBadge';
import { SettingsRowIcon } from '@/components/SettingsRowIcon';
import { Amount } from '@/components/Amount';
import { AddButton } from '@/components/AddButton';
import { SectionLabel } from '@/components/SectionLabel';
import { ActionSheet, ActionSheetItem } from '@/components/ActionSheet';
import { useUndoToast } from '@/components/UndoToast';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { NeoTile } from '@/components/NeoTile';
import { useFadeIn } from '@/lib/useFadeIn';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { styles } from './profile.styles';
import { ACCOUNT_ICON } from './profile.constants';
import { AddAccountModal } from './AddAccountModal';
import { AccountDetailModal } from './AccountDetailModal';
import { BudgetRow } from '@/features/budgets/BudgetRow';
import { AddBudgetModal } from '@/features/budgets/AddBudgetModal';
import { styles as budgetsStyles } from '@/features/budgets/budgets.styles';
import { GoalChip } from '@/features/goals/GoalChip';
import { AddGoalModal } from '@/features/goals/AddGoalModal';
import { GoalDetailModal } from '@/features/goals/GoalDetailModal';
import { ContributeModal } from '@/features/goals/ContributeModal';
import { RuleCard } from '@/features/recurring/RuleCard';

const AnimatedAccountPressable = Animated.createAnimatedComponent(Pressable);

// The sky-blue `primary` accent is too light at its own lightness to read
// as an icon stroke on its own pale tint — same fix QuickActionsRow and
// Add Transaction's type wash already apply to this exact colour.
const BUDGET_ICON_COLOR = shade(theme.colors.primary, 45, 8);

/** How many active recurring rules to show before "See all" takes over — rules can pile up over time in a way budgets/goals rarely do. */
const RECURRING_PREVIEW_CAP = 3;

/**
 * "Your money, in one place" — everything Profile already had (tracked
 * balance, stats, accounts), plus Budgets, Savings Goals, and Recurring
 * transactions, which used to live under Settings → Money even though
 * they're financial standing you check often, the same category as
 * Accounts, not one-time app configuration. Mirrors the split Accounts
 * already has: a compact preview on Home, a full manageable list here.
 */
export function YouSection() {
  const { show: showUndo } = useUndoToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [archivedAccounts, setArchivedAccounts] = useState<Account[]>([]);
  const [detailAccount, setDetailAccount] = useState<Account | null>(null);
  const [txCount, setTxCount] = useState(0);
  const [activeLoanCount, setActiveLoanCount] = useState(0);
  const [peopleCount, setPeopleCount] = useState(0);
  const [netWorth, setNetWorth] = useState(0);
  const [defaultCurrency, setDefaultCurrencyState] = useState('INR');
  const [hasOtherCurrency, setHasOtherCurrency] = useState(false);
  const [hasUntrackedAssetLoan, setHasUntrackedAssetLoan] = useState(false);
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  const accountsFadeStyle = useFadeIn([accounts]);

  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetProgress | null>(null);
  const [manageBudget, setManageBudget] = useState<BudgetProgress | null>(null);
  const [deleteBudgetBusy, setDeleteBudgetBusy] = useState(false);

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [addGoalVisible, setAddGoalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [contributingGoal, setContributingGoal] = useState<SavingsGoal | null>(null);

  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);

  const periodMonth = periodMonthOf();

  const loadYou = useCallback(async () => {
    const [accs, allAccs, txCountNow, loans, people, currency, budgetList, cats, goalList, rules] =
      await Promise.all([
        listAccounts(),
        listAccounts(true),
        // Only the count is shown — loading every row just to take .length
        // was the single heaviest query on this screen.
        countTransactions(),
        listLoans(),
        listPeople(),
        getDefaultCurrency(),
        listBudgetsForMonth(periodMonth),
        listCategories(),
        listSavingsGoals(),
        listRecurringRules(),
      ]);
    setAccounts(accs);
    setArchivedAccounts(allAccs.filter((a) => a.archived));
    setTxCount(txCountNow);
    setPeopleCount(people.length);
    setActiveLoanCount(loans.filter((l) => l.status === 'active').length);
    setDefaultCurrencyState(currency);
    setHasOtherCurrency(accs.some((a) => a.currency !== currency));
    // Shared with Home so the two screens can never show a different
    // headline number — a not-yet-closed loan with a tracked asset value
    // nets to its real equity here, a defaulted loan still counts, and
    // only a fully 'closed' loan drops out.
    setNetWorth(computeTrackedBalance({ accounts: accs, loans, people, defaultCurrency: currency }));
    setHasUntrackedAssetLoan(
      loans.some((l) => l.status !== 'closed' && l.direction === 'borrowed' && !l.assetValueMinor)
    );
    setBudgets(budgetList);
    setCategories(cats);
    setGoals(goalList.filter((g) => !g.archived));
    setRecurringRules(rules);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { loaded, loadError, reload: load } = useScreenLoad(loadYou);

  // Every balance on this screen is shown as whole rupees. Each account row
  // rounds its own balance, and the ACCOUNT BALANCE stat is the sum of those
  // rounded rows (default-currency accounts only) so the list always adds up
  // to the number shown above it.
  const dispAccountBalance = (a: Account) => roundedMinor(a.currentBalanceMinor);
  const totalBalance = accounts
    .filter((a) => a.currency === defaultCurrency)
    .reduce((sum, a) => sum + dispAccountBalance(a), 0);

  // Every expense category, parents and subcategories alike — see
  // AddBudgetModal's own comment for why this isn't pre-filtered down to
  // "doesn't already have a budget this month".
  const expenseCategories = categories.filter((c) => c.kind === 'expense');

  const onDeleteBudget = async (progress: BudgetProgress) => {
    if (deleteBudgetBusy) return;
    setDeleteBudgetBusy(true);
    try {
      const snapshot = await deleteBudget(progress.budget.id);
      haptics.warn();
      await load();
      showUndo(`Deleted "${progress.categoryName}" budget`, async () => {
        await restoreBudget(snapshot);
        await load();
      });
    } catch (e: any) {
      Alert.alert('Could not delete budget', String(e?.message ?? e));
    } finally {
      setDeleteBudgetBusy(false);
    }
  };

  const budgetManageItems: ActionSheetItem[] = manageBudget
    ? [
        {
          key: 'delete',
          label: 'Delete',
          icon: 'trash-2',
          destructive: true,
          onPress: () => onDeleteBudget(manageBudget),
        },
      ]
    : [];

  const accountNameFor = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
  const categoryNameFor = (id: string | null) =>
    (id ? categories.find((c) => c.id === id)?.name : undefined) ?? '—';

  const togglePause = async (rule: RecurringRule) => {
    try {
      await setRecurringRuleActive(rule.id, !rule.active);
      await load();
    } catch {
      // Same reasoning as the dedicated Recurring screen — a failed toggle
      // just leaves the switch as it was; nothing destructive to warn about.
    }
  };
  const visibleRules = recurringRules.filter((r) => r.active).slice(0, RECURRING_PREVIEW_CAP);
  const hiddenRuleCount = recurringRules.filter((r) => r.active).length - visibleRules.length;

  if (!loaded && !loadError) {
    // Not a full-screen gate — the shell's header, identity, and tab
    // control above this are already visible; this only fills the space
    // this section itself would otherwise occupy while it loads.
    return (
      <View style={{ paddingVertical: 40, alignItems: 'center' }}>
        <ActivityIndicator color={theme.colors.ink} />
      </View>
    );
  }

  return (
    <>
      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Couldn't load your data</Text>
          <Text style={styles.errorDetail}>{loadError}</Text>
        </View>
      )}

      <NeoTile style={styles.netWorthCard}>
        <Text style={styles.netWorthLabel}>TRACKED BALANCE</Text>
        <Text style={styles.netWorthValue} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(roundedMinor(netWorth))}
        </Text>
        <Text style={styles.netWorthHint}>
          Cash + loans + people{hasOtherCurrency ? ' · default-currency accounts only' : ''}.
          {hasUntrackedAssetLoan
            ? " A loan's own asset (a home, a vehicle) isn't included unless you record its value on that loan — until then this can run negative for a completely normal loan."
            : ' Loans with a tracked asset value count their real equity here, not just the debt.'}
        </Text>
      </NeoTile>

      <View style={styles.statsGrid}>
        <Stat value={formatMoney(totalBalance)} label="ACCOUNT BALANCE" icon="wallet-outline" />
        <Stat value={String(txCount)} label="ENTRIES" icon="format-list-bulleted" />
        <Stat value={String(activeLoanCount)} label="ACTIVE LOANS" icon="bank-outline" />
        <Stat value={String(peopleCount)} label="PEOPLE" icon="account-group-outline" />
      </View>

      <Pressable
        onPress={() => router.push('/garden')}
        style={styles.gardenLink}
        accessibilityRole="button"
        accessibilityLabel="Suu's Garden"
      >
        <SettingsRowIcon name="sprout-outline" backgroundColor={theme.colors.secondary} />
        <Text style={styles.gardenLinkText}>Suu's Garden — see what's grown</Text>
        <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Accounts</Text>
        <AddButton onPress={() => setAddAccountVisible(true)} label="+ Account" />
      </View>
      {accounts.length === 0 ? (
        <EmptyState title="No accounts yet" subtitle="Tap + Account to create one." />
      ) : (
        accounts.map((acc) => (
          <Animated.View key={acc.id} style={[styles.accountCardWrap, accountsFadeStyle]}>
            <NeoTile style={styles.accountCard}>
              <AnimatedAccountPressable onPress={() => setDetailAccount(acc)} style={styles.accountCardInner}>
                <FlatIconBadge name={ACCOUNT_ICON[acc.type] ?? 'credit-card'} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.accountName}>{acc.name}</Text>
                  <Text style={styles.accountType}>{acc.type.replace('_', ' ')}</Text>
                </View>
                <Amount
                  minor={dispAccountBalance(acc)}
                  currency={acc.currency}
                  sensitive={acc.type === 'savings'}
                  style={[styles.accountBalance, acc.currentBalanceMinor < 0 && styles.negative]}
                />
              </AnimatedAccountPressable>
            </NeoTile>
          </Animated.View>
        ))
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Budgets</Text>
        <AddButton
          onPress={() => {
            setEditingBudget(null);
            setBudgetModalVisible(true);
          }}
          label="+ Add"
        />
      </View>
      {budgets.length === 0 ? (
        <SectionEmptyCard
          icon="clock"
          iconBg={theme.colors.primaryTint}
          iconColor={BUDGET_ICON_COLOR}
          title="No budgets yet"
          subtitle="A monthly limit per category, so you can see how close you are."
          ctaLabel="+ Set a budget"
          ctaColor={theme.colors.primary}
          onPress={() => {
            setEditingBudget(null);
            setBudgetModalVisible(true);
          }}
        />
      ) : (
        <View style={budgetsStyles.listCard}>
          {budgets.map((progress, i) => (
            <BudgetRow
              key={progress.budget.id}
              progress={progress}
              divider={i > 0}
              onPress={() => {
                setEditingBudget(progress);
                setBudgetModalVisible(true);
              }}
              onLongPress={() => setManageBudget(progress)}
            />
          ))}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Savings goals</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable
            onPress={() => router.push('/whatif')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="What if — try a change"
            style={styles.seeAll}
          >
            <Text style={styles.seeAllText}>What if?</Text>
          </Pressable>
          <AddButton onPress={() => setAddGoalVisible(true)} label="+ Add" />
        </View>
      </View>
      {goals.length === 0 ? (
        <SectionEmptyCard
          icon="flag"
          iconBg={theme.colors.secondaryTint}
          iconColor={theme.colors.income}
          title="No savings goals yet"
          subtitle="A trip, an emergency fund, a big purchase — something to aim at."
          ctaLabel="+ Set a goal"
          ctaColor={theme.colors.secondary}
          onPress={() => setAddGoalVisible(true)}
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.goalStrip}
        >
          {goals.map((goal) => (
            <GoalChip key={goal.id} goal={goal} onPress={() => setEditingGoal(goal)} />
          ))}
        </ScrollView>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recurring</Text>
        <Pressable
          onPress={() => router.push('/recurring')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="See all — Recurring"
          style={styles.seeAll}
        >
          <Text style={styles.seeAllText}>See all</Text>
          <Feather name="arrow-right" size={13} color={theme.colors.textSecondary} />
        </Pressable>
      </View>
      {visibleRules.length === 0 ? (
        <EmptyState
          title="No recurring transactions"
          subtitle="Rent, subscriptions, salary — logged automatically."
        />
      ) : (
        // RuleCard's own style carries no horizontal margin — the dedicated
        // Recurring screen supplies that itself via its scroll container's
        // padding, but this preview list sits directly in Profile's, which
        // doesn't. Without this wrapper the cards ran edge-to-edge, the one
        // un-inset block on the whole screen.
        <View style={{ marginHorizontal: 20 }}>
          {visibleRules.map((rule, i) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              accountName={accountNameFor}
              categoryName={categoryNameFor}
              index={i}
              onPress={() => router.push('/recurring')}
              onTogglePause={() => togglePause(rule)}
            />
          ))}
          {hiddenRuleCount > 0 && (
            <Pressable
              onPress={() => router.push('/recurring')}
              style={{ alignSelf: 'center', marginTop: 4 }}
            >
              <Text style={styles.seeAllLink}>+{hiddenRuleCount} more</Text>
            </Pressable>
          )}
        </View>
      )}

      {archivedAccounts.length > 0 && (
        <>
          <SectionLabel color={theme.colors.textMuted} tint={theme.colors.surfaceAlt}>
            ARCHIVED ACCOUNTS
          </SectionLabel>
          {archivedAccounts.map((acc) => (
            <View key={acc.id} style={[styles.accountCardWrap, styles.archivedCard]}>
              <NeoTile style={styles.accountCard}>
                <Pressable onPress={() => setDetailAccount(acc)} style={styles.accountCardInner}>
                  <FlatIconBadge name={ACCOUNT_ICON[acc.type] ?? 'credit-card'} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.accountName}>{acc.name}</Text>
                    <Text style={styles.accountType}>{acc.type.replace('_', ' ')} · archived</Text>
                  </View>
                  <Amount
                    minor={dispAccountBalance(acc)}
                    currency={acc.currency}
                    sensitive={acc.type === 'savings'}
                    style={styles.accountBalance}
                  />
                </Pressable>
              </NeoTile>
            </View>
          ))}
        </>
      )}

      <AddAccountModal
        visible={addAccountVisible}
        onClose={() => setAddAccountVisible(false)}
        onCreated={async () => {
          setAddAccountVisible(false);
          await load();
        }}
      />
      <AccountDetailModal
        account={detailAccount}
        onClose={() => setDetailAccount(null)}
        onChanged={async () => {
          setDetailAccount(null);
          await load();
        }}
      />

      <AddBudgetModal
        visible={budgetModalVisible}
        editing={editingBudget}
        categories={expenseCategories}
        onClose={() => {
          setBudgetModalVisible(false);
          setEditingBudget(null);
        }}
        onSaved={async () => {
          setBudgetModalVisible(false);
          setEditingBudget(null);
          await load();
        }}
      />
      <ActionSheet
        visible={!!manageBudget}
        onClose={() => setManageBudget(null)}
        title={manageBudget?.categoryName}
        items={budgetManageItems}
      />

      <AddGoalModal
        visible={addGoalVisible}
        accounts={accounts}
        onClose={() => setAddGoalVisible(false)}
        onCreated={async () => {
          setAddGoalVisible(false);
          await load();
        }}
      />
      <GoalDetailModal
        goal={editingGoal}
        accounts={accounts}
        onClose={() => setEditingGoal(null)}
        onChanged={async () => {
          setEditingGoal(null);
          await load();
        }}
      />
      <ContributeModal
        goal={contributingGoal}
        onClose={() => setContributingGoal(null)}
        onContributed={async () => {
          setContributingGoal(null);
          await load();
        }}
      />
    </>
  );
}

/**
 * A compact replacement for the shared `EmptyState` in exactly this one
 * spot — Budgets and Savings goals used to each show the same full-size
 * sleepy-Suu illustration back to back, ~90px of illustration plus padding
 * apiece, with the only way to act on it up in the header above. This
 * keeps a per-section icon (so the two don't read as the same screenshot
 * twice), and puts the call to action inside the card itself, in the same
 * dashed-button language Add Transaction's "+ Add to list" already uses.
 * Scoped to YouSection only — every other screen's empty state is
 * untouched.
 */
function SectionEmptyCard({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  ctaLabel,
  ctaColor,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaColor: string;
  onPress: () => void;
}) {
  return (
    <NeoTile style={styles.emptyCard}>
      <View style={styles.emptyCardRow}>
        <View style={[styles.emptyCardIcon, { backgroundColor: iconBg }]}>
          <Feather name={icon} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.emptyCardTitle}>{title}</Text>
          <Text style={styles.emptyCardSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Pressable
        onPress={onPress}
        style={[styles.emptyCardCta, { borderColor: ctaColor }]}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
      >
        <Text style={styles.emptyCardCtaText}>{ctaLabel}</Text>
      </Pressable>
    </NeoTile>
  );
}

function Stat({ value, label, icon }: { value: string; label: string; icon: string }) {
  const { accent, onAccent } = useAccent();
  return (
    <NeoTile style={styles.statCell}>
      <SettingsRowIcon name={icon} backgroundColor={accent} iconColor={onAccent} />
      <View style={styles.statText}>
        <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </NeoTile>
  );
}

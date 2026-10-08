import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listRecurringRules, setRecurringRuleActive } from '@/db/recurring';
import { listAccounts, listCategories } from '@/db/ledger';
import { getHiddenSubscriptionSuggestions, hideSubscriptionSuggestion } from '@/db/settings';
import { getSubscriptionSuggestions, subscriptionTotals, SubscriptionSuggestion } from '@/db/subscriptions';
import { RecurringHero } from '@/features/recurring/RecurringHero';
import { SuggestionsList } from '@/features/recurring/SuggestionsList';
import { SectionHead } from '@/features/recurring/SectionHead';
import { costShares, sortRunning } from '@/features/recurring/recurring.helpers';
import { NeoTile } from '@/components/NeoTile';
import { nextMonthlyDateAfter, toLocalIsoDate } from '@/lib/date';
import { Account, Category, RecurringRule } from '@/types';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { formatMoney } from '@/lib/money';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { theme } from '@/constants/theme';
import { styles } from '@/features/recurring/recurring.styles';
import { RuleRow } from '@/features/recurring/RuleRow';
import { RuleModal } from '@/features/recurring/RuleModal';
import { Skeleton } from '@/components/Skeleton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';
import { usePrivacy } from '@/theme/PrivacyContext';
import { isSavingsEntry } from '@/lib/privateSummary';
import { savingsAccountIdsOf } from '@/lib/account';
import { parentNameOf } from '@/lib/categoryLabel';

/**
 * Rent, subscriptions, salary: rules caught up on app open (runDueRecurringRules, src/db/recurring.ts, via
 * app/_layout.tsx). This screen only edits/pauses rules; their entries show in Transactions.
 */
export default function RecurringScreen() {
  const insets = useSafeAreaInsets();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [suggestions, setSuggestions] = useState<SubscriptionSuggestion[]>([]);
  // "Make recurring" on a suggestion: the rule form, filled in from it.
  const [fromSuggestion, setFromSuggestion] = useState<SubscriptionSuggestion | null>(null);
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  const loadRules = useCallback(async () => {
    const [r, allAccs, cats, hidden] = await Promise.all([
      listRecurringRules(),
      listAccounts(true),
      listCategories(),
      getHiddenSubscriptionSuggestions(),
    ]);
    // Archived accounts stay out, except one a rule still uses: editing that rule must keep it there, not
    // quietly move it to whichever account comes first.
    const inUse = new Set(r.flatMap((rule) => [rule.accountId, rule.toAccountId]));
    const accs = allAccs.filter((a) => !a.archived || inUse.has(a.id));
    setRules(r);
    // A suggestion is a nicety — if it fails, the rules still show.
    setSuggestions(await getSubscriptionSuggestions(hidden).catch(() => []));
    setAccounts(accs);
    setCategories(cats);
  }, []);
  // `loaded` keeps "Add an account first" (an `accounts.length === 0` check)
  // from flashing on every cold open before the DB has answered.
  const { loaded, loadError, reload: load } = useScreenLoad(loadRules);

  const { hideAmounts } = usePrivacy();
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const savingsIds = useMemo(() => savingsAccountIdsOf(accounts), [accounts]);
  const isHidden = (r: RecurringRule) => hideAmounts && isSavingsEntry(r, categoriesById, savingsIds);
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';

  const activeRules = useMemo(() => sortRunning(rules.filter((r) => r.active)), [rules]);
  const pausedRules = rules.filter((r) => !r.active);
  const visibleRules = rules.filter((r) => !isHidden(r));
  const shares = costShares(visibleRules, categoriesById);
  const nextDate = activeRules.reduce<string | null>(
    (min, r) => (min === null || r.nextRunDate < min ? r.nextRunDate : min),
    null
  );

  // Memoized: the form resets whenever its prefill changes identity, so a
  // fresh object each render would wipe whatever was typed.
  const rulePrefill = useMemo(
    () =>
      fromSuggestion
        ? {
            type: 'expense' as const,
            accountId: fromSuggestion.accountId,
            toAccountId: null,
            categoryId: fromSuggestion.categoryId,
            amountMinor: fromSuggestion.amountMinor,
            note: fromSuggestion.note,
            nextRunDate: nextMonthlyDateAfter(fromSuggestion.date, toLocalIsoDate(new Date())),
          }
        : undefined,
    [fromSuggestion]
  );

  const hideSuggestion = async (s: SubscriptionSuggestion) => {
    setSuggestions((prev) => prev.filter((x) => x.key !== s.key));
    await hideSubscriptionSuggestion(s.key).catch(() => {});
  };

  const togglePause = async (rule: RecurringRule) => {
    try {
      await setRecurringRuleActive(rule.id, !rule.active);
      await load();
    } catch (e) {
      showAlert("Couldn't update", errorMessage(e));
    }
  };

  return (
    <View style={styles.container}>
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}

        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: headerHeight + theme.layout.screenTopGap,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load recurring rules</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}
        {!loaded ? (
          <>
            <View style={[styles.card, { height: 118 }]}>
              <Skeleton width={110} height={10} radius={4} />
              <Skeleton width={150} height={26} radius={6} style={{ marginTop: 10 }} />
            </View>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.card}>
                <Skeleton width={140} height={13} radius={4} />
                <Skeleton width={100} height={10} radius={4} style={{ marginTop: 8 }} />
              </View>
            ))}
          </>
        ) : accounts.length === 0 ? (
          <EmptyState
            title="Add an account first"
            subtitle="A recurring entry needs an account to come out of, or go into."
          >
            <PrimaryButton title="Add an account" onPress={() => setAddAccountVisible(true)} />
          </EmptyState>
        ) : rules.length === 0 && suggestions.length === 0 ? (
          <EmptyState
            title="Nothing recurring yet"
            subtitle="Tap + to add rent, a subscription, or your salary."
          />
        ) : (
          <>
            {(activeRules.length > 0 || suggestions.length > 0) && (
              <RecurringHero totals={subscriptionTotals(visibleRules)} shares={shares} nextDate={nextDate} />
            )}
            {activeRules.length > 0 && (
              <>
                <SectionHead title="Running" note={activeRules.length > 1 ? 'Biggest first' : undefined} />
                <NeoTile style={styles.list}>
                  {activeRules.map((rule, i) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      category={rule.categoryId ? categoriesById.get(rule.categoryId) : undefined}
                      parentName={parentNameOf(rule.categoryId, categoriesById)}
                      masked={isHidden(rule)}
                      accountName={accountName}
                      index={i}
                      onPress={() => setEditingRule(rule)}
                      onTogglePause={() => togglePause(rule)}
                    />
                  ))}
                </NeoTile>
                <Text style={styles.footnote}>
                  Yume logs these on schedule. They show up in Activity like any entry you typed.
                </Text>
              </>
            )}
            <SuggestionsList
              // A savings or investment charge (an SIP) shows its amount: left out while those are hidden.
              suggestions={hideAmounts ? suggestions.filter((s) => !s.isSensitive) : suggestions}
              onMakeRecurring={setFromSuggestion}
              onHide={hideSuggestion}
            />
            {pausedRules.length > 0 && (
              <>
                <SectionHead
                  title="Paused"
                  note={`${pausedRules.length} ${pausedRules.length === 1 ? 'rule' : 'rules'}`}
                />
                <NeoTile style={styles.list}>
                  {pausedRules.map((rule, i) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      category={rule.categoryId ? categoriesById.get(rule.categoryId) : undefined}
                      parentName={parentNameOf(rule.categoryId, categoriesById)}
                      masked={isHidden(rule)}
                      accountName={accountName}
                      index={i}
                      onPress={() => setEditingRule(rule)}
                      onTogglePause={() => togglePause(rule)}
                      muted
                    />
                  ))}
                </NeoTile>
              </>
            )}
          </>
        )}
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        collapse={collapse}
        summary={
          visibleRules.length > 0 ? (
            <HeaderSummary
              figure={formatMoney(subscriptionTotals(visibleRules).monthlyMinor)}
              rest="a month"
              dot={theme.colors.slice.free}
            />
          ) : undefined
        }
        title="Recurring"
        showBack
        hideUser
        actions={<AddButton onPress={() => setModalVisible(true)} disabled={accounts.length === 0} />}
      />

      <RuleModal
        visible={modalVisible || !!editingRule || !!fromSuggestion}
        editing={editingRule}
        accounts={accounts}
        categories={categories}
        prefill={rulePrefill}
        onClose={() => {
          setModalVisible(false);
          setEditingRule(null);
          setFromSuggestion(null);
        }}
        onSaved={async () => {
          setModalVisible(false);
          setEditingRule(null);
          setFromSuggestion(null);
          await load();
        }}
        onDeleted={async () => {
          setEditingRule(null);
          await load();
        }}
      />
      <AddAccountModal
        visible={addAccountVisible}
        onClose={() => setAddAccountVisible(false)}
        onCreated={async () => {
          setAddAccountVisible(false);
          await load();
        }}
      />
    </View>
  );
}

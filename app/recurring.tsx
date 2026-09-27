import { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listRecurringRules, setRecurringRuleActive } from '@/db/recurring';
import { listAccounts, listCategories } from '@/db/ledger';
import { getHiddenSubscriptionSuggestions, hideSubscriptionSuggestion } from '@/db/settings';
import { getSubscriptionSuggestions, subscriptionTotals, SubscriptionSuggestion } from '@/db/subscriptions';
import { SubscriptionsSection } from '@/features/recurring/SubscriptionsSection';
import { nextMonthlyDateAfter, toLocalIsoDate } from '@/lib/date';
import { Account, Category, RecurringRule } from '@/types';
import { AppHeader } from '@/components/AppHeader';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { theme } from '@/constants/theme';
import { styles } from '@/features/recurring/recurring.styles';
import { RuleCard } from '@/features/recurring/RuleCard';
import { RuleModal } from '@/features/recurring/RuleModal';
import { Skeleton } from '@/components/Skeleton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { errorMessage } from '@/lib/errorMessage';

/**
 * Rent, subscriptions, salary — anything that happens on its own schedule
 * without needing a fresh manual entry every time. Each active rule is
 * caught up automatically on app open (src/db/recurring.ts's
 * runDueRecurringRules, wired into app/_layout.tsx) — this screen is purely
 * for defining/editing/pausing rules, not for the transactions they create
 * (those show up as perfectly ordinary entries on the Transactions tab).
 */
export default function RecurringScreen() {
  const insets = useSafeAreaInsets();
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
    const [r, accs, cats, hidden] = await Promise.all([
      listRecurringRules(),
      listAccounts(),
      listCategories(),
      getHiddenSubscriptionSuggestions(),
    ]);
    setRules(r);
    // A suggestion is a nicety — if it fails, the rules still show.
    setSuggestions(await getSubscriptionSuggestions(hidden).catch(() => []));
    setAccounts(accs);
    setCategories(cats);
  }, []);
  // `loaded` keeps "Add an account first" (an `accounts.length === 0` check)
  // from flashing on every cold open before the DB has answered.
  const { loaded, loadError, reload: load } = useScreenLoad(loadRules);

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—';

  const activeRules = rules.filter((r) => r.active);
  const pausedRules = rules.filter((r) => !r.active);

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
      Alert.alert("Couldn't update", errorMessage(e));
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Recurring"
        showBack
        right={<AddButton onPress={() => setModalVisible(true)} disabled={accounts.length === 0} />}
      />

      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Couldn't load recurring rules</Text>
          <Text style={styles.errorDetail}>{loadError}</Text>
        </View>
      )}

      <Text style={styles.introText}>
        Set up something once (rent, a subscription, salary) and Yume logs it automatically on schedule — it
        shows up in Activity exactly like any entry you typed in yourself.
      </Text>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: theme.layout.screenTopGap,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        {!loaded ? (
          <>
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
            <SubscriptionsSection
              totals={subscriptionTotals(rules)}
              suggestions={suggestions}
              onMakeRecurring={setFromSuggestion}
              onHide={hideSuggestion}
              hasRunning={activeRules.length > 0}
            />
            {activeRules.map((rule, i) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                accountName={accountName}
                categoryName={categoryName}
                index={i}
                onPress={() => setEditingRule(rule)}
                onTogglePause={() => togglePause(rule)}
              />
            ))}
            {pausedRules.length > 0 && (
              <>
                <Text style={styles.sectionDivider}>Paused</Text>
                {pausedRules.map((rule, i) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    accountName={accountName}
                    categoryName={categoryName}
                    index={i}
                    onPress={() => setEditingRule(rule)}
                    onTogglePause={() => togglePause(rule)}
                    muted
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

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

import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listRecurringRules, setRecurringRuleActive } from '@/db/recurring';
import { listAccounts, listCategories } from '@/db/ledger';
import { Account, Category, RecurringRule } from '@/types';
import { AppHeader } from '@/components/AppHeader';
import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { theme, ID_PALETTE } from '@/constants/theme';
import { styles } from '@/features/recurring/recurring.styles';
import { RuleCard } from '@/features/recurring/RuleCard';
import { RuleModal } from '@/features/recurring/RuleModal';

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
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, accs, cats] = await Promise.all([listRecurringRules(), listAccounts(), listCategories()]);
      setRules(r);
      setAccounts(accs);
      setCategories(cats);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(String(e?.message ?? e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—';

  const activeRules = rules.filter((r) => r.active);
  const pausedRules = rules.filter((r) => !r.active);

  const togglePause = async (rule: RecurringRule) => {
    try {
      await setRecurringRuleActive(rule.id, !rule.active);
      await load();
    } catch (e: any) {
      Alert.alert('Could not update', String(e?.message ?? e));
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
        shows up in Transactions exactly like any entry you typed in yourself.
      </Text>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        {accounts.length === 0 ? (
          <EmptyState
            title="Add an account first"
            subtitle="You need at least one account before setting up a recurring entry."
          />
        ) : rules.length === 0 ? (
          <EmptyState
            title="Nothing recurring yet"
            subtitle="Tap + to add rent, a subscription, or your salary."
          />
        ) : (
          <>
            {activeRules.map((rule, i) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                color={ID_PALETTE[i % ID_PALETTE.length]}
                accountName={accountName}
                categoryName={categoryName}
                onPress={() => setEditingRule(rule)}
                onTogglePause={() => togglePause(rule)}
              />
            ))}
            {pausedRules.length > 0 && (
              <>
                <Text style={styles.sectionDivider}>PAUSED</Text>
                {pausedRules.map((rule, i) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    color={ID_PALETTE[i % ID_PALETTE.length]}
                    accountName={accountName}
                    categoryName={categoryName}
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
        visible={modalVisible || !!editingRule}
        editing={editingRule}
        accounts={accounts}
        categories={categories}
        onClose={() => {
          setModalVisible(false);
          setEditingRule(null);
        }}
        onSaved={async () => {
          setModalVisible(false);
          setEditingRule(null);
          await load();
        }}
        onDeleted={async () => {
          setEditingRule(null);
          await load();
        }}
      />
    </View>
  );
}

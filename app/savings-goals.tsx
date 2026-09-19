import { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listAccounts } from '@/db/ledger';
import { listSavingsGoals } from '@/db/savingsGoals';
import { Account, SavingsGoal } from '@/types';
import { theme } from '@/constants/theme';
import { AppHeader, HeaderIconButton } from '@/components/AppHeader';
import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { Skeleton } from '@/components/Skeleton';
import { GoalCard } from '@/features/goals/GoalCard';
import { AddGoalModal } from '@/features/goals/AddGoalModal';
import { GoalDetailModal } from '@/features/goals/GoalDetailModal';
import { ContributeModal } from '@/features/goals/ContributeModal';
import { styles } from '@/features/goals/goals.styles';

export default function SavingsGoalsScreen() {
  const insets = useSafeAreaInsets();
  const [allGoals, setAllGoals] = useState<SavingsGoal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [contributingGoal, setContributingGoal] = useState<SavingsGoal | null>(null);

  const loadGoals = useCallback(async () => {
    const [goals, accs] = await Promise.all([listSavingsGoals(true), listAccounts()]);
    setAllGoals(goals);
    setAccounts(accs);
  }, []);
  const { loaded, loadError, reload: load } = useScreenLoad(loadGoals);

  const activeGoals = allGoals.filter((g) => !g.archived);
  const archivedGoals = allGoals.filter((g) => g.archived);
  const visibleGoals = showArchived ? archivedGoals : activeGoals;

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <AppHeader title="Savings Goals" showBack />
        <View style={{ paddingTop: 24 }}>
          {[0, 1].map((i) => (
            <View key={i} style={styles.card}>
              <View style={styles.cardTop}>
                <Skeleton width={46} height={46} circle radius={23} />
                <View>
                  <Skeleton width={120} height={13} radius={4} />
                  <Skeleton width={90} height={9} radius={4} style={{ marginTop: 5 }} />
                </View>
              </View>
              <Skeleton width={280} height={6} radius={3} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Savings Goals"
        showBack
        right={
          <>
            <HeaderIconButton
              icon={showArchived ? 'eye-off' : 'archive'}
              onPress={() => setShowArchived((v) => !v)}
              label={showArchived ? 'Hide archived goals' : 'Show archived goals'}
              badge={!showArchived && archivedGoals.length > 0}
            />
            <AddButton onPress={() => setAddVisible(true)} label="+ Add" />
          </>
        }
      />

      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load your goals</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        <View style={{ height: 12 }} />

        {visibleGoals.length === 0 ? (
          <EmptyState
            title={showArchived ? 'No archived goals' : 'No savings goals yet'}
            subtitle={
              showArchived
                ? undefined
                : 'Set something you’re saving toward — a trip, an emergency fund, a big purchase.'
            }
          />
        ) : (
          visibleGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onPress={() => setEditingGoal(goal)}
              onContribute={() => setContributingGoal(goal)}
            />
          ))
        )}
      </ScrollView>

      <AddGoalModal
        visible={addVisible}
        accounts={accounts}
        onClose={() => setAddVisible(false)}
        onCreated={async () => {
          setAddVisible(false);
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
    </View>
  );
}

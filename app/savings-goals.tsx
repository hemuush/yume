import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { MovingRow } from '@/components/MovingRow';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listAccounts } from '@/db/ledger';
import { listSavingsGoals, markGoalLetterRevealed } from '@/db/savingsGoals';
import { Account, SavingsGoal } from '@/types';
import { theme } from '@/constants/theme';
import { HeaderIconButton } from '@/components/AppHeader';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { usePrivacy } from '@/theme/PrivacyContext';
import { formatMoney } from '@/lib/money';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { Skeleton } from '@/components/Skeleton';
import { GoalCard } from '@/features/goals/GoalCard';
import { GoalsHero } from '@/features/goals/GoalsHero';
import { goalHues, summarizeGoals } from '@/features/goals/goalPlan';
import { toLocalIsoDate } from '@/lib/date';
import { AddGoalModal } from '@/features/goals/AddGoalModal';
import { GoalDetailModal } from '@/features/goals/GoalDetailModal';
import { ContributeModal } from '@/features/goals/ContributeModal';
import { GoalLetterReveal } from '@/features/goals/GoalLetterReveal';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { styles } from '@/features/goals/goals.styles';

export default function SavingsGoalsScreen() {
  const insets = useSafeAreaInsets();
  const { hideAmounts } = usePrivacy();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const [allGoals, setAllGoals] = useState<SavingsGoal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [contributingGoal, setContributingGoal] = useState<SavingsGoal | null>(null);

  // A goal following its account can hit its target with no tap here (transfer in, salary), so its sealed
  // letter opens the next time this screen loads — once, like a hand-filled goal.
  const [letterGoal, setLetterGoal] = useState<SavingsGoal | null>(null);

  const loadGoals = useCallback(async () => {
    const [goals, accs] = await Promise.all([listSavingsGoals(true), listAccounts()]);
    setAllGoals(goals);
    setAccounts(accs);
    const reached = goals.find(
      (g) =>
        g.tracksAccount &&
        !g.archived &&
        !!g.noteToSelf &&
        !g.letterRevealed &&
        g.currentAmountMinor >= g.targetAmountMinor
    );
    if (reached) {
      await markGoalLetterRevealed(reached.id);
      setLetterGoal(reached);
    }
  }, []);
  const { loaded, loadError, reload: load } = useScreenLoad(loadGoals);

  const activeGoals = allGoals.filter((g) => !g.archived);
  const archivedGoals = allGoals.filter((g) => g.archived);
  const visibleGoals = showArchived ? archivedGoals : activeGoals;
  const totals = summarizeGoals(activeGoals, toLocalIsoDate(new Date()));
  const hues = goalHues(allGoals);

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <SkyHeader title="Savings goals" showBack hideUser />
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
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load your goals</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        <View style={{ height: theme.layout.screenTopGap }} />

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
          <>
            {!showArchived && <GoalsHero totals={totals} />}
            {visibleGoals.map((goal) => (
              <MovingRow key={goal.id}>
                <GoalCard
                  goal={goal}
                  hue={hues[goal.id]}
                  accountName={accounts.find((a) => a.id === goal.linkedAccountId)?.name}
                  onPress={() => setEditingGoal(goal)}
                  onContribute={() => setContributingGoal(goal)}
                />
              </MovingRow>
            ))}
          </>
        )}
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        collapse={collapse}
        summary={
          !hideAmounts && activeGoals.length > 0 ? (
            <HeaderSummary
              figure={formatMoney(totals.savedMinor)}
              rest="saved"
              dot={theme.colors.slice.saved}
            />
          ) : undefined
        }
        title="Savings goals"
        showBack
        hideUser
        actions={
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

      {letterGoal && (
        <ModalSheet
          visible
          onClose={() => setLetterGoal(null)}
          footer={<PrimaryButton title="Nice, thanks Suu" onPress={() => setLetterGoal(null)} />}
        >
          <GoalLetterReveal
            goalName={letterGoal.name}
            note={letterGoal.noteToSelf ?? ''}
            targetAmountMinor={letterGoal.targetAmountMinor}
          />
        </ModalSheet>
      )}

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

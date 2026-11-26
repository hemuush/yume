import { planMoneyList } from '@/features/plan/plan.styles';
import { WorkspaceActions } from '@/features/plan/WorkspaceActions';
import { ScreenLoadError } from '@/components/ScreenLoadError';
import { Appear } from '@/components/Appear';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listAccounts } from '@/db/ledger';
import { listSavingsGoals, markGoalLetterRevealed } from '@/db/savingsGoals';
import { Account, SavingsGoal } from '@/types';
import { theme } from '@/constants/theme';
import { HeaderIconButton } from '@/components/AppHeader';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { SolidFade } from '@/components/SolidFade';
import { usePrivacy } from '@/theme/PrivacyContext';
import { formatMoney } from '@/lib/money';
import { useCollapsingHeader } from '@/hooks/useCollapsingHeader';
import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { useScreenLoad } from '@/hooks/useScreenLoad';
import { Skeleton } from '@/components/Skeleton';
import { GoalListRow } from '@/features/goals/GoalListRow';
import { reuseUnchanged } from '@/lib/stableData';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { useAccent } from '@/theme/AccentContext';
import { GoalsHero } from '@/features/goals/GoalsHero';
import { summarizeGoals } from '@/features/goals/goalPlan';
import { useToday } from '@/features/budgets/useToday';
import { errorMessage } from '@/lib/errorMessage';
import { AddGoalModal } from '@/features/goals/AddGoalModal';
import { GoalOverviewModal } from '@/features/goals/GoalOverviewModal';
import { ContributeModal } from '@/features/goals/ContributeModal';
import { GoalLetterReveal } from '@/features/goals/GoalLetterReveal';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { styles } from '@/features/goals/goals.styles';
import { showAlert } from '@/components/AppDialog';

// The totals card is drawn again only when the totals change, not for a sheet opening.
const Totals = memo(GoalsHero);

export default function GoalsWorkspace({
  embedded = false,
  refreshToken,
  onChanged,
  fallback,
}: {
  embedded?: boolean;
  refreshToken?: object;
  onChanged?: () => Promise<void>;
  fallback?: React.ReactNode;
} = {}) {
  const insets = useSafeAreaInsets();
  const { hideAmounts } = usePrivacy();
  const { accent, secondary } = useAccent();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const [allGoals, setAllGoals] = useState<SavingsGoal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  // What is held, so a reload that found nothing new sets no state, and a goal that did not change stays the same object
  // (its row is not drawn again).
  const heldGoals = useRef<SavingsGoal[]>([]);
  const heldAccounts = useRef<Account[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [contributingGoal, setContributingGoal] = useState<SavingsGoal | null>(null);

  // A goal following its account can hit its target with no tap here (transfer in, salary), so its sealed
  // letter opens the next time this screen loads — once, like a hand-filled goal.
  const [letterGoal, setLetterGoal] = useState<SavingsGoal | null>(null);
  const [deferLetters, setDeferLetters] = useState(false);
  const [letterError, setLetterError] = useState<string | null>(null);
  const [letterSaving, setLetterSaving] = useState(false);
  const letterLock = useRef(false);
  const request = useRef(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current += 1;
    };
  }, []);

  const loadGoals = useCallback(async () => {
    const id = ++request.current;
    const [goals, accs] = await Promise.all([listSavingsGoals(true), listAccounts(true)]);
    if (!active.current || id !== request.current) return;
    const nextGoals = reuseUnchanged(heldGoals.current, goals);
    if (nextGoals !== heldGoals.current) {
      heldGoals.current = nextGoals;
      setAllGoals(nextGoals);
    }
    const nextAccounts = reuseUnchanged(heldAccounts.current, accs);
    if (nextAccounts !== heldAccounts.current) {
      heldAccounts.current = nextAccounts;
      setAccounts(nextAccounts);
    }
  }, []);
  const { loaded, hasData, loadError, reload: load } = useScreenLoad(loadGoals);
  const {
    goal: goalId,
    add: standaloneAdd,
    goalAdd,
  } = useLocalSearchParams<{
    goal?: string;
    add?: string;
    goalAdd?: string;
  }>();
  const add = embedded ? goalAdd : standaloneAdd;
  useEffect(() => {
    if (!loaded || loadError || (!goalId && add !== '1')) return;
    if (add === '1') setAddVisible(true);
    else {
      const goal = allGoals.find((g) => g.id === goalId);
      if (!goal) showAlert('Goal unavailable', 'This goal no longer exists.');
      if (goal?.archived) setShowArchived(true);
      setEditingGoal(goal ?? null);
    }
    router.setParams({ goal: undefined, ...(embedded ? { goalAdd: undefined } : { add: undefined }) });
  }, [embedded, loaded, loadError, goalId, add, allGoals]);

  useEffect(() => {
    if (
      deferLetters ||
      hideAmounts ||
      addVisible ||
      editingGoal ||
      contributingGoal ||
      letterGoal ||
      goalId ||
      add === '1'
    )
      return;
    const reached = allGoals.find(
      (g) => !g.archived && !!g.noteToSelf && !g.letterRevealed && g.currentAmountMinor >= g.targetAmountMinor
    );
    if (reached) {
      setLetterError(null);
      setLetterGoal(reached);
    }
  }, [
    allGoals,
    hideAmounts,
    addVisible,
    editingGoal,
    contributingGoal,
    letterGoal,
    goalId,
    add,
    deferLetters,
  ]);

  const acknowledgeLetter = async (dismissOnFailure = false) => {
    if (!letterGoal || letterLock.current) return;
    letterLock.current = true;
    setLetterSaving(true);
    try {
      await markGoalLetterRevealed(letterGoal.id);
      if (!active.current) return;
      heldGoals.current = heldGoals.current.map((g) =>
        g.id === letterGoal.id ? { ...g, letterRevealed: true } : g
      );
      setAllGoals(heldGoals.current);
      setLetterGoal(null);
    } catch (e) {
      if (active.current) {
        if (dismissOnFailure) {
          setDeferLetters(true);
          setLetterGoal(null);
        } else setLetterError(errorMessage(e));
      }
    } finally {
      letterLock.current = false;
      if (active.current) setLetterSaving(false);
    }
  };

  const activeGoals = useMemo(() => allGoals.filter((g) => !g.archived), [allGoals]);
  const archivedGoals = useMemo(() => allGoals.filter((g) => g.archived), [allGoals]);
  const visibleGoals = showArchived ? archivedGoals : activeGoals;
  const today = useToday();
  const totals = useMemo(() => summarizeGoals(activeGoals, today), [activeGoals, today]);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const selectedGoal = allGoals.find((g) => g.id === editingGoal?.id);
  useEffect(() => {
    if (loaded && !loadError && editingGoal && !selectedGoal) setEditingGoal(null);
  }, [loaded, loadError, editingGoal, selectedGoal]);

  const renderedToken = useRef(refreshToken);
  useEffect(() => {
    if (renderedToken.current === refreshToken) return;
    renderedToken.current = refreshToken;
    void load();
  }, [load, refreshToken]);
  const reloadAfterChange = async () => {
    await load();
    await onChanged?.();
  };

  if (!embedded && !hasData && loadError)
    return <ScreenLoadError title="Savings goals" message={loadError} onRetry={() => void load()} />;

  if (!embedded && !loaded && !loadError) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} plain />
        <SkyHeader title="Savings goals" showBack hideUser wallpaper />
        <View style={{ paddingTop: 24 }}>
          <View style={styles.list}>
            {[0, 1].map((i) => (
              <View key={i} style={[styles.skeletonRow, i > 0 && styles.skeletonDivider]}>
                <Skeleton width={140} height={13} radius={4} />
                <Skeleton width={280} height={6} radius={3} />
                <Skeleton width={180} height={10} radius={4} />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  const content = (
    <>
      {loadError && (
        <Appear style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Couldn’t load your goals</Text>
          <Text style={styles.errorDetail}>{loadError}</Text>
          <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void load()} />
        </Appear>
      )}

      {!embedded && <View style={{ height: theme.layout.screenTopGap }} />}

      {visibleGoals.length === 0 && embedded ? (
        <View style={[planMoneyList, { padding: 12 }]}>
          <Text style={styles.errorDetail}>
            {showArchived ? 'No archived goals.' : 'No savings goals yet.'}
          </Text>
        </View>
      ) : visibleGoals.length === 0 ? (
        <EmptyState
          title={showArchived ? 'No archived goals' : 'No savings goals yet'}
          subtitle={
            showArchived
              ? undefined
              : 'Set something you’re saving toward — a trip, an emergency fund, a big purchase.'
          }
        >
          {!showArchived && <PrimaryButton title="Create a goal" onPress={() => setAddVisible(true)} />}
        </EmptyState>
      ) : (
        <>
          {!embedded && !showArchived && <Totals ledgerStyle={embedded} totals={totals} />}
          <View style={[styles.list, embedded && planMoneyList]}>
            {visibleGoals.map((goal, i) => (
              <GoalListRow
                compact={embedded}
                key={goal.id}
                goal={goal}
                divider={i > 0}
                account={accountsById.get(goal.linkedAccountId ?? '')}
                onOpen={setEditingGoal}
                onContribute={setContributingGoal}
              />
            ))}
          </View>
        </>
      )}
    </>
  );
  const workspaceSheets = (
    <>
      <AddGoalModal
        ledgerStyle={embedded}
        visible={addVisible}
        accounts={accounts}
        onClose={() => setAddVisible(false)}
        onCreated={async () => {
          setAddVisible(false);
          await reloadAfterChange();
        }}
      />

      {selectedGoal && (
        <GoalOverviewModal
          ledgerStyle={embedded}
          key={selectedGoal.id}
          goal={selectedGoal}
          accounts={accounts}
          onClose={() => setEditingGoal(null)}
          onChanged={reloadAfterChange}
          onMoveMoney={(accountId) => {
            setEditingGoal(null);
            router.push(`/add-transaction?type=transfer&toAccountId=${encodeURIComponent(accountId)}`);
          }}
        />
      )}

      {letterGoal && !hideAmounts && !addVisible && !editingGoal && !contributingGoal && (
        <ModalSheet
          visible
          title="Your goal milestone"
          dismissible={!letterSaving}
          onClose={() => void acknowledgeLetter(true)}
          footer={
            <View>
              {letterError && <Text style={styles.errorText}>{letterError}</Text>}
              <PrimaryButton
                loading={letterSaving}
                title="Nice, thanks Suu"
                onPress={() => void acknowledgeLetter()}
              />
            </View>
          }
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
          await reloadAfterChange();
        }}
      />
    </>
  );
  if (embedded) {
    return (
      <>
        <WorkspaceActions
          toggleLabel={showArchived ? 'Active goals' : 'Archived goals'}
          onToggle={
            showArchived || archivedGoals.length > 0
              ? () => setShowArchived((current) => !current)
              : undefined
          }
        />
        {loaded && hasData ? (
          content
        ) : loadError ? (
          <PrimaryButton title="Retry" onPress={() => void load()} />
        ) : (
          (fallback ?? <Text style={styles.errorDetail}>Loading…</Text>)
        )}
        {workspaceSheets}
      </>
    );
  }

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} plain />
      <SolidFade style={{ flex: 1 }}>
        <ReanimatedAnimated.ScrollView
          ref={scrollRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: headerHeight,
            paddingBottom: theme.layout.screenScrollPad + insets.bottom,
          }}
        >
          {content}
        </ReanimatedAnimated.ScrollView>
      </SolidFade>
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
        wallpaper
        actions={
          <>
            <HeaderIconButton
              icon={showArchived ? 'eye-off' : 'archive'}
              glass
              size={36}
              onPress={() => setShowArchived((v) => !v)}
              label={showArchived ? 'Hide archived goals' : 'Show archived goals'}
              badge={!showArchived && archivedGoals.length > 0}
            />
            <AddButton onPress={() => setAddVisible(true)} label="+ Add" />
          </>
        }
      />
      {workspaceSheets}
    </View>
  );
}

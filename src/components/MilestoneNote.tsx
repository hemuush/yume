import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedAnimated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { SuuIllustration } from '@/components/SuuIllustration';
import { theme } from '@/constants/theme';
import { listBudgetsForMonth, periodMonthOf } from '@/db/budgets';
import { getMilestonesSeen, markMilestonesSeen } from '@/db/settings';
import { haptics } from '@/lib/haptics';
import { DURATIONS } from '@/lib/motionTimings';
import { budgetMonthCopy, budgetMonthHeld, budgetMonthKey, MilestoneCopy } from '@/lib/milestones';
import { usePrivacy } from '@/theme/PrivacyContext';

interface Shown extends MilestoneCopy {
  key: number;
}

type Show = (copy: MilestoneCopy) => void;

// No provider (a unit test, a stray screen) means no note rather than a crash.
const MilestoneNoteContext = createContext<Show>(() => {});

const SHOW_MS = 4500;

/**
 * Mounted once at the root, like the undo toast. A small note with Suu drops from the top when a goal passes
 * 25/50/75/100% or a budget month closes under its limits. One at a time; a newer one replaces the last.
 */
export function MilestoneNoteProvider({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const keyRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setShown(null);
  }, []);

  const show = useCallback<Show>(
    (copy) => {
      keyRef.current += 1;
      if (timer.current) clearTimeout(timer.current);
      if (copy.strong) haptics.confirm();
      else haptics.tap();
      void AccessibilityInfo.announceForAccessibility(`${copy.title}. ${copy.body}`);
      setShown({ ...copy, key: keyRef.current });
      timer.current = setTimeout(dismiss, SHOW_MS);
    },
    [dismiss]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return (
    <MilestoneNoteContext.Provider value={show}>
      {children}
      {shown && <NoteView key={shown.key} note={shown} onDismiss={dismiss} />}
    </MilestoneNoteContext.Provider>
  );
}

export function useMilestoneNote(): Show {
  return useContext(MilestoneNoteContext);
}

function NoteView({ note, onDismiss }: { note: Shown; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ReanimatedAnimated.View
      entering={FadeInUp.duration(DURATIONS.slideIn).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutUp.duration(DURATIONS.rowExit).reduceMotion(ReduceMotion.System)}
      style={[styles.wrap, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onDismiss}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`${note.title}. ${note.body}`}
        accessibilityHint="Dismiss"
      >
        <SuuIllustration size={40} pose="default" />
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={2}>
            {note.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {note.body}
          </Text>
        </View>
      </Pressable>
    </ReanimatedAnimated.View>
  );
}

/** The month before `now`, once it has closed with every budget under its limit and not yet been celebrated. */
export async function checkClosedBudgetMonth(
  now: Date,
  excludeSensitive: boolean
): Promise<MilestoneCopy | null> {
  const [y, m] = periodMonthOf(now).split('-').map(Number);
  const closed = periodMonthOf(new Date(y, m - 2, 1));
  const key = budgetMonthKey(closed);
  if ((await getMilestonesSeen()).includes(key)) return null;
  const budgets = await listBudgetsForMonth(closed, excludeSensitive);
  if (!budgetMonthHeld(budgets)) return null;
  await markMilestonesSeen([key]);
  return budgetMonthCopy(closed, budgets.length);
}

/** Renders nothing: looks for a newly closed, under-budget month shortly after launch and each time the app returns. */
export function BudgetMonthWatcher() {
  const show = useMilestoneNote();
  const { hideAmounts } = usePrivacy();
  const showRef = useRef(show);
  const hideRef = useRef(hideAmounts);
  useEffect(() => {
    showRef.current = show;
    hideRef.current = hideAmounts;
  }, [show, hideAmounts]);

  useEffect(() => {
    let alive = true;
    const check = () =>
      checkClosedBudgetMonth(new Date(), hideRef.current)
        .then((copy) => {
          if (alive && copy) showRef.current(copy);
        })
        .catch(() => {});
    const first = setTimeout(check, 1500);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    return () => {
      alive = false;
      clearTimeout(first);
      sub.remove();
    };
  }, []);

  return null;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  copy: { flexShrink: 1, gap: 2 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.ink },
  body: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted },
});

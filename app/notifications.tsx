import { PrimaryButton } from '@/components/PrimaryButton';
import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPeriodComparison } from '@/db/reports';
import { listAccounts } from '@/db/ledger';
import { toLocalIsoDate } from '@/lib/date';
import { valueReminderLine } from '@/lib/investment';
import { getNotificationPrefs, getCachedHideSensitiveAmounts } from '@/db/settings';
import { privateComparison } from '@/lib/privateSummary';
import { formatPctChange } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { EmptyState } from '@/components/EmptyState';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { useUndoToast } from '@/components/UndoToast';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { Section } from '@/components/Section';
import { screenStyles as h } from '@/components/screenStyles';
import { NeedsYouRow } from '@/features/home/NeedsYouRow';
import { NEEDS_TONE } from '@/features/home/needsTone';
import { Glass, GLASS, GLASS_CARD } from '@/components/Glass';
import { Kicker, frost } from '@/components/Frost';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { SuuIllustration } from '@/components/SuuIllustration';
import { NeedsYouItem, NeedsYouTone } from '@/features/home/needsYou';
import {
  loadNeedsYou,
  dismissNeedsYou,
  restoreNeedsYou,
  snoozeBackupReminder,
  unsnoozeBackupReminder,
} from '@/features/home/needsYouData';
import { withPressed } from '@/lib/pressed';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';
import { payCardRoute } from '@/lib/payCard';

const TONES: NeedsYouTone[] = ['urgent', 'warn', 'info'];

/**
 * The bell's screen: the full list that Home's card shows the top three of, so both counts match. A glass card
 * counts them by urgency, then the rows. ✕ hides an item until its situation changes (undoable, restorable).
 * Suu's check-in is a speech bubble from Suu, not an alert.
 */
export default function NeedsYouScreen() {
  const insets = useSafeAreaInsets();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const { accent, secondary } = useAccent();
  const { show: showUndo } = useUndoToast();
  const [shown, setShown] = useState<NeedsYouItem[] | null>(null);
  const [dismissed, setDismissed] = useState<NeedsYouItem[]>([]);
  const [showDismissed, setShowDismissed] = useState(false);
  const [suuLines, setSuuLines] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [needs, prefs, comparison, accounts] = await Promise.all([
      loadNeedsYou(),
      getNotificationPrefs(),
      // As Home's Suu line: with savings hidden, savings and investment spending leave the comparison.
      getPeriodComparison('month').then((c) => privateComparison(c, getCachedHideSensitiveAmounts())),
      listAccounts(),
    ]);
    setShown(needs.shown);
    setDismissed(needs.dismissed);
    const pct = comparison.expenseChangePct;
    const lines: string[] = [];
    if (prefs.suuCheckins && pct != null) {
      lines.push(
        pct <= 0
          ? `You're spending ${formatPctChange(pct)} less than last month — nice pace.`
          : `You're spending ${formatPctChange(pct)} more than last month. A lighter week would even it out.`
      );
    }
    const reminder = prefs.suuCheckins ? valueReminderLine(accounts, toLocalIsoDate(new Date())) : null;
    if (reminder) lines.push(reminder);
    setSuuLines(lines);
  }, []);
  const { loadError, reload } = useScreenLoad(load);

  const open = (item: NeedsYouItem) => {
    if (item.action === 'loans') router.push('/loans');
    else if (item.action === 'budgets') router.push('/budgets');
    else if (item.action === 'reports') router.navigate('/reports');
    else if (item.action === 'tidy') router.push('/tidy-up');
    else if (item.action === 'recurring') router.push('/recurring');
    else if (item.action === 'payCard' && item.payCard)
      router.push(payCardRoute(item.payCard.accountId, item.payCard.amountMinor));
    else router.push('/backup');
  };

  /** Takes an item off the shown list at once; the returned function puts it back where it was. */
  const hideOptimistically = (item: NeedsYouItem) => {
    const at = Math.max(0, shown?.findIndex((i) => i.key === item.key) ?? 0);
    setShown((prev) => prev?.filter((i) => i.key !== item.key) ?? prev);
    return () =>
      setShown((prev) =>
        !prev || prev.some((i) => i.key === item.key) ? prev : [...prev.slice(0, at), item, ...prev.slice(at)]
      );
  };

  const dismiss = async (item: NeedsYouItem) => {
    haptics.tap();
    const putBack = hideOptimistically(item);
    setDismissed((prev) => [...prev, item]);
    try {
      await dismissNeedsYou(item.key);
    } catch (e) {
      // Nothing was saved, so the list goes back to how it was rather than claiming a dismissal.
      putBack();
      setDismissed((prev) => prev.filter((i) => i.key !== item.key));
      showAlert("Couldn't dismiss", errorMessage(e));
      return;
    }
    showUndo(`Dismissed ${item.title}`, async () => {
      await restoreNeedsYou(item.key);
      await reload();
    });
  };

  const bringBack = async (item: NeedsYouItem) => {
    haptics.tap();
    try {
      await restoreNeedsYou(item.key);
    } catch (e) {
      showAlert("Couldn't show it again", errorMessage(e));
      return;
    }
    await reload();
  };

  const snooze = async (item: NeedsYouItem) => {
    const putBack = hideOptimistically(item);
    try {
      await snoozeBackupReminder();
    } catch (e) {
      putBack();
      showAlert("Couldn't snooze", errorMessage(e));
      return;
    }
    // Same as dismiss: a mis-tap can be taken back.
    showUndo(`Snoozed ${item.title}`, async () => {
      await unsnoozeBackupReminder();
      await reload();
    });
  };

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
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
            <Text style={styles.errorTitle}>Couldn't load what needs you</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
            <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void reload()} />
          </View>
        )}

        {shown === null ? (
          // Bones only while loading: a failed load shows just its banner.
          loadError ? null : (
            <View style={{ marginTop: theme.layout.screenTopGap }}>
              <CardRowsSkeleton rows={3} />
            </View>
          )
        ) : shown.length === 0 ? (
          <EmptyState
            title="All caught up"
            subtitle="Nothing needs you right now. Suu will say when something does."
          />
        ) : (
          <>
            <Glass radius={28} tone="strong" style={frost.hero}>
              <Kicker icon="bell">Needs you</Kicker>
              <View style={frost.bigRow}>
                <Text style={frost.bigValue}>{shown.length}</Text>
                <Text style={frost.bigNote}>{shown.length === 1 ? 'thing' : 'things'}</Text>
              </View>
              <View style={styles.tones}>
                {TONES.map((t) => {
                  const n = shown.filter((i) => i.tone === t).length;
                  return n > 0 ? (
                    <View key={t} style={styles.toneChip}>
                      <View style={[styles.toneDot, { backgroundColor: NEEDS_TONE[t].color }]} />
                      <Text style={styles.toneText}>
                        {n} {NEEDS_TONE[t].label}
                      </Text>
                    </View>
                  ) : null;
                })}
              </View>
            </Glass>
            <View style={[h.card, GLASS_CARD, styles.list]}>
              {shown.map((item, i) => (
                <NeedsYouRow
                  key={item.key}
                  item={item}
                  divider={i > 0}
                  onPress={() => open(item)}
                  onSnooze={() => void snooze(item)}
                  onDismiss={() => void dismiss(item)}
                />
              ))}
            </View>
          </>
        )}

        {suuLines.length > 0 && (
          <Section title="Suu says">
            <View style={styles.suu}>
              <View style={styles.suuFace}>
                <SuuIllustration size={38} />
              </View>
              <View style={styles.suuLines}>
                {suuLines.map((line, i) => (
                  <Text key={`${i}:${line}`} style={styles.suuText}>
                    {line}
                  </Text>
                ))}
              </View>
            </View>
          </Section>
        )}

        {dismissed.length > 0 && (
          <>
            <Pressable
              onPress={() => setShowDismissed((v) => !v)}
              style={withPressed(styles.dismissedToggle)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showDismissed }}
            >
              <Text style={styles.dismissedToggleText}>
                {showDismissed ? 'Hide dismissed' : `Show dismissed (${dismissed.length})`}
              </Text>
            </Pressable>
            {showDismissed && (
              <View style={[h.card, GLASS_CARD, styles.dismissedList]}>
                {dismissed.map((item, i) => (
                  <NeedsYouRow
                    key={item.key}
                    item={{ ...item, snoozable: false }}
                    divider={i > 0}
                    onPress={() => open(item)}
                    onSnooze={() => {}}
                    onDismiss={() => void bringBack(item)}
                    dismissLabel="Show again"
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        collapse={collapse}
        summary={
          shown && shown.length > 0 ? (
            <HeaderSummary
              figure={String(shown.length)}
              rest={shown.length === 1 ? 'thing needs you' : 'things need you'}
              dot={theme.colors.slice.due}
            />
          ) : undefined
        }
        title="Needs you"
        showBack
        hideUser
        wallpaper
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  list: { marginTop: 12 },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: theme.layout.screenTopGap,
    marginBottom: 4,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expenseText },
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  tones: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: theme.radius.pill,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
  },
  toneDot: { width: 8, height: 8, borderRadius: 4 },
  toneText: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.textPrimary },
  // Suu, then its lines in a bubble whose corner points back at it.
  suu: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 20 },
  suuFace: { width: 38, height: 38 },
  suuLines: {
    flex: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
    boxShadow: GLASS.shadow,
  },
  suuText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
  dismissedToggle: {
    alignSelf: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: theme.radius.pill,
    backgroundColor: GLASS.fill,
    borderWidth: 1,
    borderColor: GLASS.edge,
  },
  dismissedToggleText: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  dismissedList: { opacity: 0.75 },
});

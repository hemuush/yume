import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPeriodComparison } from '@/db/reports';
import { getNotificationPrefs } from '@/db/settings';
import { formatPctChange } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { useUndoToast } from '@/components/UndoToast';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { HomeSection } from '@/features/home/HomeSection';
import { homeStyles as h } from '@/features/home/homeStyles';
import { NeedsYouRow } from '@/features/home/NeedsYouCard';
import { NeedsYouItem } from '@/features/home/needsYou';
import {
  loadNeedsYou,
  dismissNeedsYou,
  restoreNeedsYou,
  snoozeBackupReminder,
} from '@/features/home/needsYouData';
import { withPressed } from '@/lib/pressed';
import { payCardRoute } from '@/lib/payCard';

/**
 * The bell's screen: everything that needs you, in full — the same list
 * Home's card shows the top three of, so the count on the bell and on Home
 * always match. ✕ hides an item until its situation changes (with undo);
 * dismissed items can be shown and brought back. Suu's check-in sits under
 * the list as a line, not an alert.
 */
export default function NeedsYouScreen() {
  const insets = useSafeAreaInsets();
  const { dot } = useAccent();
  const { show: showUndo } = useUndoToast();
  const [shown, setShown] = useState<NeedsYouItem[] | null>(null);
  const [dismissed, setDismissed] = useState<NeedsYouItem[]>([]);
  const [showDismissed, setShowDismissed] = useState(false);
  const [suuLine, setSuuLine] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [needs, prefs, comparison] = await Promise.all([
      loadNeedsYou(),
      getNotificationPrefs(),
      getPeriodComparison('month'),
    ]);
    setShown(needs.shown);
    setDismissed(needs.dismissed);
    const pct = comparison.expenseChangePct;
    setSuuLine(
      prefs.suuCheckins && pct != null
        ? pct <= 0
          ? `You're spending ${formatPctChange(pct)} less than last month — nice pace.`
          : `You're spending ${formatPctChange(pct)} more than last month. A lighter week would even it out.`
        : null
    );
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

  const dismiss = async (item: NeedsYouItem) => {
    haptics.tap();
    setShown((prev) => prev?.filter((i) => i.key !== item.key) ?? prev);
    setDismissed((prev) => [...prev, item]);
    await dismissNeedsYou(item.key);
    showUndo(`Dismissed ${item.title}`, async () => {
      await restoreNeedsYou(item.key);
      await reload();
    });
  };

  const bringBack = async (item: NeedsYouItem) => {
    haptics.tap();
    await restoreNeedsYou(item.key);
    await reload();
  };

  const snooze = async (item: NeedsYouItem) => {
    setShown((prev) => prev?.filter((i) => i.key !== item.key) ?? prev);
    await snoozeBackupReminder();
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Needs you" showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load what needs you</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        {shown === null ? (
          <View style={{ marginTop: theme.layout.screenTopGap }}>
            <CardRowsSkeleton rows={3} />
          </View>
        ) : shown.length === 0 ? (
          <EmptyState
            title="All caught up"
            subtitle="Nothing needs you right now. Suu will say when something does."
          />
        ) : (
          <View style={[h.card, styles.list]}>
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
        )}

        {suuLine && (
          <HomeSection title="Suu says">
            <View style={[h.card, styles.suu]}>
              <View style={[styles.suuDot, { backgroundColor: dot }]} />
              <Text style={styles.suuText}>{suuLine}</Text>
            </View>
          </HomeSection>
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
              <View style={[h.card, styles.dismissedList]}>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  list: { marginTop: theme.layout.screenTopGap },
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
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expense },
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  suu: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },
  suuDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  suuText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
  dismissedToggle: { alignSelf: 'center', marginTop: 20, paddingHorizontal: 14, paddingVertical: 8 },
  dismissedToggleText: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  dismissedList: { opacity: 0.75 },
});

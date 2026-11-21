import { PrimaryButton } from '@/components/PrimaryButton';
import { Appear } from '@/components/Appear';
import { LoadFade } from '@/components/LoadFade';
import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMonthToDateComparison } from '@/db/reports';
import { PACE_MIN_DAY } from '@/lib/pace';
import { listAccounts } from '@/db/ledger';
import { toLocalIsoDate } from '@/lib/date';
import { valueReminderLine } from '@/lib/investment';
import { getNotificationPrefs, getCachedHideSensitiveAmounts } from '@/db/settings';
import { privateComparison } from '@/lib/privateSummary';
import { formatPctChange } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useScreenLoad } from '@/hooks/useScreenLoad';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/hooks/useCollapsingHeader';
import { EmptyState } from '@/components/EmptyState';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { useUndoToast } from '@/components/UndoToast';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { Section } from '@/components/Section';
import { SCREEN } from '@/components/screenStyles';
import { NeedsYouRow } from '@/features/home/NeedsYouRow';
import { HeaderIconButton } from '@/components/AppHeader';
import { ListCard } from '@/components/SummaryCard';
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
import { withPressedTint } from '@/lib/pressed';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';
import { payCardRoute } from '@/lib/payCard';
import { themedStyles } from '@/theme/themedStyles';

const TONES: NeedsYouTone[] = ['urgent', 'warn', 'info'];
const GROUP_TITLE: Record<NeedsYouTone, string> = {
  urgent: 'Do first',
  warn: 'Coming up',
  info: 'When you can',
};

/**
 * The bell's screen: the full list of what needs you, whose count is the number on Home's bell. A glass card
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
  const [incomplete, setIncomplete] = useState(false);
  const [suuLines, setSuuLines] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [needs, prefsResult, comparisonResult, accountsResult] = await Promise.allSettled([
      loadNeedsYou(),
      getNotificationPrefs(),
      // As Home's Suu line: with savings hidden, savings and investment spending leave the comparison. This month so
      // far is set against the same days of last month, not all of it, which would always read as "less" early on.
      getMonthToDateComparison().then((c) => privateComparison(c, getCachedHideSensitiveAmounts())),
      listAccounts(),
    ]);
    if (needs.status === 'rejected') throw needs.reason;
    setShown(needs.value.shown);
    setDismissed(needs.value.dismissed);
    setIncomplete(
      needs.value.incomplete ||
        [prefsResult, comparisonResult, accountsResult].some((result) => result.status === 'rejected')
    );
    const enabled = prefsResult.status === 'fulfilled' && prefsResult.value.suuCheckins;
    const pct = comparisonResult.status === 'fulfilled' ? comparisonResult.value.expenseChangePct : null;
    const lines: string[] = [];
    // Too few days of the month to say anything fair about its pace before the 5th (as for the month forecast).
    if (enabled && pct != null && new Date().getDate() >= PACE_MIN_DAY) {
      lines.push(
        pct <= 0
          ? `You’re spending ${formatPctChange(pct)} less than at this point last month — nice pace.`
          : `You’re spending ${formatPctChange(pct)} more than at this point last month. A lighter week would even it out.`
      );
    }
    const reminder =
      enabled && accountsResult.status === 'fulfilled'
        ? valueReminderLine(accountsResult.value, toLocalIsoDate(new Date()))
        : null;
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
      showAlert('Couldn’t dismiss', errorMessage(e));
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
      showAlert('Couldn’t show it again', errorMessage(e));
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
      showAlert('Couldn’t snooze', errorMessage(e));
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
      <HomeWallpaper accent={accent} secondary={secondary} plain />
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        <LoadFade loaded={shown !== null}>
          {loadError && (
            <Appear style={styles.errorBanner}>
              <Text style={styles.errorTitle}>Couldn’t load what needs you</Text>
              <Text style={styles.errorDetail}>{loadError}</Text>
              <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void reload()} />
            </Appear>
          )}

          {!loadError && incomplete && (
            <Appear style={styles.errorBanner}>
              <Text style={styles.errorTitle}>Some updates couldn’t load</Text>
              <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void reload()} />
            </Appear>
          )}

          {shown === null ? (
            // Bones only while loading: a failed load shows just its banner.
            loadError ? null : (
              <View style={{ marginTop: theme.layout.screenTopGap }}>
                <CardRowsSkeleton rows={3} />
              </View>
            )
          ) : shown.length === 0 ? (
            incomplete || loadError ? null : (
              <EmptyState
                title="All caught up"
                subtitle="Nothing needs you right now. Suu will say when something does."
              >
                <PrimaryButton
                  title="Choose what Yume mentions"
                  variant="secondary"
                  compact
                  onPress={() => router.push('/notification-settings')}
                />
              </EmptyState>
            )
          ) : (
            <>
              <View style={styles.inboxSummary}>
                <View style={styles.inboxIcon}>
                  <Feather name="bell" size={17} color={theme.colors.link} />
                </View>
                <Text style={styles.inboxCount}>
                  {shown.length} {shown.length === 1 ? 'item to review' : 'items to review'}
                </Text>
              </View>
              {TONES.map((t) => {
                const group = shown.filter((i) => i.tone === t);
                return group.length > 0 ? (
                  <Section key={t} compact title={GROUP_TITLE[t]} badge={group.length}>
                    <ListCard>
                      {group.map((item, i) => (
                        <NeedsYouRow
                          key={item.key}
                          item={item}
                          divider={i > 0}
                          onPress={() => open(item)}
                          onSnooze={() => void snooze(item)}
                          onDismiss={() => void dismiss(item)}
                        />
                      ))}
                    </ListCard>
                  </Section>
                ) : null;
              })}
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
                style={withPressedTint(accent, styles.dismissedToggle)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showDismissed }}
              >
                <Text style={styles.dismissedToggleText}>
                  {showDismissed ? 'Hide dismissed' : `Show dismissed (${dismissed.length})`}
                </Text>
              </Pressable>
              {showDismissed && (
                <ListCard style={styles.dismissedList}>
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
                </ListCard>
              )}
            </>
          )}
        </LoadFade>
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
        actions={
          <HeaderIconButton
            icon="settings"
            label="Notification settings"
            glass
            onPress={() => router.push('/notification-settings')}
          />
        }
        showBack
        hideUser
        wallpaper
      />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },

    errorBanner: {
      marginHorizontal: SCREEN.gutter,
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
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 3,
      lineHeight: 16,
    },
    inboxSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: SCREEN.gutter,
      marginTop: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.colors.home.control,
      borderRadius: theme.radius.md,
    },
    inboxIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inboxCount: { flex: 1, fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
    // Suu, then its lines in a bubble whose corner points back at it.
    suu: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: SCREEN.gutter },
    suuFace: { width: 38, height: 38 },
    suuLines: {
      flex: 1,
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
      // The corner that points back at Suu.
      borderTopLeftRadius: 4,
    },
    suuText: {
      fontFamily: theme.font.body,
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.textSecondary,
    },
    dismissedToggle: {
      minHeight: 44,
      justifyContent: 'center',
      alignSelf: 'center',
      marginTop: 20,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    dismissedToggleText: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    dismissedList: { opacity: 0.75 },
  })
);

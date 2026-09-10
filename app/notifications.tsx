import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getNextDueInstallment } from '@/db/loans';
import { getPeriodComparison, findTopGrowingCategory } from '@/db/reports';
import { getLastLocalBackupAt, getNotificationPrefs } from '@/db/settings';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { daysUntilIsoDate } from '@/lib/date';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { theme } from '@/constants/theme';

interface FeedRow {
  key: string;
  icon: string;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<FeedRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextDue, comparison, lastBackup, prefs] = await Promise.all([
        getNextDueInstallment(),
        getPeriodComparison('month'),
        getLastLocalBackupAt(),
        getNotificationPrefs(),
      ]);

      const feed: FeedRow[] = [];

      if (nextDue) {
        const d = daysUntilIsoDate(nextDue.dueDate);
        feed.push({
          key: 'emi',
          icon: '⏰',
          iconBg: theme.colors.gold,
          title: 'EMI due soon',
          subtitle: `${nextDue.counterparty} — ${formatMoney(nextDue.emiAmountMinor)} due ${d <= 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`}.`,
          onPress: () => router.push('/loans'),
        });
      }

      const topGrowing = findTopGrowingCategory(
        comparison.current.categoryBreakdown,
        comparison.previous.categoryBreakdown
      );
      if (topGrowing) {
        feed.push({
          key: 'overspend',
          icon: '⚠️',
          iconBg: theme.colors.flatPink,
          title: 'Category over pace',
          subtitle: `${topGrowing.name} is up ${formatPctChange(topGrowing.pctChange)} vs last month.`,
          onPress: () => router.push('/reports'),
        });
      }

      feed.push({
        key: 'backup',
        icon: '💾',
        iconBg: theme.colors.flatMint,
        title: lastBackup ? 'Backup up to date' : 'No backup yet',
        subtitle: lastBackup
          ? `Last backed up ${timeAgo(lastBackup)}.`
          : 'Pick a backup folder in Settings to save your data automatically.',
        onPress: () => router.push('/backup'),
      });

      if (prefs.flynnCheckins && comparison.expenseChangePct != null) {
        const pct = comparison.expenseChangePct;
        feed.push({
          key: 'flynn',
          icon: '🐦',
          iconBg: theme.colors.flatBlue,
          title: "Flynn's check-in",
          subtitle:
            pct <= 0
              ? `You're spending ${formatPctChange(pct)} less than last month — nice pace.`
              : `You're spending ${formatPctChange(pct)} more than last month.`,
        });
      }

      setRows(feed);
      setLoadError(null);
    } catch (e: any) {
      // Previously an unguarded throw here left `rows` at null forever — an
      // indefinitely blank screen with no error and no way to know why.
      setLoadError(String(e?.message ?? e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Alerts" showBack />
      <ScrollView>
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load your alerts</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}
        {rows === null ? null : rows.length === 0 ? (
          <EmptyState
            title="All caught up"
            subtitle="No alerts right now — Flynn will let you know when something needs attention."
          />
        ) : (
          rows.map((row) => (
            <Pressable key={row.key} style={styles.row} onPress={row.onPress} disabled={!row.onPress}>
              <View style={[styles.icon, { backgroundColor: row.iconBg }]}>
                <Text style={styles.iconText}>{row.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {row.title}
                </Text>
                <Text style={styles.rowSubtitle} numberOfLines={2}>
                  {row.subtitle}
                </Text>
              </View>
            </Pressable>
          ))
        )}
        <View style={{ height: 40 + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expense },
  errorDetail: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 3, lineHeight: 16 },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    borderRadius: theme.radius.lg,
    padding: 14,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: { fontSize: 16 },
  rowTitle: { fontFamily: theme.font.bodyBold, fontSize: 13.5, color: theme.colors.textPrimary },
  rowSubtitle: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
});

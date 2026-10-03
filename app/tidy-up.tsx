import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getTidyUpReport,
  keepRepeatGroup,
  keepAsIncome,
  deleteNewestOfGroup,
  undoDeleteNewestOfGroup,
  moveToOpeningBalance,
  undoMoveToOpeningBalance,
  TidyUpReport,
  RepeatGroup,
  StartingBalanceGroup,
} from '@/db/tidyUp';
import { roundLedgerAmountsToWholeRupees } from '@/db/maintenance';
import { formatMoney } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { emitTransactionsChanged } from '@/lib/dataEvents';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { theme } from '@/constants/theme';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { CategoryIcon } from '@/components/CategoryIcon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { useUndoToast } from '@/components/UndoToast';
import { HomeSection } from '@/features/home/HomeSection';
import { homeStyles as h } from '@/features/home/homeStyles';
import { dayMonth, longMonth, shortMonthYear } from '@/lib/dateLabels';
import { errorMessage } from '@/lib/errorMessage';
import { categoryPath } from '@/lib/categoryLabel';
import { showAlert } from '@/components/AppDialog';

/** "23 Sep 1:53 pm" from created_at (UTC, "YYYY-MM-DD HH:MM:SS"). */
const savedLabel = (createdAt: string) => {
  const d = new Date(`${createdAt.replace(' ', 'T')}Z`);
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString(
    undefined,
    {
      hour: 'numeric',
      minute: '2-digit',
    }
  )}`;
};

/**
 * Tidy up (Settings → Alerts & backup): what looks off in your data, each
 * with its own fix — the same entry saved twice, an old balance logged as
 * income, amounts still carrying paise. Every fix can be undone from the
 * toast, and "keep" choices are remembered so the item doesn't come back.
 */
export default function TidyUpScreen() {
  const insets = useSafeAreaInsets();
  const { show: showUndo } = useUndoToast();
  const [report, setReport] = useState<TidyUpReport | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setReport(await getTidyUpReport());
  }, []);
  const { loaded, loadError, reload } = useScreenLoad(load);

  /** Runs one fix, refreshes, and tells the rest of the app the ledger changed. */
  const act = async (fix: () => Promise<void>, failTitle: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fix();
      emitTransactionsChanged();
      await reload();
    } catch (e) {
      showAlert(failTitle, errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteOne = (group: RepeatGroup) =>
    act(async () => {
      const snapshot = await deleteNewestOfGroup(group);
      haptics.warn();
      showUndo('Repeat moved to Recently deleted', async () => {
        await undoDeleteNewestOfGroup(snapshot);
        emitTransactionsChanged();
        await reload();
      });
    }, "Couldn't delete it");

  const keepBoth = (group: RepeatGroup) =>
    act(async () => {
      await keepRepeatGroup(group.key);
      haptics.tap();
    }, "Couldn't save that");

  const moveBalance = (group: StartingBalanceGroup) =>
    act(async () => {
      const move = await moveToOpeningBalance(group);
      haptics.confirm();
      showUndo(`Moved to ${group.accountName}'s opening balance`, async () => {
        await undoMoveToOpeningBalance(move);
        emitTransactionsChanged();
        await reload();
      });
    }, "Couldn't move it");

  const keepIncome = (group: StartingBalanceGroup) =>
    act(async () => {
      await keepAsIncome(group.key);
      haptics.tap();
    }, "Couldn't save that");

  const roundAmounts = (count: number) =>
    showAlert(
      'Round amounts to whole rupees?',
      `${count} stored amount${count === 1 ? '' : 's'} still ` +
        `carr${count === 1 ? 'ies' : 'y'} paise. Rounding them makes on-screen ` +
        'totals line up with their parts. Loan schedules are left untouched. Some account ' +
        'balances may shift by a rupee or two. You can undo right after, if needed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Round them',
          style: 'destructive',
          onPress: () =>
            act(async () => {
              const changed = await roundLedgerAmountsToWholeRupees();
              haptics.confirm();
              showUndo(
                `Rounded ${changed.total} amount${changed.total === 1 ? '' : 's'} to whole rupees`,
                async () => {
                  await changed.undo();
                  emitTransactionsChanged();
                  await reload();
                }
              );
            }, "Couldn't round amounts"),
        },
      ]
    );

  const allTidy =
    report &&
    report.repeats.length === 0 &&
    report.startingBalances.length === 0 &&
    report.fractionalCount === 0;

  return (
    <View style={styles.container}>
      <AppHeader title="Tidy up" showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't check your data</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        {!loaded || !report ? (
          <View style={{ marginTop: theme.layout.screenTopGap }}>
            <CardRowsSkeleton rows={3} />
          </View>
        ) : allTidy ? (
          <EmptyState
            title="All tidy"
            subtitle="Nothing looks off. Suu checks again whenever you open this."
          />
        ) : (
          <>
            <Text style={styles.intro}>
              A few things that might not be what you meant. Each fix can be undone straight after.
            </Text>

            {report.repeats.length > 0 && (
              <HomeSection title="Same entry twice?">
                <View style={h.card}>
                  {report.repeats.map((g, i) => (
                    <View key={g.key} style={[styles.item, i > 0 && h.divider]}>
                      <View style={styles.itemTop}>
                        <CategoryIcon
                          name={g.type === 'transfer' ? 'swap-horizontal' : (g.categoryIcon ?? 'tag')}
                          color={
                            g.type === 'transfer' ? theme.colors.secondary : (g.categoryColor ?? undefined)
                          }
                        />
                        <View style={h.mid}>
                          <Text style={h.title} numberOfLines={2}>
                            {formatMoney(g.amountMinor)} ·{' '}
                            {g.type === 'transfer'
                              ? `${g.accountName} → ${g.toAccountName ?? '—'}`
                              : `${g.categoryName ? categoryPath(g.categoryName, g.parentName) : '—'} · ${g.accountName}`}
                          </Text>
                          <Text style={h.sub}>
                            {dayMonth(g.date)} ·{' '}
                            {g.ids.length === 2 ? 'saved' : `${g.ids.length} times, saved`}{' '}
                            {g.savedAt.map(savedLabel).join(' and ')}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.actions}>
                        <PrimaryButton
                          title="Keep both"
                          variant="secondary"
                          onPress={() => keepBoth(g)}
                          disabled={busy}
                          style={styles.action}
                        />
                        <PrimaryButton
                          title={g.ids.length === 2 ? 'Delete one' : 'Delete newest'}
                          onPress={() => deleteOne(g)}
                          disabled={busy}
                          style={styles.action}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </HomeSection>
            )}

            {report.startingBalances.length > 0 && (
              <HomeSection title="Old balances logged as income">
                <View style={h.card}>
                  {report.startingBalances.map((g, i) => {
                    const one = g.ids.length === 1;
                    const when = one
                      ? dayMonth(g.firstDate)
                      : `${g.ids.length} entries, ${shortMonthYear(g.firstDate)} – ${shortMonthYear(g.lastDate)}`;
                    return (
                      <View key={g.key} style={[styles.item, i > 0 && h.divider]}>
                        <View style={styles.itemTop}>
                          <CategoryIcon name="arrow-collapse-down" color={theme.colors.idCoralDeep} />
                          <View style={h.mid}>
                            <Text style={h.title} numberOfLines={2}>
                              {formatMoney(g.totalMinor)} · {g.categoryName} · {g.accountName}
                            </Text>
                            <Text style={h.sub}>
                              {when}. If {one ? 'this is' : 'these are'} money {g.accountName} already had,
                              move {one ? 'it' : 'them'} to its opening balance: the balance stays the same,
                              and income drops by {formatMoney(g.totalMinor)}
                              {one ? ` in ${longMonth(g.firstDate)}` : ' across those months'}.
                            </Text>
                          </View>
                        </View>
                        <View style={styles.actions}>
                          <PrimaryButton
                            title={one ? "It's real income" : "They're real income"}
                            variant="secondary"
                            onPress={() => keepIncome(g)}
                            disabled={busy}
                            style={styles.action}
                          />
                          <PrimaryButton
                            title="Move to opening balance"
                            onPress={() => moveBalance(g)}
                            disabled={busy}
                            style={styles.action}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </HomeSection>
            )}

            {report.fractionalCount > 0 && (
              <HomeSection title="Amounts with paise">
                <View style={h.card}>
                  <View style={styles.item}>
                    <View style={styles.itemTop}>
                      <CategoryIcon name="calculator-variant-outline" color={theme.colors.primary} />
                      <View style={h.mid}>
                        <Text style={h.title}>
                          {report.fractionalCount} old amount{report.fractionalCount === 1 ? '' : 's'} still
                          carry paise
                        </Text>
                        <Text style={h.sub}>Rounding them makes totals line up with their parts.</Text>
                      </View>
                    </View>
                    <View style={styles.actions}>
                      <PrimaryButton
                        title="Round them"
                        onPress={() => roundAmounts(report.fractionalCount)}
                        disabled={busy}
                        style={styles.action}
                      />
                    </View>
                  </View>
                </View>
              </HomeSection>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  intro: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginHorizontal: 20,
    marginTop: 8,
  },
  item: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  action: { flexShrink: 1 },
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
  },
});

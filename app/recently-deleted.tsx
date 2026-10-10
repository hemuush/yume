import { ScreenLoadError } from '@/components/ScreenLoadError';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { EmptyState } from '@/components/EmptyState';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Amount } from '@/components/Amount';
import { theme } from '@/constants/theme';
import { Section } from '@/components/Section';
import { screenStyles as h } from '@/components/screenStyles';
import { listCategories } from '@/db/categories';
import { inParent } from '@/lib/categoryLabel';
import { listAccounts } from '@/db/accounts';
import {
  listDeletedEntries,
  restoreDeletedEntry,
  emptyDeletedEntries,
  DeletedEntry,
} from '@/db/recentlyDeleted';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { emitTransactionsChanged } from '@/lib/dataEvents';
import { errorMessage } from '@/lib/errorMessage';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { dayMonth } from '@/lib/dateLabels';
import { toLocalIsoDate } from '@/lib/date';
import { Category, Account } from '@/types';
import { showAlert } from '@/components/AppDialog';
import { isSavingsEntry } from '@/lib/privateSummary';
import { savingsAccountIdsOf } from '@/lib/account';
import { useAccent } from '@/theme/AccentContext';
import { Glass, GLASS, GLASS_CARD } from '@/components/Glass';
import { Kicker, frost } from '@/components/Frost';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { DaysLeftRing } from '@/features/profile/DaysLeftRing';

/**
 * Entries deleted in the last 30 days, newest first, each with a Restore button that puts it back exactly
 * as it was. Reached from Profile › Settings › Alerts & backup.
 */
export default function RecentlyDeletedScreen() {
  const insets = useSafeAreaInsets();
  const { accent, secondary } = useAccent();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const [entries, setEntries] = useState<DeletedEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [e, c, a] = await Promise.all([listDeletedEntries(), listCategories(true), listAccounts(true)]);
    setEntries(e);
    setCategories(c);
    setAccounts(a);
  }, []);
  const { loaded, hasData, loadError, reload } = useScreenLoad(load);

  const today = toLocalIsoDate(new Date());
  const groups = useMemo(() => {
    const todays = entries.filter((e) => toLocalIsoDate(new Date(e.deletedAt)) === today);
    const earlier = entries.filter((e) => toLocalIsoDate(new Date(e.deletedAt)) !== today);
    return [
      { title: 'Today', items: todays },
      { title: 'Earlier', items: earlier },
    ].filter((g) => g.items.length > 0);
  }, [entries, today]);

  const restore = async (entry: DeletedEntry) => {
    setBusyId(entry.id);
    try {
      await restoreDeletedEntry(entry.id);
      haptics.confirm();
      emitTransactionsChanged();
      await reload();
    } catch (e) {
      showAlert("Couldn't restore it", errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const emptyAll = () => {
    showAlert(
      'Delete all for good?',
      `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} will be gone for good. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            try {
              await emptyDeletedEntries();
              haptics.warn();
              await reload();
            } catch (e) {
              showAlert("Couldn't empty it", errorMessage(e));
            }
          },
        },
      ]
    );
  };

  const categoryOf = (id: string | null) => (id ? categories.find((c) => c.id === id) : undefined);
  // "Hide savings & investment amounts" covers a savings category and a transfer into or out of savings alike.
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const savingsIds = useMemo(() => savingsAccountIdsOf(accounts), [accounts]);
  const isSavings = (entry: DeletedEntry) =>
    isSavingsEntry(
      {
        type: entry.type,
        accountId: entry.accountId,
        toAccountId: entry.toAccountId,
        categoryId: entry.categoryId,
      },
      categoriesById,
      savingsIds
    );
  const parentOf = (cat: Category | undefined) =>
    cat?.parentId ? categories.find((c) => c.id === cat.parentId)?.name : undefined;

  if (!hasData && loadError)
    return <ScreenLoadError title="Recently deleted" message={loadError} onRetry={() => void reload()} />;

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
            <Text style={styles.errorTitle}>Couldn&rsquo;t load Recently deleted</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
            <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void reload()} />
          </View>
        )}
        {!loaded ? (
          <View style={{ marginTop: theme.layout.screenTopGap }}>
            <CardRowsSkeleton rows={3} />
          </View>
        ) : entries.length === 0 ? (
          <EmptyState
            title="Nothing here"
            subtitle="Entries you delete wait here for 30 days, then they're gone for good."
          />
        ) : (
          <>
            <Glass radius={28} tone="strong" style={frost.hero}>
              <Kicker icon="trash-2">Waiting to be restored</Kicker>
              <View style={frost.bigRow}>
                <Text style={frost.bigValue}>{entries.length}</Text>
                <Text style={frost.bigNote}>{entries.length === 1 ? 'entry' : 'entries'}</Text>
              </View>
              <Text style={styles.hint}>
                Entries you delete wait here for 30 days, then they&rsquo;re gone for good. Each ring is the
                time left.
              </Text>
            </Glass>
            {groups.map((g) => (
              <Section key={g.title} title={g.title}>
                <View style={[h.card, GLASS_CARD]}>
                  {g.items.map((entry, i) => {
                    const cat = categoryOf(entry.categoryId);
                    const isTransfer = entry.type === 'transfer';
                    const title = isTransfer ? 'Transfer' : (cat?.name ?? 'Uncategorised');
                    const where =
                      entry.note.trim() || accounts.find((a) => a.id === entry.accountId)?.name || '';
                    const sub = entry.blockedReason
                      ? entry.blockedReason
                      : [
                          isTransfer ? undefined : inParent(parentOf(cat)),
                          where,
                          dayMonth(entry.date),
                          `${entry.daysLeft} day${entry.daysLeft === 1 ? '' : 's'} left`,
                        ]
                          .filter(Boolean)
                          .join(' · ');
                    return (
                      <View key={entry.id} style={[h.row, i > 0 && h.divider]}>
                        <DaysLeftRing daysLeft={entry.daysLeft}>
                          <CategoryIcon
                            name={isTransfer ? 'swap-horizontal' : (cat?.icon ?? 'tag')}
                            color={isTransfer ? secondary : (cat?.color ?? theme.colors.textMuted)}
                            square={38}
                            round
                          />
                        </DaysLeftRing>
                        <View style={h.mid}>
                          <Text style={h.title} numberOfLines={2}>
                            {title}
                          </Text>
                          <Text style={h.sub} numberOfLines={2}>
                            {sub}
                          </Text>
                        </View>
                        <Text
                          style={[
                            h.amount,
                            entry.type === 'expense' && h.expense,
                            entry.type === 'income' && h.income,
                          ]}
                        >
                          {entry.type === 'expense' ? '−' : entry.type === 'income' ? '+' : ''}
                          <Amount minor={entry.amountMinor} sensitive={isSavings(entry)} />
                        </Text>
                        {!entry.blockedReason && (
                          <Pressable
                            onPress={() => void restore(entry)}
                            disabled={busyId != null}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`Restore ${title}${entry.note ? `, ${entry.note}` : ''}`}
                            style={withPressed(styles.restore)}
                          >
                            <Text style={styles.restoreText}>{busyId === entry.id ? '…' : 'Restore'}</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              </Section>
            ))}
            <Pressable
              onPress={emptyAll}
              accessibilityRole="button"
              style={withPressed(styles.emptyAll)}
              hitSlop={8}
            >
              <Text style={styles.emptyAllText}>Delete all for good</Text>
            </Pressable>
          </>
        )}
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        collapse={collapse}
        summary={
          entries && entries.length > 0 ? (
            <HeaderSummary
              figure={String(entries.length)}
              rest={entries.length === 1 ? 'entry to restore' : 'entries to restore'}
              dot={theme.colors.slice.debt}
            />
          ) : undefined
        }
        title="Recently deleted"
        showBack
        hideUser
        wallpaper
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  hint: { fontFamily: theme.font.body, fontSize: 13, lineHeight: 18, color: theme.colors.textSecondary },
  restore: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  restoreText: { fontFamily: theme.font.roundedBold, fontSize: 12, color: theme.colors.white },
  emptyAll: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 13,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: GLASS.edge,
    backgroundColor: GLASS.fill,
  },
  emptyAllText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expenseText },
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
});

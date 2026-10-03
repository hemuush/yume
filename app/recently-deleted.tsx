import { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { AppHeader } from '@/components/AppHeader';
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

/**
 * Entries deleted in the last 30 days, newest first, each with a Restore button that puts it back exactly
 * as it was. Reached from Profile › Settings › Alerts & backup.
 */
export default function RecentlyDeletedScreen() {
  const insets = useSafeAreaInsets();
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
  const { loaded, loadError, reload } = useScreenLoad(load);

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
  const parentOf = (cat: Category | undefined) =>
    cat?.parentId ? categories.find((c) => c.id === cat.parentId)?.name : undefined;

  return (
    <View style={styles.container}>
      <AppHeader title="Recently deleted" showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn&rsquo;t load Recently deleted</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
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
            <Text style={styles.hint}>
              Entries you delete wait here for 30 days, then they&rsquo;re gone for good.
            </Text>
            {groups.map((g) => (
              <Section key={g.title} title={g.title}>
                <View style={h.card}>
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
                        <CategoryIcon
                          name={isTransfer ? 'swap-horizontal' : (cat?.icon ?? 'tag')}
                          color={isTransfer ? theme.colors.secondary : (cat?.color ?? theme.colors.textMuted)}
                        />
                        <View style={h.mid}>
                          <Text style={h.title} numberOfLines={1}>
                            {title}
                          </Text>
                          <Text style={h.sub} numberOfLines={1}>
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
                          <Amount minor={entry.amountMinor} sensitive={cat?.isSensitive} />
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  hint: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginHorizontal: 20,
    marginTop: theme.layout.screenTopGap,
  },
  restore: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
  },
  restoreText: { fontFamily: theme.font.roundedBold, fontSize: 12, color: theme.colors.textPrimary },
  emptyAll: { alignSelf: 'center', marginTop: 24, paddingHorizontal: 14, paddingVertical: 8 },
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

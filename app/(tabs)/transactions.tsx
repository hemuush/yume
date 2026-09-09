import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Animated } from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { Account, Category, Transaction, TransactionType } from '@/types';
import { SegmentedControl } from '@/components/SegmentedControl';
import { AppHeader } from '@/components/AppHeader';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { toLocalIsoDate } from '@/lib/date';
import { useFadeIn } from '@/lib/useFadeIn';
import { NeoTile } from '@/components/NeoTile';
import { styles } from '@/features/transactions/transactions.styles';
import { MONTH_NAMES } from '@/features/transactions/transactions.constants';
import { MonthPickerModal } from '@/features/transactions/MonthPickerModal';
import { FilterModal } from '@/features/transactions/FilterModal';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { TransactionDetailModal } from '@/features/transactions/TransactionDetailModal';
import { AddTransactionModal } from '@/features/transactions/AddTransactionModal';

function isoDate(d: Date): string {
  return toLocalIsoDate(d);
}

// A 7-day window ending on `anchor`, oldest first — `anchor` is a plain day
// step, not a week counter, so jumping straight to a chosen month (via the
// picker below) works the same way stepping by one day does.
function sevenDaysEndingOn(
  anchor: Date
): { iso: string; weekday: string; day: number; month: number; year: number }[] {
  const days: { iso: string; weekday: string; day: number; month: number; year: number }[] = [];
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - i);
    days.push({
      iso: isoDate(d),
      weekday: labels[d.getDay()],
      day: d.getDate(),
      month: d.getMonth(),
      year: d.getFullYear(),
    });
  }
  return days;
}

const VIEW_SCOPES: { label: string; value: 'week' | 'month' }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { accent } = useAccent();
  const dayNumActiveColor = accent === theme.colors.ink ? theme.colors.white : accent;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [initialType, setInitialType] = useState<TransactionType>('expense');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const params = useLocalSearchParams<{ openAdd?: string }>();
  // Refreshed on every focus (below), not frozen at mount — this screen
  // stays alive for the whole app session (it's a tab, never unmounted), so
  // a `useMemo(..., [])` "today" would keep reporting yesterday's date to
  // anyone who opens the app before midnight and returns to this tab after.
  const [todayDate, setTodayDate] = useState(() => new Date());
  // The last day of the visible 7-day window (week scope) or any day within
  // the visible month (month scope) — stepping by single days/months via the
  // ‹ › arrows, or jumped straight to any month via the picker below
  // (reaching January from September used to mean eight taps of ‹; picking
  // "Jan" from the month grid is one tap).
  const [anchor, setAnchor] = useState(todayDate);
  const [viewScope, setViewScope] = useState<'week' | 'month'>('week');
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);
  const days = useMemo(() => sevenDaysEndingOn(anchor), [anchor]);
  const today = isoDate(todayDate);
  const isCurrentWeek = days.some((d) => d.iso === today);
  const isCurrentMonth =
    anchor.getFullYear() === todayDate.getFullYear() && anchor.getMonth() === todayDate.getMonth();
  const listFadeStyle = useFadeIn([transactions]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The list always matches whatever the header above it is currently
  // showing — a single day when one is tapped, the visible 7-day window in
  // Week scope, or the whole calendar month in Month scope — rather than an
  // unscoped "most recent 200 across all time" that could (and did) show a
  // January transaction while the header read "This week" in September,
  // with no connection between the two.
  const monthRange = useMemo(() => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    return { fromDate: toLocalIsoDate(new Date(y, m, 1)), toDate: toLocalIsoDate(new Date(y, m + 1, 0)) };
  }, [anchor]);
  const visibleRange = selectedDate
    ? { fromDate: selectedDate, toDate: selectedDate }
    : viewScope === 'month'
      ? monthRange
      : { fromDate: days[0].iso, toDate: days[6].iso };
  const hasActiveFilter = filterType !== 'all' || filterCategoryIds.length > 0;
  const filteredTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (filterCategoryIds.length > 0) {
          if (!t.categoryId) return false;
          const cat = categories.find((c) => c.id === t.categoryId);
          // Selecting a parent (e.g. "Food & Dining") also matches its
          // subcategories ("Zomato", "Bistro Central") — otherwise picking
          // the parent chip would only ever surface transactions tagged
          // directly against it, which is narrower than what "Food &
          // Dining" means once it has children with spend rolled up to it
          // everywhere else (Reports).
          const matchesDirectly = filterCategoryIds.includes(t.categoryId);
          const matchesViaParent = !!cat?.parentId && filterCategoryIds.includes(cat.parentId);
          if (!matchesDirectly && !matchesViaParent) return false;
        }
        return true;
      }),
    [transactions, filterType, filterCategoryIds, categories]
  );

  const load = useCallback(async (range: { fromDate: string; toDate: string }) => {
    try {
      const [tx, accs, cats] = await Promise.all([listTransactions(range), listAccounts(), listCategories()]);
      setTransactions(tx);
      setAccounts(accs);
      setCategories(cats);
      setLoadError(null);
    } catch (e: any) {
      // Previously unguarded — a transient DB failure left the screen
      // silently showing stale/empty data with no indication anything
      // went wrong, the same class of bug already fixed on the other tabs.
      setLoadError(String(e?.message ?? e));
    }
  }, []);

  // Destructured so the focus effect depends on the two primitive dates, not
  // the fresh `visibleRange` object rebuilt every render (which would re-run
  // the load on every render).
  const { fromDate: rangeFromDate, toDate: rangeToDate } = visibleRange;
  useFocusEffect(
    useCallback(() => {
      const now = new Date();
      setTodayDate((prev) => (isoDate(prev) === isoDate(now) ? prev : now));
      load({ fromDate: rangeFromDate, toDate: rangeToDate });
    }, [load, rangeFromDate, rangeToDate])
  );

  // Switching Week↔Month with a single day still selected would otherwise
  // leave the list stuck on that one day while the header now shows a whole
  // month — the scope toggle always means "show me the wider range."
  const onChangeViewScope = (scope: 'week' | 'month') => {
    setViewScope(scope);
    setSelectedDate(null);
  };

  // The center nav "+" button routes here with ?openAdd=expense|income|transfer
  // (see app/quick-add.tsx) rather than duplicating the whole transaction
  // form on a second screen — this just opens the same modal pre-set to the
  // chosen type. The param is cleared immediately so returning to this tab
  // later doesn't reopen the modal on its own.
  useEffect(() => {
    if (params.openAdd) {
      setInitialType(params.openAdd as TransactionType);
      setModalVisible(true);
      router.setParams({ openAdd: undefined });
    }
  }, [params.openAdd]);

  const onSelectDay = (iso: string) => {
    setSelectedDate((prev) => (prev === iso ? null : iso));
  };

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—';

  return (
    <View style={styles.container}>
      <AppHeader
        title="Transactions"
        right={
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setFilterVisible(true)}
              hitSlop={8}
              style={[styles.filterBtn, hasActiveFilter && styles.filterBtnActive]}
              accessibilityRole="button"
              accessibilityLabel="Filter transactions"
            >
              <Text style={styles.filterBtnText}>⚙ Filter{hasActiveFilter ? ' •' : ''}</Text>
            </Pressable>
          </View>
        }
      />

      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Couldn't load your transactions</Text>
          <Text style={styles.errorDetail}>{loadError}</Text>
        </View>
      )}

      <View style={styles.scopeRow}>
        <SegmentedControl options={VIEW_SCOPES} value={viewScope} onChange={onChangeViewScope} />
      </View>

      <View style={styles.weekNavRow}>
        <Pressable
          onPress={() =>
            setAnchor((a) => {
              if (viewScope === 'month') return new Date(a.getFullYear(), a.getMonth() - 1, 1);
              const d = new Date(a);
              d.setDate(d.getDate() - 7);
              return d;
            })
          }
          hitSlop={10}
          style={styles.weekNavBtn}
        >
          <Text style={styles.weekNavArrow}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setMonthPickerVisible(true)} hitSlop={6}>
          <Text style={styles.weekNavLabel}>
            {viewScope === 'month'
              ? `${anchor.toLocaleDateString(undefined, { month: 'long' })}${isCurrentMonth ? '' : ` ${anchor.getFullYear()}`}`
              : isCurrentWeek
                ? 'This week'
                : `${MONTH_NAMES[days[0].month]} ${days[0].day}${days[0].year !== days[6].year || days[0].month !== days[6].month ? ` – ${MONTH_NAMES[days[6].month]} ${days[6].day}` : ` – ${days[6].day}`}, ${days[6].year}`}
            {'  ▾'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() =>
            setAnchor((a) => {
              const next =
                viewScope === 'month'
                  ? new Date(a.getFullYear(), a.getMonth() + 1, 1)
                  : (() => {
                      const d = new Date(a);
                      d.setDate(d.getDate() + 7);
                      return d;
                    })();
              return next > todayDate ? todayDate : next;
            })
          }
          hitSlop={10}
          disabled={viewScope === 'month' ? isCurrentMonth : isCurrentWeek}
          style={styles.weekNavBtn}
        >
          <Text
            style={[
              styles.weekNavArrow,
              (viewScope === 'month' ? isCurrentMonth : isCurrentWeek) && styles.weekNavArrowDisabled,
            ]}
          >
            ›
          </Text>
        </Pressable>
      </View>

      <MonthPickerModal
        visible={monthPickerVisible}
        anchor={anchor}
        todayDate={todayDate}
        onClose={() => setMonthPickerVisible(false)}
        onPick={(d) => {
          setAnchor(d);
          setViewScope('month');
          setSelectedDate(null);
          setMonthPickerVisible(false);
        }}
      />

      <FilterModal
        visible={filterVisible}
        categories={categories}
        type={filterType}
        categoryIds={filterCategoryIds}
        onClose={() => setFilterVisible(false)}
        onApply={(type, categoryIds) => {
          setFilterType(type);
          setFilterCategoryIds(categoryIds);
          setFilterVisible(false);
        }}
      />

      {viewScope === 'week' && (
        <View style={styles.dayStrip}>
          {days.map((d) => {
            const active = selectedDate === d.iso;
            return (
              <Pressable key={d.iso} style={styles.dayCell} onPress={() => onSelectDay(d.iso)}>
                <Text style={styles.dayWeekday}>{d.weekday}</Text>
                {active ? (
                  <NeoTile
                    backgroundColor={theme.colors.ink}
                    borderRadius={15}
                    shadowOffset={3}
                    style={styles.dayNumWrap}
                  >
                    <Text style={[styles.dayNum, { color: dayNumActiveColor }]}>{d.day}</Text>
                  </NeoTile>
                ) : (
                  <View
                    style={[
                      styles.dayNumWrap,
                      styles.dayNumWrapPlain,
                      d.iso === today && styles.dayNumWrapToday,
                    ]}
                  >
                    <Text style={styles.dayNum}>{d.day}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        {accounts.length === 0 && (
          <Text style={styles.emptyText}>Add an account first before recording transactions.</Text>
        )}
        {accounts.length > 0 && transactions.length > 0 && filteredTransactions.length === 0 && (
          <Text style={styles.emptyText}>Nothing matches the current filter.</Text>
        )}
        {accounts.length > 0 && transactions.length === 0 && (
          <Text style={styles.emptyText}>
            {selectedDate
              ? 'Nothing logged this day.'
              : viewScope === 'month'
                ? 'Nothing logged this month.'
                : 'Nothing logged this week.'}
          </Text>
        )}
        {filteredTransactions.length > 0 && (
          <Animated.View style={[styles.txCard, listFadeStyle]}>
            <NeoTile>
              {filteredTransactions.map((tx, i) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                return (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    cat={cat}
                    accountName={accountName}
                    categoryName={categoryName}
                    divider={i > 0}
                    onPress={() => setDetailTx(tx)}
                  />
                );
              })}
            </NeoTile>
          </Animated.View>
        )}
      </ScrollView>

      <AddTransactionModal
        visible={modalVisible || !!editingTx}
        accounts={accounts}
        categories={categories}
        editing={editingTx}
        initialType={initialType}
        onClose={() => {
          setModalVisible(false);
          setEditingTx(null);
        }}
        onSaved={async () => {
          setModalVisible(false);
          setEditingTx(null);
          await load(visibleRange);
        }}
      />

      <TransactionDetailModal
        tx={detailTx}
        accounts={accounts}
        categories={categories}
        onClose={() => setDetailTx(null)}
        onEdit={(tx) => {
          setDetailTx(null);
          setEditingTx(tx);
        }}
        onChanged={async () => {
          setDetailTx(null);
          await load(visibleRange);
        }}
      />
    </View>
  );
}

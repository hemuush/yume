import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { EmptyState } from '@/components/EmptyState';
import { Section } from '@/components/Section';
import { screenStyles as h } from '@/components/screenStyles';
import { dayLabel } from '@/lib/date';
import { investRole } from '@/lib/investment';
import { formatMoney } from '@/lib/money';
import { ROW_EXIT, ROW_LAYOUT } from '@/lib/animation';
import type { PeriodCursor } from '@/lib/period';
import { roundedMinor } from '@/lib/round';
import type { Account, Category, Transaction } from '@/types';
import { RecentTransactionRow } from './RecentTransactionRow';
import { emptyRecentCopy } from './recentActivity';
import { themedStyles } from '@/theme/themedStyles';

/**
 * Home's "Recent activity": the browsed period's latest entries, each day named once above its rows. It compares its
 * props by identity, so it is drawn again only when its own entries, or what names them, change.
 */
export const HomeRecentActivity = memo(function HomeRecentActivity({
  recent,
  cursor,
  today,
  todaySpendMinor,
  categoriesById,
  accountsById,
  savingsIds,
  investIds,
  rowEntering,
  onOpenEntry,
  onSeeAll,
}: {
  recent: Transaction[];
  /** The period the entries belong to. */
  cursor: PeriodCursor;
  /** Today's date (ISO): its heading also says what went out today. */
  today: string;
  todaySpendMinor: number;
  categoriesById: ReadonlyMap<string, Category>;
  /** The name and currency of each account (all that a row says of one). */
  accountsById: ReadonlyMap<string, Pick<Account, 'name' | 'currency'>>;
  savingsIds: ReadonlySet<string>;
  investIds: ReadonlySet<string>;
  rowEntering: (i: number) => React.ComponentProps<typeof Animated.View>['entering'];
  onOpenEntry: (tx: Transaction) => void;
  /** "View all": opens the period in Activity. */
  onSeeAll: () => void;
}) {
  const categoryFor = (id: string | null) => (id ? categoriesById.get(id) : undefined);
  const parentNameFor = (id: string | null) => {
    const parentId = categoryFor(id)?.parentId;
    return parentId ? categoryFor(parentId)?.name : undefined;
  };
  const accountName = (id: string | null | undefined) => (id ? accountsById.get(id)?.name : undefined);
  const isSavingsTransfer = (tx: Transaction) =>
    tx.type === 'transfer' &&
    (savingsIds.has(tx.accountId) || (!!tx.toAccountId && savingsIds.has(tx.toAccountId)));
  return (
    <Section compact title="Recent activity" onSeeAll={onSeeAll} actionLabel="View all">
      {recent.length === 0 ? (
        <EmptyState {...emptyRecentCopy(cursor)} />
      ) : (
        <View style={styles.recent}>
          {recent.slice(0, 5).map((tx, i, rows) => (
            <Animated.View key={tx.id} entering={rowEntering(i)} layout={ROW_LAYOUT} exiting={ROW_EXIT}>
              {/* Each day is named once, above its rows; today also carries what went out. */}
              {(i === 0 || rows[i - 1].date !== tx.date) && (
                <View style={[h.dayHead, i > 0 && h.dayHeadDivider]}>
                  <Text style={h.dayHeadText}>{dayLabel(tx.date)}</Text>
                  {tx.date === today && cursor.offset === 0 && todaySpendMinor > 0 && (
                    <Text style={h.dayHeadText}>−{formatMoney(roundedMinor(todaySpendMinor))}</Text>
                  )}
                </View>
              )}
              <RecentTransactionRow
                showDay={false}
                onPress={() => onOpenEntry(tx)}
                currency={accountsById.get(tx.accountId)?.currency}
                tx={tx}
                category={categoryFor(tx.categoryId) ?? undefined}
                parentName={parentNameFor(tx.categoryId)}
                accountName={accountName(tx.accountId)}
                toAccountName={accountName(tx.toAccountId)}
                savingsTransfer={isSavingsTransfer(tx)}
                investRole={investRole(tx, investIds)}
                divider={i > 0 && rows[i - 1].date === tx.date}
              />
            </Animated.View>
          ))}
        </View>
      )}
    </Section>
  );
});

const styles = themedStyles(() =>
  StyleSheet.create({
    recent: { ...h.card, paddingHorizontal: 12 },
  })
);

import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { EmptyState } from '@/components/EmptyState';
import { groupedSurface } from '@/components/screenStyles';
import { Section } from '@/components/Section';
import { theme } from '@/constants/theme';
import { dayLabel } from '@/lib/date';
import { investRole } from '@/lib/investment';
import { formatMoneyExact } from '@/lib/money';
import { ROW_EXIT, ROW_LAYOUT } from '@/lib/animation';
import type { PeriodCursor } from '@/lib/period';
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
    <Section
      compact
      title="Recent activity"
      onSeeAll={onSeeAll}
      actionLabel={cursor.granularity === 'year' ? 'Open Activity' : 'View all'}
    >
      {recent.length === 0 ? (
        <EmptyState {...emptyRecentCopy(cursor)} />
      ) : (
        <Animated.View layout={ROW_LAYOUT} style={styles.recent}>
          {recent.slice(0, 4).map((tx, i, rows) => (
            <Animated.View key={tx.id} entering={rowEntering(i)} layout={ROW_LAYOUT} exiting={ROW_EXIT}>
              {/* Each day is named once, above its rows; today also carries what went out, once it has more than one entry (a lone entry already says it). */}
              {(i === 0 || rows[i - 1].date !== tx.date) && (
                <View style={[styles.dayHead, i > 0 && styles.dayHeadDivider]}>
                  <View style={styles.dayHeadLeft}>
                    <Text style={styles.dayHeadText}>{dayLabel(tx.date)}</Text>
                  </View>
                  {tx.date === today &&
                    cursor.offset === 0 &&
                    todaySpendMinor > 0 &&
                    rows.filter((r) => r.date === today).length > 1 && (
                      <Text style={styles.daySpendText}>−{formatMoneyExact(todaySpendMinor)}</Text>
                    )}
                </View>
              )}
              <RecentTransactionRow
                showDay={false}
                dense
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
        </Animated.View>
      )}
    </Section>
  );
});

const styles = themedStyles(() =>
  StyleSheet.create({
    recent: {
      marginHorizontal: 16,
      ...groupedSurface.frame,
      paddingBottom: 4,
      overflow: 'hidden',
    },
    dayHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 2,
    },
    dayHeadLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dayHeadDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.home.edge,
      marginTop: 4,
    },
    dayHeadText: {
      fontFamily: theme.font.bodyBold,
      fontSize: 11,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: theme.colors.home.secondaryText,
    },
    daySpendText: {
      fontFamily: theme.font.bodyBold,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
      letterSpacing: 0.2,
      color: theme.colors.home.secondaryText,
    },
  })
);

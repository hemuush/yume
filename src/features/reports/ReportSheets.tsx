import { View, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { Amount } from '@/components/Amount';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SuuIllustration } from '@/components/SuuIllustration';
import { CategoryBreakdownItem } from '@/db/reports';
import { Category, Transaction } from '@/types';
import { formatMoney } from '@/lib/money';
import { parseLocalIsoDate } from '@/lib/date';
import { theme } from '@/constants/theme';
import { DayTotal } from './DayTotal';
import { styles } from './reports.styles';

const txCount = (txs: Transaction[] | null) =>
  txs && txs.length > 0 ? `${txs.length} transaction${txs.length === 1 ? '' : 's'}` : undefined;

/** Shared body state: a spinner while loading, Suu asleep when there's nothing. */
function SheetBody<T>({
  items,
  emptyText,
  suuSize,
  children,
}: {
  items: T[] | null;
  emptyText: string;
  suuSize: number;
  children: (items: T[]) => React.ReactNode;
}) {
  if (items === null) return <ActivityIndicator color={theme.colors.ink} style={styles.daySpinner} />;
  if (items.length === 0)
    return (
      <View style={styles.dayEmpty}>
        <SuuIllustration size={suuSize} pose="sleepy" />
        <Text style={styles.empty}>{emptyText}</Text>
      </View>
    );
  return <>{children(items)}</>;
}

/** A category with subcategories: its split for the period. `items` is null while loading. */
export function SubcategorySheet({
  title,
  items,
  onClose,
}: {
  title: string | null;
  items: CategoryBreakdownItem[] | null;
  onClose: () => void;
}) {
  return (
    <ModalSheet
      visible={title != null}
      onClose={onClose}
      variant="center"
      showClose
      scrollable={false}
      title={title ?? undefined}
      footer={
        items && items.length > 0 ? (
          <View style={styles.dayTotalRow}>
            <Text style={styles.dayTotalLabel}>Total</Text>
            <Text style={styles.dayTotalValue}>
              {formatMoney(items.reduce((s, c) => s + c.totalMinor, 0))}
            </Text>
          </View>
        ) : undefined
      }
    >
      <SheetBody items={items} emptyText="Nothing logged here this period." suuSize={64}>
        {(list) =>
          list.map((c, i) => (
            <View key={c.categoryId} style={[styles.dayRow, i === 0 && styles.dayRowFirst]}>
              <View style={[styles.catDot, { backgroundColor: c.color }]} />
              <View style={styles.dayMid}>
                <Text style={styles.dayName} numberOfLines={1}>
                  {c.name}
                </Text>
              </View>
              <Amount minor={c.totalMinor} sensitive={c.isSensitive} style={styles.dayAmt} />
            </View>
          ))
        }
      </SheetBody>
    </ModalSheet>
  );
}

/** One heatmap day's transactions. `txs` is null while loading. */
export function DaySheet({
  iso,
  txs,
  catById,
  onClose,
}: {
  iso: string | null;
  txs: Transaction[] | null;
  catById: Map<string, Category>;
  onClose: () => void;
}) {
  return (
    <ModalSheet
      visible={iso != null}
      onClose={onClose}
      variant="center"
      showClose
      scrollable={false}
      title={
        iso ? parseLocalIsoDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : ''
      }
      subtitle={txCount(txs)}
      footer={txs && txs.length > 0 ? <DayTotal txs={txs} /> : undefined}
    >
      <SheetBody items={txs} emptyText="Nothing on this day." suuSize={72}>
        {(list) =>
          list.map((tx, i) => {
            const cat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
            const primary =
              cat?.name ??
              (tx.type === 'transfer' ? 'Transfer' : tx.type === 'income' ? 'Income' : 'Expense');
            const note = tx.note && tx.note !== primary ? tx.note : null;
            const sign = tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : '';
            return (
              <View key={tx.id} style={[styles.dayRow, i === 0 && styles.dayRowFirst]}>
                <CategoryIcon name={cat?.icon ?? 'swap-horizontal'} color={cat?.color} square={34} />
                <View style={styles.dayMid}>
                  <Text style={styles.dayName} numberOfLines={1}>
                    {primary}
                  </Text>
                  {note ? (
                    <Text style={styles.daySub} numberOfLines={1}>
                      {note}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.dayAmt,
                    tx.type === 'income' && { color: theme.colors.income },
                    tx.type === 'expense' && { color: theme.colors.idCoralDeep },
                    tx.type === 'transfer' && { color: theme.colors.textSecondary },
                  ]}
                >
                  {sign}
                  <Amount minor={tx.amountMinor} sensitive={cat?.isSensitive} />
                </Text>
              </View>
            );
          })
        }
      </SheetBody>
    </ModalSheet>
  );
}

/** A category without subcategories: its transactions for the period. `txs` is null while loading. */
export function CategoryTxSheet({
  category,
  txs,
  onClose,
}: {
  category: { name: string; isSensitive: boolean } | null;
  txs: Transaction[] | null;
  onClose: () => void;
}) {
  return (
    <ModalSheet
      visible={category != null}
      onClose={onClose}
      variant="center"
      showClose
      scrollable={false}
      title={category?.name}
      subtitle={txCount(txs)}
      footer={txs && txs.length > 0 ? <DayTotal txs={txs} /> : undefined}
    >
      <SheetBody items={txs} emptyText="Nothing logged in this category this period." suuSize={72}>
        {(list) =>
          list.map((tx, i) => (
            <View key={tx.id} style={[styles.dayRow, i === 0 && styles.dayRowFirst]}>
              <View style={styles.dayMid}>
                <Text style={styles.dayName} numberOfLines={1}>
                  {parseLocalIsoDate(tx.date).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
                {tx.note ? (
                  <Text style={styles.daySub} numberOfLines={1}>
                    {tx.note}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.dayAmt, { color: theme.colors.idCoralDeep }]}>
                −<Amount minor={tx.amountMinor} sensitive={category?.isSensitive} />
              </Text>
            </View>
          ))
        }
      </SheetBody>
    </ModalSheet>
  );
}

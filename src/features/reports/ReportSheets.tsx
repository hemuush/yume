import { View, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { Amount } from '@/components/Amount';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SuuIllustration } from '@/components/SuuIllustration';
import { Category, Transaction } from '@/types';
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
                <CategoryIcon name={cat?.icon ?? 'swap-horizontal'} color={cat?.color} />
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

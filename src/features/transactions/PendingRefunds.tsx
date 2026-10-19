import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { listExpectedRefunds, ExpectedRefund } from '@/db/refundTracking';
import { getTransactionById } from '@/db/transactions';
import { Transaction } from '@/types';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { dayMonthYear } from '@/lib/dateLabels';
import { styles } from './transactions.styles';
import { InsightHeader, InsightRow, insight } from '@/components/InsightCard';
import { toLocalIsoDate } from '@/lib/date';
export function PendingRefunds({
  refreshToken,
  onOpen,
}: {
  refreshToken: unknown;
  onOpen: (tx: Transaction) => void;
}) {
  const [items, setItems] = useState<ExpectedRefund[]>([]),
    [expanded, setExpanded] = useState(false),
    [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const { hideAmounts } = usePrivacy();
  useEffect(() => {
    let live = true;
    listExpectedRefunds()
      .then((rows) => {
        if (live) {
          setItems(rows);
          setFailed(false);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [refreshToken, revision]);
  if (!items.length && !failed) return null;
  const today = toLocalIsoDate(new Date());
  const ordered = [...items].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  return (
    <View
      style={[
        insight.card,
        {
          marginVertical: 0,
          marginTop: 16,
          borderRadius: 24,
          backgroundColor: theme.colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.borderSoft,
          gap: 8,
        },
      ]}
    >
      <InsightHeader
        title="Refunds awaiting payment"
        subtitle={
          items.length ? `${items.length} pending · excluded from balances` : 'Couldn’t load pending refunds'
        }
        icon="corner-down-left"
      />
      {failed ? (
        <>
          <Text style={styles.errorText}>Couldn't refresh pending refunds.</Text>
          <PrimaryButton
            compact
            variant="secondary"
            title="Retry refunds"
            onPress={() => setRevision((v) => v + 1)}
          />
        </>
      ) : (
        <>
          {ordered.slice(0, expanded ? ordered.length : 3).map((r) => (
            <InsightRow
              key={r.id}
              label={r.label}
              value={formatMaskableMoney(r.remainingMinor, {
                currency: r.currency,
                masked: hideAmounts && !!r.isSensitive,
              })}
              detail={
                r.dueDate
                  ? `${r.dueDate < today ? 'Overdue' : r.dueDate === today ? 'Due today' : 'Expected'} · ${dayMonthYear(r.dueDate)}`
                  : 'No expected date'
              }
              onPress={async () => {
                try {
                  const tx = await getTransactionById(r.transactionId);
                  if (tx) onOpen(tx);
                  else setFailed(true);
                } catch {
                  setFailed(true);
                }
              }}
            />
          ))}
          {items.length > 3 && (
            <PrimaryButton
              compact
              variant="secondary"
              title={expanded ? 'Show fewer refunds' : `View all ${items.length} refunds`}
              onPress={() => setExpanded(!expanded)}
            />
          )}
        </>
      )}
    </View>
  );
}

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { listExpectedRefunds, ExpectedRefund } from '@/db/refundTracking';
import { getTransactionById } from '@/db/transactions';
import { Transaction } from '@/types';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { styles } from './transactions.styles';
import { InsightHeader, InsightRow, insight } from '@/components/InsightCard';
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
  return (
    <View style={insight.card}>
      {failed ? (
        <>
          <InsightHeader
            title="Refunds on the way"
            subtitle={`${items.length} awaiting payment`}
            icon="corner-down-left"
          />
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
          <PrimaryButton
            compact
            variant="secondary"
            title={expanded ? 'Hide pending refunds' : 'View pending refunds'}
            onPress={() => setExpanded(!expanded)}
          />
          {expanded && (
            <>
              <Text style={styles.hintText}>Across all dates. Expected money is excluded from balances.</Text>
              {items.map((r) => (
                <InsightRow
                  key={r.id}
                  label={r.label}
                  value={formatMaskableMoney(r.remainingMinor, { currency: r.currency, masked: hideAmounts })}
                  detail={r.dueDate ? `Expected ${r.dueDate}` : 'No expected date'}
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
            </>
          )}
        </>
      )}
    </View>
  );
}

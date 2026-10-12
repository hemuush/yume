import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Transaction, Account } from '@/types';
import { Text } from '@/components/Text';
import { AmountField } from '@/components/AmountField';
import { DateField } from '@/components/DateField';
import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { useSaveOnce } from '@/lib/useSaveOnce';
import { toMinor, formatMaskableMoney } from '@/lib/money';
import { toLocalIsoDate } from '@/lib/date';
import { errorMessage } from '@/lib/errorMessage';
import { emitTransactionsChanged } from '@/lib/dataEvents';
import { usePrivacy } from '@/theme/PrivacyContext';
import { showAlert } from '@/components/AppDialog';
import {
  getExpectedRefund,
  expectRefund,
  receiveRefund,
  closeExpectedRefund,
  refundCandidates,
  undoRefundReceipt,
  ExpectedRefund,
} from '@/db/refundTracking';
import { styles } from './transactions.styles';
import { InsightHeader, InsightStat, InsightDisclosure, insight } from '@/components/InsightCard';

export function RefundTracker({
  transaction,
  accounts,
  onChanged,
}: {
  transaction: Transaction;
  accounts: Account[];
  onChanged: () => void;
}) {
  const [refund, setRefund] = useState<ExpectedRefund | null>(null);
  const [loaded, setLoaded] = useState(false),
    [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(''),
    [expected, setExpected] = useState('');
  const [date, setDate] = useState(toLocalIsoDate(new Date())),
    [hasDue, setHasDue] = useState(false),
    [due, setDue] = useState(toLocalIsoDate(new Date()));
  const [accountId, setAccountId] = useState(transaction.accountId);
  const [candidates, setCandidates] = useState<{ id: string; date: string; amount_minor: number }[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const { hideAmounts } = usePrivacy();
  const currency = accounts.find((a) => a.id === transaction.accountId)?.currency ?? 'INR';
  const money = (minor: number) => formatMaskableMoney(minor, { currency, masked: hideAmounts });
  useEffect(() => {
    let live = true;
    Promise.all([getExpectedRefund(transaction.id), refundCandidates(transaction.id)])
      .then(([r, cs]) => {
        if (!live) return;
        setRefund(r);
        setCandidates(cs);
        setExpected(String((r?.expectedMinor ?? transaction.amountMinor) / 100));
        setHasDue(!!r?.dueDate);
        if (r?.dueDate) setDue(r.dueDate);
        setLoaded(true);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [transaction.id, transaction.amountMinor]);
  const run = useSaveOnce(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      emitTransactionsChanged();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  });
  if (loaded && !refund && !editing)
    return (
      <PrimaryButton compact variant="secondary" title="Expect refund" onPress={() => setEditing(true)} />
    );
  return (
    <View style={insight.card}>
      <InsightHeader
        title="Money coming back"
        subtitle={refund?.closed ? 'Tracking closed' : 'Expected refunds stay outside your balance'}
        icon="corner-down-left"
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      {!loaded ? (
        <Text style={styles.hintText}>{error ? 'Reopen this purchase to retry.' : 'Checking refunds…'}</Text>
      ) : (
        <>
          {refund && (
            <>
              <View style={insight.facts}>
                <InsightStat label="Still awaiting" value={money(refund.remainingMinor)} />
                <InsightStat label="Received" value={money(refund.receivedMinor)} />
              </View>
              {refund.dueDate && <Text style={insight.caption}>Expected by {refund.dueDate}</Text>}
              {refund.dueDate && refund.dueDate < toLocalIsoDate(new Date()) && refund.remainingMinor > 0 && (
                <Text style={styles.errorText}>Past the expected date</Text>
              )}
              {refund.receipts.length > 0 && (
                <InsightDisclosure title={`Receipt history · ${refund.receipts.length}`}>
                  {refund.receipts.map((r) => (
                    <View key={r.id} style={styles.splitPart}>
                      <Text style={styles.splitPartName}>
                        {r.date} · {money(r.amountMinor)}
                      </Text>
                      <PrimaryButton
                        compact
                        variant="secondary"
                        title={r.createdTransaction ? 'Undo receipt' : 'Unlink receipt'}
                        disabled={busy}
                        onPress={() =>
                          showAlert(
                            'Undo this refund receipt?',
                            r.createdTransaction
                              ? 'This removes the received refund transaction and restores the pending amount.'
                              : 'The original refund transaction stays recorded. Only its link is removed.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Undo',
                                style: 'destructive',
                                onPress: () => void run(() => undoRefundReceipt(r.id)),
                              },
                            ]
                          )
                        }
                      />
                    </View>
                  ))}
                </InsightDisclosure>
              )}
            </>
          )}
          {!refund || editing ? (
            <>
              <AmountField label="Expected refund amount" value={expected} onChangeText={setExpected} />
              <View style={styles.splitPart}>
                <Text style={styles.splitPartName}>Expected by a date</Text>
                <ToggleSwitch accessibilityLabel="Expected refund date" value={hasDue} onChange={setHasDue} />
              </View>
              {hasDue && (
                <DateField label="Expected date" value={due} onChange={setDue} minDate={transaction.date} />
              )}
              <Text style={styles.hintText}>
                Expectation only. Your balance changes when money is received.
              </Text>
              <PrimaryButton
                title="Save expectation"
                disabled={busy}
                onPress={() =>
                  void run(() => expectRefund(transaction.id, toMinor(Number(expected)), hasDue ? due : null))
                }
              />
              <PrimaryButton
                compact
                variant="secondary"
                title="Cancel editing"
                disabled={busy}
                onPress={() => {
                  setEditing(false);
                  setExpected(String((refund?.expectedMinor ?? transaction.amountMinor) / 100));
                  setHasDue(!!refund?.dueDate);
                  if (refund?.dueDate) setDue(refund.dueDate);
                  setError(null);
                }}
              />
            </>
          ) : (
            <>
              {!refund.closed && refund.remainingMinor > 0 && (
                <InsightDisclosure title="Record money received">
                  <AmountField label="Refund received" value={amount} onChangeText={setAmount} />
                  <DateField
                    label="Received date"
                    value={date}
                    onChange={setDate}
                    minDate={transaction.date}
                    maxDate={toLocalIsoDate(new Date())}
                  />
                  <View style={styles.chipRow}>
                    {accounts
                      .filter((a) => !a.archived && a.type !== 'savings' && a.currency === currency)
                      .map((a) => (
                        <Chip
                          key={a.id}
                          label={a.name}
                          active={a.id === accountId}
                          onPress={() => setAccountId(a.id)}
                        />
                      ))}
                  </View>
                  <PrimaryButton
                    title="Record received refund"
                    disabled={busy}
                    onPress={() =>
                      void run(() =>
                        receiveRefund(transaction.id, {
                          amountMinor: toMinor(Number(amount)),
                          date,
                          accountId,
                        })
                      )
                    }
                  />
                  {candidates.length > 0 && (
                    <>
                      <Text style={styles.hintText}>
                        Already logged? Link a refund below to avoid recording it twice.
                      </Text>
                      <View style={styles.chipRow}>
                        {candidates.map((c) => (
                          <Chip
                            key={c.id}
                            active={false}
                            label={`${c.date} · ${money(c.amount_minor)}`}
                            onPress={() =>
                              void run(() =>
                                receiveRefund(transaction.id, {
                                  amountMinor: c.amount_minor,
                                  date: c.date,
                                  accountId,
                                  existingRefundId: c.id,
                                })
                              )
                            }
                          />
                        ))}
                      </View>
                    </>
                  )}
                </InsightDisclosure>
              )}
              <InsightDisclosure title="Manage expectation">
                <PrimaryButton
                  compact
                  variant="secondary"
                  title={refund.closed ? 'Reopen expectation' : 'Edit expectation'}
                  disabled={busy}
                  onPress={() => setEditing(true)}
                />
                {refund.remainingMinor > 0 && (
                  <PrimaryButton
                    compact
                    variant="secondary"
                    title={refund.receipts.length ? 'Close remaining expectation' : 'Cancel expectation'}
                    disabled={busy}
                    onPress={() =>
                      showAlert(
                        'Stop awaiting this refund?',
                        'Closing does not record additional received money. Existing refunds remain in your ledger.',
                        [
                          { text: 'Keep awaiting', style: 'cancel' },
                          {
                            text: 'Stop tracking',
                            onPress: () => void run(() => closeExpectedRefund(transaction.id)),
                          },
                        ]
                      )
                    }
                  />
                )}
              </InsightDisclosure>
            </>
          )}
        </>
      )}
    </View>
  );
}

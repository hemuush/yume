import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { AmountField } from '@/components/AmountField';
import { DateField } from '@/components/DateField';
import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { listAccounts } from '@/db/accounts';
import { estimatePurchase } from '@/db/purchaseAffordability';
import { Account } from '@/types';
import { router, useFocusEffect } from 'expo-router';
import { useSaveOnce } from '@/lib/useSaveOnce';
import { errorMessage } from '@/lib/errorMessage';
import { toMinor, formatMaskableMoney } from '@/lib/money';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { dayMonthYear } from '@/lib/dateLabels';
import { usePrivacy } from '@/theme/PrivacyContext';
import { styles } from './whatif.styles';
import { theme } from '@/constants/theme';
import { InsightHeader, InsightStat, InsightRow, InsightDisclosure, insight } from '@/components/InsightCard';
export function PurchaseCheck() {
  const [accounts, setAccounts] = useState<Account[]>([]),
    [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState(''),
    [date, setDate] = useState(toLocalIsoDate(new Date()));
  const [result, setResult] = useState<Awaited<ReturnType<typeof estimatePurchase>> | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const { hideAmounts } = usePrivacy();
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const revision = useRef(0);
  const loadAccounts = useCallback(() => {
    let live = true;
    const requestRevision = ++revision.current;
    setResult(null);
    setError(null);
    setLoadingAccounts(true);
    setAccountError(null);
    listAccounts()
      .then((as) => {
        if (!live || revision.current !== requestRevision) return;
        const eligible = as.filter(
          (a) => !a.archived && !a.investment && ['bank', 'cash', 'wallet'].includes(a.type)
        );
        setAccounts(eligible);
        setAccountId((id) => (eligible.some((a) => a.id === id) ? id : (eligible[0]?.id ?? null)));
        setLoadingAccounts(false);
      })
      .catch((e) => {
        if (live && revision.current === requestRevision) {
          setAccountError(errorMessage(e));
          setLoadingAccounts(false);
        }
      });
    return () => {
      live = false;
      revision.current++;
    };
  }, []);
  useFocusEffect(loadAccounts);
  const check = useSaveOnce(async () => {
    const requestRevision = revision.current;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (!accountId) throw new Error('Add a spending account first.');
      const estimate = await estimatePurchase(accountId, toMinor(Number(amount)), date);
      if (revision.current === requestRevision) setResult(estimate);
    } catch (e) {
      if (revision.current === requestRevision) setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  });
  const money = (minor: number) =>
    formatMaskableMoney(minor, { currency: result?.currency, masked: hideAmounts });
  return (
    <Glass radius={28} style={[styles.card, { gap: 12 }]}>
      <InsightHeader
        title="Can I afford it?"
        subtitle="Check a purchase while keeping your goals aside"
        icon="shopping-bag"
      />
      {loadingAccounts ? (
        <Text style={insight.caption}>Loading spending accounts…</Text>
      ) : accountError ? (
        <>
          <Text style={insight.warning}>{accountError}</Text>
          <PrimaryButton
            compact
            variant="secondary"
            title="Retry accounts"
            onPress={() => {
              loadAccounts();
            }}
          />
        </>
      ) : !accounts.length ? (
        <>
          <Text style={insight.caption}>Add a bank, cash or wallet account to check a purchase.</Text>
          <PrimaryButton title="Manage accounts" onPress={() => router.push('/profile')} />
        </>
      ) : (
        <>
          <AmountField
            label={`Planned purchase (${accounts.find((a) => a.id === accountId)?.currency ?? '—'})`}
            value={amount}
            onChangeText={(v) => {
              revision.current++;
              setAmount(v);
              setResult(null);
            }}
          />
          <DateField
            label="Purchase date"
            value={date}
            onChange={(v) => {
              revision.current++;
              setDate(v);
              setResult(null);
            }}
            minDate={toLocalIsoDate(new Date())}
            maxDate={addDaysToIsoDate(toLocalIsoDate(new Date()), 90)}
          />
          <View style={styles.chipRow}>
            {accounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                active={accountId === a.id}
                onPress={() => {
                  revision.current++;
                  setAccountId(a.id);
                  setResult(null);
                }}
              />
            ))}
          </View>
          {error && <Text style={styles.errorDetail}>{error}</Text>}
          <PrimaryButton
            title={busy ? 'Checking…' : 'Check purchase'}
            disabled={busy || !accountId || !Number.isFinite(Number(amount)) || Number(amount) <= 0}
            onPress={check}
          />
          <Text style={insight.caption}>
            Checks recorded bills and goal reservations. Leave room for everyday spending.
          </Text>
          {result && (
            <View
              style={[
                insight.result,
                !hideAmounts &&
                  (result.shortfallMinor > 0 || result.incompleteSchedule) && {
                    backgroundColor: theme.colors.expenseTint,
                  },
              ]}
            >
              <Text style={insight.title}>
                {hideAmounts
                  ? 'Estimate hidden'
                  : result.incompleteSchedule
                    ? 'Incomplete loan schedule — review before deciding'
                    : result.shortfallMinor > 0
                      ? `Short by ${money(result.shortfallMinor)}`
                      : 'Covered under these assumptions'}
              </Text>
              <View style={insight.facts}>
                <InsightStat label="After purchase" value={money(result.afterPurchaseMinor)} />
                <InsightStat label="Lowest available" value={money(result.lowestMinor)} />
              </View>
              {result.reservations.length > 0 && (
                <InsightRow label="Kept for your goals" value={money(result.reservedMinor)} />
              )}
              <Text style={insight.caption}>
                Checked through {dayMonthYear(result.through)}. Expected refunds aren't counted.
              </Text>
              {result.incompleteSchedule && (
                <Text style={styles.errorDetail}>
                  A linked loan has no remaining schedule. This estimate cannot confirm coverage.
                </Text>
              )}
              <InsightDisclosure title="How this estimate works">
                <Text style={insight.caption}>
                  Lowest balance on {hideAmounts ? '••••' : dayMonthYear(result.lowestDate)}. Same-day debits
                  are checked before income.
                </Text>
                <Text style={insight.caption}>
                  Estimate only. Excludes unrecorded everyday spending, expected refunds, and credit-card
                  repayments without a recorded payment account. Nothing is saved or spent here.
                </Text>
                {result.reservations.map((g) => (
                  <InsightRow
                    key={g.id}
                    label={g.name}
                    detail={g.archived ? 'Archived · still reserved' : 'Reserved for goal'}
                    value={money(g.reservedMinor)}
                  />
                ))}
              </InsightDisclosure>
              <InsightDisclosure title="Scheduled money in and out">
                {result.movements
                  .filter((m) => !m.isPurchase)
                  .map((m, i) => (
                    <InsightRow
                      key={i}
                      label={m.label}
                      detail={dayMonthYear(m.date)}
                      value={money(m.deltaMinor)}
                    />
                  ))}
                {!result.movements.some((m) => !m.isPurchase) && (
                  <Text style={insight.caption}>No scheduled account movements in this window.</Text>
                )}
              </InsightDisclosure>
            </View>
          )}
        </>
      )}
    </Glass>
  );
}

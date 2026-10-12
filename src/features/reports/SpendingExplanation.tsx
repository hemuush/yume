import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { DateRange } from '@/types';
import { getSpendingExplanation } from '@/db/spendingExplanation';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { allocateRoundedMinor } from '@/lib/round';
import { errorMessage } from '@/lib/errorMessage';
import { router } from 'expo-router';
import { InsightHeader, InsightRow, InsightDisclosure, insight } from '@/components/InsightCard';
export function SpendingExplanation({
  categoryId,
  current,
  previous,
  onExplore,
  onBeforeEntry,
}: {
  categoryId: string;
  current: DateRange;
  previous: DateRange;
  onExplore?: () => void;
  onBeforeEntry?: () => void;
}) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof getSpendingExplanation>> | null>(null),
    [error, setError] = useState<string | null>(null);
  const { hideAmounts } = usePrivacy();
  const currentStart = current.start,
    currentEnd = current.end,
    previousStart = previous.start,
    previousEnd = previous.end;
  useEffect(() => {
    let live = true;
    setResult(null);
    setError(null);
    getSpendingExplanation(
      categoryId,
      { start: currentStart, end: currentEnd },
      { start: previousStart, end: previousEnd },
      hideAmounts
    )
      .then((r) => {
        if (live) setResult(r);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [categoryId, currentStart, currentEnd, previousStart, previousEnd, hideAmounts]);
  const money = (minor: number) => formatMaskableMoney(minor, { masked: hideAmounts });
  const effects = result
    ? allocateRoundedMinor([result.frequencyMinor, result.sizeMinor, result.refundsMinor], result.deltaMinor)
    : [0, 0, 0];
  const hasActivity =
    !!result &&
    (result.current.count > 0 ||
      result.previous.count > 0 ||
      result.current.refundMinor > 0 ||
      result.previous.refundMinor > 0);
  return (
    <View style={insight.card}>
      <InsightHeader title="What changed?" subtitle="Compared over matching days" icon="trending-up" />
      {error ? (
        <Text style={insight.caption}>{error}</Text>
      ) : !result ? (
        <Text style={insight.caption}>Comparing matching days…</Text>
      ) : (
        <>
          <Text style={insight.value}>
            {!hasActivity
              ? 'No spending to compare'
              : result.deltaMinor === 0
                ? 'No net change'
                : `${money(Math.abs(result.deltaMinor))} ${result.deltaMinor > 0 ? 'more' : 'less'} spending`}
          </Text>
          {!hasActivity && (
            <Text style={insight.caption}>No purchases or refunds in these matching days.</Text>
          )}
          {hasActivity && result.newCategory && (
            <Text style={insight.caption}>
              No purchases in the comparison period; there is no earlier average to compare.
            </Text>
          )}
          {hasActivity && (
            <>
              <InsightRow
                label="Purchase frequency"
                value={money(effects[0])}
                detail={`${result.previous.count} → ${result.current.count} purchases`}
              />
              <InsightRow
                label="Purchase size"
                value={money(effects[1])}
                detail={`Average ${money(result.previousAverage)} → ${money(result.currentAverage)}`}
              />
              <InsightRow label="Refund changes" value={money(effects[2])} />
            </>
          )}
          <InsightDisclosure title="Comparison details">
            <Text style={insight.caption}>
              {result.ranges.current.start}–{result.ranges.current.end} vs {result.ranges.previous.start}–
              {result.ranges.previous.end}. {result.ranges.days} days in each.
            </Text>
            {hasActivity && (
              <Text style={insight.caption}>
                These three effects add up to the change. This describes recorded entries, not why you spent.
              </Text>
            )}
          </InsightDisclosure>
          {result.largest.length > 0 && (
            <>
              <InsightDisclosure title="Largest contributing entries">
                {result.largest.map((r) => (
                  <InsightRow
                    key={r.id}
                    label={r.note || 'Expense'}
                    detail={r.date}
                    value={money(r.amount_minor)}
                    onPress={() => {
                      onBeforeEntry?.();
                      router.push(`/transactions?entry=${r.id}`);
                    }}
                  />
                ))}
              </InsightDisclosure>
            </>
          )}
          {onExplore && (
            <PrimaryButton compact variant="secondary" title="Explore category entries" onPress={onExplore} />
          )}
        </>
      )}
    </View>
  );
}

import { Pressable, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { softTint } from '@/components/softTint';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { compactMoney } from '@/lib/compactMoney';
import { formatMaskableMoney } from '@/lib/money';
import { formatReturnPct } from '@/lib/investment';
import { usePrivacy } from '@/theme/PrivacyContext';
import { TileGrid } from './PlanGrid';
import { styles } from './plan.styles';
import type { Portfolio } from '@/lib/portfolio';
import { PlanListAdd, PlanSummaryRow, summaryListStyle } from './PlanSummaryRow';

/**
 * Plan's investments as one tile, built like the budget and goal tiles beside it: an icon, the name, the big
 * figure (what they are worth) and a line under it (the return, or how many values are due). Opens the
 * Investments page; with none yet, the same dashed add tile the others use invites you to track the first.
 */
export function InvestmentsCard({
  portfolio,
  onOpen,
  extraTile,
  compact = false,
}: {
  portfolio: Portfolio;
  onOpen: () => void;
  /** Another tile in the same row (Plan puts its what-if idea beside the investments). */
  extraTile?: React.ReactNode;
  compact?: boolean;
}) {
  const { hideAmounts } = usePrivacy();
  const none = portfolio.holdings.length === 0 && portfolio.otherCurrency.length === 0;
  if (none) {
    if (compact) {
      return (
        <View style={summaryListStyle}>
          <PlanListAdd label="Track an investment" onPress={onOpen} />
        </View>
      );
    }
    return (
      <TileGrid
        maxColumns={extraTile ? 2 : undefined}
        tiles={extraTile ? [extraTile] : []}
        label="Add"
        accessibilityLabel="Track an investment"
        onAdd={onOpen}
        limit={extraTile ? 2 : 1}
      />
    );
  }
  const due = portfolio.holdings.filter((x) => x.stale).length;
  const pct = portfolio.returnPct;
  const gain = portfolio.gainMinor ?? 0;
  const tone =
    hideAmounts || pct == null || gain === 0
      ? theme.colors.textMuted
      : gain > 0
        ? theme.colors.incomeText
        : theme.colors.expenseText;
  const line = hideAmounts
    ? 'Amounts hidden'
    : pct != null
      ? `${formatReturnPct(pct)} return`
      : 'Update a value to see the gain';
  const worth = formatMaskableMoney(portfolio.valueMinor, {
    currency: portfolio.currency,
    masked: hideAmounts,
  });
  if (compact) {
    const foreignOnly = portfolio.holdings.length === 0;
    const subtitle = foreignOnly
      ? 'Values in other currencies'
      : due > 0
        ? `${due} ${due === 1 ? 'value' : 'values'} due`
        : line;
    const amount = foreignOnly
      ? `${portfolio.otherCurrency.length} ${portfolio.otherCurrency.length === 1 ? 'holding' : 'holdings'}`
      : worth;
    return (
      <View style={summaryListStyle}>
        <PlanSummaryRow
          icon="chart-line"
          name="Portfolio"
          subtitle={subtitle}
          amount={amount}
          color={theme.colors.textPrimary}
          subtitleColor={tone}
          animKey="plan:investment-total"
          accessibilityLabel={`Investments, ${amount}. ${subtitle}. Open investments`}
          onPress={onOpen}
        />
      </View>
    );
  }
  return (
    <TileGrid
      maxColumns={extraTile ? 2 : undefined}
      showAdd={false}
      tiles={[
        <Pressable
          key="investments"
          onPress={onOpen}
          style={withPressed(styles.tileWrap)}
          accessibilityRole="button"
          accessibilityLabel={`Investments, worth ${worth}${
            hideAmounts || pct == null ? '' : `, ${formatReturnPct(pct)} return`
          }${due > 0 ? `, ${due} ${due === 1 ? 'value is' : 'values are'} due an update` : ''}. Open investments`}
        >
          <Glass radius={16} style={[styles.tileFill, cardSurface.neutral]}>
            <View style={styles.tileHead}>
              <View style={[styles.tileIcon, { backgroundColor: softTint(theme.colors.slice.saved, 0.6) }]}>
                <MaterialCommunityIcons name="trending-up" size={14} color={theme.colors.ink} />
              </View>
              {hideAmounts ? (
                <Feather name="eye-off" size={16} color={theme.colors.textMuted} />
              ) : (
                <Text style={styles.tilePct} numberOfLines={1}>
                  {compactMoney(portfolio.valueMinor)}
                </Text>
              )}
            </View>
            <Text style={styles.tileName} numberOfLines={2}>
              Investments
            </Text>
            <Text style={[styles.tileAmt, { color: tone }]} numberOfLines={2}>
              {due > 0 ? `${due} ${due === 1 ? 'value' : 'values'} due` : line}
            </Text>
          </Glass>
        </Pressable>,
        ...(extraTile ? [extraTile] : []),
      ]}
      label="Add"
      accessibilityLabel="Track an investment"
      onAdd={onOpen}
      limit={extraTile ? 2 : 1}
    />
  );
}

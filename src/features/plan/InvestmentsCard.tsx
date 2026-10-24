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

/**
 * Plan's investments as one tile, built like the budget and goal tiles beside it: an icon, the name, the big
 * figure (what they are worth) and a line under it (the return, or how many values are due). Opens the
 * Investments page; with none yet, the same dashed add tile the others use invites you to track the first.
 */
export function InvestmentsCard({ portfolio, onOpen }: { portfolio: Portfolio; onOpen: () => void }) {
  const { hideAmounts } = usePrivacy();
  const none = portfolio.holdings.length === 0 && portfolio.otherCurrency.length === 0;
  if (none) {
    return (
      <TileGrid tiles={[]} label="Add" accessibilityLabel="Track an investment" onAdd={onOpen} limit={1} />
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
  return (
    <TileGrid
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
          <Glass radius={20} style={[styles.tileFill, cardSurface.neutral]}>
            <View style={[styles.tileIcon, { backgroundColor: softTint(theme.colors.slice.saved, 0.6) }]}>
              <MaterialCommunityIcons name="trending-up" size={18} color={theme.colors.ink} />
            </View>
            <Text style={styles.tileName} numberOfLines={2}>
              Investments
            </Text>
            {hideAmounts ? (
              <Feather name="eye-off" size={20} color={theme.colors.textMuted} />
            ) : (
              <Text style={styles.tilePct} numberOfLines={1} adjustsFontSizeToFit>
                {compactMoney(portfolio.valueMinor)}
              </Text>
            )}
            <Text style={[styles.tileAmt, { color: tone, marginTop: 'auto' }]} numberOfLines={2}>
              {due > 0 ? `${due} ${due === 1 ? 'value' : 'values'} due` : line}
            </Text>
          </Glass>
        </Pressable>,
      ]}
      label="Add"
      accessibilityLabel="Track an investment"
      onAdd={onOpen}
      limit={1}
    />
  );
}

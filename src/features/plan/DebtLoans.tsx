import { View, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { McIconName } from '@/components/iconName';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { shortMonthYear } from '@/lib/dateLabels';
import { withPressed } from '@/lib/pressed';
import { daysUntilIsoDate } from '@/lib/date';
import { DUE_SOON_DAYS, dueDateLabel } from '@/lib/dueDate';
import { loanBarTone, loanGlyph, loanTint } from '@/features/loans/loanIdentity';
import { LoansSummary } from './planOverview';
import { TileGrid } from './PlanGrid';
import { styles } from './plan.styles';
import { keepTogether } from '@/lib/keepTogether';
import { GrowFill } from '@/components/GrowFill';

/**
 * The Debt tab's loans as compact tiles, two to a row (one with large text): the loan's mark and what is left,
 * the name, how much of it is paid and when it ends. A tile opens that loan; money you lent shows green, and a
 * tile whose next EMI is due within `DUE_SOON_DAYS` (or late) carries an amber strip saying so.
 */
export function DebtLoans({
  loans,
  hues = {},
  onLoan,
}: {
  loans: LoansSummary;
  /** Each loan's identity colour (loanHues), so a loan has the colour it has on Loans. */
  hues?: Record<string, string>;
  onLoan: (id: string) => void;
}) {
  if (loans.rows.length === 0) return null;
  return (
    <TileGrid
      showAdd={false}
      maxColumns={2}
      limit={loans.rows.length}
      label="Add"
      accessibilityLabel="Add a loan"
      onAdd={() => {}}
      tiles={loans.rows.map((r) => {
        const lent = r.direction === 'lent';
        const hue = hues[r.id] ?? (lent ? theme.colors.secondary : theme.colors.idGold);
        const progress =
          r.totalCount > 0 ? `${r.paidCount} of ${r.totalCount} paid` : lent ? 'Lent out' : 'Loan';
        const subtitle = r.endDate
          ? keepTogether(`${progress} · ends ${shortMonthYear(r.endDate)}`)
          : progress;
        const left = formatMoney(r.leftMinor);
        const fraction = r.totalCount > 0 ? Math.min(1, Math.max(0, r.paidCount / r.totalCount)) : 0;
        const soon = !!r.nextDueDate && daysUntilIsoDate(r.nextDueDate) <= DUE_SOON_DAYS;
        return (
          <Pressable
            key={r.id}
            onPress={() => onLoan(r.id)}
            style={withPressed(styles.tileWrap)}
            accessibilityRole="button"
            accessibilityLabel={`${r.name}, ${subtitle}, ${left} ${lent ? 'owed to you' : 'left'}. Open loan details`}
          >
            <Glass radius={16} style={[styles.tileFill, cardSurface.neutral, styles.debtTile]}>
              <View style={styles.debtBody}>
                <View style={styles.tileHead}>
                  <View style={[styles.tileIcon, { backgroundColor: loanTint(hue) }]}>
                    <MaterialCommunityIcons
                      name={(r.icon ?? (lent ? 'hand-coin-outline' : 'bank-outline')) as McIconName}
                      size={14}
                      color={loanGlyph(hue)}
                    />
                  </View>
                  <Text
                    style={[styles.tilePct, lent && { color: theme.colors.incomeText }]}
                    numberOfLines={1}
                  >
                    {lent ? `+${left}` : left}
                  </Text>
                </View>
                <Text style={styles.tileName} numberOfLines={2}>
                  {r.name}
                </Text>
                <View style={styles.tileTrack} pointerEvents="none">
                  <GrowFill
                    animKey={`plan:loan:${r.id}`}
                    pct={fraction * 100}
                    style={[
                      styles.tileProgress,
                      { backgroundColor: lent ? theme.colors.slice.saved : loanBarTone(hue) },
                    ]}
                  />
                </View>
                <Text style={styles.tileAmt} numberOfLines={2}>
                  {subtitle}
                </Text>
              </View>
              {soon && r.nextDueDate && (
                <View style={styles.debtDue}>
                  <Text style={styles.debtDueText} numberOfLines={1}>
                    {dueDateLabel(r.nextDueDate)}
                  </Text>
                </View>
              )}
            </Glass>
          </Pressable>
        );
      })}
    />
  );
}

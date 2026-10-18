import { View, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { Section } from '@/components/Section';
import { theme } from '@/constants/theme';
import { dueDateLabel } from '@/lib/dueDate';
import { withPressed } from '@/lib/pressed';
import { hexToRgba } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { UpcomingRow } from '@/features/home/UpcomingRow';
import { DueGroup, PlanDueItem, PlanRoute, dueTone } from './planOverview';
import { styles } from './plan.styles';

const KIND_LABEL: Record<PlanDueItem['kind'], string> = {
  emi: 'EMI',
  bill: 'Bill',
  income: 'Income',
  transfer: 'Transfer',
};

type FeatherName = React.ComponentProps<typeof Feather>['name'];

function kindIcon(item: PlanDueItem): FeatherName {
  if (item.kind === 'emi' || item.key.startsWith('card-')) return 'credit-card';
  if (item.kind === 'income') return 'arrow-down-left';
  if (item.kind === 'transfer') return 'repeat';
  return 'file-text';
}

/**
 * Plan's Coming up, straight under the runway: every EMI, bill and income of the next 14 days as the same
 * dated row Home's Upcoming uses (date tile, title and when, amount, a chip when it is late or close). An EMI
 * that is due or close ends in a Pay pill that opens the pay sheet; any other row opens what it came from.
 */
export function ComingUpSection({
  groups,
  today,
  onOpen,
  onPay,
  onLoan,
  onRule,
}: {
  groups: DueGroup[];
  /** YYYY-MM-DD — the day the amber/red tones count from. */
  today: string;
  onOpen: (route: PlanRoute) => void;
  /** Records an EMI as paid — the Pay pill on a due or close EMI. */
  onPay?: (loanId: string) => void;
  onLoan?: (loanId: string) => void;
  onRule?: (ruleId: string) => void;
}) {
  const { accent } = useAccent();
  const items = groups.flatMap((g) => g.items);
  return (
    <Section compact title="Coming up" onSeeAll={() => onOpen('/recurring')}>
      <Glass style={[styles.list, cardSurface.neutral]}>
        {items.length === 0 ? (
          <Pressable
            onPress={() => onOpen('/recurring')}
            style={withPressed(styles.emptyRow)}
            accessibilityRole="button"
            accessibilityLabel="Add a recurring entry"
          >
            <View style={styles.dueIcon}>
              <Feather name="repeat" size={16} color={theme.colors.ink} />
            </View>
            <View style={styles.dueMid}>
              <Text style={styles.dueTitle}>Rent, salary, subscriptions</Text>
              <Text style={styles.dueSub}>Add a recurring entry to see it here</Text>
            </View>
            <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
          </Pressable>
        ) : (
          items.map((item, i) => {
            const tone = dueTone(item, today);
            const payable = !!item.loanId && !!onPay && tone != null;
            return (
              <UpcomingRow
                key={item.key}
                icon={kindIcon(item)}
                iconBg={
                  item.kind === 'emi'
                    ? hexToRgba(accent, 0.18)
                    : item.kind === 'income'
                      ? theme.colors.incomeTint
                      : item.key.startsWith('card-')
                        ? theme.colors.idGold
                        : theme.colors.secondaryTint
                }
                title={item.title}
                subtitle={`${KIND_LABEL[item.kind]} · ${dueDateLabel(item.dueDate)}`}
                amountMinor={item.amountMinor}
                sign={item.kind === 'income' ? '+' : item.kind === 'transfer' ? '' : '-'}
                date={item.dueDate}
                urgent={tone === 'urgent'}
                soon={tone === 'soon'}
                actionLabel={payable ? 'Pay' : undefined}
                divider={i > 0}
                onPress={() => {
                  if (payable) onPay!(item.loanId!);
                  else if (item.loanId && onLoan) onLoan(item.loanId);
                  else if (item.ruleId && onRule) onRule(item.ruleId);
                  else onOpen(item.route);
                }}
              />
            );
          })
        )}
      </Glass>
    </Section>
  );
}

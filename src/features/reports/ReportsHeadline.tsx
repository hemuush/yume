import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { theme } from '@/constants/theme';
import { styles } from './reports.styles';

/** The period's total spend, its "N% above/below usual" badge, and the per-day line under it. */
export function ReportsHeadline({
  periodName,
  spentMinor,
  vsUsualPct,
  perDayMinor,
  spendDays,
  daysInPeriod,
}: {
  periodName: string;
  spentMinor: number;
  vsUsualPct: number | null;
  perDayMinor: number;
  spendDays: number;
  daysInPeriod: number;
}) {
  const up = vsUsualPct != null && vsUsualPct > 0;
  return (
    <>
      <View style={styles.headlineRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Spent in {periodName}</Text>
          <CountUpAmount minor={spentMinor} style={styles.big} numberOfLines={1} adjustsFontSizeToFit />
        </View>
        {vsUsualPct != null && (
          <View
            style={[
              styles.vsBadge,
              { backgroundColor: up ? theme.colors.expenseTint : theme.colors.incomeTint },
            ]}
          >
            <Feather
              name={up ? 'arrow-up-right' : 'arrow-down-right'}
              size={12}
              color={up ? theme.colors.expense : theme.colors.income}
            />
            <Text style={[styles.vsBadgeText, { color: up ? theme.colors.expense : theme.colors.income }]}>
              {formatPctChange(vsUsualPct)} {up ? 'above' : 'below'} usual
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.headlineSub}>
        {formatMoney(perDayMinor)} / day · {spendDays} spending {spendDays === 1 ? 'day' : 'days'}
        {daysInPeriod - spendDays > 0 ? ` · ${daysInPeriod - spendDays} no-spend` : ''}
      </Text>
    </>
  );
}

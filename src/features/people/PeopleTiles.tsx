import { View, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { Skeleton } from '@/components/Skeleton';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { formatMoney } from '@/lib/money';

const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;

function Tile({
  tone,
  icon,
  label,
  minor,
  color,
  sub,
  loading,
}: {
  tone: string;
  icon: 'arrow-up-right' | 'arrow-down-left';
  label: string;
  minor: number;
  color: string;
  sub: string;
  loading?: boolean;
}) {
  return (
    <View style={[styles.tile, { backgroundColor: tone }]}>
      <View style={styles.icon}>
        <Feather name={icon} size={15} color={theme.colors.textPrimary} />
      </View>
      {loading ? (
        <>
          <Skeleton width={60} height={9} radius={4} />
          <Skeleton width={90} height={20} radius={5} style={styles.skeletonValue} />
          <Skeleton width={70} height={10} radius={4} style={styles.skeletonSub} />
        </>
      ) : (
        <>
          <Text style={styles.label}>{label}</Text>
          <CountUpAmount
            minor={minor}
            style={[styles.value, { color }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        </>
      )}
    </View>
  );
}

/**
 * The top of Friends & Family: what you owe and what you're owed, as two pale
 * tiles (the Plan tab's tile shape), with the net underneath once anyone has
 * an open balance.
 */
export function PeopleTiles({
  youOweMinor,
  owedToYouMinor,
  oweCount,
  owedCount,
  loading,
}: {
  youOweMinor: number;
  owedToYouMinor: number;
  oweCount: number;
  owedCount: number;
  loading?: boolean;
}) {
  const net = owedToYouMinor - youOweMinor;
  const open = oweCount + owedCount > 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Tile
          tone={theme.colors.idCoral}
          icon="arrow-up-right"
          label="You owe"
          minor={youOweMinor}
          color={theme.colors.expenseText}
          sub={oweCount === 0 ? 'No one' : `to ${people(oweCount)}`}
          loading={loading}
        />
        <Tile
          tone={theme.colors.idSage}
          icon="arrow-down-left"
          label="Owed to you"
          minor={owedToYouMinor}
          color={theme.colors.incomeText}
          sub={owedCount === 0 ? 'No one' : `from ${people(owedCount)}`}
          loading={loading}
        />
      </View>
      {!loading && open && (
        <View style={styles.net}>
          <Text style={styles.netLabel}>
            {net > 0 ? 'Net, in your favour' : net < 0 ? 'Net, against you' : 'Net, even'}
          </Text>
          <Text
            style={[
              styles.netValue,
              net > 0 && { color: theme.colors.incomeText },
              net < 0 && { color: theme.colors.expenseText },
            ]}
          >
            {net > 0 ? '+' : net < 0 ? '−' : ''}
            {formatMoney(Math.abs(net))}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginTop: theme.layout.screenTopGap, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },
  label: EYEBROW,
  value: { fontFamily: theme.font.monoBold, fontSize: 20, marginTop: 3 },
  sub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  skeletonValue: { marginTop: 6 },
  skeletonSub: { marginTop: 6 },
  net: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  netLabel: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary },
  netValue: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textMuted },
});

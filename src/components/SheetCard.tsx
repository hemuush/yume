import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import type { McIconName } from '@/components/iconName';

/**
 * The card a sheet opens on (the calm-sheets sign-off, Direction C): the
 * entry drawn like Home's account cards — a soft gradient in its own colour
 * (the category's, the account type's, the loan's), two white circles in the
 * corner, a round white icon, and the amount big. On a form it's a live
 * preview that fills in as you type.
 */
export function SheetCard({
  hue,
  icon,
  kicker,
  amount,
  amountColor = theme.colors.textPrimary,
  title,
  meta,
  progress,
}: {
  hue: string;
  icon: string;
  /** Small caps in the top corner: "EXPENSE", "EVERY MONTH". */
  kicker?: string;
  /** The big figure — a string, or an <Amount> so hidden amounts stay hidden. None for a category. */
  amount?: React.ReactNode;
  amountColor?: string;
  title: string;
  meta?: string;
  /** 0–1: draws a bar under the meta line — how far a goal has got. */
  progress?: number;
}) {
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[shade(hue, 93), shade(hue, 85)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fill}
      />
      <View style={styles.circleBig} />
      <View style={styles.circleSmall} />
      <View style={styles.top}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name={icon as McIconName} size={18} color={shade(hue, 30, 10)} />
        </View>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      </View>
      {amount !== undefined ? (
        <Text style={[styles.amount, { color: amountColor }]} numberOfLines={1} adjustsFontSizeToFit>
          {amount}
        </Text>
      ) : null}
      <Text style={[styles.title, amount === undefined && styles.titleBig]} numberOfLines={1}>
        {title}
      </Text>
      {meta ? (
        <Text style={styles.meta} numberOfLines={2}>
          {meta}
        </Text>
      ) : null}
      {progress !== undefined && (
        <View style={styles.track}>
          <View style={[styles.fillBar, { width: `${Math.min(100, Math.max(0, progress * 100))}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xl2,
    padding: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  circleBig: {
    position: 'absolute',
    right: -32,
    bottom: -44,
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  circleSmall: {
    position: 'absolute',
    right: 38,
    bottom: 46,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontFamily: theme.font.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.textSecondary,
  },
  amount: { fontFamily: theme.font.monoBold, fontSize: 28, marginTop: 10 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary, marginTop: 2 },
  titleBig: { fontFamily: theme.font.roundedBold, fontSize: 22, marginTop: 10 },
  meta: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginTop: 12,
    overflow: 'hidden',
  },
  fillBar: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.ink },
});

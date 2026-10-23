import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';

/**
 * The thing being set up (a loan, a goal), as a slim card: its name and a line of detail on the left, one worked-out
 * figure on the right (a loan's monthly EMI, a goal's target), and one line under it. Whatever was typed into a
 * field below is not repeated here.
 */
export function DraftCard({
  hue,
  icon,
  title,
  kicker,
  figure,
  figureColor,
  per,
  meta,
}: {
  hue: string;
  icon: string;
  title: string;
  /** "9.5% · 20 years", empty until either is filled in. */
  kicker: string;
  /** The formatted figure, or undefined until it can be worked out. Shown with `per`. */
  figure?: string;
  /** Overrides the figure's colour, for money that is owed (red). */
  figureColor?: string;
  /** The small word under the figure: "a month", "target". Leave out for a card with no figure at all. */
  per?: string;
  /** The line under the card; omit when there is nothing to say yet. */
  meta?: string;
}) {
  return (
    <View style={styles.card}>
      <LinearGradient
        pointerEvents="none"
        colors={[shade(hue, 89), shade(hue, 96)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Wraps under the name when the amount is wide or the text is enlarged. */}
      <View style={styles.top}>
        <View style={styles.identity}>
          <View style={[styles.icon, { backgroundColor: theme.colors.glass }]}>
            <MaterialCommunityIcons name={icon as McIconName} size={19} color={shade(hue, 30, 10)} />
          </View>
          <View style={styles.names}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.kicker}>{kicker || ' '}</Text>
          </View>
        </View>
        {per !== undefined && (
          <View style={styles.emi}>
            <Text style={[styles.amount, figureColor ? { color: figureColor } : null]}>{figure ?? '–'}</Text>
            <Text style={styles.per}>{per}</Text>
          </View>
        )}
      </View>
      {!!meta && <Text style={styles.meta}>{meta}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.glass,
    backgroundColor: theme.colors.surface,
    marginBottom: 10,
  },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  identity: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  names: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.font.bodyMedium, fontSize: 15, color: theme.colors.textPrimary },
  kicker: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  emi: { alignItems: 'flex-end' },
  amount: {
    fontFamily: theme.font.body,
    fontSize: 22,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  per: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 15, color: theme.colors.textSecondary },
  meta: {
    fontFamily: theme.font.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
});

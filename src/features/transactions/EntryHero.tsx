import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';

/**
 * The top card of Entry details: the category's icon, name and kind on the left, the amount on the right, and the
 * date and account on one line below. The category appears here and nowhere else in the sheet, so the name is the
 * link to that category's page when `onPressTitle` is given.
 */
export function EntryHero({
  hue,
  icon,
  title,
  kicker,
  amount,
  amountColor,
  meta,
  onPressTitle,
  titleLabel,
}: {
  hue: string;
  icon: string;
  title: string;
  kicker: string;
  /** An <Amount> (or text) so hidden amounts stay hidden. */
  amount: React.ReactNode;
  amountColor: string;
  meta: string;
  /** Makes the icon and name a button, with a small chevron after the name. */
  onPressTitle?: () => void;
  /** The screen-reader name of that button. */
  titleLabel?: string;
}) {
  const { accent } = useAccent();
  const identity = (
    <>
      <View style={[styles.icon, { backgroundColor: theme.colors.glass }]}>
        <MaterialCommunityIcons name={icon as McIconName} size={19} color={shade(hue, 30, 10)} />
      </View>
      <View style={styles.names}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {onPressTitle && <Feather name="chevron-right" size={16} color={theme.colors.textSecondary} />}
        </View>
        <Text style={styles.kicker}>{kicker}</Text>
      </View>
    </>
  );
  return (
    <View style={styles.card}>
      <LinearGradient
        pointerEvents="none"
        colors={[shade(hue, 89), shade(hue, 96)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.top}>
        {onPressTitle ? (
          <Pressable
            onPress={onPressTitle}
            accessibilityRole="button"
            accessibilityLabel={titleLabel}
            style={withPressedTint(accent, styles.identity)}
          >
            {identity}
          </Pressable>
        ) : (
          <View style={styles.identity}>{identity}</View>
        )}
        <Text style={[styles.amount, { color: amountColor }]}>{amount}</Text>
      </View>
      <Text style={styles.meta}>{meta}</Text>
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
  // Wraps under the name when the amount is wide or the text is enlarged.
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
    minHeight: theme.accessibility.minTouchTarget,
    borderRadius: 14,
  },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  names: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  title: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
  kicker: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  amount: {
    fontFamily: theme.font.body,
    fontSize: 22,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  meta: {
    fontFamily: theme.font.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.inkHairline,
  },
});

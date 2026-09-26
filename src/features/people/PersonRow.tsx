import { View, Text, Pressable, Animated } from 'react-native';
import ReanimatedAnimated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { PersonWithBalance } from '@/db/people';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { MAX_LIST_STAGGER_MS } from '@/lib/animation';
import { NeoTile } from '@/components/NeoTile';
import { personStatus, lastActivityShort, PersonStatus } from './people.helpers';
import { styles } from './people.styles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const STATUS_LOOK: Record<
  PersonStatus,
  { bg: string; dot: string; text: string; amount: string; label: string }
> = {
  owed: {
    bg: theme.colors.secondaryTint,
    dot: theme.colors.income,
    text: theme.colors.income,
    amount: theme.colors.income,
    label: 'Owes you',
  },
  owe: {
    bg: theme.colors.expenseTint,
    dot: theme.colors.expense,
    text: theme.colors.expense,
    amount: theme.colors.expense,
    label: 'You owe',
  },
  settled: {
    bg: theme.colors.surfaceAlt,
    dot: theme.colors.textMuted,
    text: theme.colors.textSecondary,
    amount: theme.colors.textMuted,
    label: 'Settled',
  },
};

/** Per-row entrance stagger, capped by MAX_LIST_STAGGER_MS for long lists. */
const STAGGER_MS = 45;

/** One person on the Friends & Family list: initial, status pill, balance, last activity. */
export function PersonRow({
  person,
  color,
  index,
  onPress,
}: {
  person: PersonWithBalance;
  color: string;
  index: number;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const dispBalanceMinor = roundedMinor(person.balanceMinor);
  const look = STATUS_LOOK[personStatus(dispBalanceMinor)];
  return (
    // Entrance (reanimated) and press feedback (RN Animated) are two
    // different animation drivers, so the stagger lives on this outer
    // wrapper rather than fighting the press-scale style for the same node.
    <ReanimatedAnimated.View
      entering={FadeIn.delay(Math.min(index * STAGGER_MS, MAX_LIST_STAGGER_MS))
        .duration(280)
        .springify()
        .reduceMotion(ReduceMotion.System)}
    >
      <NeoTile style={styles.card}>
        <AnimatedPressable
          style={animatedStyle}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`${person.name}, ${look.label}${
            dispBalanceMinor === 0 ? '' : ` ${formatMoney(Math.abs(dispBalanceMinor))}`
          }`}
        >
          <View style={styles.cardTop}>
            <View style={styles.who}>
              <View style={[styles.avatar, { backgroundColor: color }]}>
                <Text style={styles.avatarInitial}>{person.name.trim().charAt(0).toUpperCase() || '?'}</Text>
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {person.name}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: look.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: look.dot }]} />
                  <Text style={[styles.statusPillText, { color: look.text }]}>{look.label}</Text>
                </View>
              </View>
            </View>
            <View style={styles.cardRight}>
              <Text
                style={[styles.cardBalance, { color: look.amount }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatMoney(Math.abs(dispBalanceMinor))}
              </Text>
              <Text style={styles.cardSub}>{lastActivityShort(person.lastActivityDate)}</Text>
            </View>
          </View>
        </AnimatedPressable>
      </NeoTile>
    </ReanimatedAnimated.View>
  );
}

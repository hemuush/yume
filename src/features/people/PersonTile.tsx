import { View, Pressable, Animated } from 'react-native';
import { Text } from '@/components/Text';
import ReanimatedAnimated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { PersonWithBalance } from '@/db/people';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { withPressed } from '@/lib/pressed';
import { MAX_LIST_STAGGER_MS, ROW_LAYOUT, ROW_EXIT } from '@/lib/animation';
import { lastActivityShort } from './people.helpers';
import { styles } from './people.styles';
import { DURATIONS } from '@/lib/motionTimings';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const LOOK = {
  owed: { tone: theme.colors.idSage, amount: theme.colors.incomeText, label: 'Owes you' },
  owe: { tone: theme.colors.idCoral, amount: theme.colors.expenseText, label: 'You owe' },
} as const;

/** Per-tile entrance stagger, capped by MAX_LIST_STAGGER_MS for long lists. */
const STAGGER_MS = 45;

/**
 * One person with an open balance on Friends & Family, as a pale tile: sage when they owe you, coral when you
 * owe them. Shows initial, name, balance and last activity, plus a Settle up pill that opens the same sheet as
 * the tile (on its Settle tab).
 */
export function PersonTile({
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
  const look = LOOK[dispBalanceMinor > 0 ? 'owed' : 'owe'];
  return (
    // Entrance (reanimated) and press feedback (RN Animated) use different drivers, so the stagger lives on
    // this outer wrapper rather than fighting the press-scale style on the same node.
    <ReanimatedAnimated.View
      style={styles.tileCell}
      entering={FadeIn.delay(Math.min(index * STAGGER_MS, MAX_LIST_STAGGER_MS))
        .duration(DURATIONS.enter)
        .springify()
        .reduceMotion(ReduceMotion.System)}
      layout={ROW_LAYOUT}
      exiting={ROW_EXIT}
    >
      <View style={[styles.personTile, { backgroundColor: look.tone }]}>
        <AnimatedPressable
          style={animatedStyle}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`${person.name}, ${look.label} ${formatMoney(Math.abs(dispBalanceMinor))}`}
        >
          <View style={styles.tileWho}>
            <View style={[styles.tileAvatar, { backgroundColor: color }]}>
              <Text style={styles.tileInitial}>{person.name.trim().charAt(0).toUpperCase() || '?'}</Text>
            </View>
            <Text style={styles.tileName} numberOfLines={1}>
              {person.name}
            </Text>
          </View>
          <Text style={[styles.tileAmount, { color: look.amount }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(Math.abs(dispBalanceMinor))}
          </Text>
          <Text style={styles.tileMeta} numberOfLines={1}>
            {`${look.label} · ${lastActivityShort(person.lastActivityDate)}`}
          </Text>
        </AnimatedPressable>
        <Pressable
          onPress={onPress}
          hitSlop={8}
          style={withPressed(styles.settlePill)}
          accessibilityRole="button"
          accessibilityLabel={`Settle up with ${person.name}`}
        >
          <Text style={styles.settlePillText}>Settle up</Text>
        </Pressable>
      </View>
    </ReanimatedAnimated.View>
  );
}

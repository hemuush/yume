import { View, Pressable, Animated } from 'react-native';
import { Text } from '@/components/Text';
import ReanimatedAnimated from 'react-native-reanimated';
import { PersonWithBalance } from '@/db/people';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { ROW_LAYOUT, ROW_EXIT } from '@/lib/animation';
import { lastActivityShort, personInitials } from './people.helpers';
import { styles } from './people.styles';
import { Glass } from '@/components/Glass';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const LOOK = {
  owed: {
    amount: theme.colors.incomeText,
    label: 'Owes you',
  },
  owe: {
    amount: theme.colors.expenseText,
    label: 'You owe',
  },
} as const;

/**
 * One person with an open balance on Friends & Family, as a glass tile, its balance green when they owe you and red when you
 * owe them. Shows initial, name, balance and last activity; tapping opens the person's sheet, where Settle up lives.
 */
export function PersonTile({
  person,
  color,
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
    <ReanimatedAnimated.View style={styles.tileCell} layout={ROW_LAYOUT} exiting={ROW_EXIT}>
      <Glass radius={22} style={styles.personTile}>
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
              <Text style={styles.tileInitial}>{personInitials(person.name)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.tileName}>{person.name}</Text>
              <Text style={styles.tileMeta}>{lastActivityShort(person.lastActivityDate)}</Text>
            </View>
          </View>
          <Text style={[styles.tileAmount, { color: look.amount }]} numberOfLines={1} adjustsFontSizeToFit>
            {dispBalanceMinor > 0 ? '+' : '−'}
            {formatMoney(Math.abs(dispBalanceMinor))}
          </Text>
        </AnimatedPressable>
      </Glass>
    </ReanimatedAnimated.View>
  );
}

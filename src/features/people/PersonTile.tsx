import { memo } from 'react';
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

import { themedValue } from '@/theme/themedStyles';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const LOOK = themedValue(() => ({
  owed: {
    amount: theme.colors.incomeText,
    label: 'Owes you',
  },
  owe: {
    amount: theme.colors.expenseText,
    label: 'You owe',
  },
}));

/**
 * One person with an open balance on Friends & Family, as a glass tile, its balance green when they owe you and red when you
 * owe them. Shows initial, name, balance and last activity; tapping opens the person's sheet, where Settle up lives.
 */
export const PersonTile = memo(function PersonTile({
  person,
  color,
  onOpen,
}: {
  person: PersonWithBalance;
  color: string;
  /** One function for every tile (it is handed the person), so a tile is drawn again only when its own person changes. */
  onOpen: (person: PersonWithBalance) => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const dispBalanceMinor = roundedMinor(person.balanceMinor);
  const look = LOOK[dispBalanceMinor > 0 ? 'owed' : 'owe'];
  return (
    <ReanimatedAnimated.View style={styles.tileCell} layout={ROW_LAYOUT} exiting={ROW_EXIT}>
      <View style={styles.personTile}>
        <AnimatedPressable
          style={animatedStyle}
          onPress={() => onOpen(person)}
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
      </View>
    </ReanimatedAnimated.View>
  );
});

import { memo } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import ReanimatedAnimated from 'react-native-reanimated';
import { PersonWithBalance } from '@/db/people';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { theme } from '@/constants/theme';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { ROW_LAYOUT, ROW_EXIT } from '@/lib/animation';
import { lastActivityShort, personInitials } from './people.helpers';
import { styles } from './people.styles';

/**
 * One person with an open balance on Friends & Family, as a row in the card of their side: initials, name with
 * their last activity, and the balance at the right, green when they owe you and red when you owe them. Tapping
 * opens the person's sheet, where Settle up lives.
 */
export const PersonTile = memo(function PersonTile({
  person,
  color,
  divider = false,
  onOpen,
}: {
  person: PersonWithBalance;
  color: string;
  /** Every row after the first has a line above it. */
  divider?: boolean;
  /** One function for every row (it is handed the person), so a row is drawn again only when its own person changes. */
  onOpen: (person: PersonWithBalance) => void;
}) {
  const { accent } = useAccent();
  const dispBalanceMinor = roundedMinor(person.balanceMinor);
  const owed = dispBalanceMinor > 0;
  return (
    <ReanimatedAnimated.View layout={ROW_LAYOUT} exiting={ROW_EXIT}>
      <Pressable
        onPress={() => onOpen(person)}
        style={withPressedTint(accent, [styles.personRow, divider && styles.quietDivider])}
        accessibilityRole="button"
        accessibilityLabel={`${person.name}, ${owed ? 'Owes you' : 'You owe'} ${formatMoney(Math.abs(dispBalanceMinor))}`}
      >
        <View style={[styles.tileAvatar, { backgroundColor: color }]}>
          <Text style={styles.tileInitial}>{personInitials(person.name)}</Text>
        </View>
        <View style={styles.personCopy}>
          <Text style={styles.tileName} numberOfLines={1}>
            {person.name}
          </Text>
          <Text style={styles.tileMeta}>{lastActivityShort(person.lastActivityDate)}</Text>
        </View>
        <Text
          style={[styles.personAmount, { color: owed ? theme.colors.incomeText : theme.colors.expenseText }]}
          numberOfLines={1}
        >
          {owed ? '+' : '−'}
          {formatMoney(Math.abs(dispBalanceMinor))}
        </Text>
      </Pressable>
    </ReanimatedAnimated.View>
  );
});

import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { PersonWithBalance } from '@/db/people';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { lastActivityShort, personInitials } from './people.helpers';
import { styles } from './people.styles';

/** A person with nothing owed either way: a plain row in the "Settled" card, not a tile of their own. */
export function PersonQuietRow({
  person,
  color,
  divider = false,
  onPress,
}: {
  person: PersonWithBalance;
  color: string;
  /** Every row after the first has a line above it. */
  divider?: boolean;
  onPress: () => void;
}) {
  const { accent } = useAccent();
  return (
    <Pressable
      onPress={onPress}
      style={withPressedTint(accent, [styles.quietRow, divider && styles.quietDivider])}
      accessibilityRole="button"
      accessibilityLabel={`${person.name}, settled`}
    >
      <View style={[styles.quietAvatar, { backgroundColor: color }]}>
        <Text style={styles.quietInitial}>{personInitials(person.name)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={styles.quietName}>{person.name}</Text>
        <Text style={styles.quietSub}>Settled · {lastActivityShort(person.lastActivityDate)}</Text>
      </View>
    </Pressable>
  );
}

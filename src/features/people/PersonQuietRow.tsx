import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { PersonWithBalance } from '@/db/people';
import { withPressed } from '@/lib/pressed';
import { lastActivityShort } from './people.helpers';
import { styles } from './people.styles';

/** A person with nothing owed either way: a plain row under "Settled", not a card. */
export function PersonQuietRow({
  person,
  color,
  onPress,
}: {
  person: PersonWithBalance;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={withPressed(styles.quietRow)}
      accessibilityRole="button"
      accessibilityLabel={`${person.name}, settled`}
    >
      <View style={[styles.quietAvatar, { backgroundColor: color }]}>
        <Text style={styles.quietInitial}>{person.name.trim().charAt(0).toUpperCase() || '?'}</Text>
      </View>
      <Text style={styles.quietName} numberOfLines={1}>
        {person.name}
      </Text>
      <Text style={styles.quietSub}>Settled · {lastActivityShort(person.lastActivityDate)}</Text>
    </Pressable>
  );
}

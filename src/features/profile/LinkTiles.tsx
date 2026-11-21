import { Pressable, View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { SCREEN } from '@/components/screenStyles';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { themedStyles } from '@/theme/themedStyles';
import { useStacked } from '@/lib/useStacked';

function Stat({
  value,
  label,
  first,
  stacked,
  onPress,
}: {
  value: number;
  label: string;
  first?: boolean;
  stacked: boolean;
  onPress: () => void;
}) {
  const { accent } = useAccent();
  return (
    <Pressable
      style={withPressedTint(accent, [
        styles.stat,
        stacked && styles.statStacked,
        !first && (stacked ? styles.dividerTop : styles.dividerLeft),
      ])}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
    >
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

/** Three shortcuts in one strip: the count over its name, each cell opening its screen. */
export function LinkTiles({
  entries,
  loans,
  friends,
  onEntries,
  onLoans,
  onFriends,
}: {
  entries: number;
  loans: number;
  friends: number;
  onEntries: () => void;
  onLoans: () => void;
  onFriends: () => void;
}) {
  const stacked = useStacked();
  return (
    <View style={[styles.strip, stacked && styles.stripStacked]}>
      <Stat
        value={entries}
        label={entries === 1 ? 'Entry' : 'Entries'}
        first
        stacked={stacked}
        onPress={onEntries}
      />
      <Stat
        value={loans}
        label={loans === 1 ? 'Active loan' : 'Active loans'}
        stacked={stacked}
        onPress={onLoans}
      />
      <Stat
        value={friends}
        label={friends === 1 ? 'Friend' : 'Friends'}
        stacked={stacked}
        onPress={onFriends}
      />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    strip: {
      flexDirection: 'row',
      marginHorizontal: SCREEN.gutter,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
      overflow: 'hidden',
    },
    stripStacked: { flexDirection: 'column' },
    stat: {
      flex: 1,
      minWidth: 0,
      minHeight: 56,
      paddingHorizontal: 6,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statStacked: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14 },
    dividerLeft: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.divider },
    dividerTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
    value: {
      fontFamily: theme.font.bodyBold,
      fontSize: 17,
      fontVariant: ['tabular-nums'],
      color: theme.colors.textPrimary,
    },
    label: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  })
);

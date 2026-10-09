import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '@/constants/theme';
import type { McIconName } from '@/components/iconName';

const SIZE = 58;

/**
 * Backup & restore's status as a shield: green when you're backed up, red when the last backup failed, amber
 * while there's no folder or no backup yet, with the status's own icon inside.
 */
export function BackupShield({ icon, tone }: { icon: McIconName; tone: 'ok' | 'failed' | 'waiting' }) {
  const color =
    tone === 'ok'
      ? theme.colors.incomeText
      : tone === 'failed'
        ? theme.colors.expenseText
        : theme.colors.warnInk;
  const fill =
    tone === 'ok' ? theme.colors.idSage : tone === 'failed' ? theme.colors.expenseTint : theme.colors.idGold;
  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={SIZE} height={SIZE} viewBox="0 0 58 58">
        <Path
          d="M29 4 L50 12 V28 C50 41 41 50 29 54 C17 50 8 41 8 28 V12 Z"
          fill={fill}
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </Svg>
      <View style={styles.icon}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE },
  icon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

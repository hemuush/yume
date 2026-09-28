import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { ModalSheet } from './ModalSheet';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface ActionSheetItem {
  key: string;
  label: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  destructive?: boolean;
  onPress: () => void;
}

/**
 * A menu of actions — a loan's Prepay / Update rate / Delete, a category's
 * Archive / Delete — as a sheet of rows with round icons (the calm-sheets
 * sign-off), risky ones in red. A plain yes/no confirm goes through
 * `showAlert` instead (see AppDialog). Built on `ModalSheet`, so the ✕,
 * backdrop tap and Android back all close it; there's no Cancel row, and no
 * ceiling on how many actions it holds.
 */
export function ActionSheet({
  visible,
  onClose,
  title,
  subtitle,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  items: ActionSheetItem[];
}) {
  return (
    <ModalSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle} scrollable={false}>
      <View style={styles.list}>
        {items.map((item, i) => (
          <ActionSheetRow key={item.key} item={item} divider={i > 0} onClose={onClose} />
        ))}
      </View>
    </ModalSheet>
  );
}

function ActionSheetRow({
  item,
  divider,
  onClose,
}: {
  item: ActionSheetItem;
  divider: boolean;
  onClose: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <AnimatedPressable
      onPress={() => {
        onClose();
        item.onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.row, divider && styles.rowDivider, animatedStyle]}
      accessibilityRole="button"
    >
      {item.icon && (
        <View style={[styles.icon, item.destructive && styles.iconDestructive]}>
          <Feather
            name={item.icon}
            size={16}
            color={item.destructive ? theme.colors.expense : theme.colors.textPrimary}
          />
        </View>
      )}
      <Text style={[styles.rowLabel, item.destructive && styles.rowLabelDestructive]}>{item.label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDestructive: { backgroundColor: theme.colors.expenseTint },
  rowLabel: { fontFamily: theme.font.bodyMedium, fontSize: 15, color: theme.colors.textPrimary },
  rowLabelDestructive: { color: theme.colors.expense },
});

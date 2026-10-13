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
 * A sheet of icon rows for a menu of actions (risky ones in red); a plain yes/no confirm uses `showAlert`.
 * Built on `ModalSheet` (✕, backdrop, Android back close it); no Cancel row, no cap on action count.
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
    <ModalSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <ActionList items={items} onClose={onClose} />
    </ModalSheet>
  );
}

/** Also used inside a detail sheet, avoiding a second modal for a short menu. */
export function ActionList({ items, onClose }: { items: ActionSheetItem[]; onClose: () => void }) {
  return (
    <View style={styles.list}>
      {items.map((item, i) => (
        <ActionSheetRow key={item.key} item={item} divider={i > 0} onClose={onClose} />
      ))}
    </View>
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
    paddingVertical: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDestructive: { backgroundColor: theme.colors.expenseTint },
  rowLabel: { flex: 1, fontFamily: theme.font.bodyMedium, fontSize: 15, color: theme.colors.textPrimary },
  rowLabelDestructive: { color: theme.colors.expenseText },
});

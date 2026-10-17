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
    <ModalSheet size="compact" visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <ActionList items={items} onClose={onClose} />
    </ModalSheet>
  );
}

/** Also used inside a detail sheet, avoiding a second modal for a short menu. */
export function ActionList({ items, onClose }: { items: ActionSheetItem[]; onClose: () => void }) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <ActionSheetRow key={item.key} item={item} onClose={onClose} />
      ))}
    </View>
  );
}

function ActionSheetRow({ item, onClose }: { item: ActionSheetItem; onClose: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <AnimatedPressable
      onPress={() => {
        onClose();
        item.onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.row, item.destructive && styles.destructiveRow, animatedStyle]}
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
      {!item.destructive && <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  destructiveRow: { backgroundColor: theme.colors.expenseTint, borderColor: theme.colors.expenseTint },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDestructive: { backgroundColor: theme.colors.expenseTint },
  rowLabel: { flex: 1, fontFamily: theme.font.bodyMedium, fontSize: 14, color: theme.colors.textPrimary },
  rowLabelDestructive: { color: theme.colors.expenseText },
});

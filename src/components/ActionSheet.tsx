import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { ModalSheet } from './ModalSheet';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/hooks/usePressScale';

import { useAccent } from '@/theme/AccentContext';
import { interactionColors } from '@/theme/interactionColors';
import { themedStyles } from '@/theme/themedStyles';

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
  ledgerStyle = false,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  items: ActionSheetItem[];
  ledgerStyle?: boolean;
}) {
  return (
    <ModalSheet
      ledgerStyle={ledgerStyle}
      size="compact"
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
    >
      <ActionList items={items} onClose={onClose} ledgerStyle={ledgerStyle} />
    </ModalSheet>
  );
}

/** Also used inside a detail sheet, avoiding a second modal for a short menu. */
export function ActionList({
  items,
  onClose,
  ledgerStyle = false,
}: {
  items: ActionSheetItem[];
  onClose: () => void;
  ledgerStyle?: boolean;
}) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <ActionSheetRow key={item.key} item={item} onClose={onClose} ledgerStyle={ledgerStyle} />
      ))}
    </View>
  );
}

function ActionSheetRow({
  item,
  onClose,
  ledgerStyle,
}: {
  item: ActionSheetItem;
  onClose: () => void;
  ledgerStyle: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const { accent } = useAccent();
  const colors = interactionColors(accent);
  return (
    <AnimatedPressable
      onPress={() => {
        onClose();
        item.onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        styles.row,
        ledgerStyle && styles.ledgerRow,
        item.destructive && styles.destructiveRow,
        animatedStyle,
      ]}
      accessibilityRole="button"
    >
      {item.icon && (
        <View
          style={[
            styles.icon,
            { backgroundColor: colors.tint },
            ledgerStyle && styles.ledgerIcon,
            item.destructive && styles.iconDestructive,
          ]}
        >
          <Feather
            name={item.icon}
            size={16}
            color={item.destructive ? theme.colors.expenseText : colors.ink}
          />
        </View>
      )}
      <Text
        style={[
          styles.rowLabel,
          ledgerStyle && styles.ledgerLabel,
          item.destructive && styles.rowLabelDestructive,
        ]}
      >
        {item.label}
      </Text>
      {!item.destructive && <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />}
    </AnimatedPressable>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
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
    ledgerRow: {
      minHeight: 48,
      paddingVertical: 6,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.home.surface,
      borderColor: theme.colors.home.edge,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconDestructive: { backgroundColor: theme.colors.expenseTint },
    ledgerIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: theme.colors.home.control },
    ledgerLabel: { fontFamily: theme.font.bodyMedium, fontSize: 13 },
    rowLabel: { flex: 1, fontFamily: theme.font.bodyMedium, fontSize: 15, color: theme.colors.textPrimary },
    rowLabelDestructive: { color: theme.colors.expenseText },
  })
);

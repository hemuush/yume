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
 * The app's own stand-in for `Alert.alert(title, undefined, buttons)` used
 * as a menu rather than a plain confirm — that call renders as a bare
 * platform dialog Android/iOS controls entirely (a plain white card,
 * default system font, ALL-CAPS teal links on Android), which looks like a
 * completely different, unstyled app dropped in the middle of Yume's own
 * cream/rounded/hairline design. A plain two-button confirm ("Delete this
 * loan?" / Cancel / Delete) still uses the native `Alert.alert` — that's a
 * normal, expected platform idiom everywhere, not what this replaces.
 *
 * Built on the same `ModalSheet` every other sheet in the app already uses,
 * so it inherits backdrop-tap-to-close, the Android back gesture, and safe-
 * area handling for free. It also sidesteps a real limitation the native
 * dialog had: Android's `Alert.alert` silently drops a 4th button rather
 * than showing it, which is why `LoanDetailModal`'s menu used to omit an
 * explicit Cancel row entirely when all three real actions applied — this
 * component has no such ceiling, so Cancel is always present.
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
      <CancelRow onClose={onClose} />
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
        <Feather
          name={item.icon}
          size={16}
          color={item.destructive ? theme.colors.expense : theme.colors.textPrimary}
        />
      )}
      <Text style={[styles.rowLabel, item.destructive && styles.rowLabelDestructive]}>{item.label}</Text>
    </AnimatedPressable>
  );
}

function CancelRow({ onClose }: { onClose: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      onPress={onClose}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.cancelBtn, animatedStyle]}
      accessibilityRole="button"
    >
      <Text style={styles.cancelText}>Cancel</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, paddingHorizontal: 16 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  rowLabel: { fontFamily: theme.font.bodyMedium, fontSize: 15, color: theme.colors.textPrimary },
  rowLabelDestructive: { color: theme.colors.expense },
  cancelBtn: {
    marginTop: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    paddingVertical: 15,
    alignItems: 'center',
  },
  cancelText: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
});

import { Tabs, router } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { HomeIcon, ActivityIcon, LoanIcon, ReportsIcon } from '@/components/icons/TabIcons';

function TabIcon({ Icon, focused }: { Icon: typeof HomeIcon; focused: boolean }) {
  const { accent, onAccent } = useAccent();
  return (
    <View
      style={[
        styles.iconWrap,
        focused && { backgroundColor: accent, borderWidth: theme.border.thin, borderColor: theme.colors.ink },
      ]}
    >
      <Icon color={focused ? onAccent : theme.colors.ink} size={19} />
    </View>
  );
}

/**
 * The raised center "+". Rendered purely as `tabBarIcon` — the default
 * tabBarButton (left untouched) still handles the actual touch and still
 * fires `tabPress`, which the Tabs.Screen below intercepts to open
 * quick-add instead of navigating. A custom `tabBarButton` would replace
 * that default touch handling entirely and silently break the tap.
 */
function CenterAddButton() {
  const { accent, onAccent } = useAccent();
  return (
    <View style={styles.fabSlot}>
      <View style={[styles.fabInner, { backgroundColor: accent }]}>
        <Feather name="plus" size={24} color={onAccent} />
      </View>
    </View>
  );
}

export default function TabsLayout() {
  // The bottom tab bar must clear the device's own gesture/nav bar — a fixed
  // height here previously let Android's system bar overlap our icons on
  // gesture-nav devices, so the bar's total height and content padding both
  // add the live safe-area inset instead of a guessed constant.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.ink,
          borderTopWidth: theme.border.thick,
          height: 58 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
        },
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon Icon={HomeIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Activity',
          tabBarIcon: ({ focused }) => <TabIcon Icon={ActivityIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarIcon: () => <CenterAddButton />,
        }}
        listeners={{
          tabPress: (e) => {
            // Never actually navigate to the "add" route itself — it exists
            // only so this slot has a place in the tab bar; the real
            // destination is the quick-add sheet, pushed onto the Stack.
            e.preventDefault();
            router.push('/quick-add');
          },
        }}
      />
      <Tabs.Screen
        name="loans"
        options={{
          title: 'Borrowed & Lent',
          tabBarIcon: ({ focused }) => <TabIcon Icon={LoanIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ focused }) => <TabIcon Icon={ReportsIcon} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 34,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabSlot: { top: -18, alignItems: 'center', justifyContent: 'center' },
  fabInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
});

import { Tabs, router } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { HomeIcon, ActivityIcon, LoanIcon, ReportsIcon } from '@/components/icons/TabIcons';

/**
 * A tab's icon inside the floating pill. The active tab — and the centre
 * "+", which is always "on" — sits in a filled ink circle with a cream
 * glyph; the rest are ink line icons on the sage pill.
 */
function TabIcon({ Icon, focused }: { Icon: typeof HomeIcon; focused: boolean }) {
  return (
    <View style={[styles.circle, focused && styles.circleFilled]}>
      <Icon color={focused ? theme.colors.surface : theme.colors.ink} size={21} />
    </View>
  );
}

/**
 * The centre "+". Rendered purely as `tabBarIcon` — the default tabBarButton
 * (left untouched) still handles the actual touch and still fires
 * `tabPress`, which the Tabs.Screen below intercepts to open the Add screen.
 */
function CenterAddButton() {
  return (
    <View style={[styles.circle, styles.circleFilled]}>
      <Feather name="plus" size={21} color={theme.colors.surface} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        // A floating sage pill, clear of the device's own gesture bar. It
        // sits above the content (position: absolute); the tab screens all
        // pad their scroll views past it.
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom + 8,
          height: 58,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.primary,
          borderTopWidth: 0,
          paddingHorizontal: 6,
          shadowColor: theme.colors.ink,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.22,
          shadowRadius: 16,
          elevation: 10,
        },
        tabBarItemStyle: { height: 58, paddingTop: 0, paddingBottom: 0 },
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
            // Never navigate to the "add" route itself — it exists only so
            // this slot has a place in the pill; the real destination is the
            // Add screen, pushed onto the Stack.
            e.preventDefault();
            router.push('/add-transaction');
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
  circle: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleFilled: { backgroundColor: theme.colors.ink },
});

import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Keyboard, Animated as RNAnimated } from 'react-native';
import Animated, { LinearTransition, FadeIn } from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import type { Tabs } from 'expo-router';
import { Text } from '@/components/Text';
import { GLASS } from '@/components/Glass';
import { HomeIcon, ActivityIcon, PlanIcon, ReportsIcon } from '@/components/icons/TabIcons';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useUiScale } from '@/lib/uiScale';
import { usePressScale } from '@/lib/usePressScale';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { useAccent } from '@/theme/AccentContext';
import { homeInk } from '@/features/home/homeInk';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, typeof HomeIcon> = {
  index: HomeIcon,
  transactions: ActivityIcon,
  plan: PlanIcon,
  reports: ReportsIcon,
};

/** The pill's height at the default font size, and its gap above the phone's bottom edge. */
export const PILL_BAR = { height: 60, bottomGap: 10 } as const;

function Tab({
  label,
  Icon,
  focused,
  ink,
  size,
  onPress,
  onLongPress,
}: {
  label: string;
  Icon: typeof HomeIcon;
  focused: boolean;
  ink: string;
  size: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const reduce = useReduceMotion();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.92);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      {/* The press is core Animated (usePressScale) on its own view; the resize is Reanimated on the one
          inside. Never both on one view. */}
      <RNAnimated.View style={animatedStyle}>
        <Animated.View
          layout={reduce ? undefined : LinearTransition.springify().damping(18).stiffness(220)}
          style={[
            styles.tab,
            { height: size, minWidth: size, borderRadius: size / 2 },
            focused && { backgroundColor: ink, paddingHorizontal: 16 },
          ]}
        >
          <Icon color={focused ? theme.colors.white : theme.colors.inkSoft} size={20} />
          {focused && (
            <Animated.View entering={reduce ? undefined : FadeIn.duration(180)}>
              <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.15}>
                {label}
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </RNAnimated.View>
    </Pressable>
  );
}

/**
 * The floating tab bar: a frosted pill holding the four tabs (only the active one shows its name, on a deep
 * pill of the theme colour) and, beside it, the round Add button. Long-press Add for "Log again". It steps
 * aside while the keyboard is up.
 */
export function PillTabBar({
  state,
  descriptors,
  navigation,
  insets,
  onAdd,
  onAddLongPress,
}: TabBarProps & { onAdd: () => void; onAddLongPress: () => void }) {
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const scale = useUiScale();
  const height = Math.round(PILL_BAR.height * scale);
  const inner = height - 12;
  const add = usePressScale(0.92);
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (keyboard) return null;

  return (
    <View pointerEvents="box-none" style={[styles.dock, { bottom: insets.bottom + PILL_BAR.bottomGap }]}>
      <View style={[styles.pill, { height, borderRadius: height / 2 }]} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const Icon = ICONS[route.name];
          if (!Icon) return null;
          const focused = state.index === index;
          const label = descriptors[route.key].options.title ?? route.name;
          return (
            <Tab
              key={route.key}
              label={label}
              Icon={Icon}
              focused={focused}
              ink={ink}
              size={inner}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  haptics.tap();
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </View>
      <Pressable
        onPress={onAdd}
        onLongPress={() => {
          haptics.tap();
          onAddLongPress();
        }}
        onPressIn={add.onPressIn}
        onPressOut={add.onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Add a transaction"
        accessibilityHint="Long-press to log a recent entry again"
      >
        <RNAnimated.View
          style={[
            styles.add,
            { width: height, height, borderRadius: height / 2, backgroundColor: ink },
            add.animatedStyle,
          ]}
        >
          <Feather name="plus" size={24} color={theme.colors.white} />
        </RNAnimated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: GLASS.edge,
    boxShadow: '0px 10px 28px rgba(16,32,51,0.12)',
  },
  tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  label: { fontFamily: theme.font.bodyBold, fontSize: 13.5, color: theme.colors.white },
  add: {
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 10px 22px rgba(16,32,51,0.28)',
  },
});

import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Keyboard, Animated as RNAnimated } from 'react-native';
import Animated from 'react-native-reanimated';
import { CONTENT_ENTER } from '@/lib/animation';
import { LinearGradient } from 'expo-linear-gradient';
import { hexToRgba } from '@/lib/color';
import Feather from '@expo/vector-icons/Feather';
import type { Tabs } from 'expo-router';
import { Text } from '@/components/Text';
import { HomeIcon, ActivityIcon, PlanIcon, ReportsIcon } from '@/components/icons/TabIcons';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useTabDockMetrics } from '@/lib/uiScale';
import { usePressScale } from '@/hooks/usePressScale';
import { useAccent } from '@/theme/AccentContext';
import { selectedFill } from '@/theme/interactionColors';
import { themedStyles } from '@/theme/themedStyles';
import { useSchemeVersion } from '@/theme/SchemeBoundary';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, typeof HomeIcon> = {
  index: HomeIcon,
  transactions: ActivityIcon,
  plan: PlanIcon,
  reports: ReportsIcon,
};

function Tab({
  label,
  Icon,
  focused,
  fill,
  layout,
  onPress,
  onLongPress,
  logAgain = false,
}: {
  label: string;
  Icon: typeof HomeIcon;
  focused: boolean;
  /** The chosen tab's pill: the theme colour itself, with ink on it. The Add button is the coral dot. */
  fill: string;
  layout: { size: number; showLabel: boolean };
  onPress: () => void;
  onLongPress: () => void;
  logAgain?: boolean;
}) {
  const { size, showLabel } = layout;
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.92);
  return (
    <Pressable
      style={styles.tabSlot}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      accessibilityHint={logAgain && focused ? 'Long-press to log a recent entry again' : undefined}
    >
      <RNAnimated.View style={animatedStyle}>
        <Animated.View style={[styles.tab, { height: size, borderRadius: size / 2 }]}>
          {/* Only the chosen tab has a pill at all: one that is drawn and then faded away could be left showing
              (two tabs lit at once) if its fade-out never ran. The arriving pill fades in. */}
          {focused && (
            <Animated.View
              pointerEvents="none"
              testID={`tab-fill-${label}`}
              entering={CONTENT_ENTER}
              style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: fill }]}
            />
          )}
          <Icon color={focused ? theme.colors.ink : theme.colors.inkSoft} size={20} />
          {showLabel && (
            <Text style={[styles.label, focused && styles.labelSelected]} numberOfLines={1}>
              {label}
            </Text>
          )}
        </Animated.View>
      </RNAnimated.View>
    </Pressable>
  );
}

/**
 * The floating tab bar: a pill holding the four tabs (with fixed positions and a tinted active state) and, beside it, the round coral Add button. Long-press Add for "Log again". It steps
 * aside while the keyboard is up.
 */
export function PillTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
  onAdd,
  onAddLongPress,
}: TabBarProps & { onAdd: () => void; onAddLongPress: () => void }) {
  useSchemeVersion();
  const { accent } = useAccent();
  const { stacked: stackedLabel, height, bottomGap, side, clearance } = useTabDockMetrics();
  const inner = stackedLabel ? theme.accessibility.minTouchTarget : Math.max(44, height - 12);
  const active = state.routes[state.index];
  const activeLabel = active ? (descriptors[active.key].options.title ?? active.name) : '';
  const isHome = state.routes[state.index]?.name === 'index';
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
    <View
      pointerEvents="box-none"
      style={[styles.dock, { bottom: insets.bottom + bottomGap, left: side, right: side }]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[hexToRgba(theme.colors.background, 0), hexToRgba(theme.colors.background, 0.94)]}
        locations={[0, 0.65]}
        style={[
          styles.fade,
          {
            height: clearance + insets.bottom + 28,
            bottom: -insets.bottom - bottomGap,
            left: -side,
            right: -side,
          },
        ]}
      />
      <View
        style={[
          styles.pill,
          { minHeight: height, borderRadius: height / 2 },
          stackedLabel && styles.pillStacked,
        ]}
        accessibilityRole="tablist"
      >
        <View style={styles.tabs}>
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
                fill={selectedFill(accent)}
                layout={{ size: inner, showLabel: !stackedLabel }}
                logAgain={isHome}
                onPress={() => {
                  const event = emitter.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    haptics.tap();
                    navigateToTab(route.key);
                  }
                }}
                onLongPress={() => {
                  if (isHome && focused) onAddLongPress();
                  else emitter.emit({ type: 'tabLongPress', target: route.key });
                }}
              />
            );
          })}
        </View>
        {stackedLabel && (
          <Text style={styles.activeLabel} accessible={false}>
            {activeLabel}
          </Text>
        )}
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
            { width: height, height, borderRadius: height / 2, backgroundColor: theme.colors.coral },
            add.animatedStyle,
          ]}
        >
          <Feather name="plus" size={24} color={theme.colors.onCoral} />
        </RNAnimated.View>
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    dock: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 10 },
    fade: { position: 'absolute' },
    pill: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      boxShadow: '0px 1px 2px rgba(60,50,20,0.04), 0px 10px 28px rgba(60,50,20,0.08)',
    },
    tabs: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pillStacked: { paddingVertical: theme.space.sm, gap: theme.space.xs },
    activeLabel: {
      fontFamily: theme.font.bodyBold,
      fontSize: 13,
      lineHeight: 16,
      color: theme.colors.ink,
      textAlign: 'center',
    },
    tabSlot: { flex: 1, minWidth: theme.accessibility.minTouchTarget },
    tab: { alignItems: 'center', justifyContent: 'center', gap: 2 },
    label: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.inkSoft, lineHeight: 14 },
    labelSelected: { color: theme.colors.ink },
    add: {
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0px 6px 16px rgba(252,123,94,0.38)',
    },
  })
);

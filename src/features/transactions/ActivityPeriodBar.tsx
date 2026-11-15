import { Animated, Pressable, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { usePressScale } from '@/lib/usePressScale';
import { useStacked } from '@/lib/useStacked';
import type { useSwipeDrag } from '@/lib/useSwipeDrag';
import { withPressed, withPressedTint } from '@/lib/pressed';
import { styles } from './transactions.styles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ViewScope = 'week' | 'month';

const VIEW_SCOPES: { label: string; value: ViewScope }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

/**
 * Under Activity's title: ‹ This week › in a frosted pill, Week | Month beside it. Dragging the pill (or the Spent
 * card below, which shares the same `swipe`) steps the period, same as the chevrons.
 */
export function ActivityPeriodBar({
  heading,
  updating,
  scope,
  atCurrent,
  swipe,
  onStepBack,
  onStepForward,
  onPickMonth,
  onScope,
}: {
  heading: { title: string; sub?: string };
  /** The period was just stepped and its entries are still loading: the line under the title says so. */
  updating: boolean;
  scope: ViewScope;
  /** The period shown is this week or month: there is nothing later to step to. */
  atCurrent: boolean;
  swipe: ReturnType<typeof useSwipeDrag>;
  onStepBack: () => void;
  onStepForward: () => void;
  onPickMonth: () => void;
  onScope: (scope: ViewScope) => void;
}) {
  const { accent } = useAccent();
  const stackPeriod = useStacked('early');
  const stepBackPress = usePressScale();
  const stepForwardPress = usePressScale();
  return (
    <View style={[styles.periodBar, stackPeriod && styles.periodBarStacked]}>
      <View
        style={[styles.periodRow, stackPeriod ? styles.periodRowStacked : styles.periodRowFlush]}
        {...swipe.panHandlers}
      >
        {/* Only the contents follow the finger, inside the clipped pill, so a drag never slides the
            pill over the Week | Month switch beside it. */}
        <ReanimatedAnimated.View style={[styles.periodInner, swipe.dragStyle]}>
          <AnimatedPressable
            onPress={onStepBack}
            onPressIn={stepBackPress.onPressIn}
            onPressOut={stepBackPress.onPressOut}
            hitSlop={2}
            style={[styles.periodNav, stepBackPress.animatedStyle]}
            accessibilityRole="button"
            accessibilityLabel={scope === 'month' ? 'Previous month' : 'Previous week'}
          >
            <Feather name="chevron-left" size={16} color={theme.colors.textPrimary} />
          </AnimatedPressable>
          <Pressable
            onPress={onPickMonth}
            hitSlop={6}
            style={withPressed(styles.periodTitleBtn)}
            accessibilityRole="button"
            accessibilityLabel={`${heading.title}${heading.sub ? `, ${heading.sub}` : ''}. Pick a month`}
          >
            <Feather name="calendar" size={14} color={theme.colors.ink} />
            <View style={styles.periodTitleCol}>
              <Text style={styles.periodTitle} numberOfLines={1}>
                {heading.title}
              </Text>
              {!!heading.sub && (
                <Text style={styles.periodSub} numberOfLines={1}>
                  {updating ? 'Updating…' : heading.sub.split(' · ')[0]}
                </Text>
              )}
            </View>
            <Feather name="chevron-down" size={14} color={theme.colors.ink} />
          </Pressable>
          <AnimatedPressable
            onPress={onStepForward}
            onPressIn={stepForwardPress.onPressIn}
            onPressOut={stepForwardPress.onPressOut}
            hitSlop={2}
            disabled={atCurrent}
            style={[styles.periodNav, stepForwardPress.animatedStyle, atCurrent && styles.periodNavOff]}
            accessibilityRole="button"
            accessibilityLabel={scope === 'month' ? 'Next month' : 'Next week'}
            accessibilityState={{ disabled: atCurrent }}
          >
            <Feather name="chevron-right" size={16} color={theme.colors.textPrimary} />
          </AnimatedPressable>
        </ReanimatedAnimated.View>
      </View>
      <View
        style={[styles.scopeSwitch, !stackPeriod && styles.scopeSwitchFlush]}
        accessibilityRole="radiogroup"
      >
        {VIEW_SCOPES.map((o) => {
          const on = scope === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onScope(o.value)}
              hitSlop={2}
              style={withPressedTint(accent, [styles.scopeBtn, stackPeriod && styles.scopeBtnStacked])}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.scopeText, on && styles.scopeTextOn]}>{o.label}</Text>
              {on && <View style={styles.scopeUnderline} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

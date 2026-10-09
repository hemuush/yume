import { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { Kicker, frost } from '@/components/Frost';
import { theme } from '@/constants/theme';
import { formatSlotTime } from '@/lib/notificationTimes';

/** The arc runs from 5 AM (the morning slot's earliest) to midnight. */
const START = 5 * 60;
const END = 24 * 60;
const HEIGHT = 112;
const BASE = 92;
const RISE = 54;
const MARK = 15;
const SUN = '#E0A23A';

type Slot = { on: boolean; minutes: number };

/**
 * The top of Notifications: one day as an arc from 5 AM to midnight, a sun on the morning time and a moon on
 * the evening time, each with its time above it. A slot that's off leaves the arc. Decoration only: the rows
 * under it say the same in words.
 */
export function DayArc({ morning, evening }: { morning: Slot; evening: Slot }) {
  const [width, setWidth] = useState(0);
  const pad = 14;
  const x = (m: number) => pad + ((m - START) / (END - START)) * (width - pad * 2);
  const y = (m: number) => BASE - Math.sin(((m - START) / (END - START)) * Math.PI) * RISE;
  let arc = '';
  if (width > 0) for (let m = START; m <= END; m += 20) arc += `${m === START ? 'M' : 'L'}${x(m)},${y(m)}`;
  const marks = [
    { key: 'morning', ...morning, icon: 'sun' as const, color: SUN },
    { key: 'evening', ...evening, icon: 'moon' as const, color: theme.colors.link },
  ].filter((s) => s.on);
  const caption = marks.length
    ? marks
        .map((s) => `${s.key === 'morning' ? 'Morning' : 'Evening'} at ${formatSlotTime(s.minutes)}`)
        .join(' · ')
    : 'No times on';

  return (
    <Glass radius={28} tone="strong" style={frost.hero}>
      <Kicker icon="bell">Your day with Yume</Kicker>
      <View
        style={styles.plot}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityLabel={caption}
      >
        {width > 0 && (
          <>
            <Svg width={width} height={HEIGHT}>
              <Line x1={4} x2={width - 4} y1={BASE + 8} y2={BASE + 8} stroke="rgba(16,32,51,0.12)" />
              <Path d={arc} fill="none" stroke="rgba(16,32,51,0.2)" strokeWidth={1.5} strokeDasharray="4 4" />
              {marks.map((s) => (
                <Line
                  key={s.key}
                  x1={x(s.minutes)}
                  x2={x(s.minutes)}
                  y1={y(s.minutes)}
                  y2={BASE + 8}
                  stroke={s.color}
                  strokeDasharray="2 3"
                />
              ))}
              {marks.map((s) => (
                <Circle
                  key={s.key}
                  cx={x(s.minutes)}
                  cy={y(s.minutes)}
                  r={MARK}
                  fill={theme.colors.white}
                  stroke={s.color}
                  strokeWidth={2.5}
                />
              ))}
            </Svg>
            {marks.map((s) => (
              <View
                key={s.key}
                style={[styles.icon, { left: x(s.minutes) - MARK, top: y(s.minutes) - MARK }]}
                pointerEvents="none"
              >
                <Feather name={s.icon} size={16} color={s.color} />
              </View>
            ))}
            {marks.map((s) => (
              <Text
                key={s.key}
                style={[
                  styles.time,
                  {
                    left: Math.max(-12, Math.min(width - 68, x(s.minutes) - 40)),
                    top: y(s.minutes) - MARK - 20,
                  },
                ]}
                numberOfLines={1}
              >
                {formatSlotTime(s.minutes)}
              </Text>
            ))}
          </>
        )}
      </View>
      <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.axisText}>5 AM</Text>
        <Text style={styles.axisText}>Noon</Text>
        <Text style={styles.axisText}>Midnight</Text>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  plot: { height: HEIGHT, marginTop: 4 },
  icon: {
    position: 'absolute',
    width: MARK * 2,
    height: MARK * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    position: 'absolute',
    width: 80,
    textAlign: 'center',
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -10 },
  axisText: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
});

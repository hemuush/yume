import { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import { KickerDot } from '@/components/StripCard';
import { WrapBeat } from './wrapData';
import { styles, kickerTone } from './wrap.styles';
const EASE = Easing.out(Easing.cubic);

/** Fades and lifts something in after `delay` ms, once, when the beat appears. Still when `still`. */
export function Rise({
  delay = 0,
  still,
  style,
  onShown,
  children,
}: {
  delay?: number;
  still: boolean;
  style?: StyleProp<ViewStyle>;
  /** Called once it is fully visible (straight away when still). */
  onShown?: () => void;
  children: React.ReactNode;
}) {
  const [v] = useState(() => new Animated.Value(still ? 1 : 0));
  const shown = useRef(onShown);
  useEffect(() => {
    shown.current = onShown;
  });
  useEffect(() => {
    if (still) {
      v.setValue(1);
      shown.current?.();
      return;
    }
    const a = Animated.timing(v, { toValue: 1, duration: 380, delay, easing: EASE, useNativeDriver: true });
    a.start(({ finished }) => {
      if (finished) shown.current?.();
    });
    return () => a.stop();
  }, [v, delay, still]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY }] }]}>{children}</Animated.View>
  );
}

/** A beat's small heading, after a dot in the beat's colour. */
export function Kicker({ kind, children }: { kind: WrapBeat['kind']; children: React.ReactNode }) {
  return (
    <View style={styles.kickerRow}>
      <KickerDot color={kickerTone(kind)} />
      <Text style={styles.kicker}>{children}</Text>
    </View>
  );
}

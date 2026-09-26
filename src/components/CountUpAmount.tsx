import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, TextProps } from 'react-native';
import { Text } from '@/components/Text';
import { formatMoney } from '@/lib/money';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { MOTION } from '@/lib/animation';

interface Props extends TextProps {
  /** Amount in minor units, same as formatMoney. */
  minor: number;
  currency?: string;
}

/**
 * A rupee figure that counts up on first mount and eases between values when
 * `minor` changes (a month/period change) — extracted from
 * `ThisMonthHero`'s original local `CountUpMoney` so Reports' own headline
 * figure can share the exact same animation instead of a second copy of it.
 * Uses a JS listener (`useNativeDriver: false`) because text content itself
 * can't be driven natively — it's one short number, so the per-frame
 * `formatMoney` cost is negligible.
 */
export function CountUpAmount({ minor, currency, style, ...rest }: Props) {
  const reduce = useReduceMotion();
  const [display, setDisplay] = useState(minor);
  const [t] = useState(() => new Animated.Value(1));
  const prev = useRef(minor);
  const mounted = useRef(false);

  useEffect(() => {
    if (reduce) {
      setDisplay(minor);
      prev.current = minor;
      mounted.current = true;
      return;
    }
    const from = mounted.current ? prev.current : 0;
    prev.current = minor;
    mounted.current = true;
    t.setValue(0);
    const id = t.addListener(({ value }) => setDisplay(Math.round(from + (minor - from) * value)));
    // Core Animated here, so the shared curve is spelled out with core Easing.
    Animated.timing(t, {
      toValue: 1,
      duration: MOTION.count,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setDisplay(minor);
    });
    return () => t.removeListener(id);
  }, [minor, reduce, t]);

  return (
    <Text style={style} {...rest}>
      {formatMoney(display, currency)}
    </Text>
  );
}

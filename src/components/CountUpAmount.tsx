import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, TextProps, TextStyle } from 'react-native';
import { Text } from '@/components/Text';
import { formatMoney } from '@/lib/money';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { DURATIONS } from '@/lib/motionTimings';

interface Props extends TextProps {
  /** Amount in minor units, same as formatMoney. */
  minor: number;
  currency?: string;
  /**
   * Count up from 0 on first appearance (default). Off: show the value at once and roll only on later
   * changes (money added to a goal, an EMI paid).
   */
  countFromZero?: boolean;
  /** Styles the leading currency symbol on its own (smaller, muted), digits keep `style`. */
  symbolStyle?: StyleProp<TextStyle>;
}

/** "-₹1,200" → ["-", "₹", "1,200"]; null when the symbol trails or is missing. */
export function splitLeadingSymbol(text: string): [string, string, string] | null {
  const m = text.match(/^([-−]?)([^\d\-−]+)(\d.*)$/);
  return m ? [m[1], m[2], m[3]] : null;
}

/**
 * A rupee figure that counts up on mount and eases when `minor` changes; shared by ThisMonthHero and Reports.
 * Uses a JS listener (`useNativeDriver: false`): text can't be driven natively; one short number, so cheap.
 */
export function CountUpAmount({ minor, currency, countFromZero = true, symbolStyle, style, ...rest }: Props) {
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
    const from = mounted.current ? prev.current : countFromZero ? 0 : minor;
    prev.current = minor;
    mounted.current = true;
    if (from === minor) {
      setDisplay(minor);
      return;
    }
    t.setValue(0);
    const id = t.addListener(({ value }) => setDisplay(Math.round(from + (minor - from) * value)));
    // Core Animated here, so the shared curve is spelled out with core Easing.
    Animated.timing(t, {
      toValue: 1,
      duration: DURATIONS.count,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      // An animation cut short by a newer value (setValue stops it) must not snap back to its own target.
      if (finished) setDisplay(minor);
    });
    return () => t.removeListener(id);
    // countFromZero only matters on the first run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minor, reduce, t]);

  const text = formatMoney(display, currency);
  const parts = symbolStyle ? splitLeadingSymbol(text) : null;
  return (
    // TalkBack reads the settled amount, not whatever number the count has reached.
    <Text style={style} accessibilityLabel={formatMoney(minor, currency)} {...rest}>
      {parts ? (
        <>
          {parts[0]}
          <Text style={symbolStyle}>{parts[1]}</Text>
          {parts[2]}
        </>
      ) : (
        text
      )}
    </Text>
  );
}

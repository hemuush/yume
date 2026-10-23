import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, TextProps, TextStyle } from 'react-native';
import { Text } from '@/components/Text';
import { formatMoney } from '@/lib/money';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { DURATIONS } from '@/lib/motionTimings';

interface Props extends TextProps {
  /** Amount in minor units, same as formatMoney. */
  minor: number;
  currency?: string;
  /** How long a change takes to roll; the month card passes a longer one for its first roll up from zero. */
  duration?: number;
  /**
   * Opt in to counting from 0 on first appearance. By default: show the value at once and roll only on later
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
 * A rupee figure that appears immediately by default and eases when `minor` changes; shared by ThisMonthHero and Reports.
 * Uses a JS listener (`useNativeDriver: false`): text can't be driven natively; one short number, so cheap.
 */
export function CountUpAmount({
  minor,
  currency,
  countFromZero = false,
  duration = DURATIONS.count,
  symbolStyle,
  style,
  ...rest
}: Props) {
  const reduce = useReduceMotion();
  const [display, setDisplay] = useState(countFromZero && !reduce ? 0 : minor);
  const [t] = useState(() => new Animated.Value(1));
  const current = useRef(minor);
  const mounted = useRef(false);
  // `countFromZero` only matters on the first run and `duration` is fixed per call site, so the effect reads
  // both without depending on them.
  const options = useEffectEvent(() => ({ fromZero: countFromZero, duration }));

  useEffect(() => {
    if (reduce) {
      setDisplay(minor);
      current.current = minor;
      mounted.current = true;
      return;
    }
    const from = mounted.current ? current.current : options().fromZero ? 0 : minor;
    mounted.current = true;
    if (from === minor) {
      current.current = minor;
      setDisplay(minor);
      return;
    }
    t.setValue(0);
    current.current = from;
    setDisplay(from);
    let active = true;
    // Only re-render when the shown (whole-unit) text changes: a frame that moved a few paise would
    // otherwise re-measure the auto-fit text for nothing.
    let shown = '';
    const id = t.addListener(({ value }) => {
      if (!active) return;
      const next = Math.round(from + (minor - from) * value);
      current.current = next;
      const nextText = formatMoney(next, currency);
      if (nextText === shown) return;
      shown = nextText;
      setDisplay(next);
    });
    // Core Animated here, so the shared curve is spelled out with core Easing.
    const animation = Animated.timing(t, {
      toValue: 1,
      duration: options().duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      // An animation cut short by a newer value (setValue stops it) must not snap back to its own target.
      if (finished && active) {
        current.current = minor;
        setDisplay(minor);
      }
    });
    return () => {
      active = false;
      t.removeListener(id);
      animation.stop();
    };
  }, [minor, currency, reduce, t]);

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

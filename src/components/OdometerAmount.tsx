import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TextStyle, StyleProp } from 'react-native';
import { formatMoney } from '@/lib/money';
import { useReduceMotion } from '@/lib/useReduceMotion';

interface Props {
  /** Amount in minor units, same as formatMoney. */
  minor: number;
  style?: StyleProp<TextStyle>;
  currency?: string;
}

/**
 * A rupee figure whose digits roll into place — like a mechanical
 * odometer — instead of a plain re-render or `CountUpAmount`'s smooth
 * numeric tween. Reserved for a moment where a total visibly *changing* is
 * the point (a running staged-transaction total right now; a milestone
 * figure later) — most numbers in the app should stay `CountUpAmount` or
 * plain text, this is a deliberately louder effect for a deliberately rare
 * spot. Display-only: never wraps an editable input, and only the digits
 * that actually changed roll — punctuation and unchanged digits stay put.
 */
export function OdometerAmount({ minor, style, currency }: Props) {
  const reduce = useReduceMotion();
  const formatted = formatMoney(minor, currency);
  const [prevFormatted, setPrevFormatted] = useState(formatted);
  const prevRef = useRef(formatted);

  useEffect(() => {
    if (formatted !== prevRef.current) {
      setPrevFormatted(prevRef.current);
      prevRef.current = formatted;
    }
  }, [formatted]);

  if (reduce) {
    return <Text style={style}>{formatted}</Text>;
  }

  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const fontSize = typeof flat?.fontSize === 'number' ? flat.fontSize : 16;
  const reelHeight = Math.ceil(fontSize * 1.25);

  return (
    <View style={styles.row}>
      {formatted.split('').map((ch, i) => {
        const isDigit = ch >= '0' && ch <= '9';
        if (!isDigit || prevFormatted[i] === ch) {
          return (
            <Text key={i} style={style}>
              {ch}
            </Text>
          );
        }
        return <DigitReel key={`${i}-${ch}`} digit={ch} height={reelHeight} textStyle={style} />;
      })}
    </View>
  );
}

function DigitReel({
  digit,
  height,
  textStyle,
}: {
  digit: string;
  height: number;
  textStyle?: StyleProp<TextStyle>;
}) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // A fresh Animated.Value per mount (the `key` above remounts this on
    // every digit change) — nothing else to depend on here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [-height, 0] });
  const opacity = v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] });

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateY }], opacity }}>
        <Text style={[textStyle, { lineHeight: height }]}>{digit}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});

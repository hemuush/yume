import { StyleProp, TextProps, TextStyle } from 'react-native';
import { Text } from '@/components/Text';
import { formatMoney } from '@/lib/money';

interface Props extends TextProps {
  /** Amount in minor units, same as formatMoney. */
  minor: number;
  currency?: string;
  /** Styles the leading currency symbol on its own (smaller, muted), digits keep `style`. */
  symbolStyle?: StyleProp<TextStyle>;
}

/** "-₹1,200" → ["-", "₹", "1,200"]; null when the symbol trails or is missing. */
export function splitLeadingSymbol(text: string): [string, string, string] | null {
  const m = text.match(/^([-−]?)([^\d\-−]+)(\d.*)$/);
  return m ? [m[1], m[2], m[3]] : null;
}

/**
 * A money figure. It shows the real amount at once and changes to a new one at once: figures no longer roll or
 * count up, which kept JavaScript busy re-measuring auto-fit text on every frame and made screens feel heavy.
 * Kept as its own component so every figure formats the same way (and the symbol can be styled on its own).
 */
export function CountUpAmount({ minor, currency, symbolStyle, style, ...rest }: Props) {
  const text = formatMoney(minor, currency);
  const parts = symbolStyle ? splitLeadingSymbol(text) : null;
  return (
    <Text style={style} accessibilityLabel={text} {...rest}>
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

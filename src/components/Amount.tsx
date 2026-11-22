import { StyleSheet, TextProps } from 'react-native';
import { Text } from '@/components/Text';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';

interface Props extends TextProps {
  /** Amount in minor units, same as formatMoney. */
  minor: number;
  /** Usually a category's own `isSensitive` flag — only masked when this AND the global privacy toggle are both on. */
  sensitive?: boolean;
  currency?: string;
  /** A recorded amount: shows its paise when it has some (see formatMoneyExact). Totals leave this off. */
  exact?: boolean;
}

/**
 * Drop-in for `<Text>{formatMoney(x)}</Text>` where an amount may be sensitive. Masks it (keeping the
 * currency symbol) only when "hide savings & investment amounts" is on AND the amount is tagged sensitive.
 */
// "₹12.50" or "12,50 €": what comes before the paise, the paise with their separator, and a currency sign after them.
const PAISE = /^(.*[0-9])([.,][0-9]{2})([^0-9]*)$/;

export function Amount({ minor, sensitive, currency, exact, style, ...rest }: Props) {
  const { hideAmounts } = usePrivacy();
  const masked = hideAmounts && sensitive;
  const text = formatMaskableMoney(minor, { currency, masked, exact });
  // Paise sit smaller than the rupees, like a printed figure: "₹12" big, ".50" small.
  const paise = exact && !masked ? PAISE.exec(text) : null;
  const size = StyleSheet.flatten(style)?.fontSize;
  if (!paise || !size)
    return (
      <Text style={style} {...rest}>
        {text}
      </Text>
    );
  return (
    <Text style={style} {...rest}>
      {paise[1]}
      <Text style={{ fontSize: Math.round(size * 0.78) }}>{paise[2]}</Text>
      {paise[3]}
    </Text>
  );
}

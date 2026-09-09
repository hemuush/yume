import { Text, TextProps } from 'react-native';
import { formatMoney, getCurrencySymbol } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';

interface Props extends TextProps {
  /** Amount in minor units, same as formatMoney. */
  minor: number;
  /** Usually a category's own `isSensitive` flag — only masked when this AND the global privacy toggle are both on. */
  sensitive?: boolean;
  currency?: string;
}

/**
 * Drop-in replacement for `<Text>{formatMoney(x)}</Text>` wherever an
 * amount is traceable to a specific (possibly sensitive) category —
 * Transactions rows, Reports category breakdown, Home's recent activity.
 * Renders the real formatted amount unless the viewer has turned on "hide
 * savings & investment amounts" in Settings AND this particular amount is
 * tagged sensitive, in which case it shows a masked placeholder that still
 * reads as money (keeps the currency symbol) rather than a blank or a zero.
 */
export function Amount({ minor, sensitive, currency, style, ...rest }: Props) {
  const { hideAmounts } = usePrivacy();
  const masked = hideAmounts && sensitive;
  return (
    <Text style={style} {...rest}>
      {masked ? `${getCurrencySymbol(currency)}••••` : formatMoney(minor, currency)}
    </Text>
  );
}

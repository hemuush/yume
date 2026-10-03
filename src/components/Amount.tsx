import { TextProps } from 'react-native';
import { Text } from '@/components/Text';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';

interface Props extends TextProps {
  /** Amount in minor units, same as formatMoney. */
  minor: number;
  /** Usually a category's own `isSensitive` flag — only masked when this AND the global privacy toggle are both on. */
  sensitive?: boolean;
  currency?: string;
}

/**
 * Drop-in for `<Text>{formatMoney(x)}</Text>` where an amount may be sensitive. Masks it (keeping the
 * currency symbol) only when "hide savings & investment amounts" is on AND the amount is tagged sensitive.
 */
export function Amount({ minor, sensitive, currency, style, ...rest }: Props) {
  const { hideAmounts } = usePrivacy();
  const masked = hideAmounts && sensitive;
  return (
    <Text style={style} {...rest}>
      {formatMaskableMoney(minor, { currency, masked })}
    </Text>
  );
}

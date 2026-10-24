import { ModalSheet } from '@/components/ModalSheet';
import { SettingsRow } from '@/components/SettingsRow';
import { Text } from '@/components/Text';
import { cardSurface } from '@/components/CardSurface';
import { screenStyles as h } from '@/components/screenStyles';
import { View } from 'react-native';
import { theme } from '@/constants/theme';
import { formatMaskableMoney } from '@/lib/money';
import { INVESTMENT_KIND_LABEL } from '@/lib/investment';
import { usePrivacy } from '@/theme/PrivacyContext';
import type { Holding } from '@/lib/portfolio';

/** Which investment? One list, one tap: used by Invest and Add a SIP when there is more than one. */
export function HoldingPickerSheet({
  visible,
  title,
  holdings,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  holdings: Holding[];
  onPick: (holding: Holding) => void;
  onClose: () => void;
}) {
  const { hideAmounts } = usePrivacy();
  return (
    <ModalSheet visible={visible} title={title} onClose={onClose}>
      <View style={[h.card, cardSurface.neutral]}>
        {holdings.map((holding, i) => (
          <SettingsRow
            key={holding.id}
            icon="trending-up"
            round
            label={holding.name}
            sub={[
              holding.kind ? INVESTMENT_KIND_LABEL[holding.kind] : null,
              formatMaskableMoney(holding.valueMinor, {
                currency: holding.account.currency,
                masked: hideAmounts,
              }),
            ]
              .filter(Boolean)
              .join(' · ')}
            onPress={() => onPick(holding)}
            divider={i > 0}
          />
        ))}
      </View>
      {holdings.length === 0 && (
        <Text style={{ fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted }}>
          Add an investment first.
        </Text>
      )}
    </ModalSheet>
  );
}

import { useState } from 'react';
import { View } from 'react-native';
import { SheetFlow } from '@/components/SheetFlow';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SettingsRow } from '@/components/SettingsRow';
import { Text } from '@/components/Text';
import { cardSurface } from '@/components/CardSurface';
import { screenStyles as h } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { formatMaskableMoney } from '@/lib/money';
import { ageLabel } from '@/lib/investment';
import { usePrivacy } from '@/theme/PrivacyContext';
import type { Holding } from '@/lib/portfolio';
import { UpdateValueSheet } from './UpdateValueSheet';

/**
 * Every holding in one list, the oldest value first: tap one to say what it is worth now, and it is ticked
 * once saved. Each save is the same value update an account's own sheet makes.
 */
export function UpdateValuesSheet({
  visible,
  holdings,
  onClose,
  onChanged,
}: {
  visible: boolean;
  holdings: Holding[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { hideAmounts } = usePrivacy();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const editing = holdings.find((x) => x.id === editingId) ?? null;
  // Never updated first, then the longest ago.
  const ordered = [...holdings].sort((a, b) => (b.ageDays ?? Infinity) - (a.ageDays ?? Infinity));
  const close = () => {
    setDone(new Set());
    setEditingId(null);
    onClose();
  };
  return (
    <SheetFlow visible={visible}>
      <ModalSheet
        flowPage
        visible={visible && !editing}
        title="Update values"
        onClose={close}
        footer={<PrimaryButton title="Done" onPress={close} />}
      >
        <Text
          style={{ fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted }}
        >
          The longest ago first. Update the ones that have changed and leave the rest.
        </Text>
        <View style={[h.card, cardSurface.neutral]}>
          {ordered.map((holding, i) => {
            const updated = done.has(holding.id);
            return (
              <SettingsRow
                key={holding.id}
                icon={updated ? 'check' : 'trending-up'}
                round
                label={holding.name}
                sub={`${formatMaskableMoney(holding.valueMinor, { currency: holding.account.currency, masked: hideAmounts })} · ${
                  updated
                    ? 'Updated today'
                    : holding.ageDays == null
                      ? 'No update yet'
                      : ageLabel(holding.ageDays)
                }`}
                subColor={!updated && holding.stale ? theme.colors.warnInk : undefined}
                onPress={() => setEditingId(holding.id)}
                divider={i > 0}
              />
            );
          })}
        </View>
      </ModalSheet>
      {editing && (
        <UpdateValueSheet
          backLabel="Back to update values"
          visible
          account={editing.account}
          valuation={null}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setDone((d) => new Set(d).add(editing.id));
            setEditingId(null);
            onChanged();
          }}
          onDeleted={() => setEditingId(null)}
        />
      )}
    </SheetFlow>
  );
}

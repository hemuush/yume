import { useEffect, useState } from 'react';
import { View, Keyboard, Pressable, StyleSheet } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { listExpenseLabels } from '@/db/expenseLabels';
import { usePrivacy } from '@/theme/PrivacyContext';
import { theme } from '@/constants/theme';

export function ExpenseLabelSheet({
  visible,
  value,
  onClose,
  onPick,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onPick: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [labels, setLabels] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const { hideAmounts } = usePrivacy();
  useEffect(() => {
    if (visible) {
      setDraft(value);
      setExpanded(false);
    }
  }, [visible, value]);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLabels([]);
    setError(false);
    setLoading(true);
    void listExpenseLabels('', hideAmounts).then(
      (rows) => {
        if (active) {
          setLabels(rows);
          setLoading(false);
        }
      },
      () => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    );
    return () => {
      active = false;
    };
  }, [visible, hideAmounts, retry]);
  const matching = labels.filter((label) => label.toLowerCase().includes(draft.trim().toLowerCase()));
  const close = () => {
    Keyboard.dismiss();
    onClose();
  };
  const pick = (label: string) => {
    onPick(label);
    close();
  };
  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      title="Expense label"
      size="compact"
      footer={
        <PrimaryButton
          title={draft.trim() ? 'Use label' : value.trim() ? 'Remove label' : 'Done'}
          onPress={() => pick(draft.trim())}
        />
      }
    >
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Find or create a label"
        accessibilityLabel="Expense label"
        returnKeyType="done"
        onSubmitEditing={() => pick(draft.trim())}
        style={{
          minHeight: 52,
          padding: 14,
          fontFamily: theme.font.body,
          fontSize: 16,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: theme.colors.borderSoft,
          backgroundColor: theme.colors.surface,
          color: theme.colors.textPrimary,
        }}
      />
      <Text style={{ marginVertical: 12, color: theme.colors.textSecondary }}>
        {draft.trim() ? 'Matching recent labels' : 'Recent labels'}
      </Text>
      {loading && (
        <Text accessibilityLiveRegion="polite" style={s.hint}>
          Loading recent labels…
        </Text>
      )}
      {error && (
        <Text style={{ color: theme.colors.expenseText }}>
          Previous labels couldn’t load. You can still enter a label.
        </Text>
      )}
      {error && (
        <Pressable onPress={() => setRetry((n) => n + 1)} accessibilityRole="button" style={s.action}>
          <Text style={s.link}>Retry recent labels</Text>
        </Pressable>
      )}
      {!loading && !error && matching.length === 0 && (
        <Text style={s.hint}>
          {draft.trim() ? 'Use this as a new label.' : 'Enter a label to organise this expense.'}
        </Text>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {matching.slice(0, expanded ? 50 : 8).map((label) => (
          <Chip key={label} label={label} active={draft.trim() === label} onPress={() => pick(label)} />
        ))}
      </View>
      {!expanded && matching.length > 8 && (
        <Pressable onPress={() => setExpanded(true)} accessibilityRole="button" style={s.action}>
          <Text style={s.link}>Show more labels</Text>
        </Pressable>
      )}
    </ModalSheet>
  );
}
const s = StyleSheet.create({
  hint: { fontFamily: theme.font.body, color: theme.colors.textMuted, fontSize: 13, marginBottom: 12 },
  action: { minHeight: 44, justifyContent: 'center' },
  link: { fontFamily: theme.font.body, color: theme.colors.link, fontSize: 13 },
});

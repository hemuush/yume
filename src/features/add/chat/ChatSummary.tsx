import { Pressable, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import type { ChatEntry, EntryKind } from './chatEntry';
import { s } from './chatStyles';
import type { useChatAdd } from './useChatAdd';

/** The form's four tabs, in its order, each with its own mark. */
export const TYPES: {
  label: string;
  value: EntryKind;
  icon: React.ComponentProps<typeof Feather>['name'];
  hint: string;
}[] = [
  { label: 'Expense', value: 'expense', icon: 'arrow-up-right', hint: 'Money you spent' },
  { label: 'Income', value: 'income', icon: 'arrow-down-left', hint: 'Money you received' },
  { label: 'Transfer', value: 'transfer', icon: 'repeat', hint: 'Between your accounts' },
  { label: 'Friend', value: 'friend', icon: 'users', hint: 'Lent or borrowed' },
];

/**
 * The end of the chat: the entry as the form would show it, every row tappable to change, the split and Money back
 * switches, then Save (which is the form's own save, see useChatAdd).
 */
export function ChatSummary({ chat, entry }: { chat: ReturnType<typeof useChatAdd>; entry: ChatEntry }) {
  const summary = chat.summary;
  if (!summary) return null;
  return (
    <View style={s.pickCard}>
      <View style={s.typeRow} accessibilityRole="radiogroup" accessibilityLabel="Type">
        {TYPES.map((t) => {
          const on = entry.type === t.value;
          return (
            <Pressable
              key={t.value}
              accessibilityRole="radio"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: on }}
              onPress={() => chat.changeType(t.value)}
              style={withPressed([s.typeChip, on && s.typeChipOn])}
            >
              <Text style={[s.typeChipText, on && s.typeChipTextOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {summary.rows.map((row) => (
        <Pressable
          key={row.field}
          accessibilityRole="button"
          accessibilityLabel={`${row.label}: ${row.value}. Change`}
          onPress={() => chat.goTo(row.field)}
          style={withPressed(row.field === 'amount' ? s.amountRow : s.row)}
        >
          <Text style={s.fieldLabel}>{row.label}</Text>
          <View style={s.rowValue}>
            <Text
              style={[row.field === 'amount' ? s.amount : s.value, row.needed && s.needed]}
              numberOfLines={1}
            >
              {row.value}
            </Text>
            <Feather name="chevron-right" size={15} color={theme.colors.textMuted} />
          </View>
        </Pressable>
      ))}
      {summary.parts && (
        <View style={s.parts}>
          <Text style={s.fieldLabel}>Split into {summary.parts.length} parts</Text>
          {summary.parts.map((part, i) => (
            <View key={i} style={s.partRow}>
              <Text style={s.value} numberOfLines={1}>
                {part.label}
              </Text>
              <Text style={s.value}>{part.value}</Text>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove the split"
            onPress={chat.clearSplit}
            hitSlop={8}
            style={withPressed(s.footBtn)}
          >
            <Text style={s.footText}>Remove the split</Text>
          </Pressable>
        </View>
      )}
      {entry.type === 'expense' && !entry.refund && !summary.parts && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Split between categories"
          onPress={chat.startSplit}
          style={withPressed(s.row)}
        >
          <Text style={s.fieldLabel}>Split between categories</Text>
          <Feather name="chevron-right" size={15} color={theme.colors.textMuted} />
        </Pressable>
      )}
      {entry.type === 'expense' && (
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Money back"
          accessibilityState={{ checked: entry.refund }}
          onPress={chat.toggleRefund}
          style={withPressed(s.row)}
        >
          <Text style={s.fieldLabel}>Money back (a refund)</Text>
          <Text style={[s.value, entry.refund && s.on]}>{entry.refund ? 'On' : 'Off'}</Text>
        </Pressable>
      )}
      <PrimaryButton
        title={chat.saving ? 'Saving…' : 'Save'}
        onPress={() => void chat.save()}
        disabled={!summary.complete || chat.saving}
        style={s.save}
      />
    </View>
  );
}

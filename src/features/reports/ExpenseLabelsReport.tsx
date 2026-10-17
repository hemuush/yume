import { useEffect, useState } from 'react';
import { View, Pressable, Keyboard, StyleSheet } from 'react-native';
import { ModalSheet } from '@/components/ModalSheet';
import { Text, TextInput } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { PrimaryButton } from '@/components/PrimaryButton';
import { expenseLabelTotals } from '@/db/expenseLabels';
import { usePrivacy } from '@/theme/PrivacyContext';
import { theme } from '@/constants/theme';
import { DateRange } from '@/types';
import { dayMonthYear } from '@/lib/dateLabels';

export function ExpenseLabelsReport({
  visible,
  range,
  onClose,
}: {
  visible: boolean;
  range: DateRange;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof expenseLabelTotals>>>([]);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(8);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const { hideAmounts } = usePrivacy();
  useEffect(() => {
    if (!visible) return;
    let live = true;
    setStatus('loading');
    setRows([]);
    setLimit(8);
    setQuery('');
    void expenseLabelTotals(range.start, range.end, hideAmounts).then(
      (data) => {
        if (live) {
          setRows(data);
          setStatus('ready');
        }
      },
      () => {
        if (live) setStatus('error');
      }
    );
    return () => {
      live = false;
    };
  }, [visible, range.start, range.end, hideAmounts, retry]);
  const matching = rows.filter((row) =>
    (row.label || 'No label').toLowerCase().includes(query.trim().toLowerCase())
  );
  const close = () => {
    Keyboard.dismiss();
    onClose();
  };
  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      title="Expense labels"
      subtitle={`${dayMonthYear(range.start)} – ${dayMonthYear(range.end)}`}
      scrollable
    >
      <View style={s.summary}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Net spending</Text>
        {status === 'ready' ? (
          <Amount
            minor={rows.reduce((total, row) => total + row.totalMinor, 0)}
            style={{ fontVariant: ['tabular-nums'], fontSize: 28 }}
          />
        ) : (
          <Text style={s.status} accessibilityLiveRegion="polite">
            {status === 'loading' ? 'Loading spending…' : 'Spending couldn’t load'}
          </Text>
        )}
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
          After refunds · includes unlabelled expenses
        </Text>
      </View>
      <View style={s.search}>
        <TextInput
          accessibilityLabel="Search report labels"
          placeholder="Find a label"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setLimit(8);
          }}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
          editable={status === 'ready'}
          style={s.input}
        />
        {!!query && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear label search"
            onPress={() => {
              setQuery('');
              setLimit(8);
            }}
            style={s.clear}
          >
            <Text style={{ color: theme.colors.link }}>Clear</Text>
          </Pressable>
        )}
      </View>
      {status === 'error' && (
        <View style={{ marginTop: 16 }}>
          <PrimaryButton
            compact
            variant="secondary"
            title="Retry labels"
            onPress={() => setRetry((value) => value + 1)}
          />
        </View>
      )}
      {status === 'ready' && matching.length === 0 && (
        <Text style={{ paddingVertical: 16 }}>
          {query.trim() ? 'No matching expense labels. Try another search.' : 'No spending in this period.'}
        </Text>
      )}
      {status === 'ready' && matching.length > 0 && (
        <Text style={s.caption}>
          {query.trim()
            ? `${matching.length} matching ${matching.length === 1 ? 'label' : 'labels'}`
            : 'By label'}
        </Text>
      )}
      {matching.slice(0, limit).map((row) => (
        <View
          key={row.label}
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.borderSoft,
          }}
        >
          <View style={{ flexGrow: 1, flexBasis: 140 }}>
            <Text style={{ fontFamily: theme.font.bodyBold, fontSize: 13 }}>{row.label || 'No label'}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
              {row.count === 0
                ? 'Refunds only'
                : `${row.count} ${row.count === 1 ? 'expense entry' : 'expense entries'}`}
            </Text>
          </View>
          <Amount minor={row.totalMinor} style={{ fontVariant: ['tabular-nums'], fontSize: 15 }} />
        </View>
      ))}
      {matching.length > limit && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            Keyboard.dismiss();
            setLimit((value) => value + 20);
          }}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ color: theme.colors.link }}>Show more labels</Text>
        </Pressable>
      )}
    </ModalSheet>
  );
}
const s = StyleSheet.create({
  summary: { gap: 6, marginBottom: 16, minHeight: 88 },
  status: {
    fontFamily: theme.font.body,
    fontSize: 18,
    color: theme.colors.textSecondary,
    paddingVertical: 4,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 14,
  },
  input: { flex: 1, minWidth: 0, minHeight: 48, padding: 12, color: theme.colors.textPrimary },
  clear: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center' },
  caption: {
    fontFamily: theme.font.body,
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 16,
    marginBottom: 4,
  },
});

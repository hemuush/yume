import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ModalSheet } from '@/components/ModalSheet';
import { Text, TextInput } from '@/components/Text';
import { theme } from '@/constants/theme';
import { dayMonthYear, longMonthYear } from '@/lib/dateLabels';
import { withPressed } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { selectedFill } from '@/theme/interactionColors';
import { heatDayLabel, type HeatDay, type HeatModel } from './reportsInsights';

type Choice =
  | { kind: 'day'; key: string; label: string; search: string; day: HeatDay }
  | { kind: 'month'; key: string; label: string; search: string };

/** Full-size alternative to precision selection in the dense year overview. */
export function HeatmapDayPicker({
  rows,
  selectedIso,
  onSelect,
  onOpenMonth,
}: {
  rows: Extract<HeatModel, { kind: 'matrix' }>['rows'];
  selectedIso: string | null;
  onSelect: (iso: string) => void;
  onOpenMonth?: (month: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { height } = useWindowDimensions();
  const { accent } = useAccent();
  const choices: Choice[] = [];
  // Build labels only while open; closed year charts don't format hundreds of unused dates.
  if (open) {
    for (const row of [...rows].reverse()) {
      const month = longMonthYear(`${row.key}-01`);
      if (onOpenMonth) choices.push({ kind: 'month', key: row.key, label: `Open ${month}`, search: month });
      for (const day of [...row.days].reverse()) {
        if (!day || day.future) continue;
        const label = dayMonthYear(day.iso);
        choices.push({ kind: 'day', key: day.iso, label, search: `${label} ${month} ${day.iso}`, day });
      }
    }
  }
  const term = query.trim().toLocaleLowerCase();
  const filtered = choices.filter((choice) => choice.search.toLocaleLowerCase().includes(term));
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const select = (choice: Choice) => {
    close();
    if (choice.kind === 'day') onSelect(choice.day.iso);
    else onOpenMonth?.(choice.key);
  };
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={withPressed(styles.launcher)}
        accessibilityRole="button"
        accessibilityLabel="Choose day or month"
      >
        <Text style={styles.title}>Choose day or month</Text>
        <Text style={styles.detail}>{selectedIso ? dayMonthYear(selectedIso) : 'Browse dates'}</Text>
      </Pressable>
      <ModalSheet
        visible={open}
        onClose={close}
        title="Choose day or month"
        size="expanded"
        scrollable={false}
      >
        <View style={{ height: Math.floor(height / 2) }}>
          <TextInput
            accessibilityLabel="Find a day"
            placeholder="Search day or month"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            style={styles.search}
          />
          <FlatList
            data={filtered}
            keyExtractor={(choice) => `${choice.kind}:${choice.key}`}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={5}
            ListEmptyComponent={<Text accessibilityLiveRegion="polite">No matching days</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => select(item)}
                accessibilityRole="button"
                accessibilityLabel={
                  item.kind === 'day' ? `${heatDayLabel(item.day)}, ${item.key.slice(0, 4)}` : item.label
                }
                accessibilityState={{ selected: item.kind === 'day' && item.key === selectedIso }}
                style={withPressed([
                  styles.row,
                  item.kind === 'month' && styles.month,
                  item.key === selectedIso && { backgroundColor: selectedFill(accent) },
                ])}
              >
                <Text style={item.kind === 'month' ? styles.title : styles.detail}>{item.label}</Text>
              </Pressable>
            )}
          />
        </View>
      </ModalSheet>
    </>
  );
}

const styles = StyleSheet.create({
  launcher: {
    minHeight: theme.accessibility.minTouchTarget,
    marginTop: theme.space.sm,
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.tray,
  },
  title: { fontFamily: theme.font.bodyBold, fontSize: theme.typeSize.row, color: theme.colors.link },
  detail: { fontFamily: theme.font.body, fontSize: theme.typeSize.row, color: theme.colors.textPrimary },
  search: {
    minHeight: theme.accessibility.minTouchTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.md,
    padding: theme.space.sm,
    marginBottom: theme.space.sm,
    fontFamily: theme.font.body,
    fontSize: theme.typeSize.row,
    color: theme.colors.textPrimary,
  },
  row: {
    minHeight: theme.accessibility.minTouchTarget,
    padding: theme.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  month: { backgroundColor: theme.colors.tray },
});

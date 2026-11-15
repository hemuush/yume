import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { ActionSheet } from '@/components/ActionSheet';
import { theme } from '@/constants/theme';
import { dayMonthYear } from '@/lib/dateLabels';
import { formatMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import type { PersonLedgerEntry } from '@/types';
import { styles } from './people.styles';

const entryLabel = (entry: PersonLedgerEntry) => entry.note || (entry.amountMinor >= 0 ? 'Lent' : 'Repaid');

/** One line of a person's history: what, when, how much, and a ⋯ button for its menu. */
const HistoryRow = memo(function HistoryRow({
  entry,
  amountMinor,
  saving,
  onDelete,
  onMenu,
}: {
  entry: PersonLedgerEntry;
  /** The amount as shown (rounded so the list adds up to the balance), unsigned. */
  amountMinor: number;
  saving: boolean;
  onDelete: (entry: PersonLedgerEntry) => void;
  onMenu: (entry: PersonLedgerEntry) => void;
}) {
  return (
    <Pressable
      style={withPressed(styles.row)}
      onLongPress={() => onDelete(entry)}
      accessibilityRole="button"
      accessibilityLabel={`${entryLabel(entry)}, ${formatMoney(Math.abs(amountMinor), entry.currency)}, ${dayMonthYear(entry.date)}`}
      accessibilityHint="Double tap and hold to delete"
      disabled={saving}
    >
      <View
        style={[
          styles.historyIcon,
          { backgroundColor: entry.amountMinor >= 0 ? theme.colors.incomeTint : theme.colors.expenseTint },
        ]}
      >
        <Feather
          name={entry.amountMinor >= 0 ? 'arrow-up' : 'arrow-down'}
          size={13}
          color={entry.amountMinor >= 0 ? theme.colors.income : theme.colors.expense}
        />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.rowLabel}>{entryLabel(entry)}</Text>
        <Text style={styles.rowSub}>{dayMonthYear(entry.date)}</Text>
      </View>
      <Text
        style={[
          styles.rowValue,
          { color: entry.amountMinor >= 0 ? theme.colors.incomeText : theme.colors.expenseText },
        ]}
      >
        {entry.amountMinor >= 0 ? '+' : '-'}
        {formatMoney(Math.abs(amountMinor), entry.currency)}
      </Text>
      <Pressable
        onPress={(event) => {
          event?.stopPropagation();
          onMenu(entry);
        }}
        hitSlop={10}
        disabled={saving}
        style={withPressed(styles.moreBtn)}
        accessibilityRole="button"
        accessibilityLabel={`More for the ${dayMonthYear(entry.date)} entry`}
      >
        <Feather name="more-horizontal" size={15} color={theme.colors.textSecondary} />
      </Pressable>
    </Pressable>
  );
});

/**
 * A person's history tab: each entry, and the ⋯ menu that deletes one. The menu's own state lives here, so opening it
 * draws the menu, not the whole sheet.
 */
export const PersonHistory = memo(function PersonHistory({
  ledger,
  amounts,
  loaded,
  loadError,
  saving,
  onDelete,
}: {
  ledger: PersonLedgerEntry[];
  /** Each entry's amount as shown, in the order of `ledger`. */
  amounts: number[];
  /** The person's details have arrived. */
  loaded: boolean;
  loadError: string | null;
  saving: boolean;
  onDelete: (entry: PersonLedgerEntry) => void;
}) {
  // The entry whose ⋯ menu is open.
  const [menuEntry, setMenuEntry] = useState<PersonLedgerEntry | null>(null);
  return (
    <>
      {!loaded ? (
        <Text style={styles.emptyText}>
          {loadError ? 'History unavailable. Tap Retry above.' : 'Loading history…'}
        </Text>
      ) : ledger.length === 0 ? (
        <Text style={styles.emptyText}>No entries yet.</Text>
      ) : (
        ledger.map((entry, i) => (
          <HistoryRow
            key={entry.id}
            entry={entry}
            amountMinor={amounts[i]}
            saving={saving}
            onDelete={onDelete}
            onMenu={setMenuEntry}
          />
        ))
      )}
      <ActionSheet
        visible={!!menuEntry}
        onClose={() => setMenuEntry(null)}
        title={menuEntry ? `${entryLabel(menuEntry)} · ${dayMonthYear(menuEntry.date)}` : undefined}
        items={
          menuEntry
            ? [
                {
                  key: 'delete',
                  label: 'Delete entry',
                  icon: 'trash-2',
                  destructive: true,
                  onPress: () => onDelete(menuEntry),
                },
              ]
            : []
        }
      />
    </>
  );
});

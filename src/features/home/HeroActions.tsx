import { useEffect, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { CategoryIcon } from '@/components/CategoryIcon';
import { pushOnce } from '@/lib/pushOnce';
import { theme } from '@/constants/theme';
import { getRepeatEntries, type RepeatEntry } from '@/db/ledger';
import { onTransactionsChanged } from '@/lib/dataEvents';
import { formatMaskableMoney } from '@/lib/money';
import { usePressScale } from '@/hooks/usePressScale';
import { haptics } from '@/lib/haptics';
import { usePrivacy } from '@/theme/PrivacyContext';
import { themedStyles } from '@/theme/themedStyles';
import { useLogAgain } from './useLogAgain';

type ActionType = 'expense' | 'income' | 'transfer';

const ACTIONS: {
  type: ActionType;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}[] = [
  { type: 'expense', label: 'Expense', icon: 'arrow-up-right' },
  { type: 'income', label: 'Income', icon: 'arrow-down-left' },
  { type: 'transfer', label: 'Transfer', icon: 'repeat' },
];

/** How many of the most repeated entries get a chip on Home; the rest stay in the + long-press sheet. */
const REPEAT_CHIPS = 3;

/** Opens Add with its entry type selected. `slim` is the chip-sized version that sits after the repeat chips. */
function Action({ type, label, icon, slim = false }: (typeof ACTIONS)[number] & { slim?: boolean }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.96);
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        pushOnce(`/add-transaction?type=${type}`);
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.wrap,
        !slim && { flexGrow: 1, flexBasis: 88 * Math.max(1, fontScale) },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={type === 'expense' ? 'Add expense' : `Add ${label.toLowerCase()}`}
    >
      <Animated.View style={[styles.action, slim && styles.slim, animatedStyle]}>
        <View style={[styles.chip, type === 'expense' && styles.chipCoral]}>
          <Feather
            name={icon}
            size={16}
            color={
              type === 'expense'
                ? theme.colors.onCoral
                : type === 'income'
                  ? theme.colors.incomeText
                  : theme.colors.link
            }
          />
        </View>
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** One repeated entry: a tap saves it again for today (with Undo), as the + long-press sheet does. */
function RepeatChip({ entry, onLog }: { entry: RepeatEntry; onLog: (entry: RepeatEntry) => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.96);
  const { hideAmounts } = usePrivacy();
  const name = entry.note.trim() || entry.categoryName;
  const amount = formatMaskableMoney(entry.amountMinor, {
    currency: entry.accountCurrency,
    masked: hideAmounts && entry.isSensitive,
  });
  return (
    <Pressable
      onPress={() => onLog(entry)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Log ${name}, ${amount}, again for today`}
      accessibilityHint="Saves it straight away. You can undo it after."
    >
      <Animated.View style={[styles.action, styles.slim, animatedStyle]}>
        <CategoryIcon name={entry.categoryIcon} color={entry.categoryColor} size={14} square={30} />
        <View style={styles.repeatText}>
          <Text style={styles.label} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.amount, entry.type === 'income' && styles.amountIn]} numberOfLines={1}>
            {entry.type === 'income' ? '+' : ''}
            {amount}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** The entries logged most often lately, kept up to date as entries are saved anywhere. */
function useRepeatEntries() {
  const [entries, setEntries] = useState<RepeatEntry[]>([]);
  useEffect(() => {
    let active = true;
    const load = () =>
      getRepeatEntries(REPEAT_CHIPS)
        .then((list) => {
          if (active) setEntries(list);
        })
        // A failed read leaves the plain Expense / Income / Transfer buttons, which always work.
        .catch(() => {
          if (active) setEntries([]);
        });
    void load();
    const unsubscribe = onTransactionsChanged(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return entries;
}

/**
 * Quick entry under the month card. Once some entries repeat, they lead as one-tap chips (saved for today, with
 * Undo), followed by Income and Transfer; Expense is the + button. Until then, the three plain shortcuts.
 */
export function HeroActions() {
  const { hideAmounts } = usePrivacy();
  const logAgain = useLogAgain();
  const repeats = useRepeatEntries().filter((entry) => !hideAmounts || !entry.isSensitive);

  if (repeats.length === 0) {
    return (
      <View style={styles.row}>
        {ACTIONS.map((a) => (
          <Action key={a.type} {...a} />
        ))}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.stripRow}
      accessibilityLabel="Quick entries"
    >
      {repeats.map((entry) => (
        <RepeatChip
          key={`${entry.type}:${entry.accountId}:${entry.categoryId}:${entry.amountMinor}`}
          entry={entry}
          onLog={(e) => void logAgain(e)}
        />
      ))}
      {ACTIONS.filter((a) => a.type !== 'expense').map((a) => (
        <Action key={a.type} {...a} slim />
      ))}
    </ScrollView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    row: { marginHorizontal: 16, marginTop: 8, flexDirection: 'row', gap: 8 },
    strip: { marginTop: 8, overflow: 'visible' },
    stripRow: { paddingHorizontal: 16, gap: 8 },
    wrap: {
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.home.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
    },
    chipCoral: { backgroundColor: theme.colors.coral },
    chip: {
      width: 30,
      height: 30,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.home.control,
    },
    pressed: { backgroundColor: theme.colors.home.pressed },
    // One slim line, icon beside its name, so the shortcuts take little of the first screen.
    action: {
      minHeight: 48,
      paddingHorizontal: 6,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    slim: { justifyContent: 'flex-start', paddingLeft: 9, paddingRight: 14 },
    repeatText: { maxWidth: 128 },
    label: {
      fontFamily: theme.font.bodyMedium,
      flexShrink: 1,
      fontSize: 12,
      color: theme.colors.textPrimary,
    },
    amount: {
      fontFamily: theme.font.bodyBold,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
      color: theme.colors.textSecondary,
    },
    amountIn: { color: theme.colors.incomeText },
  })
);

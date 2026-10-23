import { selectedFill } from '@/theme/interactionColors';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney, getCurrencySymbol } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { styles } from '@/features/add/add.styles';
import { EntryType, TYPE_WASH, typeWash } from '@/features/add/addEntry';
import { withPressed } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';

/**
 * The Add screen's display pieces: amount card, From/To pickers, "Your usual" chips, staged-entry list.
 * State and saving live in the Add controllers; display pieces only show values and report taps.
 */

/**
 * The glass card under the sky header: the amount and this category's usual amounts.
 * The kicker and caret take the entry type's colour; selection details stay in the dock.
 */
export function AmountCard({
  type,
  amount,
  pad,
  suggestions,
  refund = false,
}: {
  type: EntryType;
  amount: {
    currency: string | undefined;
    expr: string;
    isSum: boolean;
    shownAmount: string;
    issue?: string;
    minor: number;
  };
  pad: {
    visible: boolean;
    linked: boolean;
    onOpen: () => void;
    onToggle?: () => void;
  };
  suggestions: { amounts: number[]; onPick: (minor: number) => void };
  /** "Money back" is on: the card turns the income green and says so. */
  refund?: boolean;
}) {
  const { currency, expr, isSum, shownAmount, issue: amountIssue, minor: amountMinor } = amount;
  const { visible: padVisible, linked: isLinked, onOpen: onOpenPad, onToggle: onTogglePad } = pad;
  const { amounts: frequentAmounts, onPick: onPickAmount } = suggestions;
  const { accent } = useAccent();
  const wash = refund ? TYPE_WASH.income : typeWash(type, accent);
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 380 || fontScale > 1.15;
  return (
    <View style={styles.heroCard}>
      <View style={[styles.amountHeader, stacked && styles.amountHeaderStacked]}>
        <View style={styles.heroLabelRow}>
          <View style={[styles.heroDot, { backgroundColor: wash.accent }]} />
          <Text style={[styles.heroLabel, { color: wash.accent }]}>{refund ? 'Money back' : 'Amount'}</Text>
          {onTogglePad && !isLinked && !padVisible && (
            <Pressable
              onPress={onTogglePad}
              style={withPressed(styles.padToggle)}
              accessibilityRole="button"
              accessibilityLabel={padVisible ? 'Hide number pad' : 'Show number pad'}
            >
              <Text style={styles.padToggleText}>{padVisible ? 'Hide pad' : 'Show pad'}</Text>
              <Feather
                name={padVisible ? 'chevron-down' : 'chevron-up'}
                size={13}
                color={theme.colors.textMuted}
              />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={onOpenPad}
          disabled={isLinked}
          style={withPressed([styles.amountRow, stacked && styles.amountRowStacked])}
          accessibilityRole="button"
          accessibilityLabel={`Amount, ${expr === '' ? 'empty' : shownAmount}`}
          accessibilityHint={padVisible ? undefined : 'Opens the number pad'}
        >
          <Text style={[styles.amountCurrency, { color: wash.accent }]}>{getCurrencySymbol(currency)}</Text>
          <Text
            style={[styles.amountText, expr === '' && styles.amountPlaceholder]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {shownAmount}
          </Text>
          {padVisible && <View style={[styles.caret, { backgroundColor: wash.accent }]} />}
        </Pressable>
      </View>
      {isSum && <Text style={styles.expression}>{expr.replace(/([+−×÷])/g, ' $1 ')}</Text>}
      {amountIssue && (
        <Text
          style={[styles.hint, amountIssue.startsWith('Enter') && styles.amountError]}
          accessibilityLiveRegion="polite"
        >
          {amountIssue}
        </Text>
      )}

      {frequentAmounts.length > 0 && (
        <View style={styles.frequentRow}>
          {frequentAmounts.map((minor) => {
            const active = amountMinor === minor;
            return (
              <Pressable
                key={minor}
                onPress={() => {
                  haptics.tap();
                  onPickAmount(minor);
                }}
                style={withPressed([
                  styles.frequentChip,
                  active && [{ backgroundColor: selectedFill(accent), borderColor: selectedFill(accent) }],
                ])}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={styles.frequentChipText}>{formatMoney(minor, currency)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoneyExact, getCurrencySymbol } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { styles } from '@/features/add/add.styles';
import { ADD_TYPES, EntryType, TYPE_WASH, typeWash } from '@/features/add/addEntry';
import { withPressedTint } from '@/lib/pressed';
import { softTint } from '@/components/softTint';
import { useAccent } from '@/theme/AccentContext';
import { useStacked } from '@/hooks/useStacked';

/**
 * The Add screen's display pieces: amount card, From/To pickers, "Your usual" chips, staged-entry list.
 * State and saving live in the Add controllers; display pieces only show values and report taps.
 */

/**
 * The cream card under the sky header: the amount and this category's usual amounts.
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
  const typeLabel = ADD_TYPES.find((option) => option.value === type)?.label;
  const amountLabel = typeLabel ? `${typeLabel} amount` : 'Amount';
  const stacked = useStacked('early');
  return (
    <View
      style={[
        styles.heroCard,
        // While the pad is up, the card's edge takes the entry type's colour at low strength.
        padVisible && { borderColor: softTint(wash.accent, 0.35) },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        colors={[softTint(wash.accent, 0.08), softTint(wash.accent, 0)]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 1 }}
      />
      <View style={[styles.amountHeader, stacked && styles.amountHeaderStacked]}>
        <View style={styles.amountMain}>
          <View style={styles.heroLabelRow}>
            <View style={[styles.heroDot, { backgroundColor: wash.accent }]} />
            <Text style={styles.heroLabel}>{refund ? 'Money back' : amountLabel}</Text>
          </View>
          <Pressable
            onPress={onOpenPad}
            disabled={isLinked}
            style={withPressedTint(accent, styles.amountRow)}
            accessibilityRole="button"
            accessibilityLabel={`Amount, ${expr === '' ? 'empty' : shownAmount}`}
            accessibilityHint={padVisible ? undefined : 'Opens the number pad'}
          >
            <Text
              style={[styles.amountText, expr === '' && styles.amountPlaceholder]}
              numberOfLines={stacked ? undefined : 1}
              adjustsFontSizeToFit={!stacked}
            >
              {getCurrencySymbol(currency)}
              {shownAmount}
            </Text>
            {padVisible && <View style={[styles.caret, { backgroundColor: wash.accent }]} />}
          </Pressable>
        </View>
        {onTogglePad && !isLinked && (
          <Pressable
            onPress={onTogglePad}
            style={withPressedTint(accent, styles.padToggle)}
            accessibilityRole="button"
            accessibilityLabel={padVisible ? 'Hide pad' : 'Show number pad'}
          >
            {!padVisible && <Text style={styles.padToggleText}>Show pad</Text>}
            <Feather name={padVisible ? 'chevron-down' : 'grid'} size={15} color={theme.colors.textPrimary} />
          </Pressable>
        )}
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
                style={withPressedTint(accent, [styles.frequentChip, active && styles.selectedControl])}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={styles.frequentChipText}>{formatMoneyExact(minor, currency)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import ReanimatedAnimated from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { SettingsRow } from '@/components/SettingsRow';
import { screenStyles as h } from '@/components/screenStyles';
import { SUPPORTED_CURRENCIES } from '@/db/settings';
import { theme } from '@/constants/theme';
import { PANEL_ENTER, ROW_EXIT } from '@/lib/animation';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { styles } from './profile.styles';

/**
 * The default-currency row. The list is long, so the row expands in place to show it; whether it is open is this part's
 * own state, so opening it draws the row and the list, not the whole Settings page.
 */
export const CurrencySetting = memo(function CurrencySetting({
  currency,
  loaded,
  stacked,
  onSelect,
}: {
  currency: string;
  /** The currency has been read (otherwise the row says it is unavailable). */
  loaded: boolean;
  /** Large text: the value goes below the label. */
  stacked: boolean;
  onSelect: (code: string) => void;
}) {
  const { accent } = useAccent();
  // A pick-one list has nothing left to do once you've made the one choice.
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsRow
        compact
        icon="currency-inr"
        label="Default currency"
        sub="New accounts and displayed amounts"
        value={loaded ? currency : 'Unavailable'}
        valueBelow={stacked}
        onPress={() => setOpen((v) => !v)}
        expanded={open}
      />
      {open && (
        <ReanimatedAnimated.View entering={PANEL_ENTER} exiting={ROW_EXIT} style={styles.accordionBody}>
          <Text style={styles.pickerHint}>
            Existing accounts keep whatever currency they were created with. Combined totals only add up
            accounts in this currency.
          </Text>
          {SUPPORTED_CURRENCIES.map((c, i) => (
            <Pressable
              key={c.code}
              style={withPressedTint(accent, [styles.pickerRow, i > 0 && h.divider])}
              onPress={() => {
                setOpen(false);
                onSelect(c.code);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${c.label}, ${c.code}`}
              accessibilityState={{ selected: currency === c.code }}
            >
              <View style={styles.codeBubble}>
                <Text style={styles.codeText}>{c.code}</Text>
              </View>
              <Text style={[h.title, { flex: 1 }]}>{c.label}</Text>
              {currency === c.code && <Feather name="check" size={18} color={theme.colors.ink} />}
            </Pressable>
          ))}
        </ReanimatedAnimated.View>
      )}
    </>
  );
});

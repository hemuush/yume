import { View, Pressable, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { Text } from '@/components/Text';
import { PersonWithBalance } from '@/db/people';
import { Account } from '@/types';
import { OdometerAmount } from '@/components/OdometerAmount';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useAccent } from '@/theme/AccentContext';
import { haptics } from '@/lib/haptics';
import { PrimaryButton } from '@/components/PrimaryButton';
import { styles } from './add.styles';
import { withPressed } from '@/lib/pressed';
import { shade } from '@/lib/color';
import { formatMoney } from '@/lib/money';

/** A person's avatar colour: the same one every time, picked from their id. */
const AVATAR_COLORS = ['#E2846A', '#7A9BE8', '#5FB58A', '#B08AD8', '#D9A441', '#5AAFC0', '#D97BA6'];
function personColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { secondary } = useAccent();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={withPressed([
        styles.chip,
        active && { borderColor: secondary, backgroundColor: shade(secondary, 94) },
      ])}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

/**
 * The bar atop Add's number pad: account, date, note, and for a purchase Money back and Split, in one row
 * that scrolls sideways; riding on the pad keeps it in view however far the category grid is scrolled.
 */
export function DetailBar({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.detailBar}
      contentContainerStyle={styles.detailBarContent}
    >
      {children}
    </ScrollView>
  );
}

/**
 * One item on the detail bar. Account, date and note hold usual values (one quiet tap to change);
 * Money back and Split are switches, filled when on.
 */
export function DetailChip({
  icon,
  label,
  muted,
  active,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  muted?: boolean;
  /** A chip that's a switch: on, it's filled in with a tick instead of a dropdown arrow. */
  active?: boolean;
  /** Can't be used with what's already chosen (Split alongside Money back): dimmed, in the same place. */
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { accent } = useAccent();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      disabled={disabled}
      style={withPressed([
        styles.detailChip,
        active && styles.detailChipActive,
        disabled && styles.detailChipDisabled,
      ])}
      accessibilityRole={active === undefined ? 'button' : 'switch'}
      accessibilityState={
        active === undefined ? { disabled: !!disabled } : { checked: active, disabled: !!disabled }
      }
      accessibilityLabel={accessibilityLabel}
    >
      <Feather
        name={icon}
        size={13}
        color={active ? theme.colors.surface : muted ? theme.colors.textMuted : shade(accent, 40, 8)}
      />
      <Text
        style={[
          styles.detailChipText,
          muted && styles.detailChipTextMuted,
          active && styles.detailChipTextActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {active ? (
        <Feather name="check" size={12} color={theme.colors.surface} />
      ) : (
        !muted &&
        active === undefined && <Feather name="chevron-down" size={12} color={theme.colors.textMuted} />
      )}
    </Pressable>
  );
}

export function Totals({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.total}>
      <Text style={styles.totalLabel}>{label}</Text>
      <OdometerAmount minor={value} style={[styles.totalValue, { color }]} />
    </View>
  );
}

export function FriendFields({
  people,
  accounts,
  personId,
  setPersonId,
  friendSign,
  setFriendSign,
  friendAccountId,
  setFriendAccountId,
  onAddPerson,
}: {
  people: PersonWithBalance[];
  accounts: Account[];
  personId: string | null;
  setPersonId: (id: string) => void;
  friendSign: 1 | -1;
  setFriendSign: (s: 1 | -1) => void;
  friendAccountId: string | null;
  setFriendAccountId: (id: string | null) => void;
  /** Opens the new-person sheet right here, instead of sending you to Plan first. */
  onAddPerson: () => void;
}) {
  if (people.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.label}>Person</Text>
        <Text style={[styles.hint, { marginTop: 0, marginBottom: 10 }]}>
          Nobody here yet. Add the friend or family member this is with.
        </Text>
        <PrimaryButton title="Add a person" variant="secondary" onPress={onAddPerson} />
      </View>
    );
  }
  const picked = people.find((p) => p.id === personId);
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.label}>Person</Text>
        {/* People as round avatars, in a row that slides; their balance says itself under the row. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>
          {people.map((p) => {
            const on = personId === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  haptics.tap();
                  setPersonId(p.id);
                }}
                style={withPressed(styles.person)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <View style={[styles.avatarRing, on && styles.avatarRingOn]}>
                  <View style={[styles.avatar, { backgroundColor: personColor(p.id) }]}>
                    <Text style={styles.avatarText}>{p.name.trim().charAt(0).toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={[styles.personName, on && styles.personNameOn]} numberOfLines={1}>
                  {p.name}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={onAddPerson}
            style={withPressed(styles.person)}
            accessibilityRole="button"
            accessibilityLabel="Add a person"
          >
            <View style={styles.avatarRing}>
              <View style={[styles.avatar, styles.avatarAdd]}>
                <Feather name="plus" size={20} color={theme.colors.textMuted} />
              </View>
            </View>
            <Text style={styles.personName}>+ Person</Text>
          </Pressable>
        </ScrollView>
        {picked && (
          <Text style={styles.hint}>
            {picked.balanceMinor > 0
              ? `${picked.name} owes you ${formatMoney(picked.balanceMinor)}`
              : picked.balanceMinor < 0
                ? `You owe ${picked.name} ${formatMoney(-picked.balanceMinor)}`
                : `You and ${picked.name} are settled`}
          </Text>
        )}
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>What happened?</Text>
        <SegmentedControl
          options={[
            { label: 'They owe more', value: 'owe' },
            { label: 'They repaid', value: 'repaid' },
          ]}
          value={friendSign === 1 ? 'owe' : 'repaid'}
          onChange={(v) => setFriendSign(v === 'owe' ? 1 : -1)}
        />
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Did cash actually move?</Text>
        <View style={styles.chipRow}>
          <Chip
            label="Just adjust balance"
            active={friendAccountId === null}
            onPress={() => setFriendAccountId(null)}
          />
          {accounts.map((acc) => (
            <Chip
              key={acc.id}
              label={acc.name}
              active={friendAccountId === acc.id}
              onPress={() => setFriendAccountId(acc.id)}
            />
          ))}
        </View>
        <Text style={styles.hint}>
          {friendAccountId
            ? 'Records a real transaction on that account too, so it shows in Activity and Reports.'
            : 'Only updates the balance — no real transaction, so it won’t appear in Activity or Reports.'}
        </Text>
      </View>
    </>
  );
}

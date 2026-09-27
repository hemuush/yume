import { View, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { Text } from '@/components/Text';
import { PersonWithBalance } from '@/db/people';
import { Account } from '@/types';
import { CategoryIcon } from '@/components/CategoryIcon';
import { OdometerAmount } from '@/components/OdometerAmount';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useAccent } from '@/theme/AccentContext';
import { accountBadgeColor, accountIcon } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import { PrimaryButton } from '@/components/PrimaryButton';
import { styles } from './add.styles';

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

/**
 * An account, drawn the same way CategoryPicker's 'medal' tiles draw a
 * category — an icon in a soft tinted square, a name underneath, a mint
 * ring when selected — instead of the plain text pill this screen used to
 * reuse `Chip` for. Same icon/colour identity AccountChip.tsx already gives
 * each account by type, just rendered through CategoryIcon (which never
 * assumed "category" specifically, only "icon + tint + optional colour") so
 * the two pickers on this screen read as one system instead of two.
 */
export function AccountTile({
  account,
  active,
  onPress,
}: {
  account: Account;
  active: boolean;
  onPress: () => void;
}) {
  const { accent } = useAccent();
  const badgeColor = accountBadgeColor(account.type, accent);
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={styles.accountTile}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={account.name}
    >
      <View style={[styles.accountRing, active && styles.accountRingActive]}>
        <CategoryIcon name={accountIcon(account.type)} color={badgeColor} size={20} square={48} />
      </View>
      <Text style={styles.accountName} numberOfLines={1}>
        {account.name}
      </Text>
    </Pressable>
  );
}

/**
 * One of Add's detail chips — account, date, note — under the category
 * grid. They hold what's usually right already, so each is one quiet tap
 * to change rather than a full section of its own.
 */
export function DetailChip({
  icon,
  label,
  muted,
  onPress,
  accessibilityLabel,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  muted?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={styles.detailChip}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Feather name={icon} size={13} color={muted ? theme.colors.textMuted : theme.colors.ink} />
      <Text style={[styles.detailChipText, muted && styles.detailChipTextMuted]} numberOfLines={1}>
        {label}
      </Text>
      {!muted && <Feather name="chevron-down" size={12} color={theme.colors.textMuted} />}
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
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.label}>Person</Text>
        <View style={styles.chipRow}>
          {people.map((p) => (
            <Chip key={p.id} label={p.name} active={personId === p.id} onPress={() => setPersonId(p.id)} />
          ))}
          <Chip label="+ Person" active={false} onPress={onAddPerson} />
        </View>
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
            ? 'Records a real transaction on that account too, so it shows in Transactions and Reports.'
            : 'Only updates the balance — no real transaction, so it won’t appear in Transactions or Reports.'}
        </Text>
      </View>
    </>
  );
}

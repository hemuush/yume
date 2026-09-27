import { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { Chip } from '@/components/Chip';
import { Account } from '@/types';
import { formatMoney } from '@/lib/money';
import { goalsFollowingAccount } from '@/db/savingsGoals';
import { styles } from './goals.styles';

/**
 * Where a goal's money sits, and how its progress moves: following that
 * account's balance, or added by hand as before. Shared by the new-goal
 * form and the goal's detail. Warns when another goal already follows the
 * picked account (both would show the same balance), and when switching a
 * hand-tracked goal over, that the amount added so far is kept aside.
 */
export function GoalAccountField({
  accounts,
  accountId,
  tracks,
  onChangeAccount,
  onChangeTracks,
  goalId,
  manualAmountMinor = 0,
}: {
  accounts: Account[];
  accountId: string | null;
  tracks: boolean;
  onChangeAccount: (id: string | null) => void;
  onChangeTracks: (tracks: boolean) => void;
  /** The goal being edited, so it doesn't warn about itself. */
  goalId?: string;
  /** What was added by hand so far — kept, and back if the goal stops following. */
  manualAmountMinor?: number;
}) {
  const [othersFollowing, setOthersFollowing] = useState<string[]>([]);
  const account = accounts.find((a) => a.id === accountId) ?? null;

  useEffect(() => {
    let live = true;
    if (!accountId || !tracks) {
      setOthersFollowing([]);
      return;
    }
    goalsFollowingAccount(accountId, goalId)
      .then((names) => live && setOthersFollowing(names))
      .catch(() => live && setOthersFollowing([]));
    return () => {
      live = false;
    };
  }, [accountId, tracks, goalId]);

  if (accounts.length === 0) return null;

  return (
    <>
      <Text style={styles.fieldLabel}>Keeping it in (optional)</Text>
      <View style={styles.chipRow}>
        <Chip label="None" active={accountId === null} onPress={() => onChangeAccount(null)} />
        {accounts.map((a) => (
          <Chip key={a.id} label={a.name} active={accountId === a.id} onPress={() => onChangeAccount(a.id)} />
        ))}
      </View>

      {account && (
        <View style={styles.followGroup}>
          <FollowOption
            on={tracks}
            title={`Follow ${account.name}`}
            sub="Progress is this account's balance and updates by itself."
            onPress={() => onChangeTracks(true)}
          />
          <FollowOption
            on={!tracks}
            title="I'll add money myself"
            sub="Tap + Add money as you save. The account is just a label."
            onPress={() => onChangeTracks(false)}
          />
          {tracks && othersFollowing.length > 0 && (
            <Text style={styles.followWarn}>
              {othersFollowing[0]}
              {othersFollowing.length > 1 ? ` and ${othersFollowing.length - 1} more` : ''} already follow
              {othersFollowing.length > 1 ? '' : 's'} {account.name}. Both will show the same balance.
            </Text>
          )}
          {tracks && manualAmountMinor > 0 && (
            <Text style={styles.modalHint}>
              The {formatMoney(manualAmountMinor)} you added by hand is kept, and comes back if you switch
              back.
            </Text>
          )}
        </View>
      )}
    </>
  );
}

function FollowOption({
  on,
  title,
  sub,
  onPress,
}: {
  on: boolean;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.followOpt, on && styles.followOptOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={title}
    >
      <View style={[styles.followDot, on && styles.followDotOn]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.followTitle}>{title}</Text>
        <Text style={styles.followSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

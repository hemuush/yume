import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { listGoalActivity, type GoalActivity } from '@/db/goalHistory';
import { usePrivacy } from '@/theme/PrivacyContext';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';

export function GoalHistory({ goalId, refreshToken }: { goalId: string; refreshToken?: object }) {
  const { hideAmounts } = usePrivacy();
  const [rows, setRows] = useState<GoalActivity[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [more, setMore] = useState(true);
  const generation = useRef(0);
  const loading = useRef(false);
  useEffect(() => {
    const id = ++generation.current;
    loading.current = true;
    setBusy(true);
    setError(false);
    setRows([]);
    listGoalActivity(goalId)
      .then((items) => {
        if (generation.current === id) {
          setRows(items);
          setMore(items.length === 20);
        }
      })
      .catch(() => {
        if (generation.current === id) setError(true);
      })
      .finally(() => {
        if (generation.current === id) {
          loading.current = false;
          setBusy(false);
        }
      });
    return () => {
      generation.current = id + 1;
      loading.current = false;
    };
  }, [goalId, refreshToken]);
  const loadMore = async () => {
    if (loading.current) return;
    loading.current = true;
    setBusy(true);
    setError(false);
    const id = generation.current;
    try {
      const items = await listGoalActivity(goalId, rows.at(-1)?.sequence);
      if (id === generation.current) {
        setRows((old) => [...old, ...items]);
        setMore(items.length === 20);
      }
    } catch {
      if (id === generation.current) setError(true);
    } finally {
      if (id === generation.current) {
        loading.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Progress history</Text>
      <Text style={styles.hint}>
        Recorded additions, withdrawals and reservations. Earlier progress and automatic account changes are
        not reconstructed.
      </Text>
      {rows.map((row) => (
        <View key={row.id} style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.label}>
              {row.kind === 'reservation'
                ? row.amount_minor > 0
                  ? 'Reserved'
                  : 'Released'
                : row.amount_minor > 0
                  ? 'Added'
                  : 'Withdrawn'}
            </Text>
            <Text style={styles.hint}>
              {new Date(
                row.created_at.includes('T') ? row.created_at : row.created_at.replace(' ', 'T') + 'Z'
              ).toLocaleString()}
            </Text>
          </View>
          <View style={styles.amounts}>
            <Text style={styles.label}>
              {hideAmounts
                ? '••••'
                : `${row.amount_minor > 0 ? '+' : '−'}${formatMoney(Math.abs(row.amount_minor), row.currency)}`}
            </Text>
            <Text style={styles.hint}>
              {hideAmounts ? 'Balance hidden' : `${formatMoney(row.balance_after_minor, row.currency)} after`}
            </Text>
          </View>
        </View>
      ))}
      {!busy && !error && rows.length === 0 && (
        <Text style={styles.hint}>Your next change will appear here.</Text>
      )}
      {busy && <Text style={styles.hint}>Loading history…</Text>}
      {(error || (more && rows.length > 0)) && (
        <PrimaryButton
          compact
          variant="secondary"
          title={error ? 'Retry history' : 'Load older changes'}
          disabled={busy}
          onPress={() => void loadMore()}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { gap: 10, paddingTop: 8 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  hint: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  label: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  amounts: { alignItems: 'flex-end', gap: 3, flexShrink: 1 },
});

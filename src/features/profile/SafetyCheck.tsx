import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { screenStyles as h } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';

function Guard({
  title,
  sub,
  color,
  bad,
  onPress,
  label,
  checked,
}: {
  title: string;
  sub: string;
  color: string;
  bad?: boolean;
  onPress: () => void;
  label: string;
  /** Set on a card that switches something in place: it reads as a switch, on or off. */
  checked?: boolean;
}) {
  const { accent } = useAccent();
  return (
    <Pressable
      style={withPressedTint(accent, [styles.guard, bad && styles.guardBad])}
      onPress={onPress}
      accessibilityRole={checked === undefined ? 'button' : 'switch'}
      accessibilityState={checked === undefined ? undefined : { checked }}
      accessibilityLabel={label}
    >
      <View style={styles.guardHead}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.guardTitle}>{title}</Text>
      </View>
      <Text style={[styles.guardSub, bad && styles.guardSubBad]}>{sub}</Text>
    </Pressable>
  );
}

type BackupState = 'ok' | 'failed' | 'never';

/**
 * Settings' first card: is my data looked after? Backup, unlock and notifications as three rings, from the
 * same settings the rows below hold. Backup opens Backup & restore, unlock switches in place (through the same
 * checks as its row), notifications opens its page. A failed backup turns its ring red and the line says so.
 */
export function SafetyCheck({
  backup,
  backupSub,
  lockOn,
  alertsOn,
  alertsTotal,
  onBackup,
  onToggleLock,
  onNotifications,
}: {
  backup: BackupState;
  /** "Yesterday" / "Tap to check" / "Set one up". */
  backupSub: string;
  lockOn: boolean;
  /** How many notification settings are on; null while unknown. */
  alertsOn: number | null;
  alertsTotal: number;
  onBackup: () => void;
  onToggleLock: () => void;
  onNotifications: () => void;
}) {
  const todo = (backup === 'ok' ? 0 : 1) + (lockOn ? 0 : 1) + (alertsOn === 0 ? 1 : 0);
  const headline =
    backup === 'failed'
      ? 'Your last backup didn’t finish'
      : todo === 0
        ? 'Your data is looked after'
        : `${todo} thing${todo === 1 ? '' : 's'} to look at`;
  const good = theme.colors.slice.saved;
  const muted = theme.colors.inkOff;
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Safety check</Text>
      <Text style={[styles.headline, backup === 'failed' && styles.headlineBad]}>{headline}</Text>
      <View style={styles.guards}>
        <Guard
          title="Backup"
          sub={backupSub}
          color={backup === 'ok' ? good : backup === 'failed' ? theme.colors.slice.due : muted}
          bad={backup === 'failed'}
          onPress={onBackup}
          label={`Backup: ${backupSub}. Open Backup & restore`}
        />
        <Guard
          title="Unlock"
          sub={lockOn ? 'Needed to open' : 'Off'}
          color={lockOn ? good : muted}
          onPress={onToggleLock}
          checked={lockOn}
          label={`Require unlock, ${lockOn ? 'on' : 'off'}. Tap to turn it ${lockOn ? 'off' : 'on'}`}
        />
        <Guard
          title="Notifications"
          sub={alertsOn == null ? 'Morning and evening' : `${alertsOn} of ${alertsTotal} on`}
          color={alertsOn === 0 ? muted : good}
          onPress={onNotifications}
          label={`Notifications, ${alertsOn == null ? 'morning and evening' : `${alertsOn} of ${alertsTotal} on`}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...h.card, marginTop: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 4 },
  kicker: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  headline: { fontFamily: theme.font.bodyBold, fontSize: 17, color: theme.colors.textPrimary },
  headlineBad: { color: theme.colors.expenseText },
  guards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: -8 },
  guard: {
    flexGrow: 1,
    flexBasis: 96,
    minWidth: 96,
    minHeight: 56,
    padding: 8,
    gap: 3,
    justifyContent: 'center',
  },
  guardBad: { borderRadius: 12, backgroundColor: theme.colors.expenseTint },
  guardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  guardTitle: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textPrimary },
  guardSub: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  guardSubBad: { fontFamily: theme.font.bodyBold, color: theme.colors.expenseText },
});

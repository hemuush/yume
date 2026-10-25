import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
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
  icon,
}: {
  title: string;
  sub: string;
  color: string;
  bad?: boolean;
  onPress: () => void;
  label: string;
  /** Set on a card that switches something in place: it reads as a switch, on or off. */
  checked?: boolean;
  icon: React.ComponentProps<typeof Feather>['name'];
}) {
  const { accent } = useAccent();
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      style={withPressedTint(accent, [
        styles.guard,
        fontScale > 1.2 && styles.guardStack,
        bad && styles.guardBad,
      ])}
      onPress={onPress}
      accessibilityRole={checked === undefined ? 'button' : 'switch'}
      accessibilityState={checked === undefined ? undefined : { checked }}
      accessibilityLabel={label}
    >
      <View style={styles.guardHead}>
        <View style={styles.guardIcon}>
          <Feather name={icon} size={17} color={theme.colors.ink} />
        </View>
        <Feather
          name={checked === undefined ? 'arrow-up-right' : checked ? 'check' : 'plus'}
          size={13}
          color={theme.colors.textMuted}
        />
      </View>
      <View style={styles.guardLabel}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.guardTitle}>{title}</Text>
      </View>
      <Text style={[styles.guardSub, bad && styles.guardSubBad]}>{sub}</Text>
    </Pressable>
  );
}

type BackupState = 'ok' | 'failed' | 'never';

/**
 * Settings' safety overview: backup, unlock and notifications as three actionable tiles, from the
 * same settings the rows below hold. Backup opens Backup & restore, unlock switches in place (through the same
 * checks as its row), notifications opens its page. A failed backup receives an explicit warning state.
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
  const { fontScale } = useWindowDimensions();
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
      <View style={[styles.guards, fontScale > 1.2 && styles.guardsStack]}>
        <Guard
          title="Backup"
          icon="hard-drive"
          sub={backupSub}
          color={backup === 'ok' ? good : backup === 'failed' ? theme.colors.slice.due : muted}
          bad={backup === 'failed'}
          onPress={onBackup}
          label={`Backup: ${backupSub}. Open Backup & restore`}
        />
        <Guard
          title="Unlock"
          icon="lock"
          sub={lockOn ? 'Needed to open' : 'Off'}
          color={lockOn ? good : muted}
          onPress={onToggleLock}
          checked={lockOn}
          label={`Require unlock, ${lockOn ? 'on' : 'off'}. Tap to turn it ${lockOn ? 'off' : 'on'}`}
        />
        <Guard
          title="Notifications"
          icon="bell"
          sub={alertsOn == null ? 'Morning and evening' : `${alertsOn} of ${alertsTotal} on`}
          color={alertsOn == null || alertsOn === 0 ? muted : good}
          onPress={onNotifications}
          label={`Notifications, ${alertsOn == null ? 'morning and evening' : `${alertsOn} of ${alertsTotal} on`}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...h.card, marginTop: 14, padding: 14, borderWidth: 1, gap: 6 },
  kicker: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  headline: { fontFamily: theme.font.roundedBold, fontSize: 18, color: theme.colors.textPrimary },
  headlineBad: { color: theme.colors.expenseText },
  guards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  guardsStack: { flexDirection: 'column' },
  guardStack: { flexBasis: 'auto', flexGrow: 0 },
  guard: {
    flexGrow: 1,
    flexBasis: 90,
    minWidth: 0,
    minHeight: 110,
    padding: 10,
    gap: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.tray,
  },
  guardBad: { borderRadius: 12, backgroundColor: theme.colors.expenseTint },
  guardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 4,
  },
  guardIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  guardLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  guardTitle: {
    flexShrink: 1,
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  guardSub: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  guardSubBad: { fontFamily: theme.font.bodyBold, color: theme.colors.expenseText },
});

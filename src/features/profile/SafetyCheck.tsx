import { View, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Glass, GLASS } from '@/components/Glass';
import { Kicker, frost } from '@/components/Frost';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const RING = 34;
const STROKE = 3;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/** A small ring, filled to `fraction`, with its icon in the middle. */
function Ring({ fraction, color, icon }: { fraction: number; color: string; icon: FeatherName }) {
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <View style={styles.ring}>
      <Svg width={RING} height={RING}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          stroke="rgba(16,32,51,0.1)"
          strokeWidth={STROKE}
          fill="none"
        />
        {f > 0 && (
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${CIRC * f} ${CIRC}`}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        )}
      </Svg>
      <View style={styles.ringIcon}>
        <Feather name={icon} size={15} color={color} />
      </View>
    </View>
  );
}

function Guard({
  title,
  sub,
  fraction,
  color,
  icon,
  bad,
  onPress,
  label,
  checked,
}: {
  title: string;
  sub: string;
  fraction: number;
  color: string;
  icon: FeatherName;
  bad?: boolean;
  onPress: () => void;
  label: string;
  /** Set on a card that switches something in place: it reads as a switch, on or off. */
  checked?: boolean;
}) {
  return (
    <Pressable
      style={withPressed([styles.guard, bad && styles.guardBad])}
      onPress={onPress}
      accessibilityRole={checked === undefined ? 'button' : 'switch'}
      accessibilityState={checked === undefined ? undefined : { checked }}
      accessibilityLabel={label}
    >
      <Ring fraction={fraction} color={color} icon={icon} />
      <Text style={styles.guardTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {title}
      </Text>
      <Text style={[styles.guardSub, bad && styles.guardSubBad]} numberOfLines={2}>
        {sub}
      </Text>
    </Pressable>
  );
}

export type BackupState = 'ok' | 'failed' | 'never';

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
  const good = theme.colors.incomeText;
  const muted = theme.colors.textMuted;
  return (
    <Glass radius={28} tone="strong" style={frost.hero}>
      <Kicker icon="shield">Safety check</Kicker>
      <Text style={[styles.headline, backup === 'failed' && styles.headlineBad]}>{headline}</Text>
      <View style={styles.guards}>
        <Guard
          title="Backup"
          sub={backupSub}
          fraction={backup === 'ok' ? 1 : backup === 'failed' ? 0.15 : 0}
          color={backup === 'ok' ? good : backup === 'failed' ? theme.colors.expenseText : muted}
          icon={backup === 'ok' ? 'check' : backup === 'failed' ? 'alert-triangle' : 'folder'}
          bad={backup === 'failed'}
          onPress={onBackup}
          label={`Backup: ${backupSub}. Open Backup & restore`}
        />
        <Guard
          title="Unlock"
          sub={lockOn ? 'Needed to open' : 'Off'}
          fraction={lockOn ? 1 : 0}
          color={lockOn ? good : muted}
          icon={lockOn ? 'lock' : 'unlock'}
          onPress={onToggleLock}
          checked={lockOn}
          label={`Require unlock, ${lockOn ? 'on' : 'off'}. Tap to turn it ${lockOn ? 'off' : 'on'}`}
        />
        <Guard
          title="Notifications"
          sub={alertsOn == null ? 'Morning and evening' : `${alertsOn} of ${alertsTotal} on`}
          fraction={alertsOn == null ? 0 : alertsOn / alertsTotal}
          color={theme.colors.link}
          icon={alertsOn === 0 ? 'bell-off' : 'bell'}
          onPress={onNotifications}
          label={`Notifications, ${alertsOn == null ? 'morning and evening' : `${alertsOn} of ${alertsTotal} on`}`}
        />
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  headline: { fontFamily: theme.font.bodyBold, fontSize: 17, color: theme.colors.textPrimary },
  headlineBad: { color: theme.colors.expenseText },
  guards: { flexDirection: 'row', gap: 8 },
  guard: {
    flex: 1,
    minWidth: 0,
    padding: 10,
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS.edge,
    backgroundColor: GLASS.fillStrong,
  },
  guardBad: { backgroundColor: theme.colors.expenseTint, borderColor: theme.colors.expense },
  ring: { width: RING, height: RING },
  ringIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardTitle: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.textPrimary },
  guardSub: { fontFamily: theme.font.body, fontSize: 11, lineHeight: 14, color: theme.colors.textMuted },
  guardSubBad: { fontFamily: theme.font.bodyBold, color: theme.colors.expenseText },
});

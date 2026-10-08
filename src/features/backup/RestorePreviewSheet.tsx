import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { BackupSummary } from '@/lib/backup';
import { theme } from '@/constants/theme';
import { SheetCard } from '@/components/SheetCard';
import { dayMonthYear } from '@/lib/dateLabels';
import { useAccent } from '@/theme/AccentContext';

export interface RestorePreview {
  exportedAt: string;
  backup: BackupSummary;
  current: BackupSummary;
  /** Entries saved on the phone after the backup was made — gone after restoring it. */
  lostCount: number;
}

const noop = () => {};

const dayLabel = (iso: string | null) => (iso ? dayMonthYear(iso) : '—');

function describe(s: BackupSummary): string {
  const entries = `${s.entries} ${s.entries === 1 ? 'entry' : 'entries'}`;
  const latest = s.lastEntryDate ? `, the latest on ${dayLabel(s.lastEntryDate)}` : '';
  const accounts = `${s.accounts} account${s.accounts === 1 ? '' : 's'}`;
  const loans = `${s.loans} loan${s.loans === 1 ? '' : 's'}`;
  return `${entries}${latest} · ${accounts} · ${loans}`;
}

/**
 * Shown before any restore replaces data: backup contents vs what's on the phone, and how many newer entries
 * would be lost. A copy of today's data is kept first, so the restore can be undone.
 */
export function RestorePreviewSheet({
  preview,
  busy,
  onCancel,
  onRestore,
}: {
  preview: RestorePreview | null;
  busy: boolean;
  onCancel: () => void;
  onRestore: () => void;
}) {
  const { accent } = useAccent();
  if (!preview) return null;
  // A backup file with no (or a garbled) export time still previews — it just doesn't say when it was made.
  const exported = new Date(preview.exportedAt);
  const made = Number.isNaN(exported.getTime())
    ? null
    : exported.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
  return (
    <ModalSheet
      visible
      // Backdrop, ✕ and Android back do nothing while the restore is running.
      onClose={busy ? noop : onCancel}
      scrollable={false}
      footer={
        <PrimaryButton
          title={busy ? 'Restoring…' : 'Restore this backup'}
          onPress={onRestore}
          disabled={busy}
        />
      }
    >
      {/* The calm-sheets sign-off (Direction C): the backup as a card — when
          it was made and what's in it — then what's on the phone now. */}
      <SheetCard
        hue={accent}
        icon="backup-restore"
        kicker="Restore"
        title={made ? `Backup from ${made}` : 'Backup'}
        meta={describe(preview.backup)}
      />
      <View style={styles.row}>
        <Text style={styles.label}>On your phone now</Text>
        <Text style={styles.value}>{describe(preview.current)}</Text>
      </View>
      <View style={[styles.note, preview.lostCount > 0 && styles.noteWarn]}>
        <Feather
          name={preview.lostCount > 0 ? 'alert-triangle' : 'check-circle'}
          size={14}
          color={preview.lostCount > 0 ? theme.colors.warnInk : theme.colors.income}
        />
        <Text style={styles.noteText}>
          {preview.lostCount > 0
            ? `${preview.lostCount} ${preview.lostCount === 1 ? 'entry' : 'entries'} you added after that backup would be lost. `
            : 'Nothing you added since would be lost. '}
          A copy of today's data is kept first, so you can undo this.
        </Text>
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 10, gap: 2 },
  label: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  value: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary, lineHeight: 18 },
  note: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: theme.colors.secondaryTint,
  },
  noteWarn: { backgroundColor: theme.colors.idGold },
  noteText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textPrimary,
  },
});

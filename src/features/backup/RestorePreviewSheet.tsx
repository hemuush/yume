import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { BackupSummary } from '@/lib/backup';
import { parseLocalIsoDate } from '@/lib/date';
import { theme, modalFooterStyles as f } from '@/constants/theme';

export interface RestorePreview {
  exportedAt: string;
  backup: BackupSummary;
  current: BackupSummary;
  /** Entries saved on the phone after the backup was made — gone after restoring it. */
  lostCount: number;
}

const dayLabel = (iso: string | null) =>
  iso
    ? parseLocalIsoDate(iso).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

function describe(s: BackupSummary): string {
  const entries = `${s.entries} ${s.entries === 1 ? 'entry' : 'entries'}`;
  const latest = s.lastEntryDate ? `, the latest on ${dayLabel(s.lastEntryDate)}` : '';
  const accounts = `${s.accounts} account${s.accounts === 1 ? '' : 's'}`;
  const loans = `${s.loans} loan${s.loans === 1 ? '' : 's'}`;
  return `${entries}${latest} · ${accounts} · ${loans}`;
}

/**
 * What a restore would do, shown before anything is replaced: what's in
 * the backup next to what's on the phone, and how many newer entries would
 * be lost. A copy of today's data is kept first, so it can be undone.
 * Replaces the old plain "Replace all data?" dialog on every restore path.
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
  if (!preview) return null;
  const made = new Date(preview.exportedAt).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <ModalSheet
      visible
      onClose={onCancel}
      title={`Restore the ${made} backup?`}
      scrollable={false}
      footer={
        <View style={f.footerRow}>
          <PrimaryButton
            title="Cancel"
            variant="secondary"
            onPress={onCancel}
            disabled={busy}
            style={f.footerBtn}
          />
          <PrimaryButton
            title={busy ? 'Restoring…' : 'Restore'}
            onPress={onRestore}
            disabled={busy}
            style={f.footerBtn}
          />
        </View>
      }
    >
      <View style={styles.row}>
        <Text style={styles.label}>That backup</Text>
        <Text style={styles.value}>{describe(preview.backup)}</Text>
      </View>
      <View style={[styles.row, styles.divider]}>
        <Text style={styles.label}>On your phone now</Text>
        <Text style={styles.value}>{describe(preview.current)}</Text>
      </View>
      <View style={[styles.note, preview.lostCount > 0 && styles.noteWarn]}>
        <Feather
          name={preview.lostCount > 0 ? 'alert-triangle' : 'check-circle'}
          size={14}
          color={preview.lostCount > 0 ? theme.colors.idGoldDeep : theme.colors.income}
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
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
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

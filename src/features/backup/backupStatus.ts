import { theme } from '@/constants/theme';
import { toLocalIsoDate } from '@/lib/date';
import { nextLocalBackupLabel } from '@/lib/localBackup';
import type { BackupFrequency, BackupOutcome } from '@/db/settings';
import type { McIconName } from '@/components/iconName';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** One date format for the whole screen: "3 Oct, 2:05 pm". */
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export type StatusView = {
  icon: McIconName;
  tint: string;
  /** The shield's colour: backed up, failed, or waiting on a folder or a first backup. */
  tone: 'ok' | 'failed' | 'waiting';
  title: string;
  lines: string[];
  failed: boolean;
};

/** What the status card says: whether you are backed up, when, and what is next. */
export function backupStatus({
  folder,
  lastAt,
  outcome,
  frequency,
  now,
}: {
  folder: string | null;
  lastAt: string | null;
  outcome: BackupOutcome | null;
  frequency: BackupFrequency;
  now: Date;
}): StatusView {
  if (!folder) {
    return {
      icon: 'folder-outline',
      tint: theme.colors.idGold,
      tone: 'waiting',
      title: 'No backup folder yet',
      lines: ['Pick a folder once. Yume writes a backup there on its own.'],
      failed: false,
    };
  }
  if (outcome && !outcome.ok) {
    return {
      icon: 'alert-circle-outline',
      tint: theme.colors.idCoral,
      tone: 'failed',
      title: 'Last backup failed',
      lines: [outcome.error || "Couldn't write to the folder. Check that it still exists."],
      failed: true,
    };
  }
  if (!lastAt) {
    return {
      icon: 'clock-outline',
      tint: theme.colors.idGold,
      tone: 'waiting',
      title: 'Not backed up yet',
      lines: ['Tap Back up now to write the first one.'],
      failed: false,
    };
  }
  const today = toLocalIsoDate(new Date(lastAt)) === toLocalIsoDate(now);
  const size = outcome?.ok && outcome.sizeBytes ? ` · ${formatBytes(outcome.sizeBytes)}` : '';
  const next = nextLocalBackupLabel(lastAt, frequency, now);
  return {
    icon: 'shield-check-outline',
    tint: theme.colors.idSage,
    tone: 'ok',
    title: today
      ? 'Backed up today'
      : `Backed up ${new Date(lastAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`,
    lines: [`${formatWhen(lastAt)}${size}`, ...(next ? [next] : [])],
    failed: false,
  };
}

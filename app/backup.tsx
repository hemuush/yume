import { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  buildBackupSnapshot,
  BackupSnapshot,
  RestoreResult,
  summarizeSnapshot,
  getCurrentSummary,
  countEntriesSavedAfter,
  isTooLargeForBackup,
} from '@/lib/backup';
import { RestorePreviewSheet, RestorePreview } from '@/features/backup/RestorePreviewSheet';
import {
  restoreKeepingSafetyCopy,
  undoLastRestore,
  getSafetyCopyInfo,
  SafetyCopyError,
  SafetyCopyInfo,
} from '@/lib/safetyCopy';
import { generateExportWorkbookBytes } from '@/lib/exportExcel';
import {
  pickBackupFolder,
  forgetBackupFolder,
  writeLocalBackupNow,
  listLocalBackups,
  readLocalBackup,
  nextLocalBackupLabel,
  LocalBackupFile,
} from '@/lib/localBackup';
import {
  getLocalBackupFolderUri,
  getLastLocalBackupAt,
  getBackupFrequency,
  setBackupFrequency,
  getLastLocalBackupResult,
  setLastLocalBackupResult,
  BackupFrequency,
  BackupOutcome,
} from '@/db/settings';
import { resyncAfterRestore } from '@/lib/restoreSync';
import { withoutRelock } from '@/lib/appLock';
import { AppHeader } from '@/components/AppHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Skeleton } from '@/components/Skeleton';
import { theme } from '@/constants/theme';
import { errorMessage } from '@/lib/errorMessage';
import { SECTION_TITLE, SECTION_GAP, EYEBROW } from '@/constants/textStyles';
import { homeStyles as h, HOME } from '@/features/home/homeStyles';
import { SettingsRow } from '@/components/SettingsRow';
import { withPressed } from '@/lib/pressed';
import { toLocalIsoDate } from '@/lib/date';
import type { McIconName } from '@/components/iconName';
import { showAlert } from '@/components/AppDialog';

const FREQUENCIES: { label: string; value: BackupFrequency }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TABS: { label: string; value: 'points' | 'copy' }[] = [
  { label: 'Restore points', value: 'points' },
  { label: 'Save a copy', value: 'copy' },
];

/** How many backups the timeline shows before "See all". */
const COLLAPSED_FILES = 3;

/** One date format for the whole screen: "3 Oct, 2:05 pm". */
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type StatusView = { icon: McIconName; tint: string; title: string; lines: string[]; failed: boolean };

/** What the status card says: whether you are backed up, when, and what is next. */
function backupStatus({
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
      title: 'No backup folder yet',
      lines: ['Pick a folder once. Yume writes a backup there on its own.'],
      failed: false,
    };
  }
  if (outcome && !outcome.ok) {
    return {
      icon: 'alert-circle-outline',
      tint: theme.colors.idCoral,
      title: 'Last backup failed',
      lines: [outcome.error || "Couldn't write to the folder. Check that it still exists."],
      failed: true,
    };
  }
  if (!lastAt) {
    return {
      icon: 'clock-outline',
      tint: theme.colors.idGold,
      title: 'Not backed up yet',
      lines: ['Tap Backup now to write the first one.'],
      failed: false,
    };
  }
  const today = toLocalIsoDate(new Date(lastAt)) === toLocalIsoDate(now);
  const size = outcome?.ok && outcome.sizeBytes ? ` · ${formatBytes(outcome.sizeBytes)}` : '';
  const next = nextLocalBackupLabel(lastAt, frequency, now);
  return {
    icon: 'shield-check-outline',
    tint: theme.colors.idSage,
    title: today
      ? 'Backed up today'
      : `Backed up ${new Date(lastAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`,
    lines: [`${formatWhen(lastAt)}${size}`, ...(next ? [next] : [])],
    failed: false,
  };
}

/** One stop on the restore-points timeline: a dot and a rail beside a row. */
function TimelineNode({
  first,
  last,
  latest,
  copy,
  children,
}: {
  first?: boolean;
  last?: boolean;
  latest?: boolean;
  copy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.node, copy && styles.nodeCopy]}>
      {!(first && last) && (
        <View style={[styles.rail, { top: first ? '50%' : 0, bottom: last ? '50%' : 0 }]} />
      )}
      <View style={[styles.dot, latest && styles.dotLatest, copy && styles.dotCopy]} />
      <View style={h.row}>{children}</View>
    </View>
  );
}

export default function BackupScreen() {
  const insets = useSafeAreaInsets();
  const [localFolderUri, setLocalFolderUri] = useState<string | null>(null);
  const [lastLocalBackup, setLastLocalBackup] = useState<string | null>(null);
  const [localResult, setLocalResult] = useState<BackupOutcome | null>(null);
  const [frequency, setFrequency] = useState<BackupFrequency>('daily');
  const [busy, setBusy] = useState<string | null>(null);
  const [doneLabel, setDoneLabel] = useState<string | null>(null);
  // Without this, the unloaded default `!localFolderUri` briefly showed the "choose a folder"
  // call-to-action even for someone with a folder configured.
  const [loaded, setLoaded] = useState(false);
  // The copy of the data from just before the last restore, if there is one
  // (see lib/safetyCopy.ts) — shown as the "Undo your last restore" card.
  const [safetyInfo, setSafetyInfo] = useState<SafetyCopyInfo | null>(null);
  // The backup files in the chosen folder, newest first.
  const [files, setFiles] = useState<LocalBackupFile[] | null>(null);
  // A restore waiting on the preview sheet, and whether it's running.
  const [pending, setPending] = useState<{ snapshot: BackupSnapshot; preview: RestorePreview } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [tab, setTab] = useState<'points' | 'copy'>('points');
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setSafetyInfo(await getSafetyCopyInfo());
    const folder = await getLocalBackupFolderUri();
    setLocalFolderUri(folder);
    setFiles(folder ? await listLocalBackups(folder).catch(() => []) : null);
    setLastLocalBackup(await getLastLocalBackupAt());
    setLocalResult(await getLastLocalBackupResult());
    setFrequency(await getBackupFrequency());
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const run = async (label: string, fn: () => Promise<void>, opts?: { confirm?: boolean }) => {
    setBusy(label);
    try {
      await fn();
      // A brief "done" checkmark (PrimaryButton `done`), wired only to `backup-now-local` (see
      // `opts.confirm` below), not every button this helper runs.
      if (opts?.confirm) {
        setDoneLabel(label);
        await new Promise((resolve) => setTimeout(resolve, 380));
        setDoneLabel(null);
      }
    } catch (e) {
      showAlert('Something went wrong', errorMessage(e));
    } finally {
      setBusy(null);
      await load();
    }
  };

  const onChangeFrequency = (f: BackupFrequency) =>
    run('frequency', async () => setBackupFrequency(f).then(() => setFrequency(f)));

  const exportJsonLocally = () =>
    run('export-json', async () => {
      const snapshot = await buildBackupSnapshot();
      const file = new File(Paths.document, `yume-backup-${Date.now()}.json`);
      file.create();
      file.write(JSON.stringify(snapshot, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await withoutRelock(() => Sharing.shareAsync(file.uri, { mimeType: 'application/json' }));
      }
    });

  const exportExcelLocally = () =>
    run('export-excel', async () => {
      const bytes = await generateExportWorkbookBytes();
      const file = new File(Paths.document, `yume-export-${Date.now()}.xlsx`);
      file.create();
      file.write(bytes);
      if (await Sharing.isAvailableAsync()) {
        await withoutRelock(() =>
          Sharing.shareAsync(file.uri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Export Yume data',
          })
        );
      }
    });

  const restoreFromFile = () =>
    run('restore-file', async () => {
      // Accept any file type and validate the JSON afterward: many file managers report a .json file's MIME
      // type inconsistently, which would otherwise grey out the very file the user is picking.
      const result = await withoutRelock(() => DocumentPicker.getDocumentAsync({ type: '*/*' }));
      if (result.canceled || !result.assets?.[0]) return;
      const picked = new File(result.assets[0].uri);
      if (isTooLargeForBackup(result.assets[0].size ?? picked.size)) {
        throw new Error('That file is far too large to be a Yume backup — pick a full backup Yume exported.');
      }
      const content = await picked.text();
      let snapshot: BackupSnapshot;
      try {
        snapshot = JSON.parse(content);
      } catch {
        throw new Error("That file isn't valid JSON — pick a full backup Yume exported.");
      }
      await confirmAndRestore(snapshot);
    });

  // A restore replaces every table, so all loaded screen state is stale; each screen reloads via
  // useFocusEffect, so bouncing to Home lets the rest pick up new data as tabs are visited.
  const goHome = () => router.replace('/(tabs)');

  /**
   * Puts back the pre-restore data (lib/safetyCopy.ts) after one more confirmation; shared by the "Undo
   * restore" button on the completion message and the "Undo your last restore" card.
   */
  const confirmUndo = () =>
    showAlert(
      'Put back your earlier data?',
      'This replaces what is in the app now with your data from just before the restore. What is there now is kept as a copy, so this can be undone too.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => void load() },
        {
          text: 'Put back',
          style: 'destructive',
          onPress: async () => {
            setBusy('undo-restore');
            try {
              await undoLastRestore();
              void resyncAfterRestore();
              showAlert('Data put back', 'Your data is back to how it was before the restore.', [
                { text: 'OK', onPress: goHome },
              ]);
            } catch (e) {
              showAlert("Couldn't put your data back", errorMessage(e));
            } finally {
              setBusy(null);
              await load();
            }
          },
        },
      ]
    );

  /** Everything after a restore succeeds: re-sync, then say so — offering Undo when a safety copy is in place. */
  const finishRestore = ({ skippedColumns, undoAvailable }: RestoreResult & { undoAvailable: boolean }) => {
    // Everything scheduled outside the DB still describes pre-restore data: loan due reminders, the
    // reminder schedule, and home-screen widgets. Best-effort; the restore already succeeded.
    void resyncAfterRestore();
    const note =
      skippedColumns.length > 0
        ? `\n\nHeads up: ${skippedColumns.length} field${
            skippedColumns.length === 1 ? '' : 's'
          } in this backup aren't part of this version of Yume and were skipped (${skippedColumns.join(
            ', '
          )}). Everything else was restored.`
        : '';
    showAlert(
      'Restore complete',
      undoAvailable
        ? `Your data has been restored.${note}\n\nNot what you expected? You can put back your data from before this restore.`
        : `Your data has been restored.${note}`,
      undoAvailable
        ? [
            { text: 'Undo restore', onPress: confirmUndo },
            { text: 'OK', onPress: goHome },
          ]
        : [{ text: 'OK', onPress: goHome }]
    );
  };

  /** Shows the restore preview for a backup; the sheet's Restore does the rest. */
  const confirmAndRestore = async (snapshot: BackupSnapshot) => {
    const backup = summarizeSnapshot(snapshot);
    if (!backup) throw new Error("That file isn't a Yume backup — pick a full backup Yume exported.");
    const exportedAt = Number.isNaN(Date.parse(snapshot.exportedAt)) ? null : snapshot.exportedAt;
    const [current, lostCount] = await Promise.all([
      getCurrentSummary(),
      exportedAt ? countEntriesSavedAfter(exportedAt) : Promise.resolve(0),
    ]);
    setPending({
      snapshot,
      preview: { exportedAt: exportedAt ?? new Date().toISOString(), backup, current, lostCount },
    });
  };

  const restorePending = async () => {
    if (!pending) return;
    const { snapshot } = pending;
    setRestoring(true);
    try {
      const result = await restoreKeepingSafetyCopy(snapshot);
      setPending(null);
      finishRestore(result);
    } catch (e) {
      setPending(null);
      if (!(e instanceof SafetyCopyError)) {
        showAlert('Something went wrong', String((e as Error)?.message ?? e));
        return;
      }
      // The copy couldn't be saved (usually a full phone) and nothing is replaced yet; proceed only if the
      // user accepts having no way back. Cancel is the default.
      showAlert(
        "Couldn't keep a copy of your current data",
        `${e.message}

Restore anyway? Your current data would be replaced with no way back.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore anyway',
            style: 'destructive',
            onPress: async () => {
              try {
                finishRestore(await restoreKeepingSafetyCopy(snapshot, { withoutCopy: true }));
              } catch (err) {
                showAlert('Something went wrong', errorMessage(err));
              }
            },
          },
        ]
      );
    } finally {
      setRestoring(false);
    }
  };

  const choosePickFolder = () =>
    run('pick-folder', async () => {
      const uri = await pickBackupFolder();
      if (uri) await writeLocalBackupNow(uri); // confirm the grant works with a first backup right away
    });

  const backupNowLocal = () =>
    run(
      'backup-now-local',
      async () => {
        if (!localFolderUri) return;
        try {
          const { sizeBytes } = await writeLocalBackupNow(localFolderUri);
          await setLastLocalBackupResult({ at: new Date().toISOString(), ok: true, sizeBytes });
        } catch (e) {
          await setLastLocalBackupResult({
            at: new Date().toISOString(),
            ok: false,
            error: errorMessage(e),
          });
          throw e;
        }
      },
      { confirm: true }
    );

  const forgetFolder = () =>
    run('forget-folder', async () => {
      await forgetBackupFolder();
    });

  const restoreFile = (file: LocalBackupFile) =>
    run('restore-local', async () => {
      await confirmAndRestore(await readLocalBackup(file.uri));
    });

  const status = backupStatus({
    folder: localFolderUri,
    lastAt: lastLocalBackup,
    outcome: localResult,
    frequency,
    now: new Date(),
  });
  const shownFiles = files ? (showAll ? files : files.slice(0, COLLAPSED_FILES)) : [];
  const hasFolder = !!localFolderUri;

  return (
    <View style={styles.container}>
      <AppHeader title="Backup & restore" showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        <View style={[h.card, styles.statusCard]}>
          {!loaded ? (
            <>
              <Skeleton width={200} height={16} radius={4} />
              <Skeleton width={260} height={12} radius={4} style={{ marginTop: 8 }} />
              <Skeleton width={300} height={44} radius={999} style={{ marginTop: 14 }} />
            </>
          ) : (
            <>
              <View style={styles.statusHead}>
                <View style={[h.iconTile, { backgroundColor: status.tint }]}>
                  <MaterialCommunityIcons name={status.icon} size={HOME.iconGlyph} color={theme.colors.ink} />
                </View>
                <View style={h.mid}>
                  <Text style={styles.statusTitle}>{status.title}</Text>
                  {status.lines.map((line) => (
                    <Text key={line} style={[h.sub, status.failed && styles.errorLine]} numberOfLines={2}>
                      {line}
                    </Text>
                  ))}
                </View>
              </View>
              {hasFolder ? (
                <PrimaryButton
                  title={busy === 'backup-now-local' ? 'Backing up…' : 'Backup now'}
                  done={doneLabel === 'backup-now-local'}
                  onPress={backupNowLocal}
                  disabled={!!busy}
                  style={styles.mainAction}
                />
              ) : (
                <PrimaryButton
                  title={busy === 'pick-folder' ? 'Choosing…' : 'Choose folder'}
                  onPress={choosePickFolder}
                  disabled={!!busy}
                  style={styles.mainAction}
                />
              )}
              <View style={styles.scheduleBlock}>
                <Text style={styles.eyebrow}>Back up automatically</Text>
                <SegmentedControl options={FREQUENCIES} value={frequency} onChange={onChangeFrequency} />
                <View style={styles.scheduleFoot}>
                  <Text style={styles.scheduleHint}>Runs while Yume is open. Nothing leaves your phone.</Text>
                  {hasFolder && (
                    <Pressable
                      onPress={forgetFolder}
                      disabled={!!busy}
                      hitSlop={8}
                      accessibilityRole="button"
                      style={withPressed(busy ? styles.linkDisabled : undefined)}
                    >
                      <Text style={styles.link}>Forget folder</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </>
          )}
        </View>

        <View style={styles.tabs}>
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        </View>

        {tab === 'points' ? (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.sectionTitle}>Restore points</Text>
              {files && files.length > COLLAPSED_FILES && (
                <Pressable
                  onPress={() => setShowAll((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showAll }}
                  style={withPressed()}
                >
                  <Text style={styles.seeAll}>{showAll ? 'Show less' : `See all ${files.length} →`}</Text>
                </Pressable>
              )}
            </View>
            {(safetyInfo || shownFiles.length > 0) && (
              <View style={[h.card, styles.timeline]}>
                {safetyInfo && (
                  <TimelineNode first last={shownFiles.length === 0} copy>
                    <View style={h.mid}>
                      <Text style={h.title}>Before your last restore</Text>
                      <Text style={[h.sub, styles.copySub]}>
                        {formatWhen(safetyInfo.savedAt)} · {safetyInfo.transactions}{' '}
                        {safetyInfo.transactions === 1 ? 'entry' : 'entries'}, {safetyInfo.accounts}{' '}
                        {safetyInfo.accounts === 1 ? 'account' : 'accounts'}
                      </Text>
                    </View>
                    <PrimaryButton
                      compact
                      title={busy === 'undo-restore' ? 'Putting back…' : 'Put back'}
                      accessibilityLabel="Put back your data from before the last restore"
                      onPress={confirmUndo}
                      disabled={!!busy}
                    />
                  </TimelineNode>
                )}
                {shownFiles.map((file, i) => (
                  <TimelineNode
                    key={file.uri}
                    first={!safetyInfo && i === 0}
                    last={i === shownFiles.length - 1}
                    latest={i === 0}
                  >
                    <View style={h.mid}>
                      <View style={styles.whenRow}>
                        <Text style={h.title} numberOfLines={1}>
                          {file.exportedAt ? formatWhen(file.exportedAt) : 'Backup file'}
                        </Text>
                        {i === 0 && (
                          <View style={styles.latestChip}>
                            <Text style={styles.latestText}>Latest</Text>
                          </View>
                        )}
                      </View>
                      <Text style={h.sub}>
                        {file.summary
                          ? `${file.summary.entries} entries · ${formatBytes(file.sizeBytes)}`
                          : "Couldn't read this file"}
                      </Text>
                    </View>
                    <PrimaryButton
                      compact
                      title="Restore"
                      variant="secondary"
                      accessibilityLabel={`Restore the backup from ${
                        file.exportedAt ? formatWhen(file.exportedAt) : 'this file'
                      }`}
                      onPress={() => restoreFile(file)}
                      disabled={!!busy || !file.summary}
                    />
                  </TimelineNode>
                ))}
              </View>
            )}
            {loaded && shownFiles.length === 0 && (
              <View style={[h.card, styles.emptyCard, safetyInfo && styles.emptyAfter]}>
                <Text style={styles.emptyTitle}>No backups yet</Text>
                <Text style={styles.emptySub}>
                  {hasFolder
                    ? 'Nothing in this folder yet. Tap Backup now to write the first one.'
                    : 'Choose a folder above and Yume writes the first one.'}
                </Text>
              </View>
            )}
            <View style={[h.card, styles.restoreFile]}>
              <SettingsRow
                icon="file-restore-outline"
                iconBg={theme.colors.primaryTint}
                label="Restore from file"
                sub={busy === 'restore-file' ? 'Restoring…' : 'A backup JSON saved on this device'}
                onPress={busy ? undefined : restoreFromFile}
                dimmed={!!busy && busy !== 'restore-file'}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Save a copy</Text>
            <View style={h.card}>
              <SettingsRow
                icon="code-json"
                iconBg={theme.colors.idGold}
                label="Full backup (JSON)"
                sub={busy === 'export-json' ? 'Exporting…' : 'The complete copy you can restore into Yume'}
                onPress={busy ? undefined : exportJsonLocally}
                right={<Feather name="share" size={18} color={theme.colors.textMuted} />}
                dimmed={!!busy && busy !== 'export-json'}
              />
              <SettingsRow
                divider
                icon="file-excel-outline"
                iconBg={theme.colors.idSage}
                label="Excel workbook"
                sub={
                  busy === 'export-excel'
                    ? 'Exporting…'
                    : 'Transactions, accounts, category totals, loans and Friends & Family, one sheet each'
                }
                onPress={busy ? undefined : exportExcelLocally}
                right={<Feather name="share" size={18} color={theme.colors.textMuted} />}
                dimmed={!!busy && busy !== 'export-excel'}
              />
            </View>
            <Text style={styles.copyHint}>
              Both open the share sheet, so you can save them anywhere or send them to yourself.
            </Text>
          </>
        )}
      </ScrollView>
      <RestorePreviewSheet
        preview={pending?.preview ?? null}
        busy={restoring}
        onCancel={() => setPending(null)}
        onRestore={() => void restorePending()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  sectionTitle: {
    ...SECTION_TITLE,
    marginHorizontal: 20,
    marginTop: SECTION_GAP.top,
    marginBottom: SECTION_GAP.bottom,
  },
  statusCard: { marginTop: theme.layout.screenTopGap, padding: 16 },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusTitle: { fontFamily: theme.font.roundedBold, fontSize: 17, color: theme.colors.textPrimary },
  errorLine: { color: theme.colors.expenseText },
  mainAction: { marginTop: 14 },
  scheduleBlock: {
    marginTop: 16,
    paddingTop: 14,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  eyebrow: { ...EYEBROW },
  scheduleFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  scheduleHint: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 17,
  },
  link: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textDecorationLine: 'underline',
  },
  linkDisabled: { opacity: 0.45 },
  tabs: { marginHorizontal: 20, marginTop: 16 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingRight: 20,
  },
  seeAll: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  timeline: { overflow: 'hidden' },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  latestChip: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primaryTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  latestText: {
    fontFamily: theme.font.bodyBold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textSecondary,
  },
  copySub: { color: theme.colors.textSecondary },
  emptyCard: { padding: 16, alignItems: 'center' },
  emptyAfter: { marginTop: 12 },
  emptyTitle: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  emptySub: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 19,
    marginTop: 4,
    textAlign: 'center',
  },
  restoreFile: { marginTop: 12 },
  copyHint: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 17,
    marginHorizontal: 20,
    marginTop: 10,
  },
  node: { paddingLeft: 40 },
  nodeCopy: { backgroundColor: theme.colors.idTeal },
  rail: { position: 'absolute', left: 22, width: 2, backgroundColor: theme.colors.borderSoft },
  dot: {
    position: 'absolute',
    left: 17,
    top: '50%',
    marginTop: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.textMuted,
    backgroundColor: theme.colors.surface,
  },
  dotLatest: { backgroundColor: theme.colors.income, borderColor: theme.colors.income },
  dotCopy: { backgroundColor: theme.colors.idTeal, borderColor: theme.colors.income },
});

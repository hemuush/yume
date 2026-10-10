import { ScreenLoadError } from '@/components/ScreenLoadError';
import { useCallback, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
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
import { authenticate, withoutRelock } from '@/lib/appLock';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import { Glass, GLASS_CARD } from '@/components/Glass';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { BackupShield } from '@/features/backup/BackupShield';
import { shade } from '@/lib/color';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Skeleton } from '@/components/Skeleton';
import { theme } from '@/constants/theme';
import { errorMessage } from '@/lib/errorMessage';
import { screenStyles as h } from '@/components/screenStyles';
import { SettingsRow } from '@/components/SettingsRow';
import { withPressed } from '@/lib/pressed';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { listScreenStyles } from '@/features/shared/listScreenStyles';
import { showAlert } from '@/components/AppDialog';
import { styles } from '@/features/backup/backup.styles';
import { TimelineNode } from '@/features/backup/TimelineNode';
import { backupStatus, formatBytes, formatWhen } from '@/features/backup/backupStatus';
import { useAccent } from '@/theme/AccentContext';
import { useAppLock } from '@/lib/AppLockContext';

const FREQUENCIES: { label: string; value: BackupFrequency }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

const TABS: { label: string; value: 'points' | 'copy' }[] = [
  { label: 'Restore points', value: 'points' },
  { label: 'Save a copy', value: 'copy' },
];

/** How many backups the timeline shows before "See all". */
const COLLAPSED_FILES = 3;

/**
 * Writes an export to a temporary file, opens the share sheet on it, and always deletes it afterwards: it is
 * the whole of someone's finances in plain text, and shouldn't be left in the app's storage once shared.
 */
async function shareTempFile(
  name: string,
  content: string | Uint8Array,
  options: { mimeType: string; dialogTitle?: string }
): Promise<void> {
  // The cache, not documents: if the app is killed mid-share, Android clears it rather than keeping it forever.
  const file = new File(Paths.cache, name);
  try {
    file.create();
    file.write(content);
    if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this phone.");
    await withoutRelock(() => Sharing.shareAsync(file.uri, options));
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      // Nothing more to do; the export itself already succeeded or failed on its own terms.
    }
  }
}

export default function BackupScreen() {
  const { lockEnabled } = useAppLock();
  const insets = useSafeAreaInsets();
  const { accent, secondary } = useAccent();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const [localFolderUri, setLocalFolderUri] = useState<string | null>(null);
  const [lastLocalBackup, setLastLocalBackup] = useState<string | null>(null);
  const [localResult, setLocalResult] = useState<BackupOutcome | null>(null);
  const [frequency, setFrequency] = useState<BackupFrequency>('daily');
  const [busy, setBusy] = useState<string | null>(null);
  const [doneLabel, setDoneLabel] = useState<string | null>(null);
  // The saved recovery copy may predate an earlier restore if the latest restore could not keep one.
  // Show its saved date rather than claiming it always undoes the latest restore.
  const [safetyInfo, setSafetyInfo] = useState<SafetyCopyInfo | null>(null);
  // The backup files in the chosen folder, newest first.
  const [files, setFiles] = useState<LocalBackupFile[] | null>(null);
  // A restore waiting on the preview sheet, and whether it's running.
  const [pending, setPending] = useState<{ snapshot: BackupSnapshot; preview: RestorePreview } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [tab, setTab] = useState<'points' | 'copy'>('points');
  const [showAll, setShowAll] = useState(false);

  const loadData = useCallback(async () => {
    const [safety, folder, lastAt, result, freq] = await Promise.all([
      getSafetyCopyInfo(),
      getLocalBackupFolderUri(),
      getLastLocalBackupAt(),
      getLastLocalBackupResult(),
      getBackupFrequency(),
    ]);
    const list = folder ? await listLocalBackups(folder).catch(() => []) : null;
    setSafetyInfo(safety);
    setLocalFolderUri(folder);
    setFiles(list);
    setLastLocalBackup(lastAt);
    setLocalResult(result);
    setFrequency(freq);
  }, []);
  // `loaded` keeps the unloaded default `!localFolderUri` from briefly showing the "choose a folder"
  // call-to-action to someone with a folder configured; `loadError` says so if the settings can't be read.
  const { loaded, hasData, loadError, reload: load } = useScreenLoad(loadData);

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

  // An export is the whole ledger in plain text: with the app lock on, it takes the phone's own unlock first.
  const unlockedForExport = async () => !lockEnabled || (await authenticate().catch(() => false));

  const exportJsonLocally = () =>
    run('export-json', async () => {
      if (!(await unlockedForExport())) return;
      const snapshot = await buildBackupSnapshot();
      await shareTempFile(`yume-backup-${Date.now()}.json`, JSON.stringify(snapshot, null, 2), {
        mimeType: 'application/json',
      });
    });

  const exportExcelLocally = () =>
    run('export-excel', async () => {
      if (!(await unlockedForExport())) return;
      const bytes = await generateExportWorkbookBytes();
      await shareTempFile(`yume-export-${Date.now()}.xlsx`, bytes, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Yume data',
      });
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
  // Back to the Home already underneath, not a second copy of the tabs stacked on Backup.
  const goHome = () => router.dismissTo('/');

  /**
   * Puts back the pre-restore data (lib/safetyCopy.ts) after one more confirmation; shared by the "Undo
   * restore" button on the completion message and the saved recovery snapshot card.
   */
  const confirmUndo = () =>
    showAlert(
      'Put back your earlier data?',
      'This replaces what is in the app now with the saved recovery snapshot. Check its saved date before continuing: it may come from an earlier restore. What is there now is kept as a new recovery copy.',
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
              showAlert('Data put back', 'The saved recovery snapshot has been restored.', [
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
  const finishRestore = ({
    skippedColumns,
    emptiedTables = [],
    undoAvailable,
  }: RestoreResult & { undoAvailable: boolean }) => {
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
    // An older backup has no section for something added since: what was here is gone, so say what.
    const emptiedNote =
      emptiedTables.length > 0
        ? `\n\nThis backup is from an older version and had nothing for: ${emptiedTables
            .map((t) => t.replace(/_/g, ' '))
            .join(', ')}. Those are now empty.`
        : '';
    showAlert(
      'Restore complete',
      undoAvailable
        ? `Your data has been restored.${note}${emptiedNote}\n\nNot what you expected? You can put back your data from before this restore.`
        : `Your data has been restored.${note}${emptiedNote}`,
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
    // A backup without a usable export time still restores; the preview just doesn't say when it was made.
    const exportedAt = Number.isNaN(Date.parse(snapshot.exportedAt)) ? null : snapshot.exportedAt;
    const [current, lostCount] = await Promise.all([
      getCurrentSummary(),
      exportedAt ? countEntriesSavedAfter(exportedAt) : Promise.resolve(0),
    ]);
    setPending({
      snapshot,
      preview: { exportedAt: exportedAt ?? '', backup, current, lostCount },
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
        showAlert('Something went wrong', errorMessage(e));
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

  if (!hasData && loadError)
    return <ScreenLoadError title="Backup" message={loadError} onRetry={() => void load()} />;

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        {loadError && (
          <View style={listScreenStyles.errorBanner}>
            <Text style={listScreenStyles.errorTitle}>Couldn't load your backup settings</Text>
            <Text style={listScreenStyles.errorDetail}>{loadError}</Text>
            <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void load()} />
          </View>
        )}
        {/* Glass, with a shield in the status's colour (green when safe, amber or red when it needs you). */}
        <Glass radius={28} tone="strong" style={styles.statusCard}>
          {!loaded ? (
            <>
              <Skeleton width={200} height={16} radius={4} />
              <Skeleton width={260} height={12} radius={4} style={{ marginTop: 8 }} />
              <Skeleton width={300} height={44} radius={999} style={{ marginTop: 14 }} />
            </>
          ) : (
            <>
              <View style={styles.statusHead}>
                <BackupShield icon={status.icon} tone={status.tone} />
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
                  title={busy === 'backup-now-local' ? 'Backing up…' : 'Back up now'}
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
        </Glass>

        <View style={styles.tabs}>
          <SegmentedControl options={TABS} value={tab} onChange={setTab} onBand />
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
              <View style={[h.card, GLASS_CARD, styles.timeline]}>
                {safetyInfo && (
                  <TimelineNode first last={shownFiles.length === 0} copy>
                    <View style={h.mid}>
                      <Text style={h.title}>Saved recovery snapshot</Text>
                      <Text style={[h.sub, styles.copySub]}>
                        {formatWhen(safetyInfo.savedAt)} · {safetyInfo.transactions}{' '}
                        {safetyInfo.transactions === 1 ? 'entry' : 'entries'}, {safetyInfo.accounts}{' '}
                        {safetyInfo.accounts === 1 ? 'account' : 'accounts'}
                      </Text>
                    </View>
                    <PrimaryButton
                      compact
                      title={busy === 'undo-restore' ? 'Putting back…' : 'Put back'}
                      accessibilityLabel="Put back the saved recovery snapshot"
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
                        <Text style={h.title} numberOfLines={2}>
                          {file.exportedAt ? formatWhen(file.exportedAt) : 'Backup file'}
                        </Text>
                        {i === 0 && (
                          <View style={[styles.latestChip, { backgroundColor: shade(accent, 95) }]}>
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
              <View style={[h.card, GLASS_CARD, styles.emptyCard, safetyInfo && styles.emptyAfter]}>
                <Text style={styles.emptyTitle}>No backups yet</Text>
                <Text style={styles.emptySub}>
                  {hasFolder
                    ? 'Nothing in this folder yet. Tap Back up now to write the first one.'
                    : 'Choose a folder above and Yume writes the first one.'}
                </Text>
              </View>
            )}
            <View style={[h.card, GLASS_CARD, styles.restoreFile]}>
              <SettingsRow
                icon="file-restore-outline"
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
            <View style={[h.card, GLASS_CARD]}>
              <SettingsRow
                icon="code-json"
                label="Full backup (JSON)"
                sub={busy === 'export-json' ? 'Exporting…' : 'The complete copy you can restore into Yume'}
                onPress={busy ? undefined : exportJsonLocally}
                right={<Feather name="share" size={18} color={theme.colors.textMuted} />}
                dimmed={!!busy && busy !== 'export-json'}
              />
              <SettingsRow
                divider
                icon="file-excel-outline"
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
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        collapse={collapse}
        summary={<HeaderSummary rest={status.title} dot={status.tint} />}
        title="Backup & restore"
        showBack
        hideUser
        wallpaper
      />
      <RestorePreviewSheet
        preview={pending?.preview ?? null}
        busy={restoring}
        onCancel={() => setPending(null)}
        onRestore={() => void restorePending()}
      />
    </View>
  );
}

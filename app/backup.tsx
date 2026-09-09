import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { buildBackupSnapshot, restoreFromSnapshot, BackupSnapshot } from '@/lib/backup';
import { generateExportWorkbookBytes } from '@/lib/exportExcel';
import {
  signInToGoogleDrive,
  isDriveLinked,
  isDriveConfigured,
  unlinkGoogleDrive,
  getAuthSilently,
  uploadBackupToDrive,
  downloadLatestBackupFromDrive,
} from '@/lib/googleDrive';
import {
  pickBackupFolder,
  forgetBackupFolder,
  writeLocalBackupNow,
  readNewestLocalBackup,
} from '@/lib/localBackup';
import {
  getLastDriveBackupAt,
  setLastDriveBackupAt,
  getLocalBackupFolderUri,
  getLastLocalBackupAt,
  getBackupFrequency,
  setBackupFrequency,
  getLastDriveBackupResult,
  getLastLocalBackupResult,
  setLastDriveBackupResult,
  setLastLocalBackupResult,
  BackupFrequency,
  BackupOutcome,
} from '@/db/settings';
import { AppHeader } from '@/components/AppHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { theme } from '@/constants/theme';

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

/** A small pill showing whether the last attempt succeeded, failed, or never ran, plus its size. */
function StatusPill({ lastAt, outcome }: { lastAt: string | null; outcome: BackupOutcome | null }) {
  if (!lastAt) {
    return (
      <View style={[styles.pill, styles.pillNeutral]}>
        <Text style={styles.pillText}>Never run</Text>
      </View>
    );
  }
  const failed = outcome && !outcome.ok;
  return (
    <View style={styles.statusRow}>
      <View style={[styles.pill, failed ? styles.pillError : styles.pillOk]}>
        <Feather
          name={failed ? 'alert-circle' : 'check-circle'}
          size={11}
          color={failed ? theme.colors.expense : theme.colors.income}
        />
        <Text style={[styles.pillText, { color: failed ? theme.colors.expense : theme.colors.income }]}>
          {failed ? 'Failed' : 'Backed up'}
        </Text>
      </View>
      <Text style={styles.lastBackupText}>
        {new Date(lastAt).toLocaleString()}
        {outcome?.ok && outcome.sizeBytes ? ` · ${formatBytes(outcome.sizeBytes)}` : ''}
      </Text>
      {failed && outcome?.error && (
        <Text style={styles.errorDetail} numberOfLines={2}>
          {outcome.error}
        </Text>
      )}
    </View>
  );
}

export default function BackupScreen() {
  const insets = useSafeAreaInsets();
  const [linked, setLinked] = useState(false);
  const driveConfigured = isDriveConfigured();
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [driveResult, setDriveResult] = useState<BackupOutcome | null>(null);
  const [localFolderUri, setLocalFolderUri] = useState<string | null>(null);
  const [lastLocalBackup, setLastLocalBackup] = useState<string | null>(null);
  const [localResult, setLocalResult] = useState<BackupOutcome | null>(null);
  const [frequency, setFrequency] = useState<BackupFrequency>('daily');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLinked(await isDriveLinked());
    setLastBackup(await getLastDriveBackupAt());
    setDriveResult(await getLastDriveBackupResult());
    setLocalFolderUri(await getLocalBackupFolderUri());
    setLastLocalBackup(await getLastLocalBackupAt());
    setLocalResult(await getLastLocalBackupResult());
    setFrequency(await getBackupFrequency());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert('Something went wrong', String(e?.message ?? e));
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
      const file = new File(Paths.document, `flynse-backup-${Date.now()}.json`);
      file.create();
      file.write(JSON.stringify(snapshot, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
      }
    });

  const exportExcelLocally = () =>
    run('export-excel', async () => {
      const bytes = await generateExportWorkbookBytes();
      const file = new File(Paths.document, `flynse-export-${Date.now()}.xlsx`);
      file.create();
      file.write(bytes);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Export Flynse data',
        });
      }
    });

  const restoreFromFile = () =>
    run('restore-file', async () => {
      // Restricting to 'application/json' previously meant Android's own
      // file picker — which many file managers/content providers report a
      // .json file's MIME type inconsistently through (octet-stream, plain
      // text, or nothing at all) — could silently grey out or hide the very
      // backup file the user was trying to pick, with no error and nothing
      // visibly wrong: restore just looked like it "didn't work" because
      // there was never anything to select. Accepting any file type here
      // and validating the actual JSON content afterward (already done via
      // isValidSnapshotShape inside restoreFromSnapshot) is what actually
      // works reliably across devices.
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (result.canceled || !result.assets?.[0]) return;
      const content = await new File(result.assets[0].uri).text();
      let snapshot: BackupSnapshot;
      try {
        snapshot = JSON.parse(content);
      } catch {
        throw new Error(
          "That file isn't valid JSON — pick the backup file Flynse exported (Export full backup, or a file saved from Google Drive/your local folder)."
        );
      }
      await confirmAndRestore(snapshot);
    });

  const linkDrive = () =>
    run('link', async () => {
      await signInToGoogleDrive();
    });

  const unlinkDrive = () =>
    run('unlink', async () => {
      await unlinkGoogleDrive();
    });

  const backupNowToDrive = () =>
    run('backup-now', async () => {
      try {
        let auth = await getAuthSilently();
        if (!auth) auth = await signInToGoogleDrive();
        const snapshot = await buildBackupSnapshot();
        const json = JSON.stringify(snapshot);
        await uploadBackupToDrive(auth.accessToken, 'flynse-backup-latest.json', json);
        const now = new Date().toISOString();
        await setLastDriveBackupAt(now);
        await setLastDriveBackupResult({ at: now, ok: true, sizeBytes: json.length });
      } catch (e: any) {
        await setLastDriveBackupResult({
          at: new Date().toISOString(),
          ok: false,
          error: String(e?.message ?? e),
        });
        throw e;
      }
    });

  const restoreFromDrive = () =>
    run('restore-drive', async () => {
      let auth = await getAuthSilently();
      if (!auth) auth = await signInToGoogleDrive();
      const content = await downloadLatestBackupFromDrive(auth.accessToken);
      if (!content) {
        Alert.alert('No backup found', 'There is no backup file in your Flynse Backups folder yet.');
        return;
      }
      const snapshot: BackupSnapshot = JSON.parse(content);
      await confirmAndRestore(snapshot);
    });

  const confirmAndRestore = (snapshot: BackupSnapshot) =>
    new Promise<void>((resolve, reject) => {
      Alert.alert(
        'Replace all data?',
        `This backup was made on ${new Date(snapshot.exportedAt).toLocaleString()}. Restoring will replace everything currently in the app.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                await restoreFromSnapshot(snapshot);
                resolve();
                // A restore replaces every table in the database — every
                // screen's already-loaded state is now stale. Every screen
                // in this app reloads its data via useFocusEffect, so
                // navigating back to Home now (rather than leaving the user
                // here to remember to reopen the app) is enough for the
                // rest of the app to pick up the restored data as each tab
                // is visited; this also gets the user off a backup screen
                // whose own on-screen figures (last backup time, etc.) are
                // themselves now stale.
                Alert.alert('Restore complete', 'Your data has been restored.', [
                  { text: 'OK', onPress: () => router.replace('/(tabs)') },
                ]);
              } catch (e) {
                // Previously an unhandled throw here left this promise
                // pending forever — the caller's `run()` was awaiting it, so
                // its try/catch/finally never ran: the "Restoring..." button
                // stayed stuck disabled permanently with no error shown.
                reject(e);
              }
            },
          },
        ]
      );
    });

  const choosePickFolder = () =>
    run('pick-folder', async () => {
      const uri = await pickBackupFolder();
      if (uri) await writeLocalBackupNow(uri); // confirm the grant actually works with a first backup right away
    });

  const backupNowLocal = () =>
    run('backup-now-local', async () => {
      if (!localFolderUri) return;
      try {
        const { sizeBytes } = await writeLocalBackupNow(localFolderUri);
        await setLastLocalBackupResult({ at: new Date().toISOString(), ok: true, sizeBytes });
      } catch (e: any) {
        await setLastLocalBackupResult({
          at: new Date().toISOString(),
          ok: false,
          error: String(e?.message ?? e),
        });
        throw e;
      }
    });

  const forgetFolder = () =>
    run('forget-folder', async () => {
      await forgetBackupFolder();
    });

  const restoreFromLocal = () =>
    run('restore-local', async () => {
      if (!localFolderUri) return;
      const snapshot = await readNewestLocalBackup(localFolderUri);
      if (!snapshot) {
        Alert.alert('No backup found', 'There is no backup file in your chosen folder yet.');
        return;
      }
      await confirmAndRestore(snapshot);
    });

  return (
    <View style={styles.container}>
      <AppHeader title="Backup & Restore" showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        <Text style={styles.sectionTitle}>Automatic backup frequency</Text>
        <View style={styles.freqWrap}>
          <SegmentedControl options={FREQUENCIES} value={frequency} onChange={onChangeFrequency} />
        </View>
        <Text style={styles.freqHint}>
          Applies to both Google Drive and the local folder below. Backups also only run while the app is
          open.
        </Text>

        <Text style={styles.sectionTitle}>Google Drive</Text>
        {!driveConfigured ? (
          <View style={styles.card}>
            <View style={styles.comingSoonRow}>
              <Feather name="cloud" size={16} color={theme.colors.textMuted} />
              <Text style={styles.comingSoonLabel}>Coming soon</Text>
            </View>
            <Text style={styles.cardText}>
              Google Drive backup isn't set up on this build yet. The local folder backup below already covers
              automatic backups without needing this — use that in the meantime.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardText}>
              {linked
                ? 'Linked. Flynse can only see files it creates in a "Flynse Backups" folder — nothing else in your Drive.'
                : 'Link your Google account so backups upload automatically in the background, and after you restart the app.'}
            </Text>
            <StatusPill lastAt={lastBackup} outcome={driveResult} />
            <View style={styles.buttonRow}>
              {!linked ? (
                <PrimaryButton
                  title={busy === 'link' ? 'Linking...' : 'Link Google Drive'}
                  onPress={linkDrive}
                  disabled={!!busy}
                  style={{ flex: 1 }}
                />
              ) : (
                <>
                  <PrimaryButton
                    title={busy === 'backup-now' ? 'Backing up...' : 'Backup now'}
                    onPress={backupNowToDrive}
                    disabled={!!busy}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <PrimaryButton
                    title="Unlink"
                    variant="secondary"
                    onPress={unlinkDrive}
                    disabled={!!busy}
                    style={{ flex: 1 }}
                  />
                </>
              )}
            </View>
            {linked && (
              <PrimaryButton
                title={busy === 'restore-drive' ? 'Restoring...' : 'Restore latest from Drive'}
                variant="secondary"
                onPress={restoreFromDrive}
                disabled={!!busy}
                style={{ marginTop: 10 }}
              />
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Local Folder Backup</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>
            {localFolderUri
              ? 'A backup is written to your chosen folder automatically, on the schedule above. Nothing leaves your device.'
              : 'Pick a folder on your phone once — Flynse writes a backup there automatically, with no share-sheet tap needed.'}
          </Text>
          {localFolderUri && <StatusPill lastAt={lastLocalBackup} outcome={localResult} />}
          <View style={styles.buttonRow}>
            {!localFolderUri ? (
              <PrimaryButton
                title={busy === 'pick-folder' ? 'Choosing...' : 'Choose folder'}
                onPress={choosePickFolder}
                disabled={!!busy}
                style={{ flex: 1 }}
              />
            ) : (
              <>
                <PrimaryButton
                  title={busy === 'backup-now-local' ? 'Backing up...' : 'Backup now'}
                  onPress={backupNowLocal}
                  disabled={!!busy}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <PrimaryButton
                  title="Forget folder"
                  variant="secondary"
                  onPress={forgetFolder}
                  disabled={!!busy}
                  style={{ flex: 1 }}
                />
              </>
            )}
          </View>
          {localFolderUri && (
            <PrimaryButton
              title={busy === 'restore-local' ? 'Restoring...' : 'Restore latest from folder'}
              variant="secondary"
              onPress={restoreFromLocal}
              disabled={!!busy}
              style={{ marginTop: 10 }}
            />
          )}
        </View>

        <Text style={styles.sectionTitle}>Local Export</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>
            Save a full backup (JSON, for restoring into Flynse) or a styled Excel workbook — transactions,
            accounts, category totals, loans, and Friends & Family, each on its own sheet — to share, print,
            or store anywhere you like.
          </Text>
          <PrimaryButton
            title={busy === 'export-json' ? 'Exporting...' : 'Export full backup (JSON)'}
            onPress={exportJsonLocally}
            disabled={!!busy}
            style={{ marginTop: 10 }}
          />
          <PrimaryButton
            title={busy === 'export-excel' ? 'Exporting...' : 'Export to Excel (.xlsx)'}
            variant="secondary"
            onPress={exportExcelLocally}
            disabled={!!busy}
            style={{ marginTop: 10 }}
          />
        </View>

        <Text style={styles.sectionTitle}>Restore</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>Restore from a backup JSON file saved on this device.</Text>
          <PrimaryButton
            title={busy === 'restore-file' ? 'Restoring...' : 'Restore from file'}
            variant="secondary"
            onPress={restoreFromFile}
            disabled={!!busy}
            style={{ marginTop: 10 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  sectionTitle: {
    fontSize: 13,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  freqWrap: { marginHorizontal: 20 },
  freqHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginHorizontal: 20,
    marginTop: -6,
    lineHeight: 17,
  },
  card: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.thick,
    borderColor: theme.colors.border,
  },
  cardText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19 },
  comingSoonRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  comingSoonLabel: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  buttonRow: { flexDirection: 'row', marginTop: 12 },
  statusRow: { marginTop: 10, gap: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
  },
  pillOk: { backgroundColor: theme.colors.incomeTint },
  pillError: { backgroundColor: theme.colors.expenseTint },
  pillNeutral: { backgroundColor: theme.colors.surfaceAlt },
  pillText: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.textSecondary },
  lastBackupText: { fontSize: 12, color: theme.colors.textMuted },
  errorDetail: { fontSize: 11.5, color: theme.colors.expense, lineHeight: 15 },
});

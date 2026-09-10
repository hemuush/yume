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
  pickBackupFolder,
  forgetBackupFolder,
  writeLocalBackupNow,
  readNewestLocalBackup,
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
  const [localFolderUri, setLocalFolderUri] = useState<string | null>(null);
  const [lastLocalBackup, setLastLocalBackup] = useState<string | null>(null);
  const [localResult, setLocalResult] = useState<BackupOutcome | null>(null);
  const [frequency, setFrequency] = useState<BackupFrequency>('daily');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
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
      const file = new File(Paths.document, `yume-backup-${Date.now()}.json`);
      file.create();
      file.write(JSON.stringify(snapshot, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
      }
    });

  const exportExcelLocally = () =>
    run('export-excel', async () => {
      const bytes = await generateExportWorkbookBytes();
      const file = new File(Paths.document, `yume-export-${Date.now()}.xlsx`);
      file.create();
      file.write(bytes);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Export Yume data',
        });
      }
    });

  const restoreFromFile = () =>
    run('restore-file', async () => {
      // Accepting any file type and validating the JSON afterward is what
      // actually works across devices — many file managers report a .json
      // file's MIME type inconsistently, which would otherwise grey out the
      // very file the user is trying to pick.
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (result.canceled || !result.assets?.[0]) return;
      const content = await new File(result.assets[0].uri).text();
      let snapshot: BackupSnapshot;
      try {
        snapshot = JSON.parse(content);
      } catch {
        throw new Error("That file isn't valid JSON — pick a full backup Yume exported.");
      }
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
                const { skippedColumns } = await restoreFromSnapshot(snapshot);
                resolve();
                // A restore replaces every table — every screen's loaded
                // state is now stale. Each screen reloads via useFocusEffect,
                // so bouncing to Home is enough for the rest of the app to
                // pick up the restored data as tabs are visited.
                const note =
                  skippedColumns.length > 0
                    ? `\n\nHeads up: ${skippedColumns.length} field${
                        skippedColumns.length === 1 ? '' : 's'
                      } in this backup aren't part of this version of Yume and were skipped (${skippedColumns.join(
                        ', '
                      )}). Everything else was restored.`
                    : '';
                Alert.alert('Restore complete', `Your data has been restored.${note}`, [
                  { text: 'OK', onPress: () => router.replace('/(tabs)') },
                ]);
              } catch (e) {
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
      if (uri) await writeLocalBackupNow(uri); // confirm the grant works with a first backup right away
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
      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        <Text style={styles.sectionTitle}>Automatic backup frequency</Text>
        <View style={styles.freqWrap}>
          <SegmentedControl options={FREQUENCIES} value={frequency} onChange={onChangeFrequency} />
        </View>
        <Text style={styles.freqHint}>
          Applies to the local folder backup below. Backups only run while the app is open.
        </Text>

        <Text style={styles.sectionTitle}>Local Folder Backup</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>
            {localFolderUri
              ? 'A backup is written to your chosen folder automatically, on the schedule above. Nothing leaves your device.'
              : 'Pick a folder on your phone once — Yume writes a backup there automatically, with no share-sheet tap needed.'}
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
            Save a full backup (JSON, for restoring into Yume) or a styled Excel workbook — transactions,
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
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  cardText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19 },
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

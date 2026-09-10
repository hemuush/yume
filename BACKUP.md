# Backup, restore, and data privacy

## What leaves the device

By default: **nothing**. Yume's database lives entirely in local SQLite on the phone. The only way data leaves the device is if you explicitly export a JSON or Excel (.xlsx) file, or point Yume at a backup folder, and share/save it yourself. There is no cloud account, no server, and no network call anywhere in the backup path.

## Local export / restore

From **Settings → Backup & Restore**:

- **Export full backup (JSON)** — every table, serialized, shareable via any app (email, a cloud drive, a file manager). This is the complete source of truth for a restore.
- **Export to Excel (.xlsx)** — a real, styled workbook matching Yume's own colors: Summary (key totals), Transactions (with an AutoFilter and a live SUBTOTAL total row), Accounts, Categories (rolled up the same way Reports does), Loans, and Friends & Family — each its own sheet, opens directly in Excel/Sheets/Numbers.
- **Restore from file** — pick a previously exported JSON file; this **replaces all current data** after a confirmation prompt.

## Local folder backup

From the same screen, **Choose folder** grants Yume write access to one folder on the device (via the Storage Access Framework). Once set:

- Yume writes a fresh backup file into that folder automatically, on the schedule you pick (daily / weekly / monthly), checked whenever the app is opened. This is an app-open check, not a true OS background job — if you don't open the app for several days, backup resumes the next time you do.
- **Backup now** triggers it manually any time.
- **Restore latest from folder** reads the newest backup file in that folder and restores it, after confirmation.
- **Forget folder** revokes the access grant; no further automatic backups run until you pick a folder again.

The relevant code is `src/lib/localBackup.ts` (`runLocalBackupIfDue`, `writeLocalBackupNow`, `readNewestLocalBackup`).

## Coming from Flynse

Yume is the renamed continuation of **Flynse**. The backup format is unchanged, so:

1. In Flynse: **Settings → Backup → Export full backup**, save the file.
2. In Yume: **Settings → Backup & Restore → Import from Flynse**, pick that file.

Everything — transactions, accounts, loans, Friends & Family — moves over. The two apps have different Android package names (`com.flynse.app` vs `com.yume.app`) and separate sandboxes, so this file hand-off is the migration path; there is no automatic in-place upgrade. You can uninstall Flynse afterwards.

## Restore safety

Restoring **replaces every table**. The app always shows a confirmation dialog naming the backup's export date before doing this, and the restore itself runs inside a single database transaction — if it fails partway through, nothing is left half-restored. Cached settings are re-primed via `resetSettingsCache()` and the app returns to Home so every tab reloads the restored data.

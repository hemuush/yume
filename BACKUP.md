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

The relevant code is `src/lib/localBackup.ts` (`runLocalBackupIfDue`, `writeLocalBackupNow`, `readNewestLocalBackup`). Backup files are named `yume-backup-<date>.json`.

## Restore safety

Restoring **replaces every table**. The app always shows a confirmation dialog naming the backup's export date before doing this, and the restore itself runs inside a single database transaction — if it fails partway through, nothing is left half-restored. Before anything is replaced, the file is checked: a damaged file, or one whose records point at data missing from it (e.g. transactions for an account that isn't in the file), is rejected with the current data untouched. Settings that belong to this phone rather than the data — the chosen backup folder, the last-backup status, and the app lock — keep their current values instead of the backup's. Loan due reminders, the daily/weekly reminders and home-screen widgets are re-synced to the restored data. Cached settings are re-primed via `resetSettingsCache()` and the app returns to Home so every tab reloads the restored data.

### Undoing a restore (the safety copy)

Before a restore replaces anything, Yume saves the current data as a **safety copy**: one file in the app's own private storage (`yume-safety-copy.json` in the app's documents folder — never the backup folder, never shared, removed with the app). "Restore complete" then offers **Undo restore**, and while a copy exists the Backup & Restore screen shows an **Undo your last restore** card. Undo is itself a restore, so it keeps a copy of what it replaces — the user can go back and forth without losing either version.

Only the latest copy is kept. It's written to a pending file first and replaces the previous copy only once the restore succeeds, so a restore that fails (a damaged file) leaves both the data and the existing copy untouched. If the copy can't be saved at all (e.g. the phone is full), nothing is replaced unless the user explicitly chooses "Restore anyway". See `src/lib/safetyCopy.ts`.

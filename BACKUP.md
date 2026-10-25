# Backup and restore

## Current backup contract

- Settings has separate **Backup & restore** and **Export** entries. Backup shows Save backup file and Restore from file together, with folder backup status, an expandable schedule and recent saved backups. Export separately offers a period, PDF or Excel, and a pinned Create action. PDF/Excel files are reports; the full JSON backup is the restorable copy.
- New backups are plain JSON, format version 6, containing the tables explicitly listed in [backup.ts](src/lib/backup.ts). Format-1 through format-5 files remain readable. Recently deleted records are not included. Sharing a copy sends it to the destination the user selects.
- Android folder access uses a persisted storage grant. Choosing a folder scans existing valid files before a write; newer folder data requires an explicit choice rather than silent replacement. Restore replaces records; it does not merge ledgers.
- Snapshot table reads are serialized in one exclusive database section. Restore validates data and foreign-key consistency; unknown columns and tables emptied by older backups are reported.
- Restore repairs exact legacy labels on app-created linked refund receipts inside the restore transaction, matching startup repair. Manually linked refunds and custom receipt text are preserved.
- The phone keeps its folder URI and last-backup status. Already-set app-lock and widget-detail preferences take precedence; a fresh install can adopt those preferences from the backup.
- The unfinished-entry recovery setting (`entry_draft_v1`) is local transient state: snapshots omit it, imports ignore it and restore clears pending recovery. A draft never becomes a transaction through restore.
- Notification permission-request history and topic scheduling receipts belong to this phone; imports preserve local values and ignore the source phone's values. Topic receipts are omitted from exports. Queued spending alerts keep their provenance and creation time, while their OS acceptance markers are stripped on export/import so restored alerts can be scheduled on this phone.
- Daily backup is due on a different local calendar day; weekly/monthly use elapsed windows. Maintenance runs while the app is open, catching up recurring entries first. It is not guaranteed background execution.
- A successful managed daily write replaces same-day managed files only after the new file is written. Retention keeps the newest 14 managed daily backup files by content ordering; exported copies are outside this policy. Initial-folder preservation avoids replacing existing files or pruning them.
- The private recovery copy contains the data present before a restore. Its own timestamp/counts must be shown. Putting it back is another restore, not selection of the latest folder file.
- File imports on Backup and onboarding check the picker size or fall back to `File.size` before reading, with a 150 MiB ceiling. Local-folder reads check their content size after SAF reading; very large files still need device testing.
- After a successful restore, folder-setting adoption is separate metadata. Its failure appears in Restore complete and does not prevent settings/reminder resync or falsely report a failed data restore. Onboarding retries without a safety copy automatically only when entries, accounts and loans are all empty.
- Forget folder removes Yume's saved folder reference and stops automatic use. It does not delete backups or explicitly revoke Android's persisted storage grant. Exported/local copies are plain JSON; see [security boundaries](SECURITY.md).
- Test revoked permissions, invalid/truncated files, newer folder contents, restore rollback and device-owned settings. See [local backup tests](src/lib/localBackup.test.ts), [backup tests](src/lib/backup.test.ts) and [build/device checks](BUILD.md).

## Current reading guide

Maintained through **25 October 2026**; fresh verification is in the [repository re-audit](docs/REPOSITORY_REAUDIT_2026_10_25.md). Folder selection scans existing files before writing. Restore replaces local records rather than merging them. A private safety snapshot captures pre-restore data; its own timestamp describes what it contains, not the latest folder backup.

Implementation: [src/lib/backup.ts](src/lib/backup.ts) and [src/lib/localBackup.ts](src/lib/localBackup.ts). Tests generally live beside these modules; use the [architecture and logic guide](docs/ARCHITECTURE.md) to find related flows.

This document preserves earlier findings and validation. Statements inside the historical record describe that revision, including old layouts, build status and test counts. They are not new verification results. See the [documentation index](docs/INDEX.md), [data model](DATA_MODEL.md), [backup guide](BACKUP.md) and [build guide](BUILD.md) for current contracts.

<details>
<summary>Historical findings, implementation and validation</summary>

## What leaves the device

By default: **nothing**. Yume's database lives entirely in local SQLite on the phone. The only way data leaves the device is if you explicitly export a JSON, PDF or Excel (.xlsx) file, or point Yume at a backup folder, and share/save it yourself. There is no cloud account, no server, and no network call anywhere in the backup path.

## Local export / restore

From **Settings → Backup & Restore**:

- **Export full backup (JSON)** — every table, serialized, shareable via any app (email, a cloud drive, a file manager). This is the complete source of truth for a restore.
- **Reports & exports** — a separate page (Backup & Restore › Reports & exports) for one **month**, one **year** or **all time**; only periods that have entries are offered, with a line saying how many entries and how much spending they hold. Choose a format:
  - **PDF report** — A4 pages built on the phone in the selected theme's colours with the embedded Fredoka and Archivo fonts: a cover with money in, spent, net, daily average, busiest day and no-spend days (and the change against the period before), where it went with shares, a day-by-day (or month-by-month) chart, weekday pattern, biggest spends, most-repeated notes, accounts, income sources, a month table for a year or all time, category and subcategory detail, loans, friends and family, then every entry grouped by day. Pages and numbering ("Page 2 of 6") are laid out by Yume itself because Android's PDF maker ignores CSS page margins. A period is limited to 4,000 entries; a longer one asks for a shorter period or Excel.
  - **Excel (.xlsx)** — a styled workbook for the same period: Summary, Transactions (real dates, Money in / Money out / Transfer columns that each carry a live SUBTOTAL, Category and Subcategory split, AutoFilter), Accounts, Categories with each one's share, Months (year or all time), Loans, and Friends & Family. Refunds are negative Money out, so that column adds up to spending as everywhere in the app. Balances, loans and people are as they stand today.
    Totals count the default currency only; other currencies' entries are listed in their own currency and never added in. With app lock on, the phone's unlock is asked before anything is created, and the file is deleted from the app's cache once the share sheet closes.
- **Restore from file** — pick a previously exported JSON file; this **replaces all current data** after the restore preview (see _Restore safety_).

On a new phone, the first onboarding page has **I have a Yume backup**: pick the file, check the same preview, and Yume restores it and skips the rest of setup.

## Local folder backup

From the same screen, **Choose folder** grants Yume write access to one folder on the device (via the Storage Access Framework). Once set:

- Yume writes a fresh backup file into that folder automatically, on the schedule you pick (daily / weekly / monthly), checked whenever the app is opened or comes back to the foreground. Daily means once per calendar day. This is an app-open check, not a true OS background job — if you don't open the app for several days, backup resumes the next time you do.
- **Backup now** triggers it manually any time.
- The screen reads the folder again on each visit and lists valid backup files by the exported time inside the file, with entry dates as a tie-breaker. Names and cached status do not determine which data is newest. Selecting a folder containing newer or different data offers a restore preview before any backup can replace it. Existing files are preserved when adopting that folder.
- Recurring entries are caught up before an automatic backup is taken. Overlapping app-resume jobs share one run.
- **Forget folder** revokes the access grant; no further automatic backups run until you pick a folder again.

The relevant code is `src/lib/localBackup.ts` (`runLocalBackupIfDue`, `writeLocalBackupNow`, `listLocalBackups`, `readLocalBackup`). Backup files are named `yume-backup-<date>.json`.

## Restore safety

Restoring **replaces every table**. Before doing this, every restore path (a file, a folder backup, onboarding) shows a preview: what's in the backup (entries and the latest one's date, accounts, loans) next to what's on the phone now, and how many entries saved after the backup was made would be lost (`src/features/backup/RestorePreviewSheet.tsx`). The restore itself runs inside a single database transaction — if it fails partway through, nothing is left half-restored. Before anything is replaced, the file is checked: a damaged file, invalid calendar dates or fractional minor-unit amounts, or one whose records point at data missing from it (e.g. transactions for an account that isn't in the file), is rejected with the current data untouched. Settings that belong to this phone rather than the data — the chosen backup folder, the last-backup status, and the app lock — keep their current values instead of the backup's. Loan due reminders, the daily/weekly reminders and home-screen widgets are re-synced to the restored data. Cached settings are re-primed via `resetSettingsCache()` and the app returns to Home so every tab reloads the restored data.

### Undoing a restore (the safety copy)

Before a restore replaces anything, Yume saves the current data as a **safety copy**: one file in the app's own private storage (`yume-safety-copy.json` in the app's documents folder — never the backup folder, never shared, removed with the app). "Restore complete" then offers **Undo restore**, and while a copy exists the Backup & Restore screen shows **Saved recovery snapshot**, its saved date and contents, and **Put back**. A retained copy can come from an earlier restore; the screen does not claim it always reverses the latest one. Undo is itself a restore, so it keeps a copy of what it replaces — the user can go back and forth without losing either version.

Only the latest copy is kept. It's written to a pending file first and replaces the previous copy only once the restore succeeds, so a restore that fails (a damaged file) leaves both the data and the existing copy untouched. If the copy can't be saved at all (e.g. the phone is full), nothing is replaced unless the user explicitly chooses "Restore anyway". See `src/lib/safetyCopy.ts`.

</details>

## Shared goal reservations

Backup format 4 introduced support for goal reservations, expected refunds, receipt links and annual-bill goal links. Format-1, format-2 and format-3 backups remain readable; missing planner tables restore as empty, and missing reservation fields default to zero. Earlier app versions reject newer formats rather than silently losing data. Invalid reservation modes, negative/fractional amounts, missing linked accounts and combined whole-account tracking are rejected before replacement. Refund receipts must match the purchase category/currency and cannot exceed the expectation; annual preparation requires a yearly expense and a reservation goal in the same currency. A valid snapshot may contain a shortfall after a withdrawal; reservations remain intact and the app shows the shortfall.

Format 5 adds an investment's kind (`accounts.investment_kind`), the account its money normally comes from (`accounts.funding_account_id`) and the recurring rule that posted an entry (`transactions.rule_id`). Older backups restore with those empty; an earlier app version refuses a format-5 file.

Format 4 also preserves goal activity and one-off recurring overrides, including confirm-first recording. Older backups restore with empty goal history and automatic recurring recording. Historical goal activity is not reconstructed.

Format 6 adds a credit card's minimum due (`accounts.min_due_bp`, `accounts.min_due_floor_minor`) and, for a tracked investment, the units held (`accounts.units`) and a deposit's or provident fund's maturity date (`accounts.maturity_date`; its yearly rate is the existing `interest_rate_annual_bp`). Older backups restore with those empty; an earlier app version refuses a format-6 file.

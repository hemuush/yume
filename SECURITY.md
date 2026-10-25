# Security boundaries

This guide describes the implemented controls and their limits. Validation for the current revision is recorded in the [repository re-audit](docs/REPOSITORY_REAUDIT_2026_10_25.md); [device acceptance](docs/RELEASE_DEVICE_CHECKS.md) is tracked separately.

## Data and access

Yume stores its ledger in ordinary SQLite in the Android app sandbox. It does not use a backend, analytics, bank credentials or remote account authentication. EAS release configuration blocks Internet permission; development keeps connectivity for Metro. App lock uses the phone's biometric or device credential prompt. It does not encrypt SQLite, exports or the private restore recovery copy.

With app lock enabled, financial UI waits for screen-capture protection to succeed. A failed native request offers Retry while keeping financial screens blocked. Normal background return relocks after one minute; short trips through Yume's own picker/share sheet have a bounded grace period, with a five-minute maximum. Moving the clock backwards cannot extend the completed-picker grace period.

Amount hiding, app lock and widget-detail hiding are separate controls. Financial widgets hide details if the privacy preference cannot be read. The image provider checks the calling UID and image name before opening a widget image; this permits Android and the current home launcher. Changing the launcher, resizing, reboot and screenshot behavior still require Android acceptance.

## Inputs and financial integrity

- Database APIs bind data values; dynamic table/column names come from internal allowlists or the real schema. Money writes validate integer minor units. Currency and linked-record checks belong to database boundaries, alongside the UI checks.
- Backup imports are untrusted JSON. Restore checks format, table/row shape, dates, amounts and supported cross-record links, then replaces data transactionally and checks foreign keys before commit. Unsupported future formats are rejected. Unknown columns and omitted tables are reported.
- File-picker imports check the reported size, falling back to the actual file size when absent, before reading. The 150 MiB ceiling limits accidental oversized imports; it is not a guarantee against memory exhaustion on every phone. Local-folder reads use the existing SAF path and check size after reading.
- Notifications accept only the predefined internal routes. External links can prefill supported forms; database validation and the normal save/confirmation flow still apply. No link directly commits a financial write.
- PDF text is escaped and theme colors are validated. Workbook text uses string cells; user text does not become an Excel formula. Exported reports and backup copies can contain sensitive data.

## Backups and exports

Backups are readable JSON. Reports, share cards and backups leave the app only through the user's selected destination or backup folder. With app lock on, full backup/report exports require device authentication. Shared temporary files are deleted when the share operation returns; process termination can leave cache files for Android to clean later. A destination app or selected cloud folder controls its own retained copy.

Android automatic app backup is disabled. Folder access uses Android's Storage Access Framework rather than broad storage permissions. Forgetting the folder removes Yume's saved reference; it does not delete the folder or promise to revoke Android's persisted grant. Restore keeps phone-bound settings and takes a private recovery snapshot before replacement. See [backup behavior](BACKUP.md).

## Build and dependency controls

Git and EAS independently exclude `.env*`, `credentials.json`, private keys, signing files and local attachments. Ignore rules do not protect a file already tracked in Git; review staged files before committing. Do not put tokens or credentials in app configuration or `EXPO_PUBLIC_*` values, which are client-visible.

CI runs type checking, lint, formatting, import-cycle checks, regression/security tests, Expo Doctor, the advisory gate, Android JavaScript export and generated native configuration checks. Actions are pinned to commits and jobs use read-only repository permissions. EAS builds use the commit that passed CI. Native release compilation and phone acceptance remain separate checks.

The advisory gate currently documents one high-severity exception: `GHSA-86w9-cpqp-85rv` in the Expo CLI's `node-forge` build-tool chain. It is not an app-runtime dependency, but it remains a build-environment risk. Recheck the registry and remove the exception when a compatible patched dependency becomes available. A passing gate must not be described as zero advisories.

No external penetration test, rooted-device resistance assessment, database encryption migration or device security certification is implied by these checks. Report suspected vulnerabilities privately to the repository owner without attaching personal ledgers, tokens, signing files or unredacted backups to public issues.

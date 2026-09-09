# Backup, restore, and data privacy

## What leaves the device

By default: **nothing**. Flynse's database lives entirely in local SQLite on the phone. The only way data leaves the device is:

1. You explicitly export a JSON or Excel (.xlsx) file and share/save it yourself, or
2. You link Google Drive, which then uploads a JSON backup to a folder named **"Flynse Backups"** in your own Drive.

Flynse requests only the `drive.file` OAuth scope — the most restrictive Drive scope Google offers. It grants access **only to files the app itself creates**; Flynse cannot see, list, or read anything else in your Drive, and Google's consent screen makes this explicit to you before you approve it.

## Local export/restore

From **Settings → Backup & Restore**:
- **Export full backup (JSON)** — every table, serialized, shareable via any app (email, another cloud drive, a file manager). This is the complete source of truth for a restore.
- **Export to Excel (.xlsx)** — a real, styled workbook matching Flynse's own colors: Summary (key totals), Transactions (with an AutoFilter and a live SUBTOTAL total row), Accounts, Categories (rolled up the same way Reports does), Loans, and Friends & Family — each its own sheet, opens directly in Excel/Sheets/Numbers.
- **Restore from file** — pick a previously exported JSON file; this **replaces all current data** after a confirmation prompt.

## Google Drive backup

1. **Link Google Drive** (one-time): opens Google's sign-in, you approve the `drive.file` scope.
2. **Automatic backups**: once linked, Flynse silently backs up to Drive roughly once a day, checked whenever the app is opened (see `src/lib/autoBackup.ts`). This is an app-open check, not a true OS background job — if you don't open the app for several days, backup resumes the next time you do.
3. **Backup now**: manual trigger any time, from the Backup screen.
4. **Restore latest from Drive**: downloads the most recent backup file from your "Flynse Backups" folder and restores it, after confirmation.
5. **Unlink**: revokes the stored token; no further automatic backups run until you link again.

## One-time setup you need to do (Google Cloud)

Google Drive backup needs an OAuth client ID that only you can create, because it's tied to your own Google Cloud project and app identity:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a new project (or reuse one).
2. **APIs & Services → Library** → enable the **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → configure it (External, add your own email as a test user while unpublished — that's enough for personal use).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Android**
   - Package name: `com.flynse.app` (matches `app.json`)
   - SHA-1 certificate fingerprint: get this from your EAS build credentials (`eas credentials`) or, for local testing, your debug keystore (`keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`)
5. Copy the generated **Client ID** into `.env.local` at the project root:
   ```
   EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   ```
   `.env.local` is already gitignored, so the ID never gets committed. Expo automatically inlines any `EXPO_PUBLIC_*` variable at bundle time — no code changes or `app.json` edits needed.
6. Restart `expo start` (or trigger a fresh `eas build`) after adding/changing the value — env vars are read at bundle time, not live.

Without this step, the app works fully offline — local JSON/Excel export and restore keep working — but the "Link Google Drive" button will show a clear error explaining the missing setup instead of crashing.

> **Client type note**: the value currently in `.env.local` is a Google **Web application** OAuth client, reused from elsewhere. It will work for sign-in, but Google's installed-app PKCE flow (which Flynse uses, via a custom `flynse://` redirect) is better matched by an **Android**-type client, which needs no redirect URI whitelisting and no client secret. If sign-in fails with a redirect URI mismatch, create the Android-type client per the steps above and swap it into `.env.local`.

## Restore safety

Restoring **replaces every table**. The app always shows a confirmation dialog naming the backup's export date before doing this, and the restore itself runs inside a single database transaction — if it fails partway through, nothing is left half-restored.

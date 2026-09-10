import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

WebBrowser.maybeCompleteAuthSession();

const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
// Kept as "Flynse Backups" / the old SecureStore key name so a device that
// linked Drive before the rename to Yume keeps finding its existing backups
// and doesn't have to re-authorise. Only the display name changed.
const BACKUP_FOLDER_NAME = 'Flynse Backups';
const REFRESH_TOKEN_KEY = 'flynse_drive_refresh_token';

/** Whether a Drive OAuth Client ID has been configured — lets the UI show a calm "coming soon" state instead of a button that immediately throws. */
export function isDriveConfigured(): boolean {
  return !!process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
}

function getClientId(): string {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      'Google Drive backup is not configured yet. Add EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID to .env.local — see BACKUP.md.'
    );
  }
  return clientId;
}

export interface DriveAuth {
  accessToken: string;
  expiresAt: number; // epoch millis
}

let cachedAuth: DriveAuth | null = null;

/**
 * Runs the interactive Google sign-in flow (PKCE, no client secret needed)
 * and returns an access token scoped to files this app creates — Yume
 * never gets read access to the rest of the user's Drive.
 */
export async function signInToGoogleDrive(): Promise<DriveAuth> {
  const clientId = getClientId();
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'yume' });

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: SCOPES,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    // access_type=offline + prompt=consent gets us a refresh_token so daily
    // auto-backup can run silently without asking the user to sign in again.
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });

  await request.makeAuthUrlAsync(DISCOVERY);
  const result = await request.promptAsync(DISCOVERY);

  if (result.type !== 'success' || !result.params.code) {
    throw new Error('Google sign-in was cancelled or failed.');
  }

  const tokenResponse = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    DISCOVERY
  );

  if (tokenResponse.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokenResponse.refreshToken);
  }

  const auth: DriveAuth = {
    accessToken: tokenResponse.accessToken,
    expiresAt: Date.now() + (tokenResponse.expiresIn ?? 3600) * 1000,
  };
  cachedAuth = auth;
  return auth;
}

export async function isDriveLinked(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  return !!token;
}

/**
 * Revokes the refresh token with Google (so the grant actually ends on
 * Google's side, not just locally) before deleting it from SecureStore.
 * Revocation is best-effort — a network failure or an already-invalid token
 * shouldn't block clearing local state, since the user's intent ("unlink")
 * must still take effect either way.
 */
export async function unlinkGoogleDrive(): Promise<void> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (refreshToken) {
    try {
      await AuthSession.revokeAsync({ token: refreshToken }, DISCOVERY);
    } catch {
      // Best-effort — proceed to clear local state regardless.
    }
  }
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  cachedAuth = null;
}

/** Silently refreshes an access token from the stored refresh token, for background/auto backups. Returns null if never linked. */
export async function getAuthSilently(): Promise<DriveAuth | null> {
  const existing = getCachedAuth();
  if (existing) return existing;

  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  const clientId = getClientId();
  const tokenResponse = await AuthSession.refreshAsync({ clientId, refreshToken }, DISCOVERY);
  const auth: DriveAuth = {
    accessToken: tokenResponse.accessToken,
    expiresAt: Date.now() + (tokenResponse.expiresIn ?? 3600) * 1000,
  };
  cachedAuth = auth;
  return auth;
}

export function getCachedAuth(): DriveAuth | null {
  if (cachedAuth && cachedAuth.expiresAt > Date.now()) return cachedAuth;
  return null;
}

async function findOrCreateBackupFolder(accessToken: string): Promise<string> {
  const query = encodeURIComponent(
    `name = '${BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchJson = await searchRes.json();
  if (searchJson.files?.length > 0) return searchJson.files[0].id;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const createJson = await createRes.json();
  if (!createJson.id) throw new Error('Could not create the backup folder in Drive.');
  return createJson.id;
}

/** Uploads (or overwrites, if a file with the same name already exists) a JSON backup to the app's Drive folder. */
export async function uploadBackupToDrive(
  accessToken: string,
  filename: string,
  jsonContent: string
): Promise<void> {
  const folderId = await findOrCreateBackupFolder(accessToken);

  const query = encodeURIComponent(`name = '${filename}' and '${folderId}' in parents and trashed = false`);
  const existingRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const existingJson = await existingRes.json();
  const existingId: string | undefined = existingJson.files?.[0]?.id;

  const metadata = existingId ? {} : { name: filename, parents: [folderId] };
  const boundary = 'flynse-backup-boundary';
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${jsonContent}\r\n` +
    `--${boundary}--`;

  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

  const res = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive upload failed: ${errText}`);
  }
}

export async function downloadLatestBackupFromDrive(accessToken: string): Promise<string | null> {
  const folderId = await findOrCreateBackupFolder(accessToken);
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false and name contains '.json'`);
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&pageSize=1&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listJson = await listRes.json();
  const fileId: string | undefined = listJson.files?.[0]?.id;
  if (!fileId) return null;

  const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return downloadRes.text();
}

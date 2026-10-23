import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { withoutRelock } from '@/lib/appLock';

/**
 * Writes `content` to a temporary file, opens the Android share sheet on it, then deletes it. An export is
 * the whole of someone's finances in plain text, and shouldn't be left in the app's storage once shared.
 */
export async function shareTempFile(
  name: string,
  content: string | Uint8Array,
  options: { mimeType: string; dialogTitle?: string }
): Promise<void> {
  // The cache, not documents: if the app is killed mid-share, Android clears it rather than keeping it forever.
  const file = new File(Paths.cache, name);
  try {
    if (file.exists) file.delete();
    file.create();
    await file.write(content);
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

// shortcut: Math.random, not a secure source (Hermes has no crypto.randomUUID and expo-crypto is not installed). These ids only
// name local rows, 122 random bits make a clash vanishingly rare; use a secure source if an id ever guards access.
// Lightweight UUID v4 — avoids pulling in the full uuid package + crypto polyfills.
export function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

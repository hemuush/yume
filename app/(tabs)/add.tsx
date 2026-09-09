// Exists only so the tab bar's center "+" slot has a route to point at —
// app/(tabs)/_layout.tsx intercepts its tabPress and pushes /quick-add
// instead, so this screen is never actually reached in normal use.
export default function AddTabPlaceholder() {
  return null;
}

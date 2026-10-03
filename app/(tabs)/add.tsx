// Exists only so the tab bar's center "+" slot has a route; _layout.tsx intercepts its tabPress and pushes
// /add-transaction, so this screen is never reached in normal use.
export default function AddTabPlaceholder() {
  return null;
}

import { Redirect } from 'expo-router';

// Exists only so the tab bar's center "+" slot has a route; _layout.tsx intercepts its tabPress and pushes
// /add-transaction. A link straight to /add lands here, so it goes on to the Add screen rather than a blank tab.
export default function AddTabPlaceholder() {
  return <Redirect href="/add-transaction" />;
}

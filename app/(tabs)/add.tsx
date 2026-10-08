import { Redirect } from 'expo-router';

// Kept so old links to /add still resolve; the tab bar's own + button (PillTabBar) pushes /add-transaction.
// A link straight to /add lands here, so it goes on to the Add screen rather than a blank tab.
export default function AddTabPlaceholder() {
  return <Redirect href="/add-transaction" />;
}

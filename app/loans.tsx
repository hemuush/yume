import { Redirect, useLocalSearchParams } from 'expo-router';

/** Keep existing links opening the same item inside Plan. */
export default function LoanRedirect() {
  const { loan, pay } = useLocalSearchParams<{ loan?: string; pay?: string }>();
  return <Redirect href={{ pathname: '/(tabs)/plan', params: { tab: 'debt', loan, pay } }} />;
}

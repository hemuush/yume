import { Redirect, useLocalSearchParams } from 'expo-router';

/** Keep existing links opening the same item inside Plan. */
export default function GoalsRedirect() {
  const { goal, add } = useLocalSearchParams<{ goal?: string; add?: string }>();
  return (
    <Redirect
      href={{ pathname: '/(tabs)/plan', params: { tab: 'money', collection: 'goals', goal, goalAdd: add } }}
    />
  );
}

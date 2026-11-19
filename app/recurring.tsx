import { Redirect } from 'expo-router';

/** Keep existing widget, notification and profile links opening the schedule in Plan. */
export default function RecurringRedirect() {
  return <Redirect href={{ pathname: '/(tabs)/plan', params: { tab: 'upcoming', upcoming: 'recurring' } }} />;
}

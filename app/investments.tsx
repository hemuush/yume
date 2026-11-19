import { Redirect } from 'expo-router';

export default function InvestmentsRedirect() {
  return (
    <Redirect href={{ pathname: '/(tabs)/plan', params: { tab: 'money', collection: 'investments' } }} />
  );
}

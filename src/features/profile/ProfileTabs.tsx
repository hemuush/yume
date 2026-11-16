import { UnderlineTabs } from '@/components/UnderlineTabs';

export type ProfileTab = 'you' | 'settings';
const TABS: { label: string; value: ProfileTab }[] = [
  { label: 'You', value: 'you' },
  { label: 'Settings', value: 'settings' },
];

/** You | Settings as two plain tabs on one hairline: the picked one in ink with an underline. */
export function ProfileTabs({ value, onChange }: { value: ProfileTab; onChange: (tab: ProfileTab) => void }) {
  return <UnderlineTabs options={TABS} value={value} onChange={onChange} />;
}

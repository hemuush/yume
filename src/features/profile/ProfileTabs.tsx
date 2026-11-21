import { View } from 'react-native';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SCREEN } from '@/components/screenStyles';

export type ProfileTab = 'you' | 'settings';
const TABS: { label: string; value: ProfileTab }[] = [
  { label: 'You', value: 'you' },
  { label: 'Settings', value: 'settings' },
];

/** You | Settings as the app's pill switch: one pill glides to the tapped side. */
export function ProfileTabs({ value, onChange }: { value: ProfileTab; onChange: (tab: ProfileTab) => void }) {
  return (
    <View style={{ marginHorizontal: SCREEN.gutter, marginTop: 12, marginBottom: 4 }}>
      <SegmentedControl options={TABS} value={value} onChange={onChange} />
    </View>
  );
}

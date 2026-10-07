import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUserName, setUserName, getMemberSinceYear } from '@/db/settings';
import { HeaderPrivacyToggle } from '@/components/AppHeader';
import { SkyHeader } from '@/features/home/SkyHeader';
import { AmountPadDock } from '@/components/AmountField';
import { SegmentedControl } from '@/components/SegmentedControl';
import { theme } from '@/constants/theme';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { Skeleton } from '@/components/Skeleton';
import { styles } from '@/features/profile/profile.styles';
import { YouSection } from '@/features/profile/YouSection';
import { SettingsSection } from '@/features/profile/SettingsSection';
import { ProfileIdentity } from '@/features/profile/ProfileIdentity';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';

type ProfileTab = 'you' | 'settings';
const TABS: { label: string; value: ProfileTab }[] = [
  { label: 'You', value: 'you' },
  { label: 'Settings', value: 'settings' },
];

/**
 * Identity card (theme-tinted: avatar, name, member since) plus a "You"/"Settings" segment, the shared
 * shell for YouSection and SettingsSection; Settings has no route of its own (nothing else linked to it).
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [memberSince, setMemberSince] = useState<number | null>(null);
  const [tab, setTab] = useState<ProfileTab>('you');

  const loadIdentity = useCallback(async () => {
    const [userName, since] = await Promise.all([getUserName(), getMemberSinceYear()]);
    setName(userName);
    setMemberSince(since);
  }, []);
  const { loaded, loadError } = useScreenLoad(loadIdentity);

  const saveName = async () => {
    try {
      await setUserName(draft);
      setName(draft.trim() || null);
      setEditing(false);
    } catch (e) {
      showAlert("Couldn't save name", errorMessage(e));
    }
  };

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <SkyHeader title="Profile" showBack hideUser />
        <View style={styles.identity}>
          <Skeleton width={58} height={58} circle radius={29} />
          <View style={styles.identityText}>
            <Skeleton width={130} height={16} radius={5} />
            <Skeleton width={100} height={11} radius={4} style={{ marginTop: 8 }} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AmountPadDock>
        {(scrollProps) => (
          <>
            <SkyHeader title="Profile" showBack hideUser actions={<HeaderPrivacyToggle />} />

            <KeyboardAwareScrollView
              {...scrollProps}
              contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}
              keyboardShouldPersistTaps="handled"
              bottomOffset={20}
            >
              {loadError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorTitle}>Couldn't load your data</Text>
                  <Text style={styles.errorDetail}>{loadError}</Text>
                </View>
              )}

              <ProfileIdentity
                name={name}
                memberSince={memberSince}
                editing={editing}
                draft={draft}
                onDraftChange={setDraft}
                onStartEdit={() => {
                  setDraft(name ?? '');
                  setEditing(true);
                }}
                onSave={saveName}
              />

              <View style={styles.tabWrap}>
                <SegmentedControl options={TABS} value={tab} onChange={setTab} />
              </View>

              {tab === 'you' ? <YouSection /> : <SettingsSection />}
            </KeyboardAwareScrollView>
          </>
        )}
      </AmountPadDock>
    </View>
  );
}

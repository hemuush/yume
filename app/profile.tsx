import { ScreenLoadError } from '@/components/ScreenLoadError';
import { Appear } from '@/components/Appear';
import { LoadFade } from '@/components/LoadFade';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View, Keyboard } from 'react-native';
import { Text } from '@/components/Text';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUserName, setUserName, getMemberSinceYear } from '@/db/settings';
import { HeaderPrivacyToggle } from '@/components/AppHeader';
import { SkyHeader } from '@/features/home/SkyHeader';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { AmountPadDock } from '@/components/AmountField';
import { ProfileTabs, type ProfileTab } from '@/features/profile/ProfileTabs';
import { theme } from '@/constants/theme';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { Skeleton } from '@/components/Skeleton';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { useAccent } from '@/theme/AccentContext';
import { styles } from '@/features/profile/profile.styles';
import { YouSection } from '@/features/profile/YouSection';
import { SettingsSection } from '@/features/profile/SettingsSection';
import { ProfileIdentity } from '@/features/profile/ProfileIdentity';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';
import { useSaveOnce } from '@/lib/useSaveOnce';

/**
 * Personal card with inline name editing plus a "You"/"Settings" segment, the shared
 * shell for YouSection and SettingsSection; Settings has no route of its own (nothing else linked to it).
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { accent, secondary } = useAccent();
  // The header sits over the page and shrinks as it scrolls; the amount pad's scroll tracking feeds it.
  const { collapse, headerHeight, onJsScroll, onJsScrollEnd } = useCollapsingHeader();
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [draft, setDraft] = useState('');
  const [memberSince, setMemberSince] = useState<number | null>(null);
  const [tab, setTab] = useState<ProfileTab>('you');
  const { tab: requestedTab } = useLocalSearchParams<{ tab?: string }>();
  useEffect(() => {
    if (requestedTab === 'settings' || requestedTab === 'you') setTab(requestedTab);
  }, [requestedTab]);

  const loadIdentity = useCallback(async () => {
    const [userName, since] = await Promise.all([getUserName(), getMemberSinceYear()]);
    setName(userName);
    setMemberSince(since);
  }, []);
  const { loaded, hasData, loadError, reload } = useScreenLoad(loadIdentity);

  const saveName = useSaveOnce(async () => {
    setSavingName(true);
    try {
      await setUserName(draft);
      setName(draft.trim() || null);
      setEditing(false);
      Keyboard.dismiss();
    } catch (e) {
      showAlert('Couldn’t save name', errorMessage(e));
    } finally {
      setSavingName(false);
    }
  });

  if (!hasData && loadError)
    return <ScreenLoadError title="Profile" message={loadError} onRetry={() => void reload()} />;

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} plain />
        <SkyHeader title="Profile" showBack hideUser wallpaper />
        {/* The identity line’s shape while it loads. */}
        <View style={styles.skeletonIdentity}>
          <Skeleton width={36} height={36} radius={12} />
          <View style={styles.skeletonText}>
            <Skeleton width={110} height={14} radius={5} />
            <Skeleton width={150} height={10} radius={4} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} plain />
      <AmountPadDock>
        {(scrollProps) => (
          <>
            <KeyboardAwareScrollView
              {...scrollProps}
              onScroll={(e) => {
                scrollProps.onScroll(e);
                onJsScroll(e.nativeEvent.contentOffset.y);
              }}
              onScrollEndDrag={onJsScrollEnd}
              onMomentumScrollEnd={onJsScrollEnd}
              contentContainerStyle={{
                paddingTop: headerHeight,
                paddingBottom: theme.layout.screenScrollPad + insets.bottom,
              }}
              keyboardShouldPersistTaps="handled"
              bottomOffset={20}
            >
              <LoadFade loaded>
                {loadError && (
                  <Appear style={styles.errorBanner}>
                    <Text style={styles.errorTitle}>Couldn’t load your data</Text>
                    <Text style={styles.errorDetail}>{loadError}</Text>
                    <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void reload()} />
                  </Appear>
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
                  saving={savingName}
                  onCancel={() => {
                    setEditing(false);
                    Keyboard.dismiss();
                  }}
                />

                <ProfileTabs value={tab} onChange={setTab} />

                {tab === 'you' ? <YouSection /> : <SettingsSection />}
              </LoadFade>
            </KeyboardAwareScrollView>
            <SkyHeader
              title="Profile"
              showBack
              hideUser
              wallpaper
              collapse={collapse}
              actions={<HeaderPrivacyToggle />}
            />
          </>
        )}
      </AmountPadDock>
    </View>
  );
}

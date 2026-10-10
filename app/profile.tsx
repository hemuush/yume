import { ScreenLoadError } from '@/components/ScreenLoadError';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUserName, setUserName, getMemberSinceYear } from '@/db/settings';
import { HeaderPrivacyToggle } from '@/components/AppHeader';
import { SkyHeader } from '@/features/home/SkyHeader';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { AmountPadDock } from '@/components/AmountField';
import { SegmentedControl } from '@/components/SegmentedControl';
import { theme } from '@/constants/theme';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { Skeleton } from '@/components/Skeleton';
import { Glass } from '@/components/Glass';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { useAccent } from '@/theme/AccentContext';
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
  const { accent, secondary } = useAccent();
  // The header sits over the page and shrinks as it scrolls; the amount pad's scroll tracking feeds it.
  const { collapse, headerHeight, onJsScroll, settleJs } = useCollapsingHeader();
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
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

  const saveName = async () => {
    try {
      await setUserName(draft);
      setName(draft.trim() || null);
      setEditing(false);
    } catch (e) {
      showAlert("Couldn't save name", errorMessage(e));
    }
  };

  if (!hasData && loadError)
    return <ScreenLoadError title="Profile" message={loadError} onRetry={() => void reload()} />;

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} />
        <SkyHeader title="Profile" showBack hideUser wallpaper />
        {/* The identity card's shape while it loads. */}
        <Glass radius={28} tone="strong" style={styles.skeletonCard}>
          <View style={styles.identity}>
            <Skeleton width={58} height={58} circle radius={29} />
            <View style={styles.identityText}>
              <Skeleton width={130} height={16} radius={5} />
              <Skeleton width={100} height={11} radius={4} style={{ marginTop: 8 }} />
            </View>
          </View>
        </Glass>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
      <AmountPadDock>
        {(scrollProps) => (
          <>
            <KeyboardAwareScrollView
              {...scrollProps}
              onScroll={(e) => {
                scrollProps.onScroll(e);
                onJsScroll(e.nativeEvent.contentOffset.y);
              }}
              // A slow release settles the header open or closed; a fling carries on and settles at its end.
              onScrollEndDrag={(e) => {
                if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.2)
                  settleJs(e.nativeEvent.contentOffset.y, (y) =>
                    scrollProps.ref.current?.scrollTo({ y, animated: true })
                  );
              }}
              onMomentumScrollEnd={(e) =>
                settleJs(e.nativeEvent.contentOffset.y, (y) =>
                  scrollProps.ref.current?.scrollTo({ y, animated: true })
                )
              }
              contentContainerStyle={{
                paddingTop: headerHeight,
                paddingBottom: theme.layout.screenScrollPad + insets.bottom,
              }}
              keyboardShouldPersistTaps="handled"
              bottomOffset={20}
            >
              {loadError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorTitle}>Couldn't load your data</Text>
                  <Text style={styles.errorDetail}>{loadError}</Text>
                  <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void reload()} />
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
                <SegmentedControl options={TABS} value={tab} onChange={setTab} onBand />
              </View>

              {tab === 'you' ? <YouSection /> : <SettingsSection />}
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

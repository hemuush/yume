import { useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUserName, setUserName, getMemberSinceYear } from '@/db/settings';
import { AppHeader, HeaderPrivacyToggle } from '@/components/AppHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { Skeleton } from '@/components/Skeleton';
import { styles } from '@/features/profile/profile.styles';
import { YouSection } from '@/features/profile/YouSection';
import { SettingsSection } from '@/features/profile/SettingsSection';

type ProfileTab = 'you' | 'settings';
const TABS: { label: string; value: ProfileTab }[] = [
  { label: 'You', value: 'you' },
  { label: 'Settings', value: 'settings' },
];

/**
 * Identity (avatar, name, member since) plus a "You"/"Settings" segment —
 * the same reachable-from-every-screen destination Profile always was, now
 * standing in for Settings too. `/settings` used to be one tap further in,
 * reached only from the card this segment replaces; nothing else in the
 * app linked to it, so retiring it as its own route was safe. See
 * YouSection (accounts, budgets, goals, recurring, net worth) and
 * SettingsSection (appearance, money, alerts, security, about) for the
 * actual content — this file is just the shared shell around both.
 */
export default function ProfileScreen() {
  const { accent, onAccent } = useAccent();
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
    } catch (e: any) {
      Alert.alert('Could not save name', String(e?.message ?? e));
    }
  };

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <AppHeader title="Profile" showBack hideUser />
        <View style={[styles.identity, { paddingTop: 20 }]}>
          <Skeleton width={76} height={76} circle radius={38} />
          <Skeleton width={130} height={16} radius={5} style={{ marginTop: 14 }} />
          <Skeleton width={100} height={11} radius={4} style={{ marginTop: 8 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Profile" showBack hideUser right={<HeaderPrivacyToggle />} />

      <KeyboardAwareScrollView
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

        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: accent }]}>
            <Text style={[styles.avatarInitial, { color: onAccent }]}>
              {(name?.trim().charAt(0) || 'Y').toUpperCase()}
            </Text>
          </View>

          {editing ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={draft}
                onChangeText={setDraft}
                placeholder="Your name"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={40}
                autoCapitalize="words"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveName}
              />
              <Pressable onPress={saveName} hitSlop={10} style={styles.nameSave}>
                <Feather name="check" size={18} color={theme.colors.ink} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.nameRow}
              onPress={() => {
                setDraft(name ?? '');
                setEditing(true);
              }}
            >
              <Text style={styles.name} numberOfLines={1}>
                {name || 'Add your name'}
              </Text>
              <Feather name="edit-2" size={14} color={theme.colors.textMuted} />
            </Pressable>
          )}

          <Text style={styles.memberSince}>Member since {memberSince ?? new Date().getFullYear()}</Text>
        </View>

        <View style={styles.tabWrap}>
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        </View>

        {tab === 'you' ? <YouSection /> : <SettingsSection />}
      </KeyboardAwareScrollView>
    </View>
  );
}

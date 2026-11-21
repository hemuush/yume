import { View, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { PANEL_ENTER } from '@/lib/animation';
import Feather from '@expo/vector-icons/Feather';
import { Text, TextInput } from '@/components/Text';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { SCREEN } from '@/components/screenStyles';
import { useAccent } from '@/theme/AccentContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import { styles } from './profile.styles';
import { themedStyles } from '@/theme/themedStyles';

interface Props {
  name: string | null;
  memberSince: number | null;
  editing: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}

/**
 * Profile's personal card, with an explicit edit action and an inline name form.
 */
export function ProfileIdentity({
  name,
  memberSince,
  editing,
  draft,
  onDraftChange,
  onStartEdit,
  onSave,
  onCancel,
  saving = false,
}: Props) {
  const { accent, onAccent } = useAccent();

  return (
    <View style={local.card}>
      <View style={local.row}>
        <View
          style={[local.avatar, { backgroundColor: accent }]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={name?.trim() ? `${name.trim()}’s avatar` : 'Your avatar'}
        >
          <Text style={[local.avatarInitial, { color: onAccent }]}>
            {(name?.trim().charAt(0) || 'Y').toUpperCase()}
          </Text>
        </View>
        <View style={local.text}>
          <Text style={local.name} numberOfLines={1}>
            {name || 'Add your name'}
          </Text>
          <Text style={local.sub}>{memberSince ? `Member since ${memberSince}` : 'On this device'}</Text>
        </View>
        {!editing && (
          <Pressable
            onPress={onStartEdit}
            accessibilityRole="button"
            accessibilityLabel={name ? 'Edit profile name' : 'Add your name'}
            hitSlop={4}
            style={withPressed(local.editPill)}
          >
            <Feather name="edit-2" size={14} color={theme.colors.textPrimary} />
            <Text style={local.editText}>{name ? 'Edit' : 'Add'}</Text>
          </Pressable>
        )}
      </View>
      {editing && (
        <Animated.View entering={PANEL_ENTER} style={local.editForm}>
          <Text style={local.inputLabel}>Your name</Text>
          <TextInput
            accessibilityLabel="Your name"
            style={styles.nameInput}
            value={draft}
            onChangeText={onDraftChange}
            placeholder="Your name"
            placeholderTextColor={theme.colors.textMuted}
            maxLength={40}
            autoCapitalize="words"
            autoFocus
            editable={!saving}
            returnKeyType="done"
            onSubmitEditing={onSave}
          />
          <View style={local.editActions}>
            <PrimaryButton
              title="Cancel"
              compact
              variant="secondary"
              onPress={onCancel}
              disabled={saving}
              style={local.editAction}
            />
            <PrimaryButton
              title="Save name"
              compact
              onPress={onSave}
              loading={saving}
              style={local.editAction}
            />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const local = themedStyles(() =>
  StyleSheet.create({
    // The identity as a card: a round avatar, the name large with the year under it, and a labelled Edit pill.
    card: {
      marginHorizontal: SCREEN.gutter,
      marginTop: 6,
      marginBottom: 6,
      padding: 14,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      backgroundColor: theme.colors.home.surface,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      // A circular View's background can render clipped to a stale layout on Android.
      overflow: 'hidden',
    },
    avatarInitial: { fontFamily: theme.font.roundedBold, fontSize: 24 },
    text: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 2 },
    name: { fontFamily: theme.font.bodyBold, fontSize: 20, color: theme.colors.textPrimary },
    sub: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted },
    editPill: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.home.control,
    },
    editText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
    editForm: { marginTop: 12, gap: 8 },
    inputLabel: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
    editActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    editAction: { flexGrow: 1, flexBasis: 110 },
  })
);

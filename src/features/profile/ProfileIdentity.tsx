import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text, TextInput } from '@/components/Text';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { SCREEN } from '@/components/screenStyles';
import { useAccent } from '@/theme/AccentContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import { styles } from './profile.styles';

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
          accessibilityLabel={name?.trim() ? `${name.trim()}'s avatar` : 'Your avatar'}
        >
          <Text style={[local.avatarInitial, { color: onAccent }]}>
            {(name?.trim().charAt(0) || 'Y').toUpperCase()}
          </Text>
        </View>
        <Pressable
          style={withPressed(local.text)}
          accessibilityRole="button"
          accessibilityLabel={name ? `${name}, your name` : 'Add your name'}
          accessibilityHint="Edit your name"
          onPress={onStartEdit}
          disabled={editing}
        >
          <Text style={local.name} numberOfLines={1}>
            {name || 'Add your name'}
          </Text>
          <Text style={local.sub}>
            Member since {memberSince ?? new Date().getFullYear()} · On this phone
          </Text>
        </Pressable>
        {!editing && (
          <Pressable
            onPress={onStartEdit}
            accessibilityRole="button"
            accessibilityLabel="Edit profile name"
            style={withPressed(local.editButton)}
          >
            <Feather name="edit-2" size={16} color={theme.colors.link} />
          </Pressable>
        )}
      </View>
      {editing && (
        <View style={local.editForm}>
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
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  // One slim line with no card: the avatar, the name with a line under it, and an edit button.
  card: { marginHorizontal: SCREEN.gutter, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // A circular View's background can render clipped to a stale layout on Android.
    overflow: 'hidden',
  },
  avatarInitial: { fontFamily: theme.font.roundedBold, fontSize: 16 },
  text: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  name: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  editButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  editForm: { marginTop: 4, gap: 8 },
  inputLabel: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  editActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editAction: { flexGrow: 1, flexBasis: 110 },
});

import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text, TextInput } from '@/components/Text';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { SCREEN } from '@/components/screenStyles';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { LinearGradient } from 'expo-linear-gradient';
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
      <LinearGradient
        pointerEvents="none"
        colors={[shade(accent, 92), theme.colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={local.topRow}>
        <Text style={local.kicker}>Your space</Text>
        {!editing && (
          <Pressable
            onPress={onStartEdit}
            accessibilityRole="button"
            accessibilityLabel="Edit profile name"
            style={withPressed(local.editButton)}
          >
            <Feather name="edit-2" size={13} color={theme.colors.ink} />
            <Text style={local.editText}>Edit</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.identityRow}>
        <View
          style={[styles.avatar, { backgroundColor: accent }]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={name?.trim() ? `${name.trim()}'s avatar` : 'Your avatar'}
        >
          <Text style={[styles.avatarInitial, { color: onAccent }]}>
            {(name?.trim().charAt(0) || 'Y').toUpperCase()}
          </Text>
        </View>

        <View style={styles.identityText}>
          <Pressable
            style={withPressed(styles.nameRow)}
            accessibilityRole="button"
            accessibilityLabel={name ? `${name}, your name` : 'Add your name'}
            accessibilityHint="Edit your name"
            onPress={onStartEdit}
            disabled={editing}
          >
            <Text style={styles.name}>{name || 'Add your name'}</Text>
          </Pressable>
          <Text style={local.chipText}>Member since {memberSince ?? new Date().getFullYear()}</Text>
        </View>
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
      <View style={local.privacyNote}>
        <Feather name="smartphone" size={13} color={theme.colors.textSecondary} />
        <Text style={local.chipText}>On this phone · works offline</Text>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  card: {
    marginHorizontal: SCREEN.gutter,
    marginTop: theme.layout.screenTopGap,
    padding: 16,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  kicker: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  editButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 22,
    backgroundColor: theme.colors.glass,
  },
  editText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textPrimary },
  privacyNote: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.inkHairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editForm: { marginTop: 16, gap: 8 },
  inputLabel: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  editActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editAction: { flexGrow: 1, flexBasis: 110 },
  chipText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});

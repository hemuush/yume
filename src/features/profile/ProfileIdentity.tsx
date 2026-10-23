import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text, TextInput } from '@/components/Text';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { SCREEN } from '@/components/screenStyles';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { styles } from './profile.styles';

interface Props {
  name: string | null;
  memberSince: number | null;
  editing: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
}

/**
 * Top of Profile on both tabs: a glass card on the wallpaper, the avatar in a ring of the theme's second
 * colour beside the name (tap to edit), member since, and a chip saying data stays on this phone.
 */
export function ProfileIdentity({
  name,
  memberSince,
  editing,
  draft,
  onDraftChange,
  onStartEdit,
  onSave,
}: Props) {
  const { accent, onAccent, secondary } = useAccent();

  return (
    <View style={local.card}>
      <View style={styles.identityRow}>
        <View style={[local.halo, { borderColor: shade(secondary, 55) }]}>
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
        </View>

        <View style={styles.identityText}>
          {editing ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={draft}
                onChangeText={onDraftChange}
                placeholder="Your name"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={40}
                autoCapitalize="words"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={onSave}
              />
              <Pressable
                onPress={onSave}
                hitSlop={10}
                style={withPressed(styles.nameSave)}
                accessibilityRole="button"
                accessibilityLabel="Save name"
              >
                <Feather name="check" size={18} color={theme.colors.ink} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={withPressed(styles.nameRow)}
              accessibilityRole="button"
              accessibilityLabel={name ? `${name}, your name` : 'Add your name'}
              accessibilityHint="Edit your name"
              onPress={onStartEdit}
            >
              <Text style={styles.name}>{name || 'Add your name'}</Text>
              <Feather name="edit-2" size={14} color={theme.colors.textMuted} />
            </Pressable>
          )}

          <View style={local.chip}>
            <Feather name="lock" size={11} color={theme.colors.textMuted} />
            <Text style={local.chipText}>
              Member since {memberSince ?? new Date().getFullYear()} · on this phone only
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  card: { marginHorizontal: SCREEN.gutter, marginTop: theme.layout.screenTopGap, paddingVertical: 6 },
  halo: { padding: 3, borderRadius: 32, borderWidth: 1 },
  chip: {
    marginTop: -2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
  },
  chipText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});

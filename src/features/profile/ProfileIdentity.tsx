import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text, TextInput } from '@/components/Text';
import { theme } from '@/constants/theme';
import { Glass, GLASS } from '@/components/Glass';
import { withPressed } from '@/lib/pressed';
import { SCREEN } from '@/components/screenStyles';
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
    <Glass radius={28} tone="strong" style={local.card}>
      <View style={styles.identityRow}>
        <View style={[local.halo, { borderColor: secondary }]}>
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
              <Text style={styles.name} numberOfLines={1}>
                {name || 'Add your name'}
              </Text>
              <Feather name="edit-2" size={14} color={theme.colors.textMuted} />
            </Pressable>
          )}

          <Text style={styles.memberSince}>Member since {memberSince ?? new Date().getFullYear()}</Text>
          <View style={local.chip}>
            <Feather name="lock" size={11} color={theme.colors.textSecondary} />
            <Text style={local.chipText}>On this phone only</Text>
          </View>
        </View>
      </View>
    </Glass>
  );
}

const local = StyleSheet.create({
  card: { marginHorizontal: SCREEN.gutter, marginTop: theme.layout.screenTopGap, padding: 16 },
  halo: { padding: 3, borderRadius: 35, borderWidth: 3 },
  chip: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontFamily: theme.font.bodyMedium, fontSize: 11.5, color: theme.colors.textSecondary },
});

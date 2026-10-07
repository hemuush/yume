import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text, TextInput } from '@/components/Text';
import { theme } from '@/constants/theme';
import { StripCard } from '@/components/StripCard';
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
 * Top of Profile on both tabs: a white card with a strip in the theme's colour, avatar beside the name (tap to
 * edit), and a chip saying data stays on this phone. The sky and hills are the header's, just above.
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
  const { accent, onAccent } = useAccent();

  return (
    <StripCard tone={accent} style={local.card}>
      <View style={local.body}>
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
          </View>
        </View>

        <View style={local.chip}>
          <Feather name="lock" size={11} color={theme.colors.textSecondary} />
          <Text style={local.chipText}>On this phone only</Text>
        </View>
      </View>
    </StripCard>
  );
}

const local = StyleSheet.create({
  card: { marginHorizontal: SCREEN.gutter, marginTop: 6 },
  body: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14, gap: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontFamily: theme.font.bodyMedium, fontSize: 11.5, color: theme.colors.textSecondary },
});

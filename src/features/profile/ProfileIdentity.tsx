import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import { Text, TextInput } from '@/components/Text';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { withPressed } from '@/lib/pressed';
import { HOME } from '@/components/homeStyles';
import { HeaderHills } from '@/features/home/HeaderHills';
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
 * Top of Profile on both tabs: a card tinted with the active theme, avatar beside the name (tap to edit),
 * and a chip saying data stays on this phone. The pack's hills run along the bottom edge, as on Home.
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
  const top = shade(accent, 88, 4);
  const bottom = shade(accent, 95, 3);

  return (
    <View style={local.card}>
      <LinearGradient colors={[top, bottom]} style={StyleSheet.absoluteFill} />
      <View style={local.body}>
        <View style={styles.identityRow}>
          <View style={[styles.avatar, { backgroundColor: accent }]}>
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
      <HeaderHills sky={bottom} primary={accent} secondary={secondary} ground={shade(accent, 97, 2)} />
    </View>
  );
}

const local = StyleSheet.create({
  card: {
    marginHorizontal: HOME.gutter,
    marginTop: 8,
    borderRadius: theme.radius.xl2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  body: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, gap: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontFamily: theme.font.bodyMedium, fontSize: 11.5, color: theme.colors.textSecondary },
});

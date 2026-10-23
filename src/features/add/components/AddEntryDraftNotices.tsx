import { View } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { styles } from '@/features/add/add.styles';
import type { AddEntryModel } from '@/features/add/types/addEntryModel';
import type { ReactElement } from 'react';

type Props = { model: Pick<AddEntryModel, 'recovery' | 'resumeDraft' | 'setError' | 'repeatWarning'> };
export function AddEntryDraftNotices({ model }: Props): ReactElement {
  const { recovery, resumeDraft, setError, repeatWarning } = model;

  return (
    <>
      {recovery.candidate && (
        <View style={styles.draftCard}>
          <Text style={styles.draftTitle}>Continue your unfinished entry?</Text>
          <Text style={styles.draftText}>
            Nothing in this draft has been recorded. Check its date and accounts before saving.
          </Text>
          <View style={styles.draftActions}>
            <PrimaryButton
              compact
              title="Resume draft"
              disabled={recovery.discarding}
              onPress={resumeDraft}
            />
            <PrimaryButton
              compact
              variant="secondary"
              title="Discard draft"
              loading={recovery.discarding}
              onPress={() =>
                void recovery
                  .discardCandidate()
                  .catch(() => setError('Couldn’t remove the draft. Try again.'))
              }
            />
          </View>
        </View>
      )}
      {recovery.error && (
        <Text style={{ marginHorizontal: 16, color: theme.colors.textSecondary }}>{recovery.error}</Text>
      )}
      {repeatWarning && (
        <View style={styles.repeatNote} accessibilityLiveRegion="polite">
          <Feather name="alert-triangle" size={14} color={theme.colors.idGoldDeep} />
          <Text style={styles.repeatNoteText}>{repeatWarning.message}</Text>
        </View>
      )}
    </>
  );
}

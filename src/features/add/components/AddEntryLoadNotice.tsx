import { View } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StripCard } from '@/components/StripCard';
import { styles } from '@/features/add/add.styles';
import type { AddEntryModel } from '@/features/add/types/addEntryModel';
import type { ReactElement } from 'react';

type Props = {
  model: Pick<AddEntryModel, 'formReady' | 'error' | 'retryLoad' | 'isLinked'>;
};
export function AddEntryLoadNotice({ model }: Props): ReactElement {
  const { formReady, error, retryLoad, isLinked } = model;

  return (
    <>
      {!formReady && (
        <View style={styles.section}>
          <Text style={styles.formHint}>{error ? 'The entry could not be loaded.' : 'Loading entry…'}</Text>
          {error && <PrimaryButton compact variant="secondary" title="Retry loading" onPress={retryLoad} />}
        </View>
      )}
      {isLinked && (
        <StripCard tone={theme.colors.slice.due} lifted={false} style={[styles.linkedNote, styles.noteCard]}>
          <Text style={styles.linkedText}>
            This entry is tied to a loan or a person&rsquo;s ledger — edit it from there.
          </Text>
        </StripCard>
      )}
    </>
  );
}

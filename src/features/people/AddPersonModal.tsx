import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { createPerson } from '@/db/people';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ModalSheet } from '@/components/ModalSheet';
import { modalFooterStyles as f } from '@/constants/theme';
import { styles } from './people.styles';
import { errorMessage } from '@/lib/errorMessage';

export function AddPersonModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Enter a name');
      return;
    }
    setSaving(true);
    try {
      await createPerson({ name: name.trim() });
      setName('');
      onCreated();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      variant="center"
      title="New person"
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton title={saving ? 'Saving…' : 'Add person'} onPress={submit} disabled={saving} />
        </View>
      }
    >
      <FormInput label="Name" value={name} onChangeText={setName} placeholder="e.g. Roommate" />
    </ModalSheet>
  );
}

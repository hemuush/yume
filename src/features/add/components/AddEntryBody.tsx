import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { StagedList } from '@/features/add/AddSections';
import { AddEntryAmount, AMOUNT_KEYS } from '@/features/add/components/AddEntryAmount';
import { AddEntryDraftNotices, DRAFT_NOTICES_KEYS } from '@/features/add/components/AddEntryDraftNotices';
import { AddEntryFields, FIELDS_KEYS } from '@/features/add/components/AddEntryFields';
import { AddEntryLoadNotice, LOAD_NOTICE_KEYS } from '@/features/add/components/AddEntryLoadNotice';
import { memoByModelKeys } from '@/features/add/utils/memoByModelKeys';
import type { AddEntryModel } from '@/features/add/types/addEntryModel';
import type { ReactElement } from 'react';

// Each section is drawn again only when a field of the model it reads changes.
const LoadNotice = memoByModelKeys(AddEntryLoadNotice, LOAD_NOTICE_KEYS);
const Amount = memoByModelKeys(AddEntryAmount, AMOUNT_KEYS);
const DraftNotices = memoByModelKeys(AddEntryDraftNotices, DRAFT_NOTICES_KEYS);
const Fields = memoByModelKeys(AddEntryFields, FIELDS_KEYS);

type Props = { model: AddEntryModel };
export function AddEntryBody({ model }: Props): ReactElement {
  const { formBusy, footerHeight, rows, accounts, listFade, removeRow } = model;

  return (
    <KeyboardAwareScrollView
      pointerEvents={formBusy ? 'none' : 'auto'}
      accessibilityElementsHidden={formBusy}
      importantForAccessibility={formBusy ? 'no-hide-descendants' : 'auto'}
      contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 28 }}
      keyboardShouldPersistTaps="handled"
      // Clears the sticky footer that rides on the keyboard, not just the keyboard: a focused field (the
      // category search) would otherwise sit right behind Save.
      bottomOffset={footerHeight + 12}
    >
      <LoadNotice model={model} />
      <Amount model={model} />
      <DraftNotices model={model} />
      <Fields model={model} />
      {rows.length > 0 && (
        <StagedList rows={rows} accounts={accounts} fadeStyle={listFade} onRemove={removeRow} />
      )}
    </KeyboardAwareScrollView>
  );
}

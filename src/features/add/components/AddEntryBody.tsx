import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { StagedList } from '@/features/add/AddSections';
import { AddEntryAmount } from '@/features/add/components/AddEntryAmount';
import { AddEntryDraftNotices } from '@/features/add/components/AddEntryDraftNotices';
import { AddEntryFields } from '@/features/add/components/AddEntryFields';
import { AddEntryLoadNotice } from '@/features/add/components/AddEntryLoadNotice';
import type { AddEntryModel } from '@/features/add/types/addEntryModel';
import type { ReactElement } from 'react';

type Props = { model: AddEntryModel };
export function AddEntryBody({ model }: Props): ReactElement {
  const { formBusy, footerHeight, rows, totals, listFade, removeRow } = model;

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
      <AddEntryLoadNotice model={model} />
      <AddEntryAmount model={model} />
      <AddEntryDraftNotices model={model} />
      <AddEntryFields model={model} />
      {rows.length > 0 && (
        <StagedList
          rows={rows}
          netMinor={totals.income - totals.expense}
          fadeStyle={listFade}
          onRemove={removeRow}
        />
      )}
    </KeyboardAwareScrollView>
  );
}

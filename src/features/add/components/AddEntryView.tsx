import { View } from 'react-native';
import { styles } from '@/features/add/add.styles';
import { AddEntryBody } from '@/features/add/components/AddEntryBody';
import { AddEntryFooter, FOOTER_KEYS } from '@/features/add/components/AddEntryFooter';
import { AddEntryHeader, HEADER_KEYS } from '@/features/add/components/AddEntryHeader';
import { AddEntrySheets, SHEETS_KEYS } from '@/features/add/components/AddEntrySheets';
import { memoByModelKeys } from '@/features/add/utils/memoByModelKeys';
import type { AddEntryModel } from '@/features/add/types/addEntryModel';
import type { ReactElement } from 'react';

// Each section is drawn again only when a field of the model it reads changes: a digit typed on the pad redraws the amount
// and the Save button, not the header, the category grid and the sheets.
const Header = memoByModelKeys(AddEntryHeader, HEADER_KEYS);
const Footer = memoByModelKeys(AddEntryFooter, FOOTER_KEYS);
const Sheets = memoByModelKeys(AddEntrySheets, SHEETS_KEYS);

type Props = { model: AddEntryModel };
export function AddEntryView({ model }: Props): ReactElement {
  return (
    <View style={styles.container}>
      <Header model={model} />
      <AddEntryBody model={model} />
      <Footer model={model} />
      <Sheets model={model} />
    </View>
  );
}

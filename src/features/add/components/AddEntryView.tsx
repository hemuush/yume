import { View } from 'react-native';
import { styles } from '@/features/add/add.styles';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { AddEntryBody } from '@/features/add/components/AddEntryBody';
import { AddEntryFooter } from '@/features/add/components/AddEntryFooter';
import { AddEntryHeader } from '@/features/add/components/AddEntryHeader';
import { AddEntrySheets } from '@/features/add/components/AddEntrySheets';
import type { AddEntryModel } from '@/features/add/types/addEntryModel';
import type { ReactElement } from 'react';

type Props = { model: AddEntryModel };
export function AddEntryView({ model }: Props): ReactElement {
  const { accent, secondary } = model;

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} plain />
      <AddEntryHeader model={model} />
      <AddEntryBody model={model} />
      <AddEntryFooter model={model} />
      <AddEntrySheets model={model} />
    </View>
  );
}

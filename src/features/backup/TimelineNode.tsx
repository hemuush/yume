import { View } from 'react-native';
import { screenStyles as h } from '@/components/screenStyles';
import { styles } from './backup.styles';

/** One stop on the restore-points timeline: a dot and a rail beside a row. */
export function TimelineNode({
  first,
  last,
  latest,
  copy,
  children,
}: {
  first?: boolean;
  last?: boolean;
  latest?: boolean;
  copy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.node, copy && styles.nodeCopy]}>
      {!(first && last) && (
        <View style={[styles.rail, { top: first ? '50%' : 0, bottom: last ? '50%' : 0 }]} />
      )}
      <View style={[styles.dot, latest && styles.dotLatest, copy && styles.dotCopy]} />
      <View style={h.row}>{children}</View>
    </View>
  );
}

import { useCallback, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listPeople, PersonWithBalance } from '@/db/people';
import { theme, FLAT_PALETTE } from '@/constants/theme';
import { stableIndexFromId } from '@/lib/color';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { AppHeader } from '@/components/AppHeader';
import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { NeoTile } from '@/components/NeoTile';
import { OwedSummary } from '@/components/OwedSummary';
import { Skeleton } from '@/components/Skeleton';
import { peopleTotals } from '@/features/people/people.helpers';
import { PersonRow } from '@/features/people/PersonRow';
import { AddPersonModal } from '@/features/people/AddPersonModal';
import { PersonDetailModal } from '@/features/people/PersonDetailModal';
import { styles } from '@/features/people/people.styles';

/**
 * Friends & Family: informal, interest-free IOUs. Reached from the Plan tab's
 * own tile; formal loans with a schedule live on the Loans screen.
 */
export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const [people, setPeople] = useState<PersonWithBalance[]>([]);
  const [addVisible, setAddVisible] = useState(false);
  const [selected, setSelected] = useState<PersonWithBalance | null>(null);

  const loadPeople = useCallback(async () => {
    setPeople(await listPeople());
  }, []);
  const { loaded, loadError, reload } = useScreenLoad(loadPeople);
  const loading = !loaded && !loadError;
  const { owedToYouMinor, youOweMinor } = peopleTotals(people);

  return (
    <View style={styles.container}>
      <AppHeader
        title="Friends & Family"
        showBack
        right={<AddButton onPress={() => setAddVisible(true)} label="+ Person" />}
      />

      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Couldn&rsquo;t load Friends &amp; Family</Text>
          <Text style={styles.errorDetail}>{loadError}</Text>
        </View>
      )}

      <OwedSummary youOweMinor={youOweMinor} owedToYouMinor={owedToYouMinor} loading={loading} />

      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        {loading ? (
          [0, 1].map((i) => (
            <NeoTile key={i} style={[styles.card, styles.skeletonCard]}>
              <Skeleton width={38} height={38} circle radius={19} />
              <View>
                <Skeleton width={120} height={13} radius={4} />
                <Skeleton width={60} height={10} radius={4} style={{ marginTop: 8 }} />
              </View>
            </NeoTile>
          ))
        ) : people.length === 0 ? (
          <EmptyState title="No one here yet" subtitle="Tap + Person to add a friend or family member." />
        ) : (
          people.map((p, i) => (
            <PersonRow
              key={p.id}
              person={p}
              // Hashed from the person's own id, not list position, so a
              // rename or a new person never swaps anyone's colour.
              color={FLAT_PALETTE[stableIndexFromId(p.id, FLAT_PALETTE.length)]}
              index={i}
              onPress={() => setSelected(p)}
            />
          ))
        )}
      </ScrollView>

      <AddPersonModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onCreated={async () => {
          setAddVisible(false);
          await reload();
        }}
      />

      {selected && (
        <PersonDetailModal person={selected} onClose={() => setSelected(null)} onChanged={reload} />
      )}
    </View>
  );
}

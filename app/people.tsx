import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listPeople, PersonWithBalance } from '@/db/people';
import { theme, FLAT_PALETTE } from '@/constants/theme';
import { stableIndexFromId } from '@/lib/color';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { formatMoney } from '@/lib/money';
import { groupPeople, inRows, showPeopleSummary } from '@/features/people/people.helpers';
import { PeopleNet } from '@/features/people/PeopleNet';
import { PersonQuietRow } from '@/features/people/PersonQuietRow';
import { PersonTile } from '@/features/people/PersonTile';
import { AddPersonModal } from '@/features/people/AddPersonModal';
import { PersonDetailModal } from '@/features/people/PersonDetailModal';
import { styles } from '@/features/people/people.styles';

/**
 * Friends & Family: informal, interest-free IOUs. Reached from the Plan tab's
 * own tile; formal loans with a schedule live on the Loans screen.
 */
export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const [people, setPeople] = useState<PersonWithBalance[]>([]);
  const [addVisible, setAddVisible] = useState(false);
  const [selected, setSelected] = useState<PersonWithBalance | null>(null);

  const loadPeople = useCallback(async () => {
    setPeople(await listPeople());
  }, []);
  const { loaded, loadError, reload } = useScreenLoad(loadPeople);
  const loading = !loaded && !loadError;
  const { owed, owe, settled, owedToYouMinor, youOweMinor, netMinor } = groupPeople(people);
  const summary = showPeopleSummary(owed.length + owe.length);
  const columns = summary ? 2 : 1;
  // Hashed from the person's own id, not list position, so a rename or a new
  // person never swaps anyone's colour.
  const colorOf = (p: PersonWithBalance) => FLAT_PALETTE[stableIndexFromId(p.id, FLAT_PALETTE.length)];

  return (
    <View style={styles.container}>
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}

        contentContainerStyle={{
          paddingTop: headerHeight + theme.layout.screenTopGap,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn&rsquo;t load Friends &amp; family</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}
        {loading ? (
          <View style={styles.tileRow}>
            {[0, 1].map((i) => (
              <View key={i} style={[styles.tileCell, styles.personTile, styles.skeletonTile]}>
                <Skeleton width={32} height={32} circle radius={16} />
                <Skeleton width={80} height={18} radius={5} style={{ marginTop: 12 }} />
                <Skeleton width={60} height={10} radius={4} style={{ marginTop: 8 }} />
              </View>
            ))}
          </View>
        ) : people.length === 0 ? (
          <EmptyState title="No one here yet" subtitle="Tap + Person to add a friend or family member." />
        ) : (
          <>
            {[
              {
                key: 'owed',
                title: 'Owes you',
                list: owed,
                totalMinor: owedToYouMinor,
                color: theme.colors.incomeText,
              },
              {
                key: 'owe',
                title: 'You owe',
                list: owe,
                totalMinor: youOweMinor,
                color: theme.colors.expenseText,
              },
            ].map(
              (group) =>
                group.list.length > 0 && (
                  <View key={group.key}>
                    {summary && (
                      <View style={styles.groupHead}>
                        <Text style={styles.groupTitle}>{group.title}</Text>
                        <Text style={[styles.groupTotal, { color: group.color }]}>
                          {formatMoney(group.totalMinor)}
                        </Text>
                      </View>
                    )}
                    {inRows(group.list, columns).map((row, r) => (
                      <View key={row[0].id} style={styles.tileRow}>
                        {row.map((p, c) => (
                          <PersonTile
                            key={p.id}
                            person={p}
                            color={colorOf(p)}
                            index={r * columns + c}
                            onPress={() => setSelected(p)}
                          />
                        ))}
                        {row.length < columns && <View style={styles.tileCell} />}
                      </View>
                    ))}
                  </View>
                )
            )}
            {settled.length > 0 && (
              <>
                <Text style={styles.settledTitle}>Settled</Text>
                <View style={styles.settledCard}>
                  {settled.map((p, i) => (
                    <PersonQuietRow
                      key={p.id}
                      person={p}
                      color={colorOf(p)}
                      divider={i > 0}
                      onPress={() => setSelected(p)}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        collapse={collapse}
        summary={
          summary ? (
            <HeaderSummary
              figure={`${netMinor > 0 ? '+' : netMinor < 0 ? '−' : ''}${formatMoney(Math.abs(netMinor))}`}
              rest="net"
              dot={netMinor < 0 ? theme.colors.slice.spent : theme.colors.slice.saved}
            />
          ) : undefined
        }
        title="Friends & family"
        showBack
        hideUser
        actions={<AddButton onPress={() => setAddVisible(true)} label="+ Person" />}
      >
        {!loading && summary && <PeopleNet netMinor={netMinor} />}
      </SkyHeader>

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

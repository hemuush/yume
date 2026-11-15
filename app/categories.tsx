import { Appear } from '@/components/Appear';
import { CONTENT_ENTER } from '@/lib/animation';
import { ScreenLoadError } from '@/components/ScreenLoadError';
import { PrimaryButton } from '@/components/PrimaryButton';
import { memo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryKind } from '@/types';
import { theme } from '@/constants/theme';
import { HeaderIconButton } from '@/components/AppHeader';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { AddButton } from '@/components/AddButton';
import { styles } from '@/features/categories/categories.styles';
import { CategorySection, MemoCategoryTile, TileRows } from '@/features/categories/CategorySection';
import { CategoriesSheets } from '@/features/categories/CategoriesSheets';
import { createCategoriesSheets } from '@/features/categories/categoriesSheetsStore';
import { useCategoriesData } from '@/features/categories/useCategoriesData';
import { useCategoryActions } from '@/features/categories/useCategoryActions';
import { Skeleton } from '@/components/Skeleton';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { useAccent } from '@/theme/AccentContext';
import { SCREEN } from '@/components/screenStyles';
import { SheetTabs } from '@/components/SheetTabs';
import { topLevelOnly } from '@/lib/categoryTree';

// The tiles are drawn again only when their categories change, not for a sheet opening or a tab's panel.
const Section = memo(CategorySection);

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const { accent, secondary } = useAccent();
  // Which sheet is open lives outside React state: opening or closing one does not redraw the tiles behind it.
  const [sheets] = useState(createCategoriesSheets);
  const [showArchived, setShowArchived] = useState(false);
  const [kind, setKind] = useState<CategoryKind>('expense');
  const {
    allCategories,
    active: categories,
    archived: archivedCategories,
    expense: expenseCats,
    income: incomeCats,
    loaded,
    hasData,
    loadError,
    reload: load,
  } = useCategoriesData();
  const { onUnarchive, onArchive, onDelete, onManage, onManageArchived } = useCategoryActions({
    sheets,
    allCategories,
    reload: load,
  });

  const visibleCategories = kind === 'expense' ? expenseCats : incomeCats;
  const parentCount = topLevelOnly(visibleCategories).length;
  const subcategoryCount = visibleCategories.length - parentCount;

  if (!hasData && loadError)
    return <ScreenLoadError title="Categories" message={loadError} onRetry={() => void load()} />;

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} plain />
        <SkyHeader title="Categories" showBack hideUser wallpaper />
        <View style={{ paddingTop: 20 }}>
          <Skeleton
            width={100}
            height={13}
            radius={4}
            style={{ marginHorizontal: SCREEN.gutter, marginBottom: 14 }}
          />
          <View style={styles.grid}>
            {[0, 1].map((row) => (
              <View key={row} style={styles.gridRow}>
                {Array.from({ length: 3 }, (_, i) => (
                  <View key={i} style={[styles.cell, styles.tile]}>
                    <Skeleton width={50} height={50} circle radius={16} />
                    <Skeleton width={48} height={9} radius={4} style={{ marginTop: 6 }} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} plain />
      <ReanimatedAnimated.ScrollView
        // The data arriving after the placeholders: one short fade, the header and wallpaper stay solid.
        entering={CONTENT_ENTER}
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        {loadError && (
          <Appear style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn’t load your categories</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
            <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void load()} />
          </Appear>
        )}
        <View style={styles.screenIntro}>
          <Text style={styles.introText}>Organize your money, your way.</Text>
          <SheetTabs
            options={[
              { label: `Expense · ${topLevelOnly(expenseCats).length}`, value: 'expense' },
              { label: `Income · ${topLevelOnly(incomeCats).length}`, value: 'income' },
            ]}
            value={kind}
            onChange={setKind}
          />
          <View style={styles.sectionHeading}>
            <Text style={styles.collectionTitle}>{kind === 'expense' ? 'Expenses' : 'Income'}</Text>
            <Text style={styles.collectionCount}>
              {parentCount} categor{parentCount === 1 ? 'y' : 'ies'}
              {subcategoryCount > 0
                ? ` · ${subcategoryCount} subcategor${subcategoryCount === 1 ? 'y' : 'ies'}`
                : ''}
            </Text>
          </View>
        </View>
        {parentCount > 0 ? (
          <Section key={kind} cats={visibleCategories} onEdit={sheets.edit} onManage={onManage} />
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              A place for your {kind === 'expense' ? 'spending' : 'income'}
            </Text>
            <Text style={styles.emptyText}>Create a category to start organizing your transactions.</Text>
            <PrimaryButton title="Add category" compact onPress={sheets.openAdd} />
          </View>
        )}

        {showArchived && (
          <>
            <Text style={styles.sectionTitle}>Archived</Text>
            {archivedCategories.length === 0 ? (
              <Text style={styles.hintText}>No archived categories.</Text>
            ) : (
              <TileRows
                items={archivedCategories}
                // Flat, not grouped by parent: a subcategory can be archived while its parent stays
                // active, so there isn't always an archived parent tile to nest it under.
                renderTile={(cat) => (
                  <MemoCategoryTile
                    category={cat}
                    isSubcategory={!!cat.parentId}
                    onPress={onManageArchived}
                    onLongPress={onManageArchived}
                  />
                )}
              />
            )}
            <Text style={styles.hintText}>
              Archived categories are hidden from pickers everywhere else, but their past transactions stay
              intact. Tap one to restore it or delete it for good.
            </Text>
          </>
        )}

        <Text style={styles.hintText}>Tap to edit or see subcategories. Hold for more options.</Text>
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        collapse={collapse}
        summary={
          categories.length > 0 ? (
            <HeaderSummary
              figure={String(expenseCats.length + incomeCats.length)}
              rest="in use"
              dot={theme.colors.slice.free}
            />
          ) : undefined
        }
        title="Categories"
        showBack
        hideUser
        wallpaper
        actions={
          <>
            <HeaderIconButton
              icon={showArchived ? 'eye-off' : 'archive'}
              glass
              size={36}
              onPress={() => setShowArchived((v) => !v)}
              label={showArchived ? 'Hide archived categories' : 'Show archived categories'}
              badge={!showArchived && archivedCategories.length > 0}
            />
            <AddButton onPress={sheets.openAdd} label="+ Add" />
          </>
        }
      />

      <CategoriesSheets
        sheets={sheets}
        categories={categories}
        kind={kind}
        onManage={onManage}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
        onDelete={onDelete}
        reload={load}
      />
    </View>
  );
}

import { Appear } from '@/components/Appear';
import { ScreenLoadError } from '@/components/ScreenLoadError';
import { PrimaryButton } from '@/components/PrimaryButton';
import { memo, useMemo, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text, TextInput } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Category, CategoryKind } from '@/types';
import { theme } from '@/constants/theme';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { SolidFade } from '@/components/SolidFade';
import { useCollapsingHeader } from '@/hooks/useCollapsingHeader';
import { AddButton } from '@/components/AddButton';
import { styles } from '@/features/categories/categories.styles';
import { CategorySection, MemoCategoryTile, CategoryRows } from '@/features/categories/CategorySection';
import { CategoriesSheets } from '@/features/categories/CategoriesSheets';
import { createCategoriesSheets } from '@/features/categories/categoriesSheetsStore';
import { useCategoriesData } from '@/features/categories/useCategoriesData';
import { useCategoryActions } from '@/features/categories/useCategoryActions';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { useAccent } from '@/theme/AccentContext';
import { SheetTabs } from '@/components/SheetTabs';
import { searchCategories, topLevelOnly } from '@/lib/categoryTree';

/** The line under a search result: its parent, and "Income" for an income one (the tabs are not there to say so). */
function contextOf(cat: Category, byId: Map<string, Category>): string | undefined {
  const parent = cat.parentId ? byId.get(cat.parentId)?.name : undefined;
  return [parent, cat.kind === 'income' ? 'Income' : undefined].filter(Boolean).join(' · ') || undefined;
}

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
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<CategoryKind>('expense');
  const {
    allCategories,
    useCounts,
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
  const searching = query.trim().length > 0;
  const visible = showArchived ? archivedCategories : visibleCategories;
  // A search looks through both types: what is typed is what you are after, not the tab you happen to be on.
  const matches = useMemo(() => {
    if (!searching) return visible;
    return searchCategories(showArchived ? archivedCategories : [...expenseCats, ...incomeCats], query);
  }, [visible, query, searching, showArchived, archivedCategories, expenseCats, incomeCats]);
  const byId = useMemo(
    () => new Map(allCategories.map((category) => [category.id, category])),
    [allCategories]
  );
  const switchCollection = () => {
    Keyboard.dismiss();
    setQuery('');
    setShowArchived((value) => !value);
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  };

  if (!hasData && loadError)
    return <ScreenLoadError title="Categories" message={loadError} onRetry={() => void load()} />;

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} plain />
        <SkyHeader title="Categories" showBack hideUser wallpaper />
        <View style={{ paddingTop: 20 }}>
          <CardRowsSkeleton rows={6} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} plain />
      <SolidFade style={{ flex: 1 }}>
        <ReanimatedAnimated.ScrollView
          ref={scrollRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
            {showArchived ? (
              <Text accessibilityRole="header" style={styles.archiveTitle}>
                Archived
              </Text>
            ) : (
              <SheetTabs
                ledgerStyle
                options={[
                  { label: `Expense · ${topLevelOnly(expenseCats).length}`, value: 'expense' },
                  { label: `Income · ${topLevelOnly(incomeCats).length}`, value: 'income' },
                ]}
                value={kind}
                onChange={setKind}
              />
            )}
            {showArchived && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show active categories"
                onPress={switchCollection}
                style={styles.collectionAction}
              >
                <Feather name="arrow-left" size={15} color={theme.colors.link} />
                <Text style={styles.collectionActionText}>Active categories</Text>
              </Pressable>
            )}
            {(visible.length > 0 || searching) && (
              <View style={styles.categorySearch}>
                <Feather name="search" size={16} color={theme.colors.textMuted} />
                <TextInput
                  accessibilityLabel="Find a category"
                  placeholder={showArchived ? 'Search archive' : 'Find a category'}
                  placeholderTextColor={theme.colors.textMuted}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.categorySearchInput}
                />
                {query.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    onPress={() => setQuery('')}
                    style={styles.categorySearchClear}
                  >
                    <Feather name="x" size={16} color={theme.colors.textSecondary} />
                  </Pressable>
                )}
              </View>
            )}
          </View>
          {searching || showArchived ? (
            matches.length > 0 ? (
              <CategoryRows
                items={matches}
                renderRow={(cat) => (
                  <MemoCategoryTile
                    category={cat}
                    context={contextOf(cat, byId)}
                    uses={useCounts.get(cat.id) ?? 0}
                    onPress={(category) => {
                      Keyboard.dismiss();
                      if (showArchived) onManageArchived(category);
                      else sheets.edit(category);
                    }}
                    onLongPress={showArchived ? onManageArchived : onManage}
                  />
                )}
              />
            ) : (
              <Text style={styles.hintText}>
                {searching ? 'No matching categories.' : 'No archived categories.'}
              </Text>
            )
          ) : parentCount > 0 ? (
            <Section
              key={kind}
              cats={visibleCategories}
              useCounts={useCounts}
              onAddSub={sheets.addUnder}
              onEdit={sheets.edit}
              onManage={onManage}
            />
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No {kind} categories yet</Text>
              <PrimaryButton title="Add category" compact onPress={sheets.openAdd} />
            </View>
          )}
          {!showArchived && !searching && archivedCategories.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show archived categories"
              onPress={switchCollection}
              style={[styles.collectionAction, styles.archivedLink]}
            >
              <Feather name="archive" size={15} color={theme.colors.link} />
              <Text style={styles.collectionActionText}>{`Archived · ${archivedCategories.length}`}</Text>
            </Pressable>
          )}
        </ReanimatedAnimated.ScrollView>
      </SolidFade>
      <SkyHeader
        collapse={collapse}
        summary={
          !showArchived && categories.length > 0 ? (
            <HeaderSummary
              figure={String(topLevelOnly(expenseCats).length + topLevelOnly(incomeCats).length)}
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
          !showArchived && parentCount > 0 ? <AddButton onPress={sheets.openAdd} label="+ Add" /> : undefined
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

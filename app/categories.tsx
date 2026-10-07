import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScreenLoad } from '@/lib/useScreenLoad';
import {
  listCategories,
  archiveCategory,
  unarchiveCategory,
  deleteCategory,
  restoreCategory,
} from '@/db/ledger';
import { Category } from '@/types';
import { theme } from '@/constants/theme';
import { HeaderIconButton } from '@/components/AppHeader';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { AddButton } from '@/components/AddButton';
import { ActionSheet, ActionSheetItem } from '@/components/ActionSheet';
import { styles } from '@/features/categories/categories.styles';
import { CategorySection, CategoryTile, TileRows } from '@/features/categories/CategorySection';
import { AddCategoryModal } from '@/features/categories/AddCategoryModal';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';
import { Skeleton } from '@/components/Skeleton';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const { show: showUndo } = useUndoToast();
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  // Which category the "manage" sheet is open for, and whether from the active or archived section, which
  // only changes the two actions offered (Archive/Delete vs Restore/Delete).
  const [manageTarget, setManageTarget] = useState<{ cat: Category; archived: boolean } | null>(null);

  const loadCategories = useCallback(async () => {
    setAllCategories(await listCategories(true));
  }, []);
  const { loaded, loadError, reload: load } = useScreenLoad(loadCategories);
  // Guards the manage sheet's Archive/Delete/Restore against a double-tap firing the mutation twice before
  // it closes; other delete flows (LoanDetailModal, RuleModal, etc.) disable their trigger likewise.
  const [actionBusy, setActionBusy] = useState(false);

  const categories = allCategories.filter((c) => !c.archived);
  const archivedCategories = allCategories.filter((c) => c.archived);
  const expenseCats = categories.filter((c) => c.kind === 'expense');
  const incomeCats = categories.filter((c) => c.kind === 'income');

  const onUnarchive = (cat: Category) => {
    showAlert('Restore category', `Bring "${cat.name}" back into pickers?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          if (actionBusy) return;
          setActionBusy(true);
          try {
            await unarchiveCategory(cat.id);
            await load();
          } catch (e) {
            showAlert("Couldn't restore category", errorMessage(e));
          } finally {
            setActionBusy(false);
          }
        },
      },
    ]);
  };

  const onArchive = (cat: Category) => {
    const childCount = allCategories.filter((c) => c.parentId === cat.id).length;
    showAlert(
      `Archive "${cat.name}"?`,
      childCount > 0
        ? `Hides it and its ${childCount} subcategor${childCount === 1 ? 'y' : 'ies'} from pickers. Past transactions keep them.`
        : `Hides it from pickers. Past transactions keep it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            if (actionBusy) return;
            setActionBusy(true);
            try {
              await archiveCategory(cat.id);
              await load();
            } catch (e) {
              showAlert("Couldn't archive category", errorMessage(e));
            } finally {
              setActionBusy(false);
            }
          },
        },
      ]
    );
  };

  const runDelete = async (cat: Category) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const snapshot = await deleteCategory(cat.id);
      haptics.warn();
      await load();
      showUndo(`Deleted "${cat.name}"`, async () => {
        await restoreCategory(snapshot);
        await load();
      });
    } catch (e) {
      showAlert("Couldn't delete category", errorMessage(e));
    } finally {
      setActionBusy(false);
    }
  };

  const onDelete = (cat: Category) => {
    // A single category is instant-delete + undo, but one with subcategories cascades them all in the same
    // tap, which the undo toast alone doesn't make obvious, so that case gets an extra confirm step first.
    const childCount = allCategories.filter((c) => c.parentId === cat.id).length;
    if (childCount === 0) {
      runDelete(cat);
      return;
    }
    showAlert(
      `Delete "${cat.name}"?`,
      `This also deletes its ${childCount} subcategor${childCount === 1 ? 'y' : 'ies'}. You can undo right after, if needed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => runDelete(cat) },
      ]
    );
  };

  // A single-button information notice, not a menu — a plain showAlert,
  // unlike the two functions below.
  const onManage = (cat: Category) => {
    if (cat.isSystem) {
      showAlert(
        'Built-in category',
        `"${cat.name}" is used by Yume to auto-categorise loan EMIs, fees and Friends & Family entries, so it can't be archived, deleted, or renamed. You can still change its icon and colour.`
      );
      return;
    }
    setManageTarget({ cat, archived: false });
  };

  const onManageArchived = (cat: Category) => {
    setManageTarget({ cat, archived: true });
  };

  // Feeds the one shared `ActionSheet`: only its two rows differ between an active category's menu
  // (Archive/Delete) and an archived one's (Restore/Delete).
  const manageItems: ActionSheetItem[] = manageTarget
    ? manageTarget.archived
      ? [
          {
            key: 'restore',
            label: 'Restore',
            icon: 'rotate-ccw',
            onPress: () => onUnarchive(manageTarget.cat),
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: 'trash-2',
            destructive: true,
            onPress: () => onDelete(manageTarget.cat),
          },
        ]
      : [
          // Moving is a parent change in the edit sheet, so a subcategory's menu just opens it there.
          ...(manageTarget.cat.parentId
            ? [
                {
                  key: 'move',
                  label: 'Move to another category',
                  icon: 'corner-up-right' as const,
                  onPress: () => setEditingCategory(manageTarget.cat),
                },
              ]
            : []),
          { key: 'archive', label: 'Archive', icon: 'archive', onPress: () => onArchive(manageTarget.cat) },
          {
            key: 'delete',
            label: 'Delete',
            icon: 'trash-2',
            destructive: true,
            onPress: () => onDelete(manageTarget.cat),
          },
        ]
    : [];

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <SkyHeader title="Categories" showBack hideUser />
        <View style={{ paddingTop: 20 }}>
          <Skeleton width={100} height={13} radius={4} style={{ marginHorizontal: 20, marginBottom: 14 }} />
          <View style={styles.grid}>
            {[0, 1].map((row) => (
              <View key={row} style={styles.gridRow}>
                {Array.from({ length: 4 }, (_, i) => (
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
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load your categories</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}
        <Text style={[styles.sectionTitle, styles.firstTitle]}>Expense</Text>
        <CategorySection cats={expenseCats} onEdit={setEditingCategory} onManage={onManage} />

        <Text style={styles.sectionTitle}>Income</Text>
        <CategorySection cats={incomeCats} onEdit={setEditingCategory} onManage={onManage} />

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
                  <CategoryTile
                    category={cat}
                    isSubcategory={!!cat.parentId}
                    onPress={() => onManageArchived(cat)}
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

        <Text style={styles.hintText}>Tap to edit or open · hold to move, archive or delete.</Text>
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
        actions={
          <>
            <HeaderIconButton
              icon={showArchived ? 'eye-off' : 'archive'}
              onPress={() => setShowArchived((v) => !v)}
              label={showArchived ? 'Hide archived categories' : 'Show archived categories'}
              badge={!showArchived && archivedCategories.length > 0}
            />
            <AddButton onPress={() => setModalVisible(true)} label="+ Add" />
          </>
        }
      />

      <AddCategoryModal
        visible={modalVisible}
        category={null}
        allCategories={categories}
        onClose={() => setModalVisible(false)}
        onSaved={async () => {
          setModalVisible(false);
          await load();
        }}
      />
      <AddCategoryModal
        visible={!!editingCategory}
        category={editingCategory}
        allCategories={categories}
        onManage={() => {
          const cat = editingCategory;
          setEditingCategory(null);
          if (cat) onManage(cat);
        }}
        onClose={() => setEditingCategory(null)}
        onSaved={async () => {
          setEditingCategory(null);
          await load();
        }}
      />

      <ActionSheet
        visible={!!manageTarget}
        onClose={() => setManageTarget(null)}
        title={manageTarget?.archived ? 'Manage archived category' : 'Manage category'}
        items={manageItems}
      />
    </View>
  );
}

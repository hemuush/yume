import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listCategories, archiveCategory, unarchiveCategory, deleteCategory, restoreCategory } from '@/db/ledger';
import { Category } from '@/types';
import { theme } from '@/constants/theme';
import { AppHeader, HeaderIconButton } from '@/components/AppHeader';
import { AddButton } from '@/components/AddButton';
import { ActionSheet, ActionSheetItem } from '@/components/ActionSheet';
import { styles } from '@/features/categories/categories.styles';
import { CategorySection, CategoryTile } from '@/features/categories/CategorySection';
import { AddCategoryModal } from '@/features/categories/AddCategoryModal';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const { show: showUndo } = useUndoToast();
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  // Which category the "manage" sheet is open for, and whether it was
  // opened from the active or archived section — that's the only thing
  // that changes which two actions the sheet offers (Archive/Delete vs
  // Restore/Delete).
  const [manageTarget, setManageTarget] = useState<{ cat: Category; archived: boolean } | null>(null);
  // `allCategories` starts at `[]`, indistinguishable from "genuinely no
  // categories yet" — an explicit flag is what gates the spinner correctly.
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setAllCategories(await listCategories(true));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const categories = allCategories.filter((c) => !c.archived);
  const archivedCategories = allCategories.filter((c) => c.archived);
  const expenseCats = categories.filter((c) => c.kind === 'expense');
  const incomeCats = categories.filter((c) => c.kind === 'income');

  const onUnarchive = (cat: Category) => {
    Alert.alert('Restore category', `Bring "${cat.name}" back into pickers?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          try {
            await unarchiveCategory(cat.id);
            await load();
          } catch (e: any) {
            Alert.alert('Could not restore category', String(e?.message ?? e));
          }
        },
      },
    ]);
  };

  const onArchive = (cat: Category) => {
    const childCount = allCategories.filter((c) => c.parentId === cat.id).length;
    Alert.alert(
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
            try {
              await archiveCategory(cat.id);
              await load();
            } catch (e: any) {
              Alert.alert('Could not archive category', String(e?.message ?? e));
            }
          },
        },
      ]
    );
  };

  const onDelete = async (cat: Category) => {
    try {
      const snapshot = await deleteCategory(cat.id);
      haptics.warn();
      await load();
      showUndo(`Deleted "${cat.name}"`, async () => {
        await restoreCategory(snapshot);
        await load();
      });
    } catch (e: any) {
      Alert.alert('Could not delete category', String(e?.message ?? e));
    }
  };

  // A single-button information notice, not a menu — stays a plain
  // `Alert.alert` (the platform's normal idiom for "here's why not"), unlike
  // the two functions below.
  const onManage = (cat: Category) => {
    if (cat.isSystem) {
      Alert.alert(
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

  // Feeds the one shared `ActionSheet` below — its two rows are the only
  // thing that differs between an active category's menu (Archive/Delete)
  // and an archived one's (Restore/Delete). Previously two separate
  // `Alert.alert` calls (native platform dialogs, styled entirely by the
  // OS) — see `ActionSheet`'s own comment for why that looked like a
  // different, unstyled app dropped into the middle of Yume.
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

  if (!loaded) {
    return (
      <View style={styles.container}>
        <AppHeader title="Categories" showBack />
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.ink} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Categories"
        showBack
        right={
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

      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        <Text style={styles.sectionTitle}>Expense</Text>
        <CategorySection cats={expenseCats} onEdit={setEditingCategory} onManage={onManage} />

        <Text style={styles.sectionTitle}>Income</Text>
        <CategorySection cats={incomeCats} onEdit={setEditingCategory} onManage={onManage} />

        {showArchived && (
          <>
            <Text style={styles.sectionTitle}>Archived</Text>
            {archivedCategories.length === 0 ? (
              <Text style={styles.hintText}>No archived categories.</Text>
            ) : (
              <View style={styles.grid}>
                {archivedCategories.map((cat) => (
                  <CategoryTile
                    key={cat.id}
                    category={cat}
                    // Flat, not grouped-by-parent: a subcategory can be
                    // archived on its own while its parent stays active, so
                    // there isn't always an archived parent tile to nest it
                    // under here.
                    isSubcategory={!!cat.parentId}
                    onPress={() => onManageArchived(cat)}
                    onLongPress={onManageArchived}
                  />
                ))}
              </View>
            )}
            <Text style={styles.hintText}>
              Archived categories are hidden from pickers everywhere else, but their past transactions stay
              intact. Tap one to restore it or delete it for good.
            </Text>
          </>
        )}

        <Text style={styles.hintText}>
          Tap a category to edit it, or hold to archive or delete it. A category with subcategories (like
          "Food & Dining" with "Zomato") gets its own card below the grid, listing them as pills — tap or hold
          a pill the same way. Add a subcategory from + Add or from its parent's own edit screen.
        </Text>
      </ScrollView>

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

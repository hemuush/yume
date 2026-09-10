import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listCategories, archiveCategory, unarchiveCategory, deleteCategory } from '@/db/ledger';
import { Category } from '@/types';
import { theme } from '@/constants/theme';
import { AppHeader, HeaderIconButton } from '@/components/AppHeader';
import { AddButton } from '@/components/AddButton';
import { styles } from '@/features/categories/categories.styles';
import { CategorySection, CategoryTile } from '@/features/categories/CategorySection';
import { AddCategoryModal } from '@/features/categories/AddCategoryModal';

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setAllCategories(await listCategories(true));
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
      'Archive category',
      childCount > 0
        ? `Hide "${cat.name}" and its ${childCount} subcategor${childCount === 1 ? 'y' : 'ies'} from pickers? Past transactions keep them.`
        : `Hide "${cat.name}" from pickers? Past transactions keep it.`,
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

  const onDelete = (cat: Category) => {
    const childCount = allCategories.filter((c) => c.parentId === cat.id).length;
    Alert.alert(
      `Delete "${cat.name}"?`,
      (childCount > 0
        ? `This also deletes its ${childCount} subcategor${childCount === 1 ? 'y' : 'ies'}. `
        : '') + "This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(cat.id);
              await load();
            } catch (e: any) {
              Alert.alert('Could not delete category', String(e?.message ?? e));
            }
          },
        },
      ]
    );
  };

  const onManage = (cat: Category) => {
    if (cat.isSystem) {
      Alert.alert(
        'Built-in category',
        `"${cat.name}" is used by Yume to auto-categorise loan EMIs, fees and Friends & Family entries, so it can't be archived, deleted, or renamed. You can still change its icon and colour.`
      );
      return;
    }
    Alert.alert(
      'Manage category',
      undefined,
      [
        { text: 'Archive', onPress: () => onArchive(cat) },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(cat) },
      ],
      { cancelable: true }
    );
  };

  const onManageArchived = (cat: Category) => {
    Alert.alert(
      'Manage archived category',
      undefined,
      [
        { text: 'Restore', onPress: () => onUnarchive(cat) },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(cat) },
      ],
      { cancelable: true }
    );
  };

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
    </View>
  );
}

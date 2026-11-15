import { memo } from 'react';
import { ActionSheet, type ActionSheetItem } from '@/components/ActionSheet';
import type { Category, CategoryKind } from '@/types';
import { AddCategoryModal } from './AddCategoryModal';
import { useCategoriesSheets, type CategoriesSheets as CategoriesSheetsStore } from './categoriesSheetsStore';

/**
 * The sheets the Categories page opens: the new-category form, the editor and the manage menu. Which is open lives in
 * `sheets`, so the tiles behind do not redraw when one opens or closes.
 */
export const CategoriesSheets = memo(function CategoriesSheets({
  sheets,
  categories,
  kind,
  onManage,
  onArchive,
  onUnarchive,
  onDelete,
  reload,
}: {
  sheets: CategoriesSheetsStore;
  /** The active categories (the parents a new one can go under). */
  categories: Category[];
  /** The type the new-category form starts on: the page's selected tab. */
  kind: CategoryKind;
  onManage: (cat: Category) => void;
  onArchive: (cat: Category) => void;
  onUnarchive: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  /** Reloads the page in place after something was saved. */
  reload: () => Promise<void>;
}) {
  const { adding, editing, manage } = useCategoriesSheets(sheets);

  // Feeds the one shared `ActionSheet`: only its two rows differ between an active category's menu
  // (Archive/Delete) and an archived one's (Restore/Delete).
  const manageItems: ActionSheetItem[] = manage
    ? manage.archived
      ? [
          { key: 'restore', label: 'Restore', icon: 'rotate-ccw', onPress: () => onUnarchive(manage.cat) },
          {
            key: 'delete',
            label: 'Delete',
            icon: 'trash-2',
            destructive: true,
            onPress: () => onDelete(manage.cat),
          },
        ]
      : [
          { key: 'edit', label: 'Edit category', icon: 'edit-2', onPress: () => sheets.edit(manage.cat) },
          // Moving is a parent change in the edit sheet, so a subcategory's menu just opens it there.
          ...(manage.cat.parentId
            ? [
                {
                  key: 'move',
                  label: 'Move to another category',
                  icon: 'corner-up-right' as const,
                  onPress: () => sheets.edit(manage.cat),
                },
              ]
            : []),
          { key: 'archive', label: 'Archive', icon: 'archive', onPress: () => onArchive(manage.cat) },
          {
            key: 'delete',
            label: 'Delete',
            icon: 'trash-2',
            destructive: true,
            onPress: () => onDelete(manage.cat),
          },
        ]
    : [];

  return (
    <>
      <AddCategoryModal
        visible={adding}
        category={null}
        initialKind={kind}
        allCategories={categories}
        onClose={sheets.closeAdd}
        onSaved={async () => {
          sheets.closeAdd();
          await reload();
        }}
      />
      <AddCategoryModal
        visible={!!editing}
        category={editing}
        allCategories={categories}
        onManage={() => {
          const cat = editing;
          sheets.edit(null);
          if (cat) onManage(cat);
        }}
        onClose={() => sheets.edit(null)}
        onSaved={async () => {
          sheets.edit(null);
          await reload();
        }}
      />

      <ActionSheet
        visible={!!manage}
        onClose={sheets.closeManage}
        title={manage?.archived ? 'Manage archived category' : 'Manage category'}
        items={manageItems}
      />
    </>
  );
});

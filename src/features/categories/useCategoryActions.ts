import { useRef } from 'react';
import { showAlert } from '@/components/AppDialog';
import { useUndoToast } from '@/components/UndoToast';
import { archiveCategory, deleteCategory, restoreCategory, unarchiveCategory } from '@/db/ledger';
import { errorMessage } from '@/lib/errorMessage';
import { haptics } from '@/lib/haptics';
import { showPrivacyReminderWarning } from '@/lib/privacyReminderFeedback';
import { useSaveOnce } from '@/lib/useSaveOnce';
import { useStableCallback } from '@/lib/useStableCallback';
import type { Category } from '@/types';
import type { CategoriesSheets } from './categoriesSheetsStore';

/**
 * What the Categories page does to a category outside its form: open its manage sheet (a built-in one only gets a notice),
 * archive, restore and delete with an undo. One runs at a time (a double tap never fires twice). The functions keep their
 * identity, so the tiles and sheets that hold them are not redrawn for them.
 */
export function useCategoryActions({
  sheets,
  allCategories,
  reload,
}: {
  sheets: CategoriesSheets;
  allCategories: Category[];
  reload: () => Promise<void>;
}) {
  const { show: showUndo } = useUndoToast();
  const runAction = useSaveOnce(async (action: () => Promise<void>) => {
    await action();
  });
  // Guards Archive, Delete and Restore against a double-tap firing the mutation twice before the sheet closes.
  const busy = useRef(false);
  const guarded = (failTitle: string, action: () => Promise<void>) =>
    runAction(async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        await action();
      } catch (e) {
        showAlert(failTitle, errorMessage(e));
      } finally {
        busy.current = false;
      }
    });

  const onUnarchive = useStableCallback((cat: Category) => {
    showAlert('Restore category', `Bring "${cat.name}" back into pickers?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: () =>
          guarded('Couldn’t restore category', async () => {
            await unarchiveCategory(cat.id, showPrivacyReminderWarning);
            await reload();
          }),
      },
    ]);
  });

  const onArchive = useStableCallback((cat: Category) => {
    const childCount = allCategories.filter((c) => c.parentId === cat.id).length;
    showAlert(
      `Archive "${cat.name}"?`,
      childCount > 0
        ? `Hides it and its ${childCount} subcategor${childCount === 1 ? 'y' : 'ies'} from pickers. Past transactions keep them. Recurring entries keep running; pause them in Recurring if needed.`
        : `Hides it from pickers. Past transactions keep it. Recurring entries keep running; pause them in Recurring if needed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () =>
            guarded('Couldn’t archive category', async () => {
              await archiveCategory(cat.id, showPrivacyReminderWarning);
              await reload();
            }),
        },
      ]
    );
  });

  const runDelete = (cat: Category) =>
    guarded('Couldn’t delete category', async () => {
      const snapshot = await deleteCategory(cat.id, showPrivacyReminderWarning);
      haptics.warn();
      await reload();
      showUndo(`Deleted "${cat.name}"`, async () => {
        await restoreCategory(snapshot, showPrivacyReminderWarning);
        await reload();
      });
    });

  const onDelete = useStableCallback((cat: Category) => {
    // A single category is instant-delete + undo, but one with subcategories cascades them all in the same
    // tap, which the undo toast alone doesn't make obvious, so that case gets an extra confirm step first.
    const childCount = allCategories.filter((c) => c.parentId === cat.id).length;
    if (childCount === 0) {
      void runDelete(cat);
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
  });

  // A single-button information notice for a built-in category, not a menu; anything else opens the manage sheet.
  const onManage = useStableCallback((cat: Category) => {
    if (cat.isSystem) {
      showAlert(
        'Built-in category',
        `"${cat.name}" is used by Yume to auto-categorise loan EMIs, fees and Friends & Family entries, so it can’t be archived, deleted, or renamed. You can still change its icon and colour.`
      );
      return;
    }
    sheets.manage(cat, false);
  });

  const onManageArchived = useStableCallback((cat: Category) => sheets.manage(cat, true));

  return { onUnarchive, onArchive, onDelete, onManage, onManageArchived };
}

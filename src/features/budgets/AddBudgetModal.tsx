import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { createBudget, updateBudget, BudgetProgress } from '@/db/budgets';
import { toMinor } from '@/lib/money';
import { Category } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { modalFooterStyles as f } from '@/constants/theme';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { CategoryPicker } from '@/components/CategoryPicker';
import { topLevelOnly } from '@/lib/categoryTree';
import { styles } from './budgets.styles';

/**
 * Creates a new month's budget, or edits an existing one's limit/rollover —
 * the category and month themselves are fixed once a budget exists (like an
 * account's currency), so re-categorising means deleting and adding a new
 * one instead.
 */
export function AddBudgetModal({
  visible,
  editing,
  categories,
  onClose,
  onSaved,
}: {
  visible: boolean;
  editing: BudgetProgress | null;
  /**
   * Every expense category (parents and subcategories alike) — irrelevant,
   * and hidden, once editing. Deliberately not pre-filtered down to
   * "doesn't already have a budget this month": excluding an already-
   * budgeted parent while leaving one of its still-eligible subcategories
   * in would silently drop that child from the picker too (CategoryPicker
   * only shows a subcategory once its parent is present to expand it
   * under). `createBudget` already gives a clear error for the rare case
   * of picking one that's taken, the same way every other "already exists"
   * case in the app is handled — by the create call itself, not by hiding
   * the option beforehand.
   */
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [limit, setLimit] = useState('');
  const [rollover, setRollover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setCategoryId(editing.budget.categoryId);
      setLimit((editing.budget.limitAmountMinor / 100).toString());
      setRollover(editing.budget.rollover);
    } else {
      setCategoryId(topLevelOnly(categories)[0]?.id ?? null);
      setLimit('');
      setRollover(false);
    }
    setError(null);
    // Only re-derive defaults when the modal actually opens or which budget
    // it's editing changes — `categories` is a fresh array every render of
    // the host screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editing]);

  const submit = async () => {
    setError(null);
    const limitAmountMinor = toMinor(parseFloat(limit || '0'));
    if (!Number.isFinite(limitAmountMinor) || limitAmountMinor <= 0) {
      setError('Enter a valid monthly limit');
      return;
    }
    if (!editing && !categoryId) {
      setError('Pick a category');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateBudget(editing.budget.id, { limitAmountMinor, rollover });
      } else {
        await createBudget({ categoryId: categoryId!, limitAmountMinor, rollover });
      }
      onSaved();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title={editing ? 'Edit Budget' : 'New Budget'}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={f.footerRow}>
            <PrimaryButton title="Cancel" variant="secondary" onPress={onClose} style={f.footerBtn} />
            <PrimaryButton
              title={saving ? 'Saving...' : editing ? 'Save' : 'Create'}
              onPress={submit}
              disabled={saving}
              style={f.footerBtn}
            />
          </View>
        </View>
      }
    >
      {editing ? (
        <Text style={styles.modalHint}>
          For {editing.categoryName}, {editing.budget.periodMonth} — the category and month can't be changed
          once a budget exists.
        </Text>
      ) : categories.length === 0 ? (
        <Text style={styles.modalHint}>Add an expense category first before budgeting one.</Text>
      ) : (
        <>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={{ marginBottom: 16 }}>
            <CategoryPicker
              categories={categories}
              selectedId={categoryId}
              onSelect={setCategoryId}
              variant="chip"
            />
          </View>
        </>
      )}

      <FormInput
        label="Monthly limit"
        value={limit}
        onChangeText={setLimit}
        keyboardType="numeric"
        placeholder="e.g. 5000"
      />

      <View style={styles.toggleRow}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.fieldLabel}>Roll over unspent</Text>
          <Text style={styles.modalHint}>
            Anything left under this limit at month's end adds to next month's — so a light month buys some
            slack the next time this category runs hot.
          </Text>
        </View>
        <ToggleSwitch value={rollover} onChange={setRollover} />
      </View>
    </ModalSheet>
  );
}

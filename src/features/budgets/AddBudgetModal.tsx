import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { createBudget, updateBudget, BudgetProgress } from '@/db/budgets';
import { toMinor, formatMoney, inputMinor } from '@/lib/money';
import { Category } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { SheetCard } from '@/components/SheetCard';
import { theme, modalFooterStyles as f } from '@/constants/theme';
import { longMonthYear } from '@/lib/dateLabels';
import { AmountField } from '@/components/AmountField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { CategoryPicker } from '@/components/CategoryPicker';
import { topLevelOnly } from '@/lib/categoryTree';
import { styles } from './budgets.styles';
import { errorMessage } from '@/lib/errorMessage';
import { categorySentence } from '@/lib/categoryLabel';

/**
 * Creates a month's budget or edits its limit/rollover. Category and month are fixed once a budget exists
 * (like an account's currency), so re-categorising means delete and add.
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
   * Every expense category (parents and subs), hidden when editing. Not filtered by "already budgeted": hiding
   * a parent would drop its eligible subs (CategoryPicker needs it); createBudget errors on a duplicate.
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
    // Re-derive defaults only when the modal opens or the edited budget changes (`categories` changes every render).
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
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // The calm-sheets sign-off (Direction C): a live card of the budget in
  // its category's colour, then the form.
  const cat = categories.find((c) => c.id === categoryId);
  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton
            title={saving ? 'Saving…' : editing ? 'Save changes' : 'Create budget'}
            onPress={submit}
            disabled={saving}
          />
        </View>
      }
    >
      <SheetCard
        hue={cat?.color ?? theme.colors.primary}
        icon={cat?.icon ?? 'wallet-outline'}
        kicker={rollover ? 'Monthly · rolls over' : 'Monthly'}
        amount={formatMoney(inputMinor(limit))}
        title={
          editing
            ? categorySentence(editing.categoryName, editing.parentName)
            : (cat?.name ?? 'Pick a category')
        }
        meta={
          editing
            ? `${longMonthYear(`${editing.budget.periodMonth}-01`)} · category and month are fixed`
            : 'A limit for this month'
        }
      />
      {!editing &&
        (categories.length === 0 ? (
          <Text style={styles.modalHint}>Add an expense category before setting a budget.</Text>
        ) : (
          <View style={styles.pickerGap}>
            <CategoryPicker
              categories={categories}
              selectedId={categoryId}
              onSelect={setCategoryId}
              variant="medal"
            />
          </View>
        ))}

      <AmountField label="Monthly limit" value={limit} onChangeText={setLimit} placeholder="e.g. 5000" />

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

import { useState } from 'react';
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
 * The category a new budget starts on: the first top-level one without a budget yet, else any without one,
 * else none (the user picks). Exported for its test.
 */
export function defaultBudgetCategoryId(
  categories: Category[],
  budgeted: ReadonlySet<string> = new Set()
): string | null {
  const free = (c: Category) => !budgeted.has(c.id);
  return (topLevelOnly(categories).find(free) ?? categories.find(free))?.id ?? null;
}

/**
 * Creates a month's budget or edits its limit/rollover. Category and month are fixed once a budget exists
 * (like an account's currency), so re-categorising means delete and add.
 */
export function AddBudgetModal({
  visible,
  editing,
  categories,
  budgetedCategoryIds,
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
  /** Categories that already have a budget this month — skipped when choosing the default category. */
  budgetedCategoryIds?: ReadonlySet<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [limit, setLimit] = useState('');
  const [rollover, setRollover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The form starts fresh each time the sheet opens (or switches to another budget). Done while rendering
  // rather than in an effect, so the first painted frame is already the reset form, not last time's.
  const openKey = visible ? (editing ? `edit:${editing.budget.id}` : 'new') : null;
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (openKey !== syncedKey) {
    setSyncedKey(openKey);
    if (openKey) {
      if (editing) {
        setCategoryId(editing.budget.categoryId);
        setLimit((editing.budget.limitAmountMinor / 100).toString());
        setRollover(editing.budget.rollover);
      } else {
        setCategoryId(defaultBudgetCategoryId(categories, budgetedCategoryIds));
        setLimit('');
        setRollover(false);
      }
      setError(null);
    }
  }

  const submit = async () => {
    setError(null);
    // Whole units by design: the field takes digits only, so the limit is never fractional.
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

      <AmountField
        label="Monthly limit"
        value={limit}
        onChangeText={setLimit}
        placeholder="e.g. 5000"
        decimal={false}
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

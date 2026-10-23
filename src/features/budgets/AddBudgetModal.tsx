import { useSheetMutation } from '@/lib/useSheetMutation';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { createBudget, updateBudget, BudgetProgress } from '@/db/budgets';
import { toMinor, formatMoney, inputMinor } from '@/lib/money';
import { Category } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { DraftCard } from '@/components/DraftCard';
import { modalFooterStyles as f } from '@/constants/theme';
import { longMonthYear } from '@/lib/dateLabels';
import { AmountField } from '@/components/AmountField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { CategoryPicker } from '@/components/CategoryPicker';
import { topLevelOnly } from '@/lib/categoryTree';
import { styles } from './budgets.styles';
import { categorySentence } from '@/lib/categoryLabel';
import { useAccent } from '@/theme/AccentContext';

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
export function AddBudgetModal(props: AddBudgetProps) {
  return props.visible ? <BudgetForm key={props.editing?.budget.id ?? 'new'} {...props} /> : null;
}

interface AddBudgetProps {
  visible: boolean;
  editing: BudgetProgress | null;
  categories: Category[];
  budgetedCategoryIds?: ReadonlySet<string>;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  backLabel?: string;
}

function BudgetForm({
  visible,
  editing,
  categories,
  budgetedCategoryIds,
  onClose,
  onSaved,
  backLabel,
}: AddBudgetProps) {
  const { accent } = useAccent();
  const [categoryId, setCategoryId] = useState<string | null>(
    () => editing?.budget.categoryId ?? defaultBudgetCategoryId(categories, budgetedCategoryIds)
  );
  const [limit, setLimit] = useState(() => (editing ? String(editing.budget.limitAmountMinor / 100) : ''));
  const [rollover, setRollover] = useState(editing?.budget.rollover ?? false);
  const { run, pending: saving, saved, error } = useSheetMutation();

  const submit = () =>
    run(async () => {
      // Whole units by design: the field takes digits only, so the limit is never fractional.
      const limitAmountMinor = toMinor(parseFloat(limit || '0'));
      if (!Number.isFinite(limitAmountMinor) || limitAmountMinor <= 0) {
        throw new Error('Enter a valid monthly limit');
      }
      if (!editing && !categoryId) {
        throw new Error('Pick a category');
      }
      if (!editing && !categories.some((c) => c.id === categoryId && !c.archived && c.kind === 'expense'))
        throw new Error('Pick an available expense category');
      if (editing) {
        await updateBudget(editing.budget.id, { limitAmountMinor, rollover });
      } else {
        await createBudget({ categoryId: categoryId!, limitAmountMinor, rollover });
      }
    }, onSaved);

  // The calm-sheets sign-off (Direction C): a live card of the budget in
  // its category's colour, then the form.
  const cat = categories.find((c) => c.id === categoryId);
  return (
    <ModalSheet
      dismissible={!saving}
      visible={visible}
      backLabel={backLabel}
      title={editing ? 'Edit budget' : 'New budget'}
      onClose={onClose}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton
            loading={saving}
            title={saving ? 'Saving…' : saved ? 'Budget saved' : editing ? 'Save changes' : 'Create budget'}
            onPress={submit}
            disabled={saving || saved}
          />
        </View>
      }
    >
      <View
        pointerEvents={saving || saved ? 'none' : 'auto'}
        accessibilityElementsHidden={saving || saved}
        importantForAccessibility={saving || saved ? 'no-hide-descendants' : 'auto'}
      >
        <DraftCard
          hue={cat?.color ?? editing?.categoryColor ?? accent}
          icon={cat?.icon ?? editing?.categoryIcon ?? 'wallet-outline'}
          kicker={rollover ? 'Monthly · rolls over' : 'Monthly'}
          figure={inputMinor(limit) > 0 ? formatMoney(inputMinor(limit)) : undefined}
          per="a month"
          title={
            editing
              ? categorySentence(editing.categoryName, editing.parentName)
              : (cat?.name ?? 'Pick a category')
          }
          meta={
            editing
              ? `${longMonthYear(`${editing.budget.periodMonth}-01`)} · category and month are fixed`
              : undefined
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
          editable={!saving && !saved}
          value={limit}
          onChangeText={setLimit}
          placeholder="e.g. 5000"
          decimal={false}
        />

        <View style={styles.toggleRow}>
          <View style={styles.rolloverCopy}>
            <Text style={styles.fieldLabel}>Roll over unspent</Text>
            <Text style={styles.modalHint}>Add this month’s remaining amount to next month’s limit.</Text>
          </View>
          <ToggleSwitch value={rollover} onChange={setRollover} accessibilityLabel="Roll over unspent" />
        </View>
      </View>
    </ModalSheet>
  );
}

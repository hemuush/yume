import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { createCategory, updateCategory } from '@/db/ledger';
import { Category, CategoryKind } from '@/types';
import { FormInput } from '@/components/FormInput';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ModalSheet, SheetLink } from '@/components/ModalSheet';
import { SheetCard } from '@/components/SheetCard';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CATEGORY_COLOR_PALETTE, modalFooterStyles as f, theme } from '@/constants/theme';
import { CATEGORY_ICON_CHOICES } from '@/constants/categories';
import { styles } from './categories.styles';
import { errorMessage } from '@/lib/errorMessage';
import { withPressed } from '@/lib/pressed';
import { useSaveOnce } from '@/lib/useSaveOnce';

const KINDS: { label: string; value: CategoryKind }[] = [
  { label: 'Expense', value: 'expense' },
  { label: 'Income', value: 'income' },
];

export function AddCategoryModal({
  visible,
  category,
  allCategories,
  onClose,
  onSaved,
  onManage,
}: {
  visible: boolean;
  category: Category | null;
  allCategories: Category[];
  onClose: () => void;
  onSaved: () => void;
  /** Opens Archive / Delete for the category being edited — shown for your own categories only. */
  onManage?: () => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [parentId, setParentId] = useState<string | null>(null);
  const [color, setColor] = useState(CATEGORY_COLOR_PALETTE[0]);
  const [icon, setIcon] = useState(CATEGORY_ICON_CHOICES[0]);
  const [isSensitive, setIsSensitive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The form starts fresh each time the sheet opens (or switches to another category). Done while rendering
  // rather than in an effect, so the first painted frame is already the reset form, not last time's.
  const openKey = visible ? (category ? `edit:${category.id}` : 'new') : null;
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (openKey !== syncedKey) {
    setSyncedKey(openKey);
    if (openKey) {
      setName(category?.name ?? '');
      setKind(category?.kind ?? 'expense');
      setParentId(category?.parentId ?? null);
      setColor(category?.color ?? CATEGORY_COLOR_PALETTE[0]);
      setIcon(category?.icon ?? CATEGORY_ICON_CHOICES[0]);
      // Its own flag: one inherited from a hidden parent shows below, but isn't this category's to switch.
      setIsSensitive(category?.ownIsSensitive ?? category?.isSensitive ?? false);
      setError(null);
    }
  }

  // Only a top-level category with no subcategories can be a parent: one level deep only, and a category
  // with children can't become a subcategory (mirrors createCategory/updateCategory in src/db/ledger.ts).
  const thisHasChildren = !!category && allCategories.some((c) => c.parentId === category.id);
  const eligibleParents = allCategories.filter(
    (c) => c.kind === kind && !c.parentId && c.id !== category?.id
  );
  // A category that already has children shows only as itself editing, no
  // parent picker — showing one that can never be used would just confuse.
  const showParentPicker = !thisHasChildren;

  const onKindChange = (next: CategoryKind) => {
    setKind(next);
    setParentId(null); // a parent from the other kind would no longer be valid
  };

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Enter a name');
      return;
    }
    setSaving(true);
    try {
      if (category) {
        await updateCategory(category.id, { name: name.trim(), icon, color, parentId, isSensitive });
      } else {
        await createCategory({ name: name.trim(), kind, color, icon, parentId, isSensitive });
      }
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const submitOnce = useSaveOnce(submit);

  const isSystem = !!category?.isSystem;

  // Calm-sheets layout: a card that takes on the picked colour and icon, then the form.
  // Archive/delete is a quiet link at the end, not a third footer button.
  const parent = allCategories.find((c) => c.id === parentId);
  const parentName = parent?.name;
  // Under a parent marked sensitive, a subcategory is hidden with it (db/spendSql.ts sensitiveOf).
  const hiddenWithParent = !!parent?.isSensitive;
  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton
            title={saving ? 'Saving…' : category ? 'Save changes' : 'Create category'}
            onPress={submitOnce}
            disabled={saving}
          />
        </View>
      }
    >
      <SheetCard
        hue={color}
        icon={icon}
        kicker={kind === 'income' ? 'Income' : 'Expense'}
        title={name.trim() || (category ? category.name : 'New category')}
        meta={
          parentName ? `Inside ${parentName}` : isSensitive ? 'Sensitive · hidden with amounts' : undefined
        }
      />
      <FormInput
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Pet Care"
        editable={!isSystem}
      />
      {isSystem ? (
        <Text style={styles.modalHint}>
          Built-in category — its name and type are fixed because Yume files loan and Friends & Family
          transactions under it automatically. Colour, icon and sensitivity can still be changed.
        </Text>
      ) : category ? (
        <Text style={styles.modalHint}>
          Type ({kind}) can't be changed once a category exists — archive and recreate it instead.
        </Text>
      ) : (
        <>
          <Text style={styles.fieldLabel}>Type</Text>
          <SegmentedControl options={KINDS} value={kind} onChange={onKindChange} />
        </>
      )}
      {showParentPicker && (
        <>
          <Text style={styles.fieldLabel}>
            {category?.parentId ? 'Move to another category' : 'Parent category (optional)'}
          </Text>
          <View style={styles.colorRow}>
            <Pressable
              onPress={() => setParentId(null)}
              accessibilityRole="radio"
              accessibilityLabel={category?.parentId ? 'Top level, no parent category' : 'No parent category'}
              accessibilityState={{ selected: parentId === null, checked: parentId === null }}
              style={withPressed([styles.parentChip, parentId === null && styles.parentChipActive])}
            >
              <Text style={[styles.parentChipText, parentId === null && styles.parentChipTextActive]}>
                {category?.parentId ? 'Top level' : 'None'}
              </Text>
            </Pressable>
            {eligibleParents.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setParentId(p.id)}
                accessibilityRole="radio"
                accessibilityLabel={`Inside ${p.name}`}
                accessibilityState={{ selected: parentId === p.id, checked: parentId === p.id }}
                style={withPressed([styles.parentChip, parentId === p.id && styles.parentChipActive])}
              >
                <Text style={[styles.parentChipText, parentId === p.id && styles.parentChipTextActive]}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {parentId && (
            <Text style={styles.modalHint}>
              {category?.parentId && parentId !== category.parentId ? 'Will move to' : 'A subcategory of'}{' '}
              {allCategories.find((c) => c.id === parentId)?.name} — its spend rolls up into that category's
              total in Reports, with its own split visible on drill-down.
            </Text>
          )}
        </>
      )}
      <Text style={styles.fieldLabel}>Color</Text>
      <View style={styles.colorRow}>
        {CATEGORY_COLOR_PALETTE.map((c, i) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            accessibilityRole="button"
            accessibilityLabel={`Colour ${i + 1} of ${CATEGORY_COLOR_PALETTE.length}`}
            accessibilityState={{ selected: color === c }}
            style={withPressed([
              styles.colorSwatch,
              { backgroundColor: c },
              color === c && styles.colorSwatchActive,
            ])}
          />
        ))}
      </View>
      <Text style={styles.fieldLabel}>Icon</Text>
      <View style={styles.iconGrid}>
        {CATEGORY_ICON_CHOICES.map((iconName) => (
          <Pressable
            key={iconName}
            onPress={() => setIcon(iconName)}
            accessibilityRole="button"
            accessibilityLabel={`${iconName.replace(/-/g, ' ')} icon`}
            accessibilityState={{ selected: icon === iconName }}
            style={withPressed([styles.iconChoice, icon === iconName && styles.iconChoiceActive])}
          >
            <CategoryIcon
              name={iconName}
              color={icon === iconName ? color : theme.colors.surface}
              square={38}
              size={18}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.sensitiveRow}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.fieldLabel}>Treat as sensitive</Text>
          <Text style={styles.modalHint}>
            {hiddenWithParent
              ? `Hidden along with ${parentName}, which is marked sensitive. Change it there.`
              : `When "Hide savings & investment amounts" is on (Settings, or the eye icon on any screen), this category's amounts show masked wherever they appear.`}
          </Text>
        </View>
        <ToggleSwitch
          value={isSensitive || hiddenWithParent}
          onChange={setIsSensitive}
          disabled={hiddenWithParent}
        />
      </View>
      {category && !category.isSystem && onManage && (
        <SheetLink label="Archive or delete" onPress={onManage} disabled={saving} />
      )}
    </ModalSheet>
  );
}

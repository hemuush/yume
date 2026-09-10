import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { createCategory, updateCategory } from '@/db/ledger';
import { Category, CategoryKind } from '@/types';
import { FormInput } from '@/components/FormInput';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ModalSheet } from '@/components/ModalSheet';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CATEGORY_COLOR_PALETTE, modalFooterStyles as f, theme } from '@/constants/theme';
import { CATEGORY_ICON_CHOICES } from '@/constants/categories';
import { styles } from './categories.styles';

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
}: {
  visible: boolean;
  category: Category | null;
  allCategories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [parentId, setParentId] = useState<string | null>(null);
  const [color, setColor] = useState(CATEGORY_COLOR_PALETTE[0]);
  const [icon, setIcon] = useState(CATEGORY_ICON_CHOICES[0]);
  const [isSensitive, setIsSensitive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (category) {
      setName(category.name);
      setKind(category.kind);
      setParentId(category.parentId);
      setColor(category.color);
      setIcon(category.icon);
      setIsSensitive(category.isSensitive);
    } else {
      setName('');
      setKind('expense');
      setParentId(null);
      setColor(CATEGORY_COLOR_PALETTE[0]);
      setIcon(CATEGORY_ICON_CHOICES[0]);
      setIsSensitive(false);
    }
    setError(null);
  }, [visible, category]);

  // Only a top-level category with no subcategories of its own can be a
  // parent — one level deep only, and a category that already has children
  // can't also become a subcategory (mirrors the same guard in
  // src/db/ledger.ts's createCategory/updateCategory).
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
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const isSystem = !!category?.isSystem;

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title={category ? 'Edit Category' : 'New Category'}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={f.footerRow}>
            <PrimaryButton title="Cancel" variant="secondary" onPress={onClose} style={f.footerBtn} />
            <PrimaryButton
              title={saving ? 'Saving...' : category ? 'Save' : 'Create'}
              onPress={submit}
              disabled={saving}
              style={f.footerBtn}
            />
          </View>
        </View>
      }
    >
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
          <Text style={styles.fieldLabel}>Parent category (optional)</Text>
          <View style={styles.colorRow}>
            <Pressable
              onPress={() => setParentId(null)}
              style={[styles.parentChip, parentId === null && styles.parentChipActive]}
            >
              <Text style={[styles.parentChipText, parentId === null && styles.parentChipTextActive]}>
                None
              </Text>
            </Pressable>
            {eligibleParents.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setParentId(p.id)}
                style={[styles.parentChip, parentId === p.id && styles.parentChipActive]}
              >
                <Text style={[styles.parentChipText, parentId === p.id && styles.parentChipTextActive]}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {parentId && (
            <Text style={styles.modalHint}>
              A subcategory of {allCategories.find((c) => c.id === parentId)?.name} — its spend rolls up into
              that category's total in Reports, with its own split visible on drill-down.
            </Text>
          )}
        </>
      )}
      <Text style={styles.fieldLabel}>Color</Text>
      <View style={styles.colorRow}>
        {CATEGORY_COLOR_PALETTE.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchActive]}
          />
        ))}
      </View>
      <Text style={styles.fieldLabel}>Icon</Text>
      <View style={styles.iconGrid}>
        {CATEGORY_ICON_CHOICES.map((iconName) => (
          <Pressable
            key={iconName}
            onPress={() => setIcon(iconName)}
            style={[styles.iconChoice, icon === iconName && styles.iconChoiceActive]}
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
            When "Hide savings & investment amounts" is on (Settings, or the eye icon on any screen), this
            category's amounts show masked wherever they appear.
          </Text>
        </View>
        <ToggleSwitch value={isSensitive} onChange={setIsSensitive} />
      </View>
    </ModalSheet>
  );
}

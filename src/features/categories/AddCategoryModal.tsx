import { useAccent } from '@/theme/AccentContext';
import { selectedFill } from '@/theme/interactionColors';
import { useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { McIconName } from '@/components/iconName';
import { Text } from '@/components/Text';
import { createCategory, updateCategory } from '@/db/ledger';
import { Category, CategoryKind } from '@/types';
import { FormInput } from '@/components/FormInput';
import { SheetTabs } from '@/components/SheetTabs';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ModalSheet, SheetLink } from '@/components/ModalSheet';
import { DraftCard } from '@/components/DraftCard';
import { SwitchRow } from '@/components/SwitchRow';
import { InsightDisclosure } from '@/components/InsightCard';
import { CATEGORY_COLOR_PALETTE, modalFooterStyles as f, theme } from '@/constants/theme';
import { CATEGORY_ICON_CHOICES } from '@/constants/categories';
import { styles, GRID_COLUMNS, GRID_GAP } from './categories.styles';
import { errorMessage } from '@/lib/errorMessage';
import { withPressed } from '@/lib/pressed';
import { useSaveOnce } from '@/lib/useSaveOnce';
import { showPrivacyReminderWarning } from '@/lib/privacyReminderFeedback';
import { softTint } from '@/components/softTint';

const PREVIEW_ICON_COUNT = 24;

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
  initialKind = 'expense',
}: {
  visible: boolean;
  category: Category | null;
  allCategories: Category[];
  onClose: () => void;
  onSaved: () => void;
  /** Opens Archive / Delete for the category being edited — shown for your own categories only. */
  onManage?: () => void;
  initialKind?: CategoryKind;
}) {
  const { accent } = useAccent();
  const [gridWidth, setGridWidth] = useState(0);
  const columns = Math.max(1, Math.min(GRID_COLUMNS, Math.floor((gridWidth + GRID_GAP) / (44 + GRID_GAP))));
  const cell =
    gridWidth > 0 ? Math.max(44, Math.floor((gridWidth - GRID_GAP * (columns - 1)) / columns)) : 44;
  const cellSize = useMemo(() => ({ width: cell, height: cell }), [cell]);
  const [showAllIcons, setShowAllIcons] = useState(false);
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
  const openKey = visible ? (category ? `edit:${category.id}` : `new:${initialKind}`) : null;
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (openKey !== syncedKey) {
    setSyncedKey(openKey);
    if (openKey) {
      setName(category?.name ?? '');
      setKind(category?.kind ?? initialKind);
      setParentId(category?.parentId ?? null);
      setColor(category?.color ?? CATEGORY_COLOR_PALETTE[0]);
      setIcon(category?.icon ?? CATEGORY_ICON_CHOICES[0]);
      // Its own flag: one inherited from a hidden parent shows below, but isn't this category's to switch.
      setIsSensitive(category?.ownIsSensitive ?? category?.isSensitive ?? false);
      setError(null);
      setShowAllIcons(false);
    }
  }

  // Parents must be top-level: only one nesting level. A category with children can't become a subcategory
  // (mirrors createCategory/updateCategory in src/db/ledger.ts).
  const thisHasChildren = !!category && allCategories.some((c) => c.parentId === category.id);
  const eligibleParents = allCategories.filter(
    (c) => c.kind === kind && !c.parentId && c.id !== category?.id
  );
  // Categories with children and built-ins have no available parent change, so omit the picker.
  const showParentPicker = !thisHasChildren && !category?.isSystem;

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
        const refreshed = await updateCategory(category.id, {
          name: name.trim(),
          icon,
          color,
          parentId,
          isSensitive,
        });
        if (refreshed === false) showPrivacyReminderWarning();
      } else {
        await createCategory(
          { name: name.trim(), kind, color, icon, parentId, isSensitive },
          showPrivacyReminderWarning
        );
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
  const previewIcons = CATEGORY_ICON_CHOICES.slice(0, PREVIEW_ICON_COUNT);
  if (!previewIcons.includes(icon)) previewIcons[previewIcons.length - 1] = icon;
  const visibleIcons = showAllIcons ? CATEGORY_ICON_CHOICES : previewIcons;
  return (
    <ModalSheet
      dismissible={!saving}
      title={category ? 'Edit category' : 'New category'}
      visible={visible}
      onClose={onClose}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton
            loading={saving}
            title={saving ? 'Saving…' : category ? 'Save changes' : 'Create category'}
            onPress={submitOnce}
            disabled={saving}
          />
        </View>
      }
    >
      <DraftCard
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
          Built-in category — its name, type and parent are fixed because Yume files loan and Friends & Family
          entries under it. Colour, icon and sensitivity can still be changed.
        </Text>
      ) : category ? (
        <Text style={styles.modalHint}>
          Type ({kind}) can't be changed once a category exists — archive and recreate it instead.
        </Text>
      ) : (
        <>
          <Text style={styles.fieldLabel}>Type</Text>
          <SheetTabs options={KINDS} value={kind} onChange={onKindChange} />
        </>
      )}
      {showParentPicker && (
        <InsightDisclosure
          key={openKey}
          title={category?.parentId ? 'Move to another category' : 'Parent category (optional)'}
        >
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setParentId(null)}
              accessibilityRole="radio"
              accessibilityLabel={category?.parentId ? 'Top level, no parent category' : 'No parent category'}
              accessibilityState={{ selected: parentId === null, checked: parentId === null }}
              style={withPressed([
                styles.parentChip,
                parentId === null && [
                  { backgroundColor: selectedFill(accent), borderColor: selectedFill(accent) },
                ],
              ])}
            >
              <Text style={styles.parentChipText}>{category?.parentId ? 'Top level' : 'None'}</Text>
            </Pressable>
            {eligibleParents.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setParentId(p.id)}
                accessibilityRole="radio"
                accessibilityLabel={`Inside ${p.name}`}
                accessibilityState={{ selected: parentId === p.id, checked: parentId === p.id }}
                style={withPressed([
                  styles.parentChip,
                  parentId === p.id && [
                    { backgroundColor: selectedFill(accent), borderColor: selectedFill(accent) },
                  ],
                ])}
              >
                <Text style={styles.parentChipText}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
          {parentId && (
            <Text style={styles.modalHint}>
              {category?.parentId && parentId !== category.parentId ? 'Will move to' : 'A subcategory of'}{' '}
              {allCategories.find((c) => c.id === parentId)?.name} — its spend rolls up into that category's
              total in Reports.
            </Text>
          )}
        </InsightDisclosure>
      )}
      <View style={styles.appearance}>
        <Text style={styles.appearanceTitle}>Make it yours</Text>
        <Text style={styles.pickerLabel}>Color</Text>
        <View style={styles.colorRow} onLayout={(e) => setGridWidth(Math.round(e.nativeEvent.layout.width))}>
          {gridWidth > 0 &&
            CATEGORY_COLOR_PALETTE.map((c, i) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                accessibilityRole="button"
                accessibilityLabel={`Colour ${i + 1} of ${CATEGORY_COLOR_PALETTE.length}`}
                accessibilityState={{ selected: color === c }}
                style={withPressed([styles.colorSwatch, cellSize, color === c && styles.colorSwatchActive])}
              >
                <View style={[styles.colorSwatchFill, { backgroundColor: c }]}>
                  {color === c && <Feather name="check" size={17} color={theme.colors.ink} />}
                </View>
              </Pressable>
            ))}
        </View>
        <Text style={styles.pickerLabel}>Icon</Text>
        <View style={styles.iconGrid}>
          {gridWidth > 0 &&
            visibleIcons.map((iconName) => (
              <Pressable
                key={iconName}
                onPress={() => setIcon(iconName)}
                accessibilityRole="button"
                accessibilityLabel={`${iconName.replace(/-/g, ' ')} icon`}
                accessibilityState={{ selected: icon === iconName }}
                style={withPressed([
                  styles.iconChoice,
                  cellSize,
                  icon === iconName && [styles.iconChoiceActive, { backgroundColor: softTint(color, 0.4) }],
                ])}
              >
                <MaterialCommunityIcons name={iconName as McIconName} color={theme.colors.ink} size={22} />
              </Pressable>
            ))}
        </View>
        <Pressable
          onPress={() => setShowAllIcons((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showAllIcons ? 'Show fewer icons' : 'Browse all icons'}
          accessibilityState={{ expanded: showAllIcons }}
          style={withPressed(styles.moreIcons)}
        >
          <Text style={styles.moreIconsText}>{showAllIcons ? 'Show fewer icons' : 'Browse all icons'}</Text>
          <Feather
            name={showAllIcons ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      </View>
      <SwitchRow
        title="Treat as sensitive"
        hint={
          hiddenWithParent
            ? `Hidden along with ${parentName}, which is marked sensitive. Change it there.`
            : 'Amounts show masked while "Hide savings & investment amounts" is on (Settings, or the eye icon).'
        }
        value={isSensitive || hiddenWithParent}
        onChange={setIsSensitive}
        disabled={hiddenWithParent}
      />
      {category && !category.isSystem && onManage && (
        <SheetLink label="Archive or delete" onPress={onManage} disabled={saving} />
      )}
    </ModalSheet>
  );
}

import { useAccent } from '@/theme/AccentContext';
import { selectedFill } from '@/theme/interactionColors';
import { useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { CategoryGlyph } from '@/components/CategoryGlyph';
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
import {
  DEFAULT_CATEGORY_ICON,
  isEmojiIcon,
  normalizeCategoryIcon,
  parseEmojiInput,
} from '@/lib/categoryIcon';
import { styles, GRID_COLUMNS, GRID_GAP } from './categories.styles';
import { errorMessage } from '@/lib/errorMessage';
import { withPressed } from '@/lib/pressed';
import { useSaveOnce } from '@/lib/useSaveOnce';
import { showPrivacyReminderWarning } from '@/lib/privacyReminderFeedback';
import { softTint } from '@/components/softTint';

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
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [parentId, setParentId] = useState<string | null>(null);
  const [color, setColor] = useState(CATEGORY_COLOR_PALETTE[0]);
  const [icon, setIcon] = useState(DEFAULT_CATEGORY_ICON);
  // The icon a category being edited already has, when it is a built-in one the picker no longer lists (the defaults
  // `gas-station` or `shield-check`, or one picked before the list was cut): it stays on offer while editing, so nothing
  // is lost by opening the editor.
  const [keptIcon, setKeptIcon] = useState<string | null>(null);
  // The person's own emoji: the text in the field, whether the field is open, and what is wrong with it, if anything.
  const [emojiDraft, setEmojiDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiError, setEmojiError] = useState<string | null>(null);
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
      const startIcon = category ? normalizeCategoryIcon(category.icon) : DEFAULT_CATEGORY_ICON;
      setIcon(startIcon);
      setKeptIcon(isEmojiIcon(startIcon) || CATEGORY_ICON_CHOICES.includes(startIcon) ? null : startIcon);
      setEmojiDraft(isEmojiIcon(startIcon) ? startIcon : '');
      setEmojiOpen(isEmojiIcon(startIcon));
      setEmojiError(null);
      // Its own flag: one inherited from a hidden parent shows below, but isn't this category's to switch.
      setIsSensitive(category?.ownIsSensitive ?? category?.isSensitive ?? false);
      setError(null);
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
    if (emojiOpen && emojiError) {
      setError('Fix the emoji, or pick one of the icons instead.');
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
  const builtInIcons = keptIcon ? [...CATEGORY_ICON_CHOICES, keptIcon] : CATEGORY_ICON_CHOICES;
  const emojiChosen = isEmojiIcon(icon);

  const pickBuiltIn = (name: string) => {
    setIcon(name);
    setEmojiOpen(false);
    setEmojiError(null);
  };
  // Opens the field (or folds it away), and picks the emoji typed earlier again, if there is one.
  const toggleEmoji = () => {
    if (emojiOpen) {
      setEmojiOpen(false);
      return;
    }
    setEmojiOpen(true);
    const typed = parseEmojiInput(emojiDraft);
    if (typed.kind === 'ok') setIcon(typed.emoji);
  };
  const typeEmoji = (text: string) => {
    setEmojiDraft(text);
    const typed = parseEmojiInput(text);
    if (typed.kind === 'ok') {
      setIcon(typed.emoji);
      setEmojiError(null);
    } else if (typed.kind === 'empty') {
      // Nothing typed: back to the default icon, but only if the emoji was what is chosen.
      if (emojiChosen) setIcon(DEFAULT_CATEGORY_ICON);
      setEmojiError(null);
    } else {
      // The last good icon stays in the preview; Save is held until the field is fixed or an icon is picked.
      setEmojiError(
        typed.kind === 'many' ? 'One emoji only.' : 'That isn’t an emoji. Use your keyboard’s emoji key.'
      );
    }
  };
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
          Type ({kind}) can’t be changed once a category exists — archive and recreate it instead.
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
              {allCategories.find((c) => c.id === parentId)?.name} — its spend rolls up into that category’s
              total in Reports.
            </Text>
          )}
        </InsightDisclosure>
      )}
      <View style={styles.appearance}>
        <Text style={styles.appearanceTitle}>Make it yours</Text>
        <Text style={styles.pickerLabel}>Colour</Text>
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
            builtInIcons.map((iconName) => (
              <Pressable
                key={iconName}
                onPress={() => pickBuiltIn(iconName)}
                accessibilityRole="button"
                accessibilityLabel={`${iconName.replace(/-/g, ' ')} icon`}
                accessibilityState={{ selected: icon === iconName }}
                style={withPressed([
                  styles.iconChoice,
                  cellSize,
                  icon === iconName && [styles.iconChoiceActive, { backgroundColor: softTint(color, 0.4) }],
                ])}
              >
                <CategoryGlyph name={iconName} color={theme.colors.ink} size={22} />
              </Pressable>
            ))}
        </View>
        <Pressable
          onPress={toggleEmoji}
          accessibilityRole="button"
          accessibilityLabel={emojiChosen ? 'Your own emoji, selected' : 'Use your own emoji'}
          accessibilityState={{ selected: emojiChosen, expanded: emojiOpen }}
          style={withPressed([styles.ownEmojiRow, emojiChosen && styles.ownEmojiRowActive])}
        >
          <View style={[styles.ownEmojiBadge, emojiChosen && { backgroundColor: softTint(color, 0.4) }]}>
            {emojiChosen ? (
              <CategoryGlyph name={icon} color={theme.colors.ink} size={20} />
            ) : (
              <Feather name="plus" size={18} color={theme.colors.ink} />
            )}
          </View>
          <Text style={styles.ownEmojiText}>{emojiChosen ? 'Your own emoji' : 'Use your own emoji'}</Text>
          <Feather
            name={emojiOpen ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={theme.colors.textSecondary}
          />
        </Pressable>
        {emojiOpen && (
          <View style={styles.ownEmojiField}>
            <FormInput
              label="Your emoji"
              value={emojiDraft}
              onChangeText={typeEmoji}
              placeholder="Type or paste one emoji"
              autoCorrect={false}
              autoCapitalize="none"
              maxLength={40}
            />
            {emojiError ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {emojiError}
              </Text>
            ) : (
              <Text style={styles.modalHint}>
                {emojiDraft.trim()
                  ? 'Shown wherever this category appears.'
                  : 'Use your keyboard’s emoji key, or paste one. Left empty, the tag icon is used.'}
              </Text>
            )}
          </View>
        )}
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

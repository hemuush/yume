import { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { AppHeader } from '@/components/AppHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CategoryPicker } from '@/components/CategoryPicker';
import { ModalSheet } from '@/components/ModalSheet';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { homeStyles as h } from '@/features/home/homeStyles';
import { childrenOf } from '@/lib/categoryTree';
import { formatMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { haptics } from '@/lib/haptics';
import { AmountPad } from './AmountPad';
import { applyPadKey, PadKey } from './padMath';
import { SplitMeter } from './SplitCard';
import { getSplitSession, finishSplitSession } from './splitSession';
import {
  DraftPart,
  newPartKey,
  partAmounts,
  splitProblem,
  splitProblemText,
  canAddPart,
  canRemovePart,
} from './splitDraft';

/** Which part the category sheet is for: a new one, or changing one already there. */
type Picking = { mode: 'add' } | { mode: 'change'; key: string };

/**
 * The split page (the split redesign sign-off): one payment spread across
 * 2–6 categories. The first part holds whatever the others don't, so the
 * split always adds up; the others are typed on Yume's own pad, one at a
 * time. Done hands the parts back to Add (splitSession.ts), and Add's Save
 * saves them. Back leaves Add as it was.
 */
export function SplitScreen() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [session] = useState(getSplitSession);
  const [parts, setParts] = useState<DraftPart[]>(() => session?.parts ?? []);
  // The part the pad types into; never the first, which holds the rest.
  const [target, setTarget] = useState<string | null>(null);
  const [picking, setPicking] = useState<Picking | null>(null);
  const [pickNote, setPickNote] = useState<string | null>(null);

  // Reached without Add opening a split (a stale deep link): nothing to show.
  useEffect(() => {
    if (!session) router.back();
  }, [session]);
  if (!session) return null;

  const { totalMinor, categories, currency } = session;
  const money = (minor: number) => formatMoney(minor, currency);
  const amounts = partAmounts(totalMinor, parts);
  const rest = amounts[0] ?? totalMinor;
  const problem = splitProblem(totalMinor, parts);
  const catOf = (p: DraftPart | undefined) => categories.find((c) => c.id === p?.categoryId);
  const nameOf = (key: string) => catOf(parts.find((p) => p.key === key))?.name ?? 'this part';
  const targetPart =
    parts.findIndex((p) => p.key === target) > 0 ? parts.find((p) => p.key === target) : undefined;

  const update = (key: string, patch: Partial<DraftPart>) =>
    setParts((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const onPadKey = (key: PadKey) => {
    if (!targetPart) return;
    update(targetPart.key, { amountText: applyPadKey(targetPart.amountText, key) });
  };

  const removePart = (key: string) => {
    if (!canRemovePart(parts, key)) return;
    haptics.tap();
    setParts((prev) => prev.filter((p) => p.key !== key));
    if (target === key) setTarget(null);
  };

  const openPicker = (next: Picking) => {
    setPickNote(null);
    setPicking(next);
  };

  const onPickCategory = (id: string) => {
    if (!picking) return;
    const changingKey = picking.mode === 'change' ? picking.key : null;
    if (parts.some((p) => p.categoryId === id && p.key !== changingKey)) {
      haptics.warn();
      setPickNote('That category is already in this split.');
      return;
    }
    setPickNote(null);
    let key = changingKey;
    if (key) {
      update(key, { categoryId: id });
    } else {
      key = newPartKey();
      const added = key;
      setParts((prev) => [...prev, { key: added, categoryId: id, amountText: '' }]);
      // A new part is the one you'll type next.
      setTarget(added);
    }
    // A category with subcategories stays open for them, now as a change to this same part.
    if (childrenOf(categories, id).length > 0) setPicking({ mode: 'change', key });
    else setPicking(null);
  };

  const onDone = () => {
    if (problem) return;
    finishSplitSession(parts);
    router.back();
  };

  const overLine =
    problem?.kind === 'over'
      ? problem.overMinor > 0
        ? `The other parts come to ${money(problem.overMinor)} more than the whole payment.`
        : `That leaves nothing for ${nameOf(parts[0].key)}.`
      : null;

  const pickingKey = picking?.mode === 'change' ? picking.key : null;
  const doneButton = (
    <PrimaryButton
      title={problem ? splitProblemText(problem, parts, nameOf, money) : 'Done'}
      onPress={onDone}
      disabled={problem != null}
      style={styles.done}
    />
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Split payment" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[h.card, styles.summary]}>
          <Text style={styles.total}>{money(totalMinor)}</Text>
          {session.meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {session.meta}
            </Text>
          ) : null}
          <View style={styles.meterGap}>
            <SplitMeter parts={parts} amounts={amounts} categories={categories} />
          </View>
        </View>

        <View style={[h.card, styles.parts]}>
          {parts.map((p, i) => {
            const cat = catOf(p);
            const amount = amounts[i];
            const first = i === 0;
            const live = targetPart?.key === p.key;
            const share = amount > 0 && totalMinor > 0 ? `${Math.round((amount / totalMinor) * 100)}%` : null;
            return (
              <View key={p.key} style={[h.row, i > 0 && h.divider]}>
                <Pressable
                  onPress={() => openPicker({ mode: 'change', key: p.key })}
                  style={withPressed(styles.pickArea)}
                  accessibilityRole="button"
                  accessibilityLabel={`${cat ? cat.name : 'No category yet'}. Change category`}
                >
                  <CategoryIcon
                    name={cat?.icon ?? 'tag-outline'}
                    color={cat?.color ?? theme.colors.inkHairline}
                  />
                  <View style={h.mid}>
                    <Text style={[h.title, !cat && styles.placeholder]} numberOfLines={1}>
                      {cat ? cat.name : 'Pick a category'}
                    </Text>
                    {share && <Text style={h.sub}>{share}</Text>}
                  </View>
                </Pressable>
                {first ? (
                  <View
                    style={[styles.box, styles.restBox, rest <= 0 && parts.length > 1 && styles.restBoxBad]}
                    accessible
                    accessibilityLabel={`${cat?.name ?? 'This part'} holds the rest, ${money(Math.max(0, rest))}`}
                  >
                    <Text style={[styles.restLabel, rest <= 0 && parts.length > 1 && styles.bad]}>
                      The rest
                    </Text>
                    <Text
                      style={[styles.boxText, styles.restText, rest <= 0 && parts.length > 1 && styles.bad]}
                    >
                      {money(Math.max(0, rest))}
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      haptics.tap();
                      setTarget(p.key);
                    }}
                    style={[styles.box, live && styles.boxLive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: live }}
                    accessibilityLabel={`${cat?.name ?? 'This part'} amount, ${money(amount)}. Type it`}
                  >
                    <View style={styles.boxRow}>
                      <Text style={[styles.boxText, amount <= 0 && styles.placeholder]}>{money(amount)}</Text>
                      {live && <View style={styles.caret} />}
                    </View>
                  </Pressable>
                )}
                {!first && (
                  <Pressable
                    onPress={() => removePart(p.key)}
                    hitSlop={8}
                    style={withPressed(styles.remove)}
                    accessibilityRole="button"
                    accessibilityLabel={`Take ${cat?.name ?? 'this part'} out of the split`}
                  >
                    <Feather name="x" size={12} color={theme.colors.textSecondary} />
                  </Pressable>
                )}
              </View>
            );
          })}
          {canAddPart(parts) && (
            <Pressable
              onPress={() => openPicker({ mode: 'add' })}
              style={withPressed([h.row, h.divider, styles.addRow])}
              accessibilityRole="button"
            >
              <Feather
                name="plus"
                size={16}
                color={parts.length < 2 ? theme.colors.textPrimary : theme.colors.textSecondary}
              />
              <Text style={[styles.addText, parts.length < 2 && styles.addTextLead]}>Add a category</Text>
            </Pressable>
          )}
        </View>

        {overLine ? (
          <Text style={[styles.hint, styles.bad]}>{overLine}</Text>
        ) : parts.length < 2 ? (
          <Text style={styles.hint}>
            The first category always holds whatever the others don&rsquo;t, so the split adds up on its own.
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {targetPart ? (
          <>
            <Text style={styles.typing} numberOfLines={1}>
              Typing into <Text style={styles.typingName}>{nameOf(targetPart.key)}</Text>
            </Text>
            <AmountPad onKey={onPadKey} onClear={() => update(targetPart.key, { amountText: '' })}>
              {doneButton}
            </AmountPad>
          </>
        ) : (
          <View style={styles.actionRow}>{doneButton}</View>
        )}
      </View>

      {/* The sheet hugs its grid and sits on the bottom edge; the grid scrolls in
          place only when a long category list needs it. */}
      <ModalSheet
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title={picking?.mode === 'add' ? 'Add a category' : 'Change category'}
        scrollable={false}
      >
        {pickNote && <Text style={[styles.pickNote, styles.bad]}>{pickNote}</Text>}
        <ScrollView
          style={{ maxHeight: screenHeight * 0.62 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <CategoryPicker
            categories={categories}
            selectedId={pickingKey ? (parts.find((p) => p.key === pickingKey)?.categoryId ?? null) : null}
            onSelect={onPickCategory}
            variant="medal"
            searchable
            // Already in this split: faded, so it's clear which ones are taken.
            dimmedIds={parts
              .filter((p) => p.key !== pickingKey && p.categoryId)
              .map((p) => p.categoryId as string)}
          />
        </ScrollView>
      </ModalSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingTop: theme.layout.screenTopGap },
  summary: { padding: 16 },
  total: { fontFamily: theme.font.monoBold, fontSize: 28, color: theme.colors.textPrimary },
  meta: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
  meterGap: { marginTop: 14 },
  parts: { marginTop: 14 },
  pickArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  placeholder: { color: theme.colors.textMuted, fontFamily: theme.font.body },
  box: {
    minWidth: 96,
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  boxLive: { borderColor: theme.colors.ink, backgroundColor: theme.colors.surface },
  boxRow: { flexDirection: 'row', alignItems: 'center' },
  boxText: { fontFamily: theme.font.monoBold, fontSize: 13.5, color: theme.colors.textPrimary },
  caret: { width: 1.5, height: 15, backgroundColor: theme.colors.ink, marginLeft: 2 },
  restBox: { backgroundColor: theme.colors.secondaryTint, paddingVertical: 6 },
  restBoxBad: { backgroundColor: theme.colors.expenseTint },
  restLabel: {
    ...EYEBROW,
    fontFamily: theme.font.bodyBold,
    fontSize: 10,
    color: theme.colors.income,
    marginBottom: 2,
  },
  restText: { color: theme.colors.income },
  bad: { color: theme.colors.expense },
  remove: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  addRow: { minHeight: 52, gap: 10 },
  addText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  addTextLead: { color: theme.colors.textPrimary },
  hint: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textMuted,
    marginTop: 10,
    marginHorizontal: 24,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  typing: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  typingName: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  done: { flex: 1 },
  actionRow: { flexDirection: 'row' },
  pickNote: { fontFamily: theme.font.bodyBold, fontSize: 12, marginBottom: 10 },
});

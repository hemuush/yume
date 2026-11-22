import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AmountPad } from '@/components/AmountPad';
import { CalendarSheet } from '@/components/CalendarSheet';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CategoryPicker } from '@/components/CategoryPicker';
import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, TextInput } from '@/components/Text';
import { theme } from '@/constants/theme';
import { AccountPickList } from '@/features/add/components/AccountPickList';
import { typeWash } from '@/features/add/addEntry';
import { SkyHeader } from '@/features/home/SkyHeader';
import { AddPersonModal } from '@/features/people/AddPersonModal';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { useCollapsingHeader } from '@/hooks/useCollapsingHeader';
import { childrenOf } from '@/lib/categoryTree';
import { addDaysToIsoDate } from '@/lib/date';
import { formatMaskableMoney, formatMoneyExact } from '@/lib/money';
import { hasOperator } from '@/lib/padMath';
import { withPressed } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { usableAccounts, usableCategories } from './chatEntry';
import { useChatAdd } from './useChatAdd';
import { ChatSummary, TYPES } from './ChatSummary';
import { s } from './chatStyles';

/**
 * Add by chat: Suu asks one thing at a time and the answer is a tap: your usual entries in one go, the form's own
 * category grid and account list, this category's usual amounts above the form's number pad, the app's calendar. Only
 * a note is ever typed, and only if you want one. The end is a summary with every field tappable (and Money back),
 * then Save, which is the form's own save (see useChatAdd).
 */
export function AddChatScreen() {
  const insets = useSafeAreaInsets();
  const { accent } = useAccent();
  const { hideAmounts } = usePrivacy();
  const chat = useChatAdd();
  /** A usual entry's amount, hidden for a sensitive category while savings amounts are hidden (as the form's chips). */
  const usualMoney = (u: { amountMinor: number; accountCurrency: string; isSensitive?: boolean }) =>
    formatMaskableMoney(u.amountMinor, {
      currency: u.accountCurrency,
      masked: hideAmounts && !!u.isSensitive,
    });
  const [text, setText] = useState('');
  const [noteTyping, setNoteTyping] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [addPerson, setAddPerson] = useState(false);
  const [addAccount, setAddAccount] = useState(false);
  // A parent category picked while its subcategories are shown: used as it is, or one of them is tapped instead.
  const [pickedParent, setPickedParent] = useState<string | null>(null);
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const [barHeight, setBarHeight] = useState(0);
  const { entry, step, lookups } = chat;
  const typing = step === 'note' && noteTyping;

  // New words or a new card: keep the end of the conversation in view.
  const marker = `${chat.transcript.length}:${step}`;
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [marker, scrollRef]);
  useEffect(() => {
    setPickedParent(null);
    setNoteTyping(false);
    setText('');
  }, [step]);

  const submit = () => {
    if (!text.trim()) return;
    chat.submitNote(text);
  };

  /** A category picked for the entry, or for the next part of a split. */
  const chooseCategory = (id: string) => {
    if (step === 'splitCategory') chat.pickSplitCategory(id);
    else chat.answer('category', id);
  };

  const categories =
    entry && (entry.type === 'income' || entry.type === 'expense')
      ? usableCategories(lookups, entry.type)
      : [];
  const accounts = usableAccounts(lookups);
  const currency = lookups.accounts.find((a) => a.id === entry?.accountId)?.currency;

  return (
    <View style={s.container}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: headerHeight + 8,
          paddingBottom: (typing ? barHeight : 0) + insets.bottom + 24,
        }}
      >
        {chat.transcript.map((m) => (
          <View key={m.id} style={[s.bubbleRow, m.from === 'you' && s.bubbleRowYou]}>
            <View style={[s.bubble, m.from === 'you' ? s.bubbleYou : s.bubbleSuu]}>
              <Text style={[s.bubbleText, m.from === 'you' && s.bubbleTextYou]}>{m.text}</Text>
            </View>
          </View>
        ))}

        {step === 'type' && (
          <View style={s.typeGrid} accessibilityRole="radiogroup" accessibilityLabel="What to add">
            {TYPES.map((t) => {
              const wash = typeWash(t.value, accent);
              return (
                <Pressable
                  key={t.value}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${t.label}`}
                  disabled={!chat.ready}
                  onPress={() => void chat.start(t.value)}
                  style={withPressed([s.typeCard, { backgroundColor: wash.bg }])}
                >
                  <Feather name={t.icon} size={22} color={wash.accent} />
                  <Text style={[s.typeLabel, { color: wash.accent }]}>{t.label}</Text>
                  <Text style={s.typeHint}>{t.hint}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {entry && step === 'usual' && (
          <View style={s.pickCard}>
            {chat.usual.map((u) => (
              <Pressable
                key={`${u.categoryId}:${u.amountMinor}:${u.accountId}`}
                accessibilityRole="button"
                accessibilityLabel={`${u.categoryName}, ${usualMoney(u)}`}
                onPress={() => chat.pickUsual(u)}
                style={withPressed(s.usualRow)}
              >
                <CategoryIcon name={u.categoryIcon} color={u.categoryColor} />
                <View style={s.usualMid}>
                  <Text style={s.value} numberOfLines={1}>
                    {u.parentName ? `${u.parentName} › ${u.categoryName}` : u.categoryName}
                  </Text>
                  <Text style={s.typeHint} numberOfLines={1}>
                    {lookups.accounts.find((a) => a.id === u.accountId)?.name ?? ''}
                    {u.note ? ` · ${u.note}` : ''}
                  </Text>
                </View>
                <Text style={s.value}>{usualMoney(u)}</Text>
              </Pressable>
            ))}
            <PrimaryButton
              title="Something else"
              variant="secondary"
              compact
              onPress={chat.skipUsual}
              style={s.useParent}
            />
          </View>
        )}

        {entry && (step === 'category' || step === 'splitCategory') && (
          <View style={s.pickCard}>
            <CategoryPicker
              categories={categories}
              selectedId={pickedParent ?? (step === 'category' ? entry.categoryId : null)}
              onSelect={(id) => {
                // A category with subcategories shows them first: tap one, or use the parent as it is.
                if (childrenOf(categories, id).length > 0) setPickedParent(id);
                else chooseCategory(id);
              }}
              variant="medal"
              searchable
              compact
            />
            {pickedParent && (
              <PrimaryButton
                title={`Use ${categories.find((c) => c.id === pickedParent)?.name ?? 'this'}`}
                variant="secondary"
                compact
                onPress={() => chooseCategory(pickedParent)}
                style={s.useParent}
              />
            )}
          </View>
        )}

        {entry && (step === 'amount' || step === 'splitAmount') && (
          <View style={s.pickCard}>
            <View style={s.display} accessibilityLiveRegion="polite">
              <Text style={s.displayAmount}>{formatMoneyExact(chat.padMinor ?? 0, currency)}</Text>
              {hasOperator(chat.padExpr) && <Text style={s.typeHint}>{chat.padExpr}</Text>}
            </View>
            {step === 'amount' && chat.amountChips.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.amountChips}
              >
                {chat.amountChips.map((minor) => (
                  <Chip
                    key={minor}
                    label={formatMoneyExact(minor, currency)}
                    active={chat.padMinor === minor}
                    onPress={() => chat.answer('amount', minor)}
                  />
                ))}
              </ScrollView>
            )}
            <AmountPad onKey={chat.padKey} onClear={chat.clearPad}>
              <PrimaryButton
                title="Done"
                onPress={step === 'splitAmount' ? chat.finishSplitAmount : chat.finishAmount}
                disabled={chat.padMinor === null}
                style={s.done}
              />
            </AmountPad>
          </View>
        )}

        {entry && (step === 'account' || step === 'toAccount') && (
          <View style={s.pickCard}>
            {entry.type === 'friend' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Not tied to an account"
                onPress={() => chat.answer('account', '')}
                style={withPressed(s.noneRow)}
              >
                <Feather name="slash" size={16} color={theme.colors.textSecondary} />
                <Text style={s.noneText}>Not tied to an account</Text>
              </Pressable>
            )}
            <AccountPickList
              accounts={step === 'toAccount' ? accounts.filter((a) => a.id !== entry.accountId) : accounts}
              activeId={step === 'toAccount' ? entry.toAccountId : entry.accountId}
              onPick={(id) => chat.answer(step as 'account' | 'toAccount', id)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add an account"
              onPress={() => setAddAccount(true)}
              style={withPressed(s.noneRow)}
            >
              <Feather name="plus" size={16} color={theme.colors.link} />
              <Text style={s.footText}>Add an account</Text>
            </Pressable>
          </View>
        )}

        {entry && step === 'person' && (
          <View style={s.pickCard}>
            {lookups.people.length > 0 && (
              <View style={s.chips}>
                {lookups.people.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.name}
                    active={entry.personId === p.id}
                    onPress={() => chat.answer('person', p.id)}
                  />
                ))}
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a person"
              onPress={() => setAddPerson(true)}
              style={withPressed(s.noneRow)}
            >
              <Feather name="plus" size={16} color={theme.colors.link} />
              <Text style={s.footText}>
                {lookups.people.length > 0 ? 'Add a person' : 'Add your first person'}
              </Text>
            </Pressable>
          </View>
        )}

        {entry && step === 'direction' && (
          <View style={s.twoCards}>
            {(
              [
                { label: 'I gave', hint: 'They owe me', value: 1 },
                { label: 'I got', hint: 'I owe them', value: -1 },
              ] as const
            ).map((d) => (
              <Pressable
                key={d.value}
                accessibilityRole="button"
                accessibilityLabel={d.label}
                onPress={() => chat.answer('direction', d.value)}
                style={withPressed([s.bigCard, entry.friendSign === d.value && s.bigCardOn])}
              >
                <Text style={s.bigLabel}>{d.label}</Text>
                <Text style={s.typeHint}>{d.hint}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {entry && step === 'date' && (
          <View style={s.twoCards}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Today"
              onPress={() => chat.answer('date', lookups.today)}
              style={withPressed([s.bigCard, entry.date === lookups.today && s.bigCardOn])}
            >
              <Text style={s.bigLabel}>Today</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Yesterday"
              onPress={() => chat.answer('date', addDaysToIsoDate(lookups.today, -1))}
              style={withPressed(s.bigCard)}
            >
              <Text style={s.bigLabel}>Yesterday</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pick a date"
              onPress={() => setCalendar(true)}
              style={withPressed(s.bigCard)}
            >
              <Feather name="calendar" size={18} color={theme.colors.textPrimary} />
              <Text style={s.bigLabel}>Pick a date</Text>
            </Pressable>
          </View>
        )}

        {entry && step === 'splitMore' && (
          <View style={s.twoCards}>
            {chat.canAddPart && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add another part"
                onPress={chat.addSplitPart}
                style={withPressed(s.bigCard)}
              >
                <Feather name="plus" size={18} color={theme.colors.textPrimary} />
                <Text style={s.bigLabel}>Add another part</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done splitting"
              onPress={chat.finishSplit}
              style={withPressed([s.bigCard, s.bigCardOn])}
            >
              <Text style={s.bigLabel}>Done</Text>
            </Pressable>
          </View>
        )}

        {step === 'note' && (
          <View style={s.noteRow}>
            <PrimaryButton title="No note" compact onPress={chat.skip} />
            {!noteTyping && (
              <PrimaryButton
                title="Add a note"
                variant="secondary"
                compact
                onPress={() => setNoteTyping(true)}
              />
            )}
          </View>
        )}

        {entry && step === 'summary' && chat.summary && <ChatSummary chat={chat} entry={entry} />}

        {entry && (
          <View style={s.foot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit in the form"
              onPress={chat.editInForm}
              hitSlop={8}
              style={withPressed(s.footBtn)}
            >
              <Text style={s.footText}>Edit in form</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start over"
              onPress={() => chat.reset('No problem. What would you like to add?')}
              hitSlop={8}
              style={withPressed(s.footBtn)}
            >
              <Text style={s.footText}>Start over</Text>
            </Pressable>
          </View>
        )}
      </Animated.ScrollView>

      <SkyHeader
        title="Add by chat"
        showBack
        hideUser
        wallpaper
        expandedTitleSize={26}
        collapse={collapse}
        actions={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use the form instead"
            onPress={() => router.replace('/add-transaction')}
            style={withPressed(s.formLink)}
          >
            <Feather name="edit-3" size={15} color={theme.colors.textPrimary} />
            <Text style={s.formLinkText}>Form</Text>
          </Pressable>
        }
      />

      {typing && (
        <KeyboardStickyView
          offset={{ opened: insets.bottom }}
          style={[s.bar, { paddingBottom: insets.bottom + 10 }]}
          onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
        >
          <View style={s.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={submit}
              placeholder="Note"
              placeholderTextColor={theme.colors.textMuted}
              returnKeyType="done"
              blurOnSubmit={false}
              autoFocus
              style={s.input}
              accessibilityLabel="Note"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              disabled={!text.trim()}
              onPress={submit}
              style={withPressed([s.send, !text.trim() && s.sendOff])}
            >
              <Feather name="arrow-up" size={20} color={theme.colors.onInk} />
            </Pressable>
          </View>
        </KeyboardStickyView>
      )}

      {entry && (
        <CalendarSheet
          visible={calendar}
          value={entry.date}
          quickPicks
          onClose={() => setCalendar(false)}
          onPick={(iso) => {
            setCalendar(false);
            chat.answer('date', iso);
          }}
        />
      )}
      <AddPersonModal
        visible={addPerson}
        onClose={() => setAddPerson(false)}
        onCreated={() => {
          setAddPerson(false);
          void chat.refreshLists();
        }}
      />
      <AddAccountModal
        visible={addAccount}
        onClose={() => setAddAccount(false)}
        onCreated={() => {
          setAddAccount(false);
          void chat.refreshLists();
        }}
      />
    </View>
  );
}

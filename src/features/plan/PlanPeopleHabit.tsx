import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { theme, FLAT_PALETTE } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { stableIndexFromId } from '@/lib/color';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { personInitials } from '@/features/people/people.helpers';
import type { HabitState, PeopleState } from './planOverview';
import type { PlanPerson } from './PlanTiles';

/** Kept days' sprouts grow a little taller each day; a missed day stays a small grey one. */
const SPROUT_BASE = 10;
const SPROUT_STEP = 2;

/**
 * Overview's Friends and Spend streak as two rows in one card: the people with the biggest balances as
 * initials, what is owed either way, and the week's sprouts beside the streak.
 */
export function PlanPeopleHabit({
  people,
  topPeople,
  habit,
  goalMinor,
  onPeople,
  onPerson,
  onGarden,
}: {
  people: PeopleState;
  /** The people with the biggest balances either way, biggest first. */
  topPeople: PlanPerson[];
  /** Null when no daily spending goal is set. */
  habit: HabitState | null;
  goalMinor: number | null;
  onPeople: () => void;
  /** Tapping a person's initials opens that person, not the whole list. */
  onPerson?: (id: string) => void;
  onGarden: () => void;
}) {
  const { accent } = useAccent();
  const count = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;
  const faces = people.kind === 'balances' ? topPeople.filter((p) => p.balanceMinor !== 0).slice(0, 2) : [];
  const peopleSub =
    people.kind === 'none'
      ? 'Track who paid and who owes'
      : people.kind === 'settled'
        ? `All settled with ${count(people.count)}`
        : `With ${count(people.count)}`;
  const peopleSpoken =
    people.kind === 'balances'
      ? `Friends & Family, ${formatMoney(people.owedToYouMinor)} to collect, ${formatMoney(people.youOweMinor)} to pay back. ${peopleSub}`
      : `Friends & Family. ${peopleSub}`;
  const hasHabit = habit != null && goalMinor != null;
  return (
    <View style={s.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={peopleSpoken}
        onPress={onPeople}
        style={withPressedTint(accent, s.row)}
      >
        {faces.length > 0 ? (
          <View
            style={s.faces}
            accessibilityElementsHidden={!onPerson}
            importantForAccessibility={onPerson ? 'auto' : 'no-hide-descendants'}
          >
            {faces.map((p) => (
              <Pressable
                key={p.id}
                disabled={!onPerson}
                onPress={() => onPerson?.(p.id)}
                hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
                accessibilityRole="button"
                accessibilityLabel={`Open ${p.name} details`}
                accessibilityHint={`${formatMoney(Math.abs(p.balanceMinor))} ${p.balanceMinor > 0 ? 'to collect' : 'to pay back'}`}
                style={[
                  s.face,
                  { backgroundColor: FLAT_PALETTE[stableIndexFromId(p.id, FLAT_PALETTE.length)] },
                ]}
              >
                <Text style={s.faceText}>{personInitials(p.name)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={s.mark}>
            <Feather name="users" size={15} color={theme.colors.textSecondary} />
          </View>
        )}
        <View style={s.copy}>
          <Text style={s.title}>Friends</Text>
          <Text style={s.sub}>{peopleSub}</Text>
        </View>
        {people.kind === 'balances' && (
          <View style={s.end}>
            {people.owedToYouMinor > 0 && (
              <View style={s.balance}>
                <Text style={s.endLine}>To collect</Text>
                <Text style={[s.value, s.good]}>{formatMoney(people.owedToYouMinor)}</Text>
              </View>
            )}
            {people.youOweMinor > 0 && (
              <View style={s.balance}>
                <Text style={s.endLine}>To pay back</Text>
                <Text style={[s.value, s.bad]}>{formatMoney(people.youOweMinor)}</Text>
              </View>
            )}
          </View>
        )}
        <Feather name="chevron-right" size={15} color={theme.colors.textMuted} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          hasHabit
            ? `${habit.streakDays}-day streak at ${formatMoney(goalMinor)} or less a day. ${habit.days.map((kept, i) => `${habit.dates?.[i] ?? `Day ${i + 1}`}: ${habit.tracked?.[i] === false ? 'not tracked' : kept ? 'within goal' : 'over goal'}`).join(', ')}. Open Suu's garden`
            : "Set a daily goal. Open Suu's garden"
        }
        onPress={onGarden}
        style={withPressedTint(accent, [s.row, s.divider])}
      >
        <View style={[s.mark, s.markGreen]}>
          <MaterialCommunityIcons name="sprout" size={16} color={theme.colors.incomeText} />
        </View>
        <View style={s.copy}>
          <Text style={s.title}>Spend streak</Text>
          <Text style={s.sub}>
            {hasHabit ? `${formatMoney(goalMinor)} or less a day` : 'Set a daily goal to grow Suu’s garden'}
          </Text>
        </View>
        {hasHabit && (
          <View style={s.end}>
            <Text style={s.value}>
              {habit.streakDays} day{habit.streakDays === 1 ? '' : 's'}
            </Text>
            <View
              style={s.sprouts}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {habit.days.map((kept, i) => (
                <MaterialCommunityIcons
                  key={i}
                  name="sprout"
                  size={kept ? SPROUT_BASE + i * SPROUT_STEP : SPROUT_BASE - 1}
                  color={kept ? theme.colors.incomeText : theme.colors.textMuted}
                  style={!kept && { opacity: 0.45 }}
                />
              ))}
            </View>
          </View>
        )}
        <Feather name="chevron-right" size={15} color={theme.colors.textMuted} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  row: { minHeight: 52, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
  faces: { flexDirection: 'row', gap: 4 },
  face: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceText: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.ink },
  mark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  markGreen: { backgroundColor: theme.colors.incomeTint },
  copy: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.font.bodyMedium, fontSize: 14, lineHeight: 20, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  end: { flexShrink: 1, alignItems: 'flex-end', gap: 2 },
  balance: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    columnGap: 5,
  },
  endLine: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, textAlign: 'right' },
  value: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  good: { color: theme.colors.incomeText },
  bad: { color: theme.colors.expenseText },
  sprouts: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
});

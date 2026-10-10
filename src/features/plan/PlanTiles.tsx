import { View, Pressable, Animated } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { usePressScale } from '@/lib/usePressScale';
import { hueFor } from '@/lib/hueFor';
import { compactMoney } from '@/lib/compactMoney';
import { HabitState, PeopleState } from './planOverview';
import { styles } from './plan.styles';
import { parseLocalIsoDate } from '@/lib/date';
import { Kicker } from '@/components/Frost';

export { Kicker, FrostChip as PlanChip } from '@/components/Frost';

/**
 * Plan's small pieces: a card's topic (icon disc + name), the chips under a figure, and the Friends and
 * Spend streak tiles. Colour is kept for figures that mean something (green money back, red over).
 */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A tappable glass tile that shrinks a touch when pressed. */
export function PlanTile({
  label,
  onPress,
  wide,
  children,
}: {
  label: string;
  onPress: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[{ flex: wide ? 1.25 : 1, minWidth: 0 }, animatedStyle]}
    >
      <Glass radius={22} style={styles.tile}>
        <View style={styles.go}>
          <Feather name="arrow-up-right" size={15} color={theme.colors.textMuted} />
        </View>
        {children}
      </Glass>
    </AnimatedPressable>
  );
}

/* ---------- Friends & Family ---------- */

export interface PlanPerson {
  id: string;
  name: string;
  balanceMinor: number;
}

/** How many people's balances show under the total. */
export const PEOPLE_SHOWN = 3;

export function PeopleTile({
  state,
  people,
  onOpen,
}: {
  state: PeopleState;
  /** The people with the biggest balances either way, biggest first. */
  people: PlanPerson[];
  onOpen: () => void;
}) {
  const count = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;
  let value: React.ReactNode;
  let sub: string;
  if (state.kind === 'none') {
    value = <Text style={styles.title}>Track IOUs</Text>;
    sub = 'Who paid, who owes';
  } else if (state.kind === 'settled') {
    value = <Text style={styles.title}>All settled</Text>;
    sub = `With ${count(state.count)}`;
  } else if (state.owedToYouMinor >= state.youOweMinor) {
    value = (
      <Text style={[styles.value, styles.income]} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(state.owedToYouMinor)}
      </Text>
    );
    sub = state.youOweMinor > 0 ? `to collect · you owe ${formatMoney(state.youOweMinor)}` : 'To collect';
  } else {
    value = (
      <Text style={[styles.value, styles.over]} numberOfLines={1} adjustsFontSizeToFit>
        −{formatMoney(state.youOweMinor)}
      </Text>
    );
    sub =
      state.owedToYouMinor > 0
        ? `to pay back · ${formatMoney(state.owedToYouMinor)} to collect`
        : 'To pay back';
  }
  const shown =
    state.kind === 'balances' ? people.filter((p) => p.balanceMinor !== 0).slice(0, PEOPLE_SHOWN) : [];
  return (
    <PlanTile wide label={`Friends & Family, ${sub}. Open Friends & Family`} onPress={onOpen}>
      <Kicker icon="users" inTile>
        Friends
      </Kicker>
      {value}
      <Text style={styles.tileSub} numberOfLines={2}>
        {sub}
      </Text>
      {shown.length > 0 && (
        <View
          style={styles.people}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {shown.map((p) => (
            <View key={p.id} style={styles.person}>
              <View style={[styles.avatar, { backgroundColor: hueFor(p.id) }]}>
                <Text style={styles.avatarText}>{p.name.trim().charAt(0).toUpperCase() || '?'}</Text>
              </View>
              <Text style={styles.personName} numberOfLines={1}>
                {p.name.split(' ')[0]}
              </Text>
              <Text style={[styles.personAmt, p.balanceMinor > 0 ? styles.income : styles.over]}>
                {p.balanceMinor > 0 ? '+' : '−'}
                {compactMoney(Math.abs(p.balanceMinor))}
              </Text>
            </View>
          ))}
        </View>
      )}
    </PlanTile>
  );
}

/* ---------- Spend streak ---------- */

/** Kept days' sprouts grow a little taller each day; a missed day stays a small grey one. */
const SPROUT_BASE = 13;
const SPROUT_STEP = 3;

export function HabitTile({
  habit,
  goalMinor,
  onOpen,
  today,
}: {
  /** Null when no daily spending goal is set. */
  habit: HabitState | null;
  goalMinor: number | null;
  today?: string;
  onOpen: () => void;
}) {
  const sprout = <MaterialCommunityIcons name="sprout" size={14} color={theme.colors.ink} />;
  if (!habit || goalMinor == null) {
    return (
      <PlanTile label="Set a daily goal. Open Suu's garden" onPress={onOpen}>
        <Kicker icon={sprout} inTile>
          Spend streak
        </Kicker>
        <Text style={styles.title}>Set a daily goal</Text>
        <Text style={styles.tileSub}>Grow Suu&rsquo;s garden</Text>
      </PlanTile>
    );
  }
  return (
    <PlanTile
      label={`${habit.streakDays}-day streak at ${formatMoney(goalMinor)} or less a day. ${habit.days.map((kept, i) => `${habit.dates?.[i] ?? `Day ${i + 1}`}: ${habit.tracked?.[i] === false ? 'not tracked' : kept ? 'within goal' : 'over goal'}`).join(', ')}. Open Suu's garden`}
      onPress={onOpen}
    >
      <Kicker icon={sprout} inTile>
        Spend streak
      </Kicker>
      <Text style={styles.value}>
        {habit.streakDays} day{habit.streakDays === 1 ? '' : 's'}
      </Text>
      <View
        style={styles.sprouts}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {habit.days.map((kept, i) => (
          <View key={i} style={styles.sproutDay}>
            <MaterialCommunityIcons
              name="sprout"
              size={kept ? SPROUT_BASE + i * SPROUT_STEP : SPROUT_BASE - 2}
              color={kept ? theme.colors.incomeText : theme.colors.textMuted}
              style={!kept && { opacity: 0.45 }}
            />
            <Text style={[styles.dayLabel, habit.dates?.[i] === today && styles.income]}>
              {habit.tracked?.[i] === false
                ? '—'
                : habit.dates?.[i]
                  ? parseLocalIsoDate(habit.dates[i]).toLocaleDateString(undefined, { weekday: 'narrow' })
                  : `${i + 1}`}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.tileSub}>{formatMoney(goalMinor)} or less / day</Text>
      {habit.tracked?.includes(false) && <Text style={styles.dayLabel}>— Not tracked</Text>}
    </PlanTile>
  );
}

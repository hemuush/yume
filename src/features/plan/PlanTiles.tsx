import { View, Pressable, Animated } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { theme, FLAT_PALETTE } from '@/constants/theme';
import { stableIndexFromId } from '@/lib/color';
import { personInitials } from '@/features/people/people.helpers';
import { formatMoney } from '@/lib/money';
import { usePressScale } from '@/lib/usePressScale';
import { PeopleState } from './planOverview';
import { styles } from './plan.styles';
import { Kicker } from '@/components/Frost';

export { Kicker, FrostChip as PlanChip } from '@/components/Frost';

/**
 * Plan's small pieces: a card's topic (icon disc + name), the chips under a figure, and the Friends and
 * Spend streak tiles. Colour is kept for figures that mean something (green money back, red over).
 */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A tappable glass tile that shrinks a touch when pressed. */
function PlanTile({
  label,
  onPress,
  children,
  footer,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Glass radius={22} style={[styles.tile, cardSurface.neutral]}>
        <AnimatedPressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={[{ gap: 8, paddingRight: 20 }, animatedStyle]}
        >
          <View style={[styles.go, { top: 0, right: 0 }]}>
            <Feather name="chevron-right" size={15} color={theme.colors.textMuted} />
          </View>
          {children}
        </AnimatedPressable>
        {footer}
      </Glass>
    </View>
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
  onPerson,
}: {
  state: PeopleState;
  /** The people with the biggest balances either way, biggest first. */
  people: PlanPerson[];
  onOpen: () => void;
  onPerson?: (id: string) => void;
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
  } else {
    value = (
      <View style={{ gap: 4, width: '100%' }}>
        <View style={styles.balanceLine}>
          <Text style={styles.tileSub}>To collect</Text>
          <Text style={[styles.value, styles.compactValue, styles.income]}>
            {formatMoney(state.owedToYouMinor)}
          </Text>
        </View>
        <View style={styles.balanceLine}>
          <Text style={styles.tileSub}>To pay back</Text>
          <Text style={[styles.value, styles.compactValue, state.youOweMinor > 0 && styles.over]}>
            {formatMoney(state.youOweMinor)}
          </Text>
        </View>
      </View>
    );
    sub = `With ${count(state.count)}`;
  }

  const shown = state.kind === 'balances' ? people.filter((p) => p.balanceMinor !== 0).slice(0, 2) : [];
  return (
    <PlanTile
      label={`Friends & Family, ${state.kind === 'balances' ? `${formatMoney(state.owedToYouMinor)} to collect, ${formatMoney(state.youOweMinor)} to pay back. ` : ''}${sub}. Open Friends & Family`}
      onPress={onOpen}
      footer={
        shown.length > 0 && (
          <View
            style={[styles.people, { flexWrap: 'wrap', overflow: 'visible', marginTop: 4, gap: 8 }]}
            accessibilityElementsHidden={!onPerson}
            importantForAccessibility={onPerson ? 'auto' : 'no-hide-descendants'}
          >
            {shown.map((p) => (
              <Pressable
                key={p.id}
                style={[
                  styles.person,
                  {
                    minHeight: 44,
                    minWidth: 44,
                    flexShrink: 1,
                    maxWidth: '100%',
                    flexDirection: 'row',
                    gap: 6,
                    paddingHorizontal: 0,
                    borderRadius: 14,
                    backgroundColor: 'transparent',
                  },
                ]}
                disabled={!onPerson}
                onPress={() => onPerson?.(p.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${p.name} details`}
                accessibilityHint={`${formatMoney(Math.abs(p.balanceMinor))} ${p.balanceMinor > 0 ? 'to collect' : 'to pay back'}`}
              >
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: FLAT_PALETTE[stableIndexFromId(p.id, FLAT_PALETTE.length)] },
                  ]}
                >
                  <Text style={styles.avatarText}>{personInitials(p.name)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )
      }
    >
      <View style={{ gap: 8 }}>
        <View style={{ gap: 4 }}>
          <Kicker icon="users" inTile>
            Friends
          </Kicker>
          <Text style={styles.tileSub}>{sub}</Text>
        </View>
        {value}
      </View>
    </PlanTile>
  );
}

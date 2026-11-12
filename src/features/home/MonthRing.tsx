import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { heroPct, type HeroSlices } from './heroSlices';

/** The four slices of the month, in the order the ring draws them. */
export type SliceKey = 'spent' | 'saved' | 'due' | 'free';

/** The ring's width and height; the same on every phone, so the card stays small. */
const RING_SIZE = 112;
const STROKE = 10;
const OUTER_STROKE = 2.5;
const R = (RING_SIZE - STROKE - OUTER_STROKE * 2 - 2) / 2;
const R_OUTER = RING_SIZE / 2 - OUTER_STROKE / 2;
const GAP = 2.5;
/** The shortest a flat bar for a very small slice is drawn, so it can still be seen. */
const MIN_BAR = 2;
/** The slices that were not picked step back. */
const DIM = 0.35;

/**
 * The month as one ring: spent, saved, bills still to pay and free, in the colours of the legend beside it. A
 * thin outer ring shows how far through the month today is, so spending reads against time. It is still: it
 * draws at once and only dims the slices that were not picked. The figure for the picked slice sits in the
 * middle (`children`).
 */
export function MonthRing({
  slices,
  hideSavings,
  dayShare = null,
  focus = null,
  children,
}: {
  slices: HeroSlices;
  hideSavings: boolean;
  /** How far through the month today is (0–1); null outside the current month. */
  dayShare?: number | null;
  focus?: SliceKey | null;
  children?: React.ReactNode;
}) {
  const parts: { key: SliceKey; share: number; color: string }[] = [
    { key: 'spent' as const, share: slices.spent, color: theme.colors.slice.spent },
    { key: 'saved' as const, share: hideSavings ? 0 : slices.saved, color: theme.colors.slice.saved },
    { key: 'due' as const, share: slices.due ?? 0, color: theme.colors.slice.due },
    { key: 'free' as const, share: slices.free, color: theme.colors.slice.free },
  ].filter((part) => part.share > 0);
  const c = RING_SIZE / 2;
  const circumference = 2 * Math.PI * R;
  const outerC = 2 * Math.PI * R_OUTER;
  let used = 0;
  // A single slice is the whole ring, with no gap to leave.
  const whole = parts.length === 1;
  const label = `Where the month went: spent ${heroPct(slices.spent)}${
    hideSavings ? '' : `, saved ${heroPct(slices.saved)}`
  }${slices.due ? `, bills ${heroPct(slices.due)}` : ''}, free ${heroPct(slices.free)}`;
  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', width: RING_SIZE, height: RING_SIZE }}
        accessible={slices.hasIncome}
        accessibilityElementsHidden={!slices.hasIncome}
        importantForAccessibility={slices.hasIncome ? 'yes' : 'no-hide-descendants'}
        accessibilityRole="image"
        accessibilityLabel={label}
      >
        <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: 'absolute' }}>
          {dayShare != null && (
            <>
              <Circle
                cx={c}
                cy={c}
                r={R_OUTER}
                stroke={theme.colors.divider}
                strokeWidth={OUTER_STROKE}
                fill="none"
              />
              <Circle
                cx={c}
                cy={c}
                r={R_OUTER}
                stroke={theme.colors.ink}
                strokeWidth={OUTER_STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${Math.max(0, outerC * Math.min(1, dayShare))} ${outerC}`}
                transform={`rotate(-90 ${c} ${c})`}
              />
            </>
          )}
          <Circle cx={c} cy={c} r={R} stroke={theme.colors.trayTrack} strokeWidth={STROKE} fill="none" />
          {parts.map((part) => {
            const start = used;
            used += part.share;
            const slot = circumference * part.share;
            // A slice with room draws a round-capped arc (the caps add half a stroke to each end, so a whole
            // stroke comes off along with the gap). A slice too small for that, like Free or Bills left late in
            // the month, draws a thin flat bar centred in its own slot at least 2 dp long, so it stays visible
            // and never overlaps its neighbours as a dot would.
            const roomy = slot - GAP >= STROKE + 1;
            const length = roomy ? slot - GAP - STROKE : Math.max(MIN_BAR, slot - GAP);
            const lead = roomy ? (STROKE + GAP) / 2 : (slot - length) / 2;
            return (
              <Circle
                key={part.key}
                cx={c}
                cy={c}
                r={R}
                stroke={part.color}
                strokeWidth={STROKE}
                strokeLinecap={whole || !roomy ? 'butt' : 'round'}
                fill="none"
                opacity={focus != null && focus !== part.key ? DIM : 1}
                strokeDasharray={whole ? undefined : `${length} ${circumference}`}
                strokeDashoffset={whole ? undefined : -(circumference * start + lead)}
                transform={`rotate(-90 ${c} ${c})`}
              />
            );
          })}
        </Svg>
      </View>
      <View style={{ width: R * 2 - STROKE - 6, alignItems: 'center' }}>{children}</View>
    </View>
  );
}

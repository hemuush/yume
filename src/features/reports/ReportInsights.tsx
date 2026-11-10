import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { screenStyles as h } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { softTint } from '@/components/softTint';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { MoonPhase } from './MoonPhase';
import type { StoryAction, StoryCard } from './reportsInsights';
import { styles as shared } from './reports.styles';

/** The round mark each read leads with. */
const MARK = 32;

const TONE_HEX = {
  coral: theme.colors.slice.spent,
  sky: '#8FCBFF',
  lavender: '#B7A4EC',
  mint: theme.colors.slice.saved,
  gold: theme.colors.slice.due,
} as const;

const ICON: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  mover: 'trending-up',
  heaviest: 'calendar',
  busiestDay: 'calendar',
  weekends: 'sun',
  frontLoaded: 'fast-forward',
  noSpend: 'moon',
  quiet: 'moon',
  fixed: 'repeat',
  early: 'clock',
};

/**
 * The period in a few short reads, most telling first, as plain rows in one card: what it is, the figure or
 * day in question, and a line of detail. A row with something to open ends in a chevron and opens it.
 */
export function ReportInsights({
  title,
  cards,
  onAction,
}: {
  title: string;
  cards: StoryCard[];
  onAction: (action: StoryAction) => void;
}) {
  const { accent } = useAccent();
  if (!cards.length) return null;
  return (
    <View style={s.block}>
      <Text style={shared.blockTitle}>{title}</Text>
      <View style={s.card}>
        {cards.map((card, i) => {
          const headline = card.compact ? card.detail : card.big;
          const body = (
            <>
              <View style={[s.mark, { backgroundColor: softTint(TONE_HEX[card.tone], 0.3) }]}>
                {card.moonFraction != null ? (
                  <MoonPhase size={24} litFraction={card.moonFraction} accent={accent} />
                ) : (
                  <Feather name={ICON[card.key] ?? 'info'} size={15} color={theme.colors.ink} />
                )}
              </View>
              <View style={s.mid}>
                <Text style={s.kicker}>{card.kicker}</Text>
                <Text style={s.big}>{headline}</Text>
                {!card.compact && <Text style={s.detail}>{card.detail}</Text>}
                {!!card.foot && <Text style={s.foot}>{card.foot}</Text>}
              </View>
              {card.action && <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />}
            </>
          );
          const style = [s.row, i > 0 && h.divider];
          return card.action ? (
            <Pressable
              key={card.key}
              onPress={() => onAction(card.action!)}
              accessibilityRole="button"
              accessibilityLabel={`${card.kicker}. ${headline}. ${card.cta ?? ''}`}
              style={withPressedTint(accent, style)}
            >
              {body}
            </Pressable>
          ) : (
            <View key={card.key} style={style} accessible accessibilityLabel={`${card.kicker}. ${card.big}`}>
              {body}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  block: { marginBottom: 10 },
  card: { ...h.card, marginHorizontal: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mid: { flex: 1, minWidth: 0, gap: 1 },
  kicker: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  big: {
    fontFamily: theme.font.bodyMedium,
    fontSize: theme.typeSize.row,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  detail: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  foot: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
});

import { useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { withPressed } from '@/lib/pressed';
import { MoonPhase } from './MoonPhase';
import type { StoryAction, StoryCard } from './reportsInsights';
import { styles as shared } from './reports.styles';

const GAP = 10;
/** A card is about two thirds of the screen, so the next one peeks in and says "swipe". */
const cardWidth = (screen: number) => Math.round(Math.min(280, Math.max(220, screen * 0.66)));

const TONE_HEX = {
  coral: theme.colors.slice.spent,
  sky: '#8FCBFF',
  lavender: '#B7A4EC',
  mint: theme.colors.slice.saved,
  gold: theme.colors.slice.due,
} as const;

/**
 * The period in a few answers as a row of swipeable cards, most telling first; a card with something to open
 * does it from its own button. Dots under the row say where you are.
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
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  if (!cards.length) return null;
  const w = cardWidth(width);
  return (
    <View style={s.block}>
      <View style={s.head}>
        <Text style={[shared.blockTitle, s.title]}>{title}</Text>
        <Text style={shared.storyPos}>{cards.length > 1 ? 'Swipe' : ''}</Text>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        snapToInterval={w + GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        style={s.row}
        contentContainerStyle={s.rowContent}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / (w + GAP));
          if (i !== page) setPage(Math.max(0, Math.min(cards.length - 1, i)));
        }}
      >
        {cards.map((card) => {
          const body = (
            <>
              <Text style={s.kicker}>{card.kicker}</Text>
              <Text style={s.big}>{card.compact ? card.detail : card.big}</Text>
              {!card.compact && <Text style={s.detail}>{card.detail}</Text>}
              {!!card.foot && <Text style={s.foot}>{card.foot}</Text>}
              {card.moonFraction != null && (
                <View style={s.moon}>
                  <MoonPhase size={44} litFraction={card.moonFraction} accent={accent} />
                </View>
              )}
              {card.action && card.cta && (
                <View style={s.cta}>
                  <Text style={s.ctaText}>{card.cta} →</Text>
                </View>
              )}
            </>
          );
          const style = [s.card, { width: w, backgroundColor: shade(TONE_HEX[card.tone], 91) }];
          return card.action ? (
            <Pressable
              key={card.key}
              onPress={() => onAction(card.action!)}
              accessibilityRole="button"
              accessibilityLabel={`${card.kicker}. ${card.compact ? card.detail : card.big}. ${card.cta ?? ''}`}
              style={withPressed(style)}
            >
              {body}
            </Pressable>
          ) : (
            <View key={card.key} style={style} accessible accessibilityLabel={`${card.kicker}. ${card.big}`}>
              {body}
            </View>
          );
        })}
      </ScrollView>
      {cards.length > 1 && (
        <View style={s.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {cards.map((c, i) => (
            <View key={c.key} style={[s.dot, i === page && s.dotOn]} />
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  block: { marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, minWidth: 0 },
  // Bleeds to the screen edges so the next card can peek in.
  row: { marginHorizontal: -16 },
  rowContent: { gap: GAP, paddingHorizontal: 16 },
  card: { minHeight: 150, padding: 16, borderRadius: theme.radius.xl2, gap: 4 },
  kicker: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  big: {
    fontFamily: theme.font.roundedMedium,
    fontSize: theme.typeSize.title,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: theme.colors.textPrimary,
    paddingRight: 48,
  },
  detail: { fontFamily: theme.font.body, fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  foot: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
  moon: { position: 'absolute', right: 14, top: 14 },
  cta: { marginTop: 'auto', paddingTop: 8 },
  ctaText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.ink },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.trayTrack },
  dotOn: { width: 18, backgroundColor: theme.colors.textSecondary },
});

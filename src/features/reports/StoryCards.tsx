import { useState } from 'react';
import { View, ScrollView, Pressable, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { MoonPhase } from './MoonPhase';
import type { StoryCard, StoryTarget, StoryTone } from './reportsInsights';
import { styles } from './reports.styles';

const TONE_BG: Record<StoryTone, string> = {
  coral: theme.colors.idCoral,
  sky: theme.colors.primaryTint,
  lavender: theme.colors.accentTint,
  mint: theme.colors.secondaryTint,
  gold: theme.colors.goldTint,
};

/** Each card takes this share of the row, so the next one always peeks in. */
const CARD_SHARE = 0.82;
const CARD_GAP = 10;

/**
 * The period "in short", as a row of story cards you swipe through — one big
 * answer per card (see buildStoryCards). Each card jumps to the part of
 * Reports it came from; the fixed-vs-flexible moon lives on its own card.
 */
export function StoryCards({
  title,
  cards,
  onJump,
}: {
  title: string;
  cards: StoryCard[];
  onJump: (target: StoryTarget) => void;
}) {
  const { accent } = useAccent();
  const [rowWidth, setRowWidth] = useState(0);
  const [active, setActive] = useState(0);
  if (cards.length === 0) return null;
  const cardWidth = Math.round(rowWidth * CARD_SHARE);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (cardWidth <= 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP));
    const clamped = Math.max(0, Math.min(cards.length - 1, i));
    if (clamped !== active) setActive(clamped);
  };

  return (
    <View style={styles.storyBlock}>
      <View style={styles.storyHead}>
        <Text style={styles.blockTitle}>{title}</Text>
        {cards.length > 1 && (
          <Text style={styles.storyPos}>
            {active + 1} of {cards.length}
          </Text>
        )}
      </View>
      <View onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
        {rowWidth > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + CARD_GAP}
            snapToAlignment="start"
            decelerationRate="fast"
            onScroll={onScroll}
            scrollEventThrottle={32}
            contentContainerStyle={{ gap: CARD_GAP }}
          >
            {cards.map((c, i) => (
              <Pressable
                key={c.key}
                onPress={() => onJump(c.target)}
                style={[
                  styles.story,
                  { width: cards.length === 1 ? rowWidth : cardWidth, backgroundColor: TONE_BG[c.tone] },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${c.kicker}: ${c.big}. ${c.detail}${c.foot ? ` ${c.foot}.` : ''}`}
              >
                <Text style={styles.storyKicker}>
                  {String(i + 1).padStart(2, '0')} · {c.kicker.toUpperCase()}
                </Text>
                {c.moonFraction != null ? (
                  <View style={styles.storyMoonRow}>
                    <MoonPhase size={64} litFraction={c.moonFraction} accent={accent} />
                    <View style={styles.storyMoonText}>
                      <Text style={styles.storyBig} numberOfLines={1} adjustsFontSizeToFit>
                        {c.big}
                      </Text>
                      <Text style={styles.storyDetail}>{c.detail}</Text>
                    </View>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.storyBig} numberOfLines={2} adjustsFontSizeToFit>
                      {c.big}
                    </Text>
                    <Text style={styles.storyDetail}>{c.detail}</Text>
                  </View>
                )}
                {!!c.foot && <Text style={styles.storyFoot}>{c.foot}</Text>}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
      {cards.length > 1 && (
        <View style={styles.storyDots}>
          {cards.map((c, i) => (
            <View key={c.key} style={[styles.storyDot, i === active && styles.storyDotOn]} />
          ))}
        </View>
      )}
    </View>
  );
}

import { useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleProp,
  ViewStyle,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { MoonPhase } from './MoonPhase';
import type { StoryAction, StoryCard, StoryTone } from './reportsInsights';
import { styles } from './reports.styles';
import { withPressed } from '@/lib/pressed';
import { shade } from '@/lib/color';
import { softTint } from '@/components/softTint';
import { useReduceMotion } from '@/lib/useReduceMotion';

// Sky and mint are washes of the picked theme's two colours; each card shows its tone as a frosted wash.
const toneBg = (accent: string, secondary: string): Record<StoryTone, string> => ({
  coral: theme.colors.idCoral,
  sky: shade(accent, 95),
  lavender: theme.colors.accentTint,
  mint: shade(secondary, 94),
  gold: theme.colors.goldTint,
});

/** Each card takes this share of the row, so the next one always peeks in. */
const CARD_SHARE = 0.82;
const CARD_GAP = 10;

/**
 * The period "in short": swipeable story cards, one big answer each (see buildStoryCards). A card with an
 * action does it on tap (its day on the heatmap, its category row); the fixed-vs-flexible moon has its own.
 */
export function StoryCards({
  title,
  cards,
  onAction,
}: {
  title: string;
  cards: StoryCard[];
  onAction: (action: StoryAction) => void;
}) {
  const { accent, secondary } = useAccent();
  const [rowWidth, setRowWidth] = useState(0);
  const [active, setActive] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const reduceMotion = useReduceMotion();
  const move = (next: number) => {
    setActive(next);
    scroll.current?.scrollTo({
      x: next * (Math.round(rowWidth * CARD_SHARE) + CARD_GAP),
      animated: !reduceMotion,
    });
  };
  if (cards.length === 0) return null;
  const cardWidth = Math.round(rowWidth * CARD_SHARE);
  const tones = toneBg(accent, secondary);

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
            ref={scroll}
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
              <StoryFrame
                key={c.key}
                action={c.action}
                onAction={onAction}
                style={[
                  c.compact ? styles.storyCompact : styles.story,
                  {
                    width: cards.length === 1 ? rowWidth : cardWidth,
                    backgroundColor: softTint(tones[c.tone], 0.8),
                  },
                ]}
                accessibilityLabel={`${c.kicker}${c.compact ? '' : `: ${c.big}`}. ${c.detail}${c.foot ? ` ${c.foot}.` : ''}${c.cta ? ` ${c.cta}.` : ''}`}
              >
                {c.compact ? (
                  <>
                    <Text style={styles.storyCompactTitle}>{c.kicker}</Text>
                    <Text style={styles.storyCompactDetail}>{c.detail}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.storyKicker}>
                      {String(i + 1).padStart(2, '0')} · {c.kicker}
                    </Text>
                    {c.moonFraction != null ? (
                      <View style={styles.storyMoonRow}>
                        <MoonPhase size={64} litFraction={c.moonFraction} accent={accent} />
                        <View style={styles.storyMoonText}>
                          <Text style={styles.storyBig}>{c.big}</Text>
                          <Text style={styles.storyDetail}>{c.detail}</Text>
                        </View>
                      </View>
                    ) : (
                      <View>
                        <Text style={styles.storyBig}>{c.big}</Text>
                        <Text style={styles.storyDetail}>{c.detail}</Text>
                      </View>
                    )}
                  </>
                )}
                {!!c.foot && <Text style={styles.storyFoot}>{c.foot}</Text>}
                {!!c.cta && <Text style={styles.storyCta}>{c.cta} →</Text>}
              </StoryFrame>
            ))}
          </ScrollView>
        )}
      </View>
      {cards.length > 1 && (
        <View style={styles.storyDots}>
          <Pressable
            onPress={() => move(active - 1)}
            disabled={active === 0}
            accessibilityRole="button"
            accessibilityLabel="Previous insight"
            accessibilityState={{ disabled: active === 0 }}
            style={withPressed({
              minWidth: 44,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: active === 0 ? 0.35 : 1,
            })}
          >
            <Text>‹</Text>
          </Pressable>
          {cards.map((c, i) => (
            <View key={c.key} style={[styles.storyDot, i === active && styles.storyDotOn]} />
          ))}
          <Pressable
            onPress={() => move(active + 1)}
            disabled={active === cards.length - 1}
            accessibilityRole="button"
            accessibilityLabel="Next insight"
            accessibilityState={{ disabled: active === cards.length - 1 }}
            style={withPressed({
              minWidth: 44,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: active === cards.length - 1 ? 0.35 : 1,
            })}
          >
            <Text>›</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** A card with an action is a button; one without is plain, so it doesn't promise a tap. */
function StoryFrame({
  action,
  onAction,
  style,
  accessibilityLabel,
  children,
}: {
  action?: StoryAction;
  onAction: (action: StoryAction) => void;
  style: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  if (!action)
    return (
      <View style={style} accessible accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  return (
    <Pressable
      onPress={() => onAction(action)}
      style={withPressed(style)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Pressable>
  );
}

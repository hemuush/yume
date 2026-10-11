import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { GLASS } from '@/components/Glass';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { MoonPhase } from './MoonPhase';
import type { StoryAction, StoryCard } from './reportsInsights';
import { styles } from './reports.styles';
import { withPressed } from '@/lib/pressed';

/** Scan-friendly insights, preserving the underlying facts and drill-through actions. */
export function ReportInsights({
  title,
  cards,
  onAction,
}: {
  title: string;
  cards: StoryCard[];
  onAction: (action: StoryAction) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const { accent } = useAccent();
  if (!cards.length) return null;
  return (
    <View style={s.block}>
      <View style={s.head}>
        <Text style={[styles.blockTitle, { flex: 1, minWidth: 0 }]}>{title}</Text>
        <Text style={styles.stripSub}>{cards.length} insights</Text>
      </View>
      <View style={s.card}>
        {cards.map((card, i) => {
          const expanded = open === card.key;
          return (
            <View key={card.key} style={[s.row, i > 0 && s.divider]}>
              <Pressable
                onPress={() => setOpen(expanded ? null : card.key)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${card.kicker}. ${card.compact ? card.detail : card.big}. Expand insight`}
                style={withPressed(s.summary)}
              >
                <Text style={s.number}>{String(i + 1).padStart(2, '0')}</Text>
                <View style={s.names}>
                  <Text style={s.kicker}>{card.kicker}</Text>
                  <Text style={s.big}>{card.compact ? card.detail : card.big}</Text>
                </View>
                <Feather name={expanded ? 'minus' : 'plus'} size={17} color={theme.colors.textMuted} />
              </Pressable>
              {expanded && (
                <View style={s.details}>
                  {card.moonFraction != null && (
                    <MoonPhase size={56} litFraction={card.moonFraction} accent={accent} />
                  )}
                  {!card.compact && <Text style={s.detail}>{card.detail}</Text>}
                  {!!card.foot && <Text style={s.detail}>{card.foot}</Text>}
                  {card.action && (
                    <Pressable
                      onPress={() => onAction(card.action!)}
                      accessibilityRole="link"
                      style={withPressed(styles.catLink)}
                    >
                      <Text style={styles.catLinkText}>{card.cta} →</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  block: { marginBottom: 22 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  card: {
    backgroundColor: GLASS.fillStrong,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: GLASS.edge,
    paddingHorizontal: 14,
  },
  row: { paddingVertical: 6 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  summary: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.accentTint,
    padding: 6,
    borderRadius: 6,
  },
  names: { flex: 1, minWidth: 0, gap: 3 },
  kicker: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  big: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  details: { paddingBottom: 6, paddingLeft: 34, gap: 8 },
  detail: { fontFamily: theme.font.body, fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
});

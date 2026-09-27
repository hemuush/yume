import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { formatMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { haptics } from '@/lib/haptics';
import { homeStyles as h } from './homeStyles';
import type { ReadyWrap } from '@/features/wrap/wrapWindow';

const SIZE = 34;

/**
 * Home's Wrap button, between the bell and your profile picture (the Wrap
 * button sign-off): a play button that's only there while a Wrap is ready,
 * on a Monday for last week and on the 1st–7th for last month (wrapWindow.ts).
 * A pastel ring means there's one you haven't watched; once watched, the ring
 * goes plain, like a seen story. On the day both are ready it shows a 2 and
 * asks which one to play.
 */
export function WrapButton({ wraps, onPlay }: { wraps: ReadyWrap[]; onPlay: (wrap: ReadyWrap) => void }) {
  const { accent } = useAccent();
  const [choosing, setChoosing] = useState(false);
  if (wraps.length === 0) return null;

  const fresh = wraps.some((w) => !w.seen);
  const nameOf = (w: ReadyWrap) => (w.period === 'month' ? `${w.label}'s Wrap` : "last week's Wrap");
  const onPress = () => {
    haptics.tap();
    if (wraps.length === 1) onPlay(wraps[0]);
    else setChoosing(true);
  };
  const disc = (
    <View style={styles.inner}>
      <View style={[styles.play, !fresh && styles.playSeen]}>
        <MaterialCommunityIcons
          name="play"
          size={16}
          color={fresh ? theme.colors.surface : theme.colors.ink}
          style={styles.playIcon}
        />
      </View>
    </View>
  );

  return (
    <>
      <Pressable
        onPress={onPress}
        hitSlop={6}
        style={withPressed(styles.hit)}
        accessibilityRole="button"
        accessibilityLabel={
          wraps.length === 1 ? `Play ${nameOf(wraps[0])}` : `Play a Wrap, ${wraps.length} ready`
        }
      >
        {fresh ? (
          <LinearGradient
            colors={[accent, theme.colors.secondary, theme.colors.accent, theme.colors.spentSoft]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ring}
          >
            {disc}
          </LinearGradient>
        ) : (
          <View style={[styles.ring, styles.ringSeen]}>{disc}</View>
        )}
        {wraps.length > 1 && (
          <View style={styles.count}>
            <Text style={styles.countText}>{wraps.length}</Text>
          </View>
        )}
      </Pressable>

      <ModalSheet
        visible={choosing}
        onClose={() => setChoosing(false)}
        title="Which Wrap?"
        scrollable={false}
      >
        <View style={styles.card}>
          {wraps.map((w, i) => (
            <Pressable
              key={w.key}
              onPress={() => {
                setChoosing(false);
                onPlay(w);
              }}
              style={withPressed([h.row, i > 0 && h.divider])}
              accessibilityRole="button"
              accessibilityLabel={`Play ${nameOf(w)}, ${formatMoney(w.spentMinor)} spent`}
            >
              <View style={styles.rowPlay}>
                <MaterialCommunityIcons
                  name="play"
                  size={18}
                  color={theme.colors.surface}
                  style={styles.playIcon}
                />
              </View>
              <View style={h.mid}>
                <Text style={h.title} numberOfLines={1}>
                  {w.label}
                </Text>
                <Text style={h.sub}>
                  {w.period === 'month' ? 'Your month · 15 sec' : 'Your week · 8 sec'}
                </Text>
              </View>
              <Text style={h.amount}>{formatMoney(w.spentMinor)}</Text>
            </Pressable>
          ))}
        </View>
      </ModalSheet>
    </>
  );
}

const styles = StyleSheet.create({
  hit: { width: SIZE, height: SIZE },
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    padding: 2,
  },
  ringSeen: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  inner: {
    flex: 1,
    borderRadius: SIZE / 2,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playSeen: { backgroundColor: theme.colors.surfaceAlt },
  // The play triangle's weight sits left of its box; this centres it by eye.
  playIcon: { marginLeft: 2 },
  count: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: theme.font.monoBold, fontSize: 10, color: theme.colors.surface },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  rowPlay: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

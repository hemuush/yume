import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, PanResponder, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { Account } from '@/types';
import { accountHue, accountIcon } from '@/lib/account';
import { GainPill } from '@/features/investments/GainPill';
import { shade } from '@/lib/color';
import { haptics } from '@/lib/haptics';
import { MOTION, timing } from '@/lib/animation';
import { withPressed } from '@/lib/pressed';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { useAccent } from '@/theme/AccentContext';
import {
  STACK,
  cardPose,
  dragProgress,
  shouldCommit,
  slotOf,
  stackHeight,
  visibleCount,
} from './accountStackMotion';

interface Props {
  accounts: Account[];
  onOpen: (account: Account) => void;
  /** True on the first load after the app opens: the cards fan out one after another instead of one quick fade. */
  opening?: boolean;
}

/**
 * Home's "Your accounts" (the Account Stack sign-off): up to four account cards
 * overlapping like a hand of cards, each showing its name and balance in the
 * strip that peeks out, the front one in full. Swipe the stack sideways and the
 * back card slides out and goes to the front; with more than four accounts the
 * next one rises into the front instead and the dots below say where you are.
 * Tapping a card opens that account's summary.
 *
 * The motion is one number, `p` (see accountStackMotion) — a finger drag sets it
 * directly, a release plays it out on the UI thread — so the swipe never waits
 * on React. A new account count remounts the stack back at its resting order.
 */
export function AccountStack(props: Props) {
  return <StackBody key={props.accounts.length} {...props} />;
}

interface Gesture {
  grant: () => void;
  move: (dx: number) => void;
  release: (dx: number, vx: number) => void;
}

function StackBody({ accounts, onOpen, opening = false }: Props) {
  const n = accounts.length;
  const vis = visibleCount(n);
  const reduce = useReduceMotion();
  const { accent } = useAccent();
  const [playOpening] = useState(opening);

  const width = useSharedValue(0);
  const widthPx = useRef(0);
  /** Swipes landed so far; the account at index i sits in slot (i - base) mod n. */
  const base = useSharedValue(0);
  /** How far the current swipe has got, 0 to 1. */
  const p = useSharedValue(0);
  const dir = useSharedValue(1);
  const fade = useSharedValue(1);
  const busy = useRef(false);
  /** `base`, mirrored in React for what the UI thread can't drive: accessibility, touch, dots. */
  const [baseJs, setBaseJs] = useState(0);

  const settle = useCallback(() => {
    busy.current = false;
    setBaseJs((b) => b + 1);
  }, []);

  const commit = (p0: number, d: number) => {
    if (busy.current || n < 2) return;
    busy.current = true;
    haptics.tap();
    dir.value = d;
    if (reduce) {
      // Config objects are built here on the JS thread: a worklet callback can capture them, but must not call JS helpers.
      const half = { duration: STACK.reduceMs / 2 };
      fade.value = withTiming(0, half, (finished) => {
        if (!finished) return;
        base.value = base.value + 1;
        p.value = 0;
        fade.value = withTiming(1, half);
        runOnJS(settle)();
      });
      return;
    }
    const cfg = { duration: STACK.totalMs * (1 - p0) + 60, easing: Easing.linear };
    p.value = withTiming(1, cfg, (finished) => {
      if (!finished) return;
      base.value = base.value + 1;
      p.value = 0;
      runOnJS(settle)();
    });
  };

  const gesture: Gesture = {
    grant: () => cancelAnimation(p),
    move: (dx) => {
      if (busy.current || reduce) return;
      dir.value = dx >= 0 ? 1 : -1;
      p.value = dragProgress(dx, widthPx.current);
    },
    release: (dx, vx) => {
      if (busy.current) return;
      const d = dx >= 0 ? 1 : -1;
      const p0 = dragProgress(dx, widthPx.current);
      if (shouldCommit(p0, vx, d)) commit(reduce ? 0 : p0, d);
      else if (!reduce) p.value = withTiming(0, timing(STACK.cancelMs));
    },
  };
  const live = useRef(gesture);
  useEffect(() => {
    live.current = gesture;
  });

  // react-hooks/refs can't see that `live` is only read from inside the responder's own callbacks, later, on a real gesture.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      // Mostly-horizontal drags only: a vertical one is the page scrolling and must pass through.
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => live.current.grant(),
      onPanResponderMove: (_, g) => live.current.move(g.dx),
      onPanResponderRelease: (_, g) => live.current.release(g.dx, g.vx),
      onPanResponderTerminate: () => live.current.release(0, 0),
      onPanResponderTerminationRequest: () => false,
    })
  );

  const onLayout = (e: LayoutChangeEvent) => {
    widthPx.current = e.nativeEvent.layout.width;
    width.value = e.nativeEvent.layout.width;
  };
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const frontIndex = (((baseJs + vis - 1) % n) + n) % n;

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[{ height: stackHeight(n) }, fadeStyle]}
        onLayout={onLayout}
        {...(n > 1 ? responder.panHandlers : {})}
      >
        {accounts.map((account, i) => {
          const slot = slotOf(i, baseJs, n);
          return (
            <StackCard
              key={account.id}
              account={account}
              index={i}
              count={n}
              base={base}
              p={p}
              dir={dir}
              width={width}
              playOpening={playOpening}
              reduce={reduce}
              hidden={slot >= vis}
              front={slot === vis - 1}
              onOpen={() => onOpen(account)}
              onNext={() => commit(0, -1)}
            />
          );
        })}
      </Animated.View>
      {n > STACK.maxVisible && (
        <View
          testID="account-stack-dots"
          style={styles.dots}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {accounts.map((a, i) => (
            <View
              key={a.id}
              style={[styles.dot, i === frontIndex && [styles.dotOn, { backgroundColor: accent }]]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

interface CardProps {
  account: Account;
  index: number;
  count: number;
  base: { value: number };
  p: { value: number };
  dir: { value: number };
  width: { value: number };
  playOpening: boolean;
  reduce: boolean;
  hidden: boolean;
  front: boolean;
  onOpen: () => void;
  onNext: () => void;
}

function StackCard({
  account,
  index,
  count,
  base,
  p,
  dir,
  width,
  playOpening,
  reduce,
  hidden,
  front,
  onOpen,
  onNext,
}: CardProps) {
  const { accent } = useAccent();
  const hue = accountHue(account.type, accent);
  const vis = visibleCount(count);
  const frontY = (vis - 1) * STACK.peek;
  const enter = useSharedValue(0);

  // The opening fans out from the front card, one step behind the last; a card that arrives later just fades in.
  useEffect(() => {
    if (reduce) {
      enter.value = 1;
      return;
    }
    const delay = playOpening ? Math.max(0, vis - 1 - index) * MOTION.enterStep : 0;
    enter.value = withDelay(delay, withTiming(1, timing(playOpening ? MOTION.enter : MOTION.quick)));
  }, [enter, reduce, playOpening, vis, index]);

  const style = useAnimatedStyle(() => {
    const slot = slotOf(index, base.value, count);
    const pose = cardPose(slot, count, p.value, dir.value, width.value);
    const e = enter.value;
    let zIndex = slot + 1;
    if (slot === 0) zIndex = p.value < STACK.exitEnd ? 1 : 30;
    else if (slot > vis) zIndex = 0;
    else if (slot === vis) zIndex = p.value > STACK.exitEnd ? vis + 2 : 0;
    return {
      opacity: pose.opacity * e,
      zIndex,
      transform: [
        { translateX: pose.x },
        { translateY: frontY + (pose.y - frontY) * e },
        { rotate: `${pose.rotate}deg` },
        { scale: pose.scale },
      ],
    };
  });

  const typeLabel = account.investment ? 'savings · tracked' : account.type.replace('_', ' ');
  return (
    <Animated.View
      testID={`account-card-${account.id}`}
      style={[styles.card, { borderColor: shade(hue, 82) }, style]}
      pointerEvents={hidden ? 'none' : 'auto'}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={hidden}
    >
      <LinearGradient
        colors={[shade(hue, 94), shade(hue, 88)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.circleBig} />
      <View style={styles.circleSmall} />
      <Pressable
        onPress={onOpen}
        style={withPressed(styles.face)}
        accessibilityRole="button"
        accessibilityLabel={`${account.name}, ${typeLabel}. Open summary`}
        accessibilityActions={front && count > 1 ? [{ name: 'next', label: 'Show next account' }] : undefined}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'next') onNext();
        }}
      >
        <View style={styles.row}>
          <MaterialCommunityIcons
            name={accountIcon(account.type) as McIconName}
            size={22}
            color={shade(hue, 38, 10)}
          />
          <Text style={styles.name} numberOfLines={1}>
            {account.name}
          </Text>
          <Amount
            minor={account.currentBalanceMinor}
            currency={account.currency}
            sensitive={account.type === 'savings'}
            style={styles.balance}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
        </View>
        <Text style={styles.type}>{typeLabel}</Text>
        {account.investment && (
          <View style={styles.gain}>
            <GainPill account={account} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20 },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: STACK.cardHeight,
    borderRadius: theme.radius.xl2,
    borderWidth: 1,
    overflow: 'hidden',
    // Pivots at its bottom edge, so the leaving card tilts like one lifted off a pile.
    transformOrigin: '50% 100%',
    boxShadow: '0px -2px 9px rgba(18,19,15,0.08)',
  },
  face: { flex: 1 },
  circleBig: {
    position: 'absolute',
    right: -28,
    bottom: -52,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  circleSmall: {
    position: 'absolute',
    right: 30,
    bottom: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  row: {
    height: STACK.peek,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 2,
    paddingHorizontal: 20,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.font.roundedBold,
    fontSize: 15.5,
    color: theme.colors.textPrimary,
  },
  balance: {
    flexShrink: 0,
    maxWidth: '55%',
    fontFamily: theme.font.monoBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  gain: { position: 'absolute', right: 14, bottom: 8 },
  type: {
    position: 'absolute',
    left: 52,
    bottom: 11,
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(18,19,15,0.14)' },
  dotOn: { width: 16 },
});

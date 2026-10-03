import ReanimatedAnimated, { SharedValue, useAnimatedStyle, interpolate } from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { styles } from './hero.styles';

const CONFETTI_COLORS = [theme.colors.secondary, theme.colors.primary, theme.colors.idCoralDeep];

export interface ConfettiPiece {
  color: string;
  angle: number;
  distance: number;
}

export function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: 8 }, (_, i) => ({
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    angle: -Math.PI / 2 + (Math.random() - 0.5) * 2.6,
    distance: 22 + Math.random() * 18,
  }));
}

export function ConfettiDot({ progress, piece }: { progress: SharedValue<number>; piece: ConfettiPiece }) {
  const style = useAnimatedStyle(() => {
    const tx = interpolate(progress.value, [0, 1], [0, Math.cos(piece.angle) * piece.distance]);
    const ty = interpolate(
      progress.value,
      [0, 0.4, 1],
      [0, Math.sin(piece.angle) * piece.distance - 6, Math.sin(piece.angle) * piece.distance + 18]
    );
    const opacity = interpolate(progress.value, [0, 0.15, 0.7, 1], [0, 1, 1, 0]);
    const rotate = interpolate(progress.value, [0, 1], [0, 260]);
    return {
      opacity,
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${rotate}deg` }],
    };
  });
  return (
    <ReanimatedAnimated.View
      pointerEvents="none"
      style={[styles.confettiDot, { backgroundColor: piece.color }, style]}
    />
  );
}

import ReanimatedAnimated, { SharedValue, useAnimatedStyle, interpolate } from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { styles } from './hero.styles';

// The theme's two colours plus coral; resolved at draw time so a piece follows the picked theme.
type ConfettiTone = 'secondary' | 'accent' | 'coral';
const CONFETTI_TONES: ConfettiTone[] = ['secondary', 'accent', 'coral'];

export interface ConfettiPiece {
  tone: ConfettiTone;
  angle: number;
  distance: number;
}

export function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: 8 }, (_, i) => ({
    tone: CONFETTI_TONES[i % CONFETTI_TONES.length],
    angle: -Math.PI / 2 + (Math.random() - 0.5) * 2.6,
    distance: 22 + Math.random() * 18,
  }));
}

export function ConfettiDot({ progress, piece }: { progress: SharedValue<number>; piece: ConfettiPiece }) {
  const { accent, secondary } = useAccent();
  const color =
    piece.tone === 'accent' ? accent : piece.tone === 'secondary' ? secondary : theme.colors.idCoralDeep;
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
      style={[styles.confettiDot, { backgroundColor: color }, style]}
    />
  );
}

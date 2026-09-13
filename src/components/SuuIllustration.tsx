import { View, Image, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

interface Props {
  size?: number;
  pose?: 'default' | 'peek' | 'sleepy';
}

const CORAL = theme.colors.idCoralDeep;

// Suu — Yume's mascot, redrawn after the ring-mark rebrand. Earlier attempts
// tried to give Suu its own crescent shape, and later to put a face on the
// app icon's exact silhouette — both read as a mismatch with the icon, or
// as a face awkwardly stuck onto a shape that was never built to hold one.
// This is a different idea, signed off in session: Suu isn't a character
// wearing the logo, Suu *is* the logo — the same ring asset the app icon
// uses, with no face at all. Personality comes entirely from the one coral
// dot: centered and full-size at rest, shrunk/dimmed/drifted down for
// 'sleepy'. 'peek' renders like 'default', matching every earlier version
// of this component.
export function SuuIllustration({ size = 90, pose = 'default' }: Props) {
  const sleepy = pose === 'sleepy';
  const dotSize = size * (sleepy ? 0.24 : 0.33);

  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={require('../../assets/suu-ring.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            left: size * (sleepy ? 0.5 : 0.47) - dotSize / 2,
            top: size * (sleepy ? 0.34 : 0.24) - dotSize / 2,
            opacity: sleepy ? 0.55 : 1,
          },
        ]}
      />
      {sleepy && (
        <>
          <Text style={[styles.z, { fontSize: size * 0.16, right: size * 0.14, top: size * 0.08 }]}>z</Text>
          <Text style={[styles.z, { fontSize: size * 0.11, right: size * 0.06, top: size * 0.01 }]}>z</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', backgroundColor: CORAL },
  z: { position: 'absolute', fontFamily: theme.font.roundedBold, color: theme.colors.ink },
});

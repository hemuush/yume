import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { theme } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
  /** Tinted fills carry their own separation and get no border (like NeoTile). */
  backgroundColor?: string;
  borderRadius?: number;
  padding?: number;
  /** One soft, blurred shadow — the calm register's only lift. Off by default. */
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The Home screen's calmer card: rounder corners and more air than the
 * doodle-register `NeoTile`, a hairline only on plain surfaces, and an
 * optional gentle blurred shadow (never the hard offset shadow). Kept
 * separate from `NeoTile` on purpose — every other screen still uses that.
 */
export function SoftCard({
  children,
  backgroundColor = theme.colors.surface,
  borderRadius = theme.radius.xl2,
  padding = 16,
  elevated = false,
  style,
}: Props) {
  const isColored = backgroundColor !== theme.colors.surface;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor, borderRadius, padding },
        !isColored && styles.hairline,
        elevated && styles.elevated,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'visible' },
  hairline: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderSoft },
  elevated: {
    shadowColor: theme.colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
});

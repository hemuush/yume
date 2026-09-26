import { View } from 'react-native';
import { Text } from '@/components/Text';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { roundedMinor } from '@/lib/round';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { MoonPhase, moonPhaseShades } from './MoonPhase';
import { styles } from './reports.styles';

/**
 * Recurring vs discretionary spend as a moon phase, not a bar: the lit
 * fraction of the disc is drawn to the exact recurring/total ratio (see
 * MoonPhase's lune construction). Both the moon and its legend are shades of
 * the user's own accent, so it always sits in the app's colour family.
 */
export function MoonCard({
  periodName,
  recurringMinor,
  discretionaryMinor,
}: {
  periodName: string;
  recurringMinor: number;
  discretionaryMinor: number;
}) {
  const { accent } = useAccent();
  const total = recurringMinor + discretionaryMinor;
  // moonShades.dark (a pale tint) is right for the disc, but too light to read
  // as text or a tiny dot on a cream card — `discretionaryInk` is a mid-dark
  // version of the same hue for the "Discretionary" figure and its dot.
  const moonShades = moonPhaseShades(accent);
  const discretionaryInk = shade(accent, 55, -2);
  return (
    <View style={styles.moonCard}>
      <Text style={styles.moonTitle}>Fixed vs flexible</Text>
      <Text style={styles.moonSub}>How much of {periodName} was already spoken for</Text>
      <MoonPhase litFraction={recurringMinor / total} size={132} accent={accent} />
      <View style={styles.moonFigs}>
        <View style={styles.moonFig}>
          <View style={styles.moonFigLabelRow}>
            <View style={[styles.rdDot, { backgroundColor: moonShades.lit }]} />
            <Text style={styles.moonFigLabel}>Recurring</Text>
          </View>
          <Text style={[styles.moonFigValue, { color: moonShades.lit }]}>
            {formatMoney(roundedMinor(recurringMinor))}
          </Text>
        </View>
        <View style={styles.moonFig}>
          <View style={styles.moonFigLabelRow}>
            <View style={[styles.rdDot, { backgroundColor: discretionaryInk }]} />
            <Text style={styles.moonFigLabel}>Discretionary</Text>
          </View>
          <Text style={[styles.moonFigValue, { color: discretionaryInk }]}>
            {formatMoney(roundedMinor(discretionaryMinor))}
          </Text>
        </View>
      </View>
      <Text style={styles.moonCaption}>
        {formatPctChange((recurringMinor / total) * 100)} of what you spent was already spoken for — EMI,
        rent, subscriptions &amp; insurance.
      </Text>
    </View>
  );
}

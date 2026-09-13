import { TextWidget } from 'react-native-android-widget';
import { WidgetShell, MoonPhaseRow } from './WidgetShell';
import { widgetColor, asWidgetColor } from './widgetTheme';
import type { SuuWidgetData } from './data';

/**
 * "Suu Check-in" — the 2×2 widget. The one widget a generic finance app
 * couldn't ship: Suu's own line (`suuLine()`, unchanged — savings nudge,
 * spend-up warning, or a top-growing category, in that priority order) on
 * the home screen. Suu itself redrawn as a seven-dot row with one
 * highlighted center dot, instead of the ring shape RemoteViews can't
 * easily reproduce — which, since the ring-mark rebrand, actually echoes
 * Suu's own design (one moving dot carries the personality) rather than
 * just standing in for it. Taps open the app to Home, where the full hero
 * card lives.
 */
export function SuuWidget({ line, dot }: SuuWidgetData) {
  return (
    <WidgetShell clickAction="OPEN_APP">
      <MoonPhaseRow dot={asWidgetColor(dot)} />
      <TextWidget
        text={line.text}
        maxLines={3}
        style={{
          width: 'match_parent',
          fontSize: 12,
          color: widgetColor.ink,
          textAlign: 'center',
          lineHeight: 16,
          marginTop: 10,
          fontWeight: '500',
        }}
      />
      <TextWidget
        text="SUU SAYS"
        style={{
          width: 'match_parent',
          fontSize: 8.5,
          color: widgetColor.textMuted,
          letterSpacing: 1,
          textAlign: 'center',
          marginTop: 7,
          fontWeight: '600',
        }}
      />
    </WidgetShell>
  );
}

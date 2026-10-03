import { FlexWidget, ImageWidget, OverlapWidget, TextWidget } from 'react-native-android-widget';
import { WidgetShell, WidgetLabel } from './WidgetShell';
import { widgetColor, widgetTint, asWidgetColor, WIDGET_FONT, WIDGET_RADIUS } from './widgetTheme';
import type { SuuWidgetData } from './data';

const SUU = 30;
const DOT = Math.round(SUU * 0.33);

/**
 * "Suu Check-in" 2×2 widget: the app's ring image with one theme-coloured dot (see SuuIllustration), "Suu says"
 * beside it, `suuLine()` across the full width (beside Suu it fit a word or two), pack-colour footer.
 */
export function SuuWidget({ line, dot, secondary }: SuuWidgetData) {
  return (
    <WidgetShell clickAction="OPEN_APP" padding={0}>
      <FlexWidget
        style={{
          flex: 1,
          height: 0,
          width: 'match_parent',
          flexDirection: 'column',
          padding: 14,
          paddingBottom: 8,
        }}
      >
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <OverlapWidget style={{ width: SUU, height: SUU }}>
            <ImageWidget image={require('../../assets/suu-ring.png')} imageWidth={SUU} imageHeight={SUU} />
            <FlexWidget
              style={{
                width: DOT,
                height: DOT,
                borderRadius: DOT / 2,
                backgroundColor: asWidgetColor(dot),
                marginLeft: Math.round(SUU * 0.47 - DOT / 2),
                marginTop: Math.round(SUU * 0.24 - DOT / 2),
              }}
            />
          </OverlapWidget>
          <FlexWidget style={{ width: 8, height: 1 }} />
          <WidgetLabel text="Suu says" />
        </FlexWidget>
        <TextWidget
          text={line.text}
          maxLines={4}
          truncate="END"
          style={{
            fontFamily: WIDGET_FONT.roundedMedium,
            fontSize: 12.5,
            lineHeight: 16,
            color: widgetColor.ink,
            marginTop: 8,
          }}
        />
      </FlexWidget>
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 8,
          backgroundColor: widgetTint(secondary, 90),
          borderBottomLeftRadius: WIDGET_RADIUS - 1,
          borderBottomRightRadius: WIDGET_RADIUS - 1,
        }}
      >
        <WidgetLabel text="Open Yume ›" color={widgetColor.inkSoft} />
      </FlexWidget>
    </WidgetShell>
  );
}

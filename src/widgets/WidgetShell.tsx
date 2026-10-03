import { FlexWidget, TextWidget, IconWidget, type ColorProp } from 'react-native-android-widget';
import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import { widgetColor, WIDGET_FONT, WIDGET_RADIUS } from './widgetTheme';

/**
 * The shell every widget is built on: Home's calm cream card, warm hairline border, 22 corner. Components
 * must be plain sync functions with no hooks (Android renders them to RemoteViews outside React's loop).
 */
export function WidgetShell({
  children,
  clickAction,
  clickActionData,
  flexDirection = 'column',
  alignItems,
  justifyContent,
  padding = 14,
}: {
  children?: React.ReactNode;
  clickAction?: string;
  clickActionData?: Record<string, unknown>;
  flexDirection?: 'row' | 'column';
  alignItems?: 'flex-start' | 'center' | 'flex-end';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  padding?: number;
}) {
  return (
    <FlexWidget
      clickAction={clickAction}
      clickActionData={clickActionData}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection,
        alignItems,
        justifyContent,
        backgroundColor: widgetColor.cream,
        borderRadius: WIDGET_RADIUS,
        borderWidth: 1,
        borderColor: widgetColor.borderSoft,
        padding,
      }}
    >
      {children}
    </FlexWidget>
  );
}

/** A widget's heading, in Home's section-title face: "September", "Your accounts". */
export function WidgetTitle({ text }: { text: string }) {
  return (
    <TextWidget
      text={text}
      maxLines={1}
      truncate="END"
      style={{ fontFamily: WIDGET_FONT.rounded, fontSize: 15, color: widgetColor.ink }}
    />
  );
}

/** A small uppercase label — "18 DAYS LEFT", "SUU SAYS". */
export function WidgetLabel({ text, color = widgetColor.textMuted }: { text: string; color?: ColorProp }) {
  return (
    <TextWidget
      text={text.toUpperCase()}
      style={{ fontFamily: WIDGET_FONT.bodyMedium, fontSize: 9, color, letterSpacing: 0.8 }}
    />
  );
}

const GLYPHS = glyphs as Record<string, number>;

/** The character a Material Community Icons name draws, or a plain dot for a name it doesn't know. */
export function iconGlyph(name: string): string {
  const code = GLYPHS[name] ?? GLYPHS['circle-small'];
  return code != null ? String.fromCodePoint(code) : '•';
}

/** A category or account icon in a round tinted circle, like Home's rows. */
export function WidgetIcon({
  name,
  background,
  color = widgetColor.ink,
  size = 30,
  clickAction,
  clickActionData,
}: {
  name: string;
  background: ColorProp;
  color?: ColorProp;
  size?: number;
  clickAction?: string;
  clickActionData?: Record<string, unknown>;
}) {
  return (
    <FlexWidget
      clickAction={clickAction}
      clickActionData={clickActionData}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconWidget
        icon={iconGlyph(name)}
        font={WIDGET_FONT.icons}
        size={Math.round(size * 0.5)}
        style={{ color }}
      />
    </FlexWidget>
  );
}

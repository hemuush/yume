import { FlexWidget, TextWidget, type ColorProp } from 'react-native-android-widget';
import { widgetColor, widgetRgba, WIDGET_GLASS_BG, WIDGET_RADIUS } from './widgetTheme';

/**
 * The one shell every widget is built on — same radius, same border, same
 * translucent fill regardless of which widget it is, so the five read as
 * one family sitting on the wallpaper rather than five unrelated cards
 * pasted over it (the "deference" + "consistency" pass — see the Yume
 * Night design artifact this implements).
 *
 * Widget components must stay plain sync functions with no hooks (Android
 * renders these into RemoteViews on its own, outside React's render loop) —
 * this is composition only, no state of its own.
 */
export function WidgetShell({
  children,
  clickAction,
  clickActionData,
  flexDirection = 'column',
  alignItems,
  padding = 16,
}: {
  children?: any;
  clickAction?: string;
  clickActionData?: Record<string, unknown>;
  flexDirection?: 'row' | 'column';
  alignItems?: 'flex-start' | 'center' | 'flex-end';
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
        backgroundColor: WIDGET_GLASS_BG,
        borderRadius: WIDGET_RADIUS,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        padding,
      }}
    >
      {children}
    </FlexWidget>
  );
}

/** A small uppercase mono-ish label — "SPENT THIS MONTH", "ACCOUNTS". */
export function WidgetLabel({ text }: { text: string }) {
  return (
    <TextWidget
      text={text}
      style={{ fontSize: 9, color: widgetColor.textMuted, letterSpacing: 1, fontWeight: '600' }}
    />
  );
}

function Dot({ on, color }: { on: boolean; color: ColorProp }) {
  return (
    <FlexWidget
      style={{
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: on ? color : widgetRgba(148, 142, 124, 0.35),
        marginLeft: 4,
      }}
    />
  );
}

/**
 * The quiet night-sky motif in a widget's corner — six dots, two of them lit
 * in the user's own accent. Stands in for Nothing's Glyph Matrix without
 * copying it outright, and doubles as a nod to "Yume" (a dream, a night
 * sky). Purely decorative — never spells out real data.
 */
export function ConstellationDots({ accent, lit = [0, 4] }: { accent: ColorProp; lit?: number[] }) {
  const cells = Array.from({ length: 6 }, (_, i) => lit.includes(i));
  return (
    <FlexWidget style={{ flexDirection: 'row', width: 'wrap_content', flexGap: 0 }}>
      <FlexWidget style={{ flexDirection: 'column' }}>
        <FlexWidget style={{ flexDirection: 'row' }}>
          {cells.slice(0, 3).map((on, i) => (
            <Dot key={i} on={on} color={accent} />
          ))}
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', marginTop: 4 }}>
          {cells.slice(3, 6).map((on, i) => (
            <Dot key={i} on={on} color={accent} />
          ))}
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/** Suu's crescent, redrawn as a seven-dot moon-phase row instead of a filled icon — same dot language as ConstellationDots, shaped like the thing Suu already is. */
export function MoonPhaseRow() {
  const opacities = [0.15, 0.4, 0.7, 1, 0.7, 0.4, 0.15];
  return (
    <FlexWidget style={{ flexDirection: 'row', justifyContent: 'center', width: 'match_parent' }}>
      {opacities.map((o, i) => (
        <FlexWidget
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: 2.5,
            marginLeft: i === 0 ? 0 : 3,
            backgroundColor: i === 3 ? widgetColor.sage : `rgba(18, 19, 15, ${o})`,
            borderWidth: i === 3 ? 1 : 0,
            borderColor: widgetColor.ink,
          }}
        />
      ))}
    </FlexWidget>
  );
}

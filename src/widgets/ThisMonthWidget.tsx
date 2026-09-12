import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { WidgetShell, WidgetLabel, ConstellationDots } from './WidgetShell';
import { widgetColor, DOT_FONT, asWidgetColor } from './widgetTheme';
import type { ThisMonthWidgetData } from './data';

/**
 * "This Month" — the 4×2 widget. Same figure, same spend/kept bar
 * (mint = kept, deep coral = spent, flipped fully to expense-red if
 * overspent) as Home's own `ThisMonthHero`, just without the income figure
 * or Suu — there isn't room for a second hierarchy in one widget, and
 * spend is the number people actually check without opening the app.
 * Taps open the app (`OPEN_APP`) — there's no single deeper screen this
 * one number belongs to more than Home itself.
 */
export function ThisMonthWidget(data: ThisMonthWidgetData) {
  const { spentMinor, changePct, spentPct, keptPct, overspent, accent } = data;
  return (
    <WidgetShell clickAction="OPEN_APP">
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent' }}>
        <WidgetLabel text="SPENT THIS MONTH" />
        <ConstellationDots accent={asWidgetColor(accent)} />
      </FlexWidget>
      <TextWidget
        text={formatMoney(spentMinor)}
        style={{ fontFamily: DOT_FONT, fontSize: 28, color: widgetColor.ink, marginTop: 4 }}
      />
      {changePct != null && (
        <TextWidget
          text={`${changePct >= 0 ? '↑' : '↓'} ${formatPctChange(changePct)} ${changePct >= 0 ? 'more' : 'less'} than last month`}
          style={{
            fontSize: 11,
            color: changePct > 0 ? widgetColor.expense : widgetColor.inkSoft,
            marginTop: 3,
          }}
        />
      )}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          height: 6,
          borderRadius: 3,
          backgroundColor: widgetColor.borderSoft,
          marginTop: 13,
          overflow: 'hidden',
        }}
      >
        {overspent ? (
          <FlexWidget
            style={{ width: 'match_parent', height: 'match_parent', backgroundColor: widgetColor.expense }}
          />
        ) : (
          // Same technique Android's own weighted LinearLayout uses for a
          // proportional bar: zero base width plus a `flex` weight, rather
          // than a percentage width (RemoteViews sizing only understands a
          // fixed dp number, `wrap_content`, or `match_parent` — no `%`).
          //
          // A plain array here, not a `<>...</>` fragment: this library's
          // widget-tree builder resolves any non-native element by calling
          // `type(props)` directly, and a Fragment's `type` is a Symbol, not
          // a function — that call throws, the throw is swallowed by
          // widgetTaskHandler's catch, and the widget is left stuck on
          // Android's blank initial layout forever. An array of elements
          // renders identically (the builder already flattens one level of
          // nested arrays) without hitting that path.
          [
            <FlexWidget
              key="spent"
              style={{
                width: 0,
                flex: spentPct,
                height: 'match_parent',
                backgroundColor: widgetColor.coralDeep,
              }}
            />,
            <FlexWidget
              key="kept"
              style={{ width: 0, flex: keptPct, height: 'match_parent', backgroundColor: widgetColor.mint }}
            />,
          ]
        )}
      </FlexWidget>
    </WidgetShell>
  );
}

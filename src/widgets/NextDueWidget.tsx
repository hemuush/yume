import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { formatMoney } from '@/lib/money';
import { WidgetShell } from './WidgetShell';
import { widgetColor, widgetAlpha, WIDGET_FONT } from './widgetTheme';
import { dateTileParts, type NextDueWidgetData } from './data';

/**
 * "Next Due" — the 4×1 widget, one of Home's Upcoming rows (the Home A
 * widgets sign-off): a date tile ("01" over "OCT") in the category's colour,
 * or the theme's for an EMI; the name and when it's due; the amount in ink,
 * green only for money coming in. The same loan-EMI-or-recurring-rule merge
 * Home's Upcoming list computes. Tapping opens Loans or Recurring, whichever
 * this item came from.
 */
export function NextDueWidget({ data }: { data: NextDueWidgetData | null }) {
  if (!data) {
    return (
      <WidgetShell clickAction="OPEN_APP" flexDirection="row" alignItems="center">
        <TextWidget
          text="Nothing due soon"
          style={{ fontFamily: WIDGET_FONT.bodyMedium, fontSize: 13, color: widgetColor.textMuted }}
        />
      </WidgetShell>
    );
  }

  const { title, subtitle, amountMinor, sign, route, dateIso, tint } = data;
  const { day, month } = dateTileParts(dateIso);
  return (
    <WidgetShell
      clickAction="OPEN_URI"
      clickActionData={{ uri: `yume://${route.slice(1)}` }}
      flexDirection="row"
      alignItems="center"
      padding={12}
    >
      <FlexWidget
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          backgroundColor: widgetAlpha(tint, 0.28),
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TextWidget
          text={day}
          style={{ fontFamily: WIDGET_FONT.rounded, fontSize: 15, color: widgetColor.ink }}
        />
        <TextWidget
          text={month}
          style={{
            fontFamily: WIDGET_FONT.bodyMedium,
            fontSize: 8,
            letterSpacing: 0.5,
            color: widgetColor.inkSoft,
          }}
        />
      </FlexWidget>
      <FlexWidget style={{ width: 12, height: 1 }} />
      <FlexWidget style={{ flexDirection: 'column', flex: 1, width: 0 }}>
        <TextWidget
          text={title}
          truncate="END"
          maxLines={1}
          style={{ fontFamily: WIDGET_FONT.bodyMedium, fontSize: 13.5, color: widgetColor.ink }}
        />
        <TextWidget
          text={subtitle}
          maxLines={1}
          style={{ fontFamily: WIDGET_FONT.body, fontSize: 11, color: widgetColor.inkSoft, marginTop: 1 }}
        />
      </FlexWidget>
      <TextWidget
        text={`${sign === '+' ? '+' : ''}${formatMoney(amountMinor)}`}
        style={{
          fontFamily: WIDGET_FONT.mono,
          fontSize: 13.5,
          color: sign === '+' ? widgetColor.income : widgetColor.ink,
        }}
      />
    </WidgetShell>
  );
}

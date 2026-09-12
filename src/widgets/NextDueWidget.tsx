import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { formatMoney } from '@/lib/money';
import { WidgetShell } from './WidgetShell';
import { widgetColor, asWidgetColor } from './widgetTheme';
import type { NextDueWidgetData } from './data';

/**
 * "Next Due" — the 4×1 widget. The same loan-EMI-or-recurring-rule merge
 * Home's own "Upcoming" section computes, one row. The 📅 emoji from the
 * first design pass is gone — emoji render differently across Pixel's Noto
 * Color Emoji and Samsung's own set, which is exactly the kind of
 * per-OEM inconsistency this whole feature is meant to avoid — replaced
 * with a three-dot column in the user's own accent, matching the dot
 * language the other widgets use. Tapping opens Loans or Recurring,
 * whichever this item actually came from.
 */
export function NextDueWidget({ data }: { data: NextDueWidgetData | null }) {
  if (!data) {
    return (
      <WidgetShell clickAction="OPEN_APP" flexDirection="row" alignItems="center">
        <TextWidget
          text="Nothing due soon"
          style={{ fontSize: 13, color: widgetColor.textMuted, fontWeight: '500' }}
        />
      </WidgetShell>
    );
  }

  const { title, subtitle, amountMinor, sign, route, accent } = data;
  return (
    <WidgetShell
      clickAction="OPEN_URI"
      clickActionData={{ uri: `yume://${route.slice(1)}` }}
      flexDirection="row"
      alignItems="center"
    >
      <FlexWidget style={{ flexDirection: 'column', width: 'wrap_content' }}>
        {[0, 1, 2].map((i) => (
          <FlexWidget
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: 2.5,
              backgroundColor: asWidgetColor(accent),
              marginTop: i === 0 ? 0 : 4,
            }}
          />
        ))}
      </FlexWidget>
      <FlexWidget style={{ width: 13, height: 'match_parent' }} />
      <FlexWidget style={{ flexDirection: 'column', flex: 1, width: 0 }}>
        <TextWidget
          text={title}
          truncate="END"
          maxLines={1}
          style={{ fontSize: 13, fontWeight: '600', color: widgetColor.ink }}
        />
        <TextWidget text={subtitle} style={{ fontSize: 10.5, color: widgetColor.inkSoft, marginTop: 1 }} />
      </FlexWidget>
      <TextWidget
        text={`${sign === '-' ? '−' : '+'}${formatMoney(amountMinor)}`}
        style={{
          fontSize: 15,
          fontWeight: '700',
          color: sign === '-' ? widgetColor.expense : widgetColor.income,
        }}
      />
    </WidgetShell>
  );
}

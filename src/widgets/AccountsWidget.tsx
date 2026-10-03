import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { shade } from '@/lib/color';
import { WidgetShell, WidgetTitle, WidgetIcon } from './WidgetShell';
import { widgetColor, widgetTint, asWidgetColor, WIDGET_FONT } from './widgetTheme';
import type { AccountsWidgetData } from './data';

/**
 * "Accounts" 4×2 widget: your first three accounts in Home's strip order, each with a type-tinted round icon,
 * type under the name, Space Mono balance; the total sits by the title when sensible. Opens the app.
 */
export function AccountsWidget({ accounts, totalText }: AccountsWidgetData) {
  return (
    <WidgetShell clickAction="OPEN_APP">
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'match_parent',
        }}
      >
        <WidgetTitle text="Your accounts" />
        {totalText != null && (
          <TextWidget
            text={totalText}
            style={{ fontFamily: WIDGET_FONT.mono, fontSize: 11.5, color: widgetColor.inkSoft }}
          />
        )}
      </FlexWidget>
      <FlexWidget style={{ height: 4, width: 'match_parent' }} />
      {accounts.length === 0 ? (
        <TextWidget
          text="No accounts yet"
          style={{ fontFamily: WIDGET_FONT.body, fontSize: 12.5, color: widgetColor.textMuted, marginTop: 6 }}
        />
      ) : (
        accounts.map((acc, i) => (
          <FlexWidget
            key={`${acc.name}-${i}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              width: 'match_parent',
              paddingVertical: 5,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: widgetColor.borderSoft,
            }}
          >
            <WidgetIcon
              name={acc.icon}
              background={widgetTint(acc.hue, 88)}
              color={asWidgetColor(shade(acc.hue, 38, 10))}
              size={28}
            />
            <FlexWidget style={{ width: 10, height: 1 }} />
            <FlexWidget style={{ flex: 1, width: 0, flexDirection: 'column' }}>
              <TextWidget
                text={acc.name}
                truncate="END"
                maxLines={1}
                style={{ fontFamily: WIDGET_FONT.bodyMedium, fontSize: 12.5, color: widgetColor.ink }}
              />
              <TextWidget
                text={acc.typeLabel}
                maxLines={1}
                style={{ fontFamily: WIDGET_FONT.body, fontSize: 10, color: widgetColor.textMuted }}
              />
            </FlexWidget>
            <TextWidget
              text={acc.balanceText}
              style={{
                fontFamily: WIDGET_FONT.mono,
                fontSize: 12.5,
                color: acc.negative ? widgetColor.expenseText : widgetColor.ink,
              }}
            />
          </FlexWidget>
        ))
      )}
    </WidgetShell>
  );
}

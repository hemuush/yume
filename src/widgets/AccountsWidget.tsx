import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { shade } from '@/lib/color';
import { WidgetShell, WidgetTitle, WidgetIcon } from './WidgetShell';
import { widgetColor, widgetTint, asWidgetColor, WIDGET_FONT } from './widgetTheme';
import type { AccountsWidgetData } from './data';

/** Three centred account columns, matching Home; balances keep their currency and privacy mask. */
export function AccountsWidget({ accounts, totalText }: AccountsWidgetData) {
  return (
    <WidgetShell clickAction="OPEN_APP" justifyContent="space-between">
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: 'match_parent',
        }}
      >
        <WidgetTitle text="Accounts" />
        {totalText != null && (
          <TextWidget
            text={totalText}
            maxLines={1}
            style={{
              fontFamily: WIDGET_FONT.amount,
              fontSize: 11,
              color: widgetColor.inkSoft,
              width: 100,
              textAlign: 'right',
              adjustsFontSizeToFit: true,
            }}
          />
        )}
      </FlexWidget>
      {accounts.length === 0 ? (
        <TextWidget
          text="Add your first account in Yume"
          style={{ fontFamily: WIDGET_FONT.body, fontSize: 12, color: widgetColor.textMuted }}
        />
      ) : (
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', marginTop: 10 }}>
          {accounts.map((acc, i) => (
            <FlexWidget
              key={`${acc.name}-${i}`}
              style={{
                flex: 1,
                width: 0,
                flexDirection: 'column',
                alignItems: 'center',
                paddingHorizontal: 3,
              }}
            >
              <WidgetIcon
                name={acc.icon}
                background={widgetTint(acc.hue, 88)}
                color={asWidgetColor(shade(acc.hue, 30, 10))}
                size={30}
              />
              <TextWidget
                text={acc.name}
                maxLines={1}
                truncate="END"
                style={{
                  width: 'match_parent',
                  textAlign: 'center',
                  fontFamily: WIDGET_FONT.bodyMedium,
                  fontSize: 12,
                  color: widgetColor.ink,
                  marginTop: 6,
                }}
              />
              <TextWidget
                text={acc.typeLabel}
                maxLines={1}
                style={{
                  width: 'match_parent',
                  textAlign: 'center',
                  fontFamily: WIDGET_FONT.body,
                  fontSize: 10,
                  color: widgetColor.textMuted,
                  marginTop: 2,
                }}
              />
              <TextWidget
                text={acc.balanceText}
                maxLines={1}
                style={{
                  width: 'match_parent',
                  textAlign: 'center',
                  fontFamily: WIDGET_FONT.amount,
                  fontSize: 14,
                  adjustsFontSizeToFit: true,
                  color: acc.negative ? widgetColor.expenseText : widgetColor.ink,
                  marginTop: 4,
                }}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      )}
    </WidgetShell>
  );
}

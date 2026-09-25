import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { WidgetShell, WidgetLabel, ConstellationDots } from './WidgetShell';
import { widgetColor, asWidgetColor } from './widgetTheme';
import type { AccountWidgetRow } from './data';

/**
 * "Accounts" — the 4×2 widget, a vertical echo of Home's own horizontal
 * account strip, top 3 accounts by creation order (the same order the
 * in-app strip uses). The busiest widget of the five, which is exactly why
 * it gets the plainest treatment (Apple's "defer to content" principle) —
 * no extra decoration beyond the same constellation mark every widget
 * carries. Opens the app on tap; there's no single accounts screen to deep
 * link past Home/Profile that's worth the extra route wiring here.
 */
export function AccountsWidget({ accounts }: { accounts: AccountWidgetRow[] }) {
  return (
    <WidgetShell clickAction="OPEN_APP">
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent' }}>
        <WidgetLabel text="ACCOUNTS" />
        <ConstellationDots accent={asWidgetColor(accounts[0]?.badgeColor ?? widgetColor.ink)} lit={[1, 5]} />
      </FlexWidget>
      <FlexWidget style={{ height: 9, width: 'match_parent' }} />
      {accounts.length === 0 ? (
        <TextWidget text="No accounts yet" style={{ fontSize: 12.5, color: widgetColor.textMuted }} />
      ) : (
        accounts.map((acc, i) => (
          <FlexWidget
            key={acc.name}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              width: 'match_parent',
              paddingTop: 7,
              paddingBottom: 7,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: widgetColor.borderSoft,
            }}
          >
            <FlexWidget
              style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: asWidgetColor(acc.badgeColor) }}
            />
            <FlexWidget style={{ width: 8, height: 'match_parent' }} />
            <FlexWidget style={{ flex: 1, width: 0 }}>
              <TextWidget
                text={acc.name}
                truncate="END"
                maxLines={1}
                style={{ fontSize: 12.5, fontWeight: '500', color: widgetColor.ink }}
              />
            </FlexWidget>
            <TextWidget
              text={acc.balanceText}
              style={{ fontSize: 12.5, fontWeight: '700', color: widgetColor.ink }}
            />
          </FlexWidget>
        ))
      )}
    </WidgetShell>
  );
}

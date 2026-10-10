import type React from 'react';
import { TextWidget } from 'react-native-android-widget';
import { getHideWidgetValues } from '@/db/settings';
import { WidgetShell, WidgetTitle } from './WidgetShell';
import { WIDGET_FONT, widgetColor } from './widgetTheme';
import { ThisMonthWidget } from './ThisMonthWidget';
import { QuickAddWidget } from './QuickAddWidget';
import { SuuWidget } from './SuuWidget';
import { NextDueWidget } from './NextDueWidget';
import { AccountsWidget } from './AccountsWidget';
import {
  getThisMonthWidgetData,
  getSuuWidgetData,
  getNextDueWidgetData,
  getAccountsWidgetData,
  getQuickAddWidgetData,
} from './data';

/** Must match `name` for each widget entry in app.json's config-plugin block. */
export const WIDGET_NAMES = ['ThisMonth', 'QuickAdd', 'Suu', 'NextDue', 'Accounts'] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

export function isWidgetName(name: string): name is WidgetName {
  return (WIDGET_NAMES as readonly string[]).includes(name);
}

/**
 * Fetches a widget's data and returns its rendered JSX; the one place `widgetTaskHandler` and `notifyWidgets`
 * build a widget from, so the two never drift apart.
 */
export async function renderWidgetByName(name: WidgetName): Promise<React.JSX.Element> {
  // Failure to read privacy must not reveal previously protected values.
  if (name !== 'QuickAdd' && (await getHideWidgetValues().catch(() => true))) {
    return (
      <WidgetShell clickAction="OPEN_APP" justifyContent="center">
        <WidgetTitle text="Yume" />
        <TextWidget
          text="Widget details hidden"
          style={{ fontFamily: WIDGET_FONT.bodyMedium, fontSize: 12, color: widgetColor.textMuted }}
        />
        <TextWidget
          text="Open Yume to view your finances"
          style={{ fontFamily: WIDGET_FONT.bodyMedium, fontSize: 11, color: widgetColor.textMuted }}
        />
      </WidgetShell>
    );
  }
  switch (name) {
    case 'ThisMonth':
      return <ThisMonthWidget {...await getThisMonthWidgetData()} />;
    case 'QuickAdd':
      return <QuickAddWidget {...await getQuickAddWidgetData()} />;
    case 'Suu':
      return <SuuWidget {...await getSuuWidgetData()} />;
    case 'NextDue':
      return <NextDueWidget data={await getNextDueWidgetData()} />;
    case 'Accounts':
      return <AccountsWidget {...await getAccountsWidgetData()} />;
  }
}

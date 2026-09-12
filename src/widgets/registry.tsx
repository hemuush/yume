import type React from 'react';
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
} from './data';

/** Must match `name` for each widget entry in app.json's config-plugin block. */
export const WIDGET_NAMES = ['ThisMonth', 'QuickAdd', 'Suu', 'NextDue', 'Accounts'] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

export function isWidgetName(name: string): name is WidgetName {
  return (WIDGET_NAMES as readonly string[]).includes(name);
}

/**
 * Fetches whatever data a given widget needs and returns its rendered JSX —
 * the one place both `widgetTaskHandler` (Android calling into a headless
 * JS context) and `notifyWidgets` (the app itself, nudging a refresh after
 * something changes) build a widget from, so the two never drift apart.
 */
export async function renderWidgetByName(name: WidgetName): Promise<React.JSX.Element> {
  switch (name) {
    case 'ThisMonth':
      return <ThisMonthWidget {...await getThisMonthWidgetData()} />;
    case 'QuickAdd':
      return <QuickAddWidget />;
    case 'Suu':
      return <SuuWidget {...await getSuuWidgetData()} />;
    case 'NextDue':
      return <NextDueWidget data={await getNextDueWidgetData()} />;
    case 'Accounts':
      return <AccountsWidget {...await getAccountsWidgetData()} />;
  }
}
